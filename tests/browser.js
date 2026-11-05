(async () => {
  const lines = [];
  let failed = 0;
  const equal = (actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  };
  const test = async (name, fn) => {
    try { await fn(); lines.push('PASS ' + name); }
    catch (e) { failed++; lines.push('FAIL ' + name + ': ' + (e.stack || e.message)); }
  };
  await test('support report excludes secrets and includes structural example only with consent', async () => {
    const secret = 'PRIVATE_TOKEN_TITLE_ACCOUNT_URL';
    const raw = { lang: 'fr', view: 'watch', prefs: { audioPrimary: 'fr-FR', audioSecondary: 'ja-JP', subLang: 'fr-FR', token: secret },
      notice: secret, error: secret, scope: secret, url: secret, progress: { done: 1, total: 4, token: secret },
      example: { title: secret, seriesId: secret, status: 'pending', error: secret,
        audios: { any: ['fr-FR', secret] }, pending: [{ id: secret, number: 187 }] } };
    const basic = BWLReport.snapshot(raw);
    equal('example' in basic, false);
    equal(JSON.stringify(basic).includes(secret), false);
    const extra = BWLReport.snapshot(raw, true);
    equal(extra.example.nextEpisode, 187);
    equal(extra.example.availableAudio, ['fr-FR', 'other']);
    equal(JSON.stringify(extra).includes(secret), false);
    equal(BWLReport.issueURL.includes('body='), false);
    const container = document.createElement('div'); document.body.append(container);
    let optedIn;
    BWLReport.mount(container, async consent => { optedIn = consent; return BWLReport.snapshot(raw, consent); });
    const buttons = container.querySelectorAll('button');
    buttons[0].click(); await new Promise(resolve => setTimeout(resolve, 0));
    equal(optedIn, false);
    equal(container.querySelector('textarea').value.includes(secret), false);
    const checkbox = container.querySelector('input'); checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change')); await new Promise(resolve => setTimeout(resolve, 0));
    equal(optedIn, true);
    equal(container.querySelector('textarea').value.includes('"nextEpisode": 187'), true);
    equal(container.querySelector('a').rel, 'noopener noreferrer');
    container.remove();
  });
  await test('encrypted reports authenticate edited Unicode text and watchlist sharing is explicit', async () => {
    const text = '## Rapport modifié\n日本語・Français 😄\n';
    const pair = {
      publicKey: await crypto.subtle.importKey('jwk', BWL_TEST_RSA.publicKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['wrapKey']),
      privateKey: await crypto.subtle.importKey('jwk', BWL_TEST_RSA.privateKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['unwrapKey']),
    };
    const bytes64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
    const from64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
    const config = { id: [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24), spki: bytes64(spki) };
    const encoded = await BWLReportCrypto.encrypt(text, config);
    equal(encoded.startsWith('BWL2:'), true);
    const envelope = JSON.parse(new TextDecoder().decode(from64(encoded.slice(5))));
    const aes = await crypto.subtle.unwrapKey('raw', from64(envelope.ek), pair.privateKey,
      { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const params = { name: 'AES-GCM', iv: from64(envelope.iv),
      additionalData: new TextEncoder().encode('BWL2:' + envelope.kid), tagLength: 128 };
    const compressed = await crypto.subtle.decrypt(params, aes, from64(envelope.ct));
    equal(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text(), text);
    const damaged = from64(envelope.ct); damaged[0] ^= 1;
    let rejected = false;
    try { await crypto.subtle.decrypt(params, aes, damaged); } catch { rejected = true; }
    equal(rejected, true);
    const first = await BWLReportCrypto.encrypt(text);
    equal(first !== await BWLReportCrypto.encrypt(text), true);
    equal(atob(first.slice(5)).includes('Rapport'), false);
    rejected = false;
    try { await BWLReportCrypto.encrypt('x'.repeat(2_000_001)); } catch { rejected = true; }
    equal(rejected, true);
    const secret = 'ACCOUNT_TOKEN_EMAIL_COOKIE';
    const raw = { results: [{ seriesId: 'G12345678', title: '作品の名前', status: 'pending',
      token: secret, login: secret, account_id: secret, error: secret, image: secret,
      pending: [{ id: 'E12345678', number: 42, season: 2, audio: 'fr-FR', token: secret, url: secret }] }],
      scope: secret, prefs: { hidden: ['G12345678'] } };
    equal('watchlist' in BWLReport.snapshot(raw), false);
    const report = BWLReport.snapshot(raw, false, true);
    equal(report.watchlist[0].title, '作品の名前');
    equal(report.watchlist[0].pending[0].number, 42);
    equal(report.watchlist[0].hidden, true);
    equal(JSON.stringify(report).includes(secret), false);
    const container = document.createElement('div'); document.body.append(container);
    const calls = [];
    BWLReport.mount(container, async (example, watchlist) => {
      calls.push([example, watchlist]); return BWLReport.snapshot(raw, example, watchlist);
    });
    container.querySelector('button').click(); await new Promise(resolve => setTimeout(resolve, 0));
    equal(calls[0], [false, false]);
    const listToggle = container.querySelectorAll('input')[1]; listToggle.checked = true;
    listToggle.dispatchEvent(new Event('change')); await new Promise(resolve => setTimeout(resolve, 0));
    equal(calls[1], [false, true]);
    equal(container.querySelector('textarea').value.includes('作品の名前'), true);
    container.remove();
  });
  await test('localized paths override .com and document language', () => {
    equal(BWL.language('https://www.crunchyroll.com/fr/watchlist', 'en'), 'fr');
    equal(BWL.language('https://www.crunchyroll.com/it/watchlist', 'fr'), 'en');
    equal(BWL.language('https://www.crunchyroll.fr/watchlist'), 'fr');
    equal(BWL.language('https://www.crunchyroll.com/watchlist'), 'en');
  });
  await test('only watchlist routes match', () => {
    equal(['/watchlist', '/fr/watchlist/', '/en-us/watchlist'].map(BWL.watchlist), [true, true, true]);
    equal(['/series/ABC', '/news/watchlist/foo', '/watchlist-other'].map(BWL.watchlist), [false, false, false]);
  });
  await test('classification prioritizes playable episodes over waits', () => {
    equal(BWL.category({ status: 'pending', pending: [{}], waitingDub: 2 }), 'watch');
    equal(BWL.category({ status: 'never', noDub: true }), 'start');
    equal(BWL.category({ status: 'uptodate', waitingDub: 1 }), 'dub');
    equal(BWL.category({ status: 'uptodate', waitingSub: 1 }), 'sub');
    equal(BWL.category({ status: 'uptodate' }), 'current');
    equal(BWL.category({ status: 'error' }), 'errors');
    equal(BWL.category({}), 'errors');
  });
  await test('thumbnail targets the next playable episode, skips extras, and resumes progress', () => {
    equal(BWL.playbackPath({ seriesId: 'S', pending: [{ id: 'OLD', skipped: true }, { id: 'OVA', extra: true }, { id: 'NEXT' }] }), '/watch/NEXT');
    equal(BWL.playbackPath({ seriesId: 'S', pending: [{ id: 'FIRST' }, { id: 'PARTIAL', inProgress: true }] }), '/watch/PARTIAL');
    equal(BWL.playbackPath({ seriesId: 'S', pending: [] }), '/series/S');
    equal(BWL.playbackPath({ seriesId: 'S', pending: [{ id: 'https://example.org' }] }), '/series/S');
  });
  await test('lists prioritize native favorites, sort within groups and put missing data last', () => {
    const rows = [
      { seriesId: 'A', title: 'A', favorite: false, lastReleaseAt: 900, rating: { average: 5 } },
      { seriesId: 'B', title: 'B', favorite: true, lastReleaseAt: 100, rating: { average: 4 } },
      { seriesId: 'C', title: 'C', favorite: true, lastReleaseAt: 200, rating: { average: 3 } },
      { seriesId: 'D', title: 'D', favorite: true },
    ];
    const defaults = BWL.listOptions(BWL.settings(), 'watch');
    equal(BWL.sortRows(rows, defaults).map(x => x.seriesId), ['C', 'B', 'D', 'A']);
    equal(BWL.sortRows(rows, { ...defaults, sort: 'rating' }).map(x => x.seriesId), ['B', 'C', 'D', 'A']);
    equal(BWL.sortRows(rows, { ...defaults, favoritesFirst: false }).map(x => x.seriesId), ['A', 'C', 'B', 'D']);
    equal(BWL.sortRows(rows, { ...defaults, onlyFavorites: true }).map(x => x.seriesId), ['C', 'B', 'D']);
    equal(rows[0].seriesId, 'A');
    const entries = CRAnalyzer.mergeSources([{ id: 'watchlist', items: [{ is_favorite: true,
      panel: { id: 'NATIVE', type: 'series', title: 'Native', rating: { average: '4.7', total: 10 } } }] }]);
    equal(entries[0].favorite, true); equal(entries[0].rating.average, 4.7);
  });
  await test('week boundary excludes past and dates beyond seven days', () => {
    equal(BWL.inWeek({ next: { at: 1001 } }, 1000), true);
    equal(BWL.inWeek({ next: { at: 1000 } }, 1000), false);
    equal(BWL.inWeek({ next: { at: 1001 + 7 * 86400000 } }, 1000), false);
  });
  await test('settings and translation key parity', () => {
    equal(BWL.settings().showDub, false);
    equal(BWL.settings({ hidden: [null, 'ABC'] }).hidden, ['ABC']);
    equal(Object.keys(CRI18n.messages.fr).sort(), Object.keys(CRI18n.messages.en).sort());
    equal(Object.keys(CRI18n.messages.ja).sort(), Object.keys(CRI18n.messages.en).sort());
    for (const [key, reference] of Object.entries(CRI18n.messages.en)) {
      const placeholders = value => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
      for (const language of ['fr', 'ja']) {
        const value = CRI18n.messages[language][key];
        equal(typeof value === 'string' && value.trim().length > 0, true);
        equal(placeholders(value), placeholders(reference));
      }
    }
    equal(CRI18n.lang(), 'en');
    CRI18n.setLanguage('unsupported'); equal(CRI18n.lang(), 'en');
  });
  await test('recent viewing uses actual history and excludes unknown or future dates', () => {
    const now = Date.now();
    equal(BWL.recentlyWatched({ lastWatchedAt: now - 2 * 86400000 }, 7, now), true);
    equal(BWL.recentlyWatched({ lastWatchedAt: now - 8 * 86400000 }, 7, now), false);
    equal(BWL.recentlyWatched({}, 30, now), false);
    equal(BWL.recentlyWatched({ lastWatchedAt: now + 1 }, 30, now), false);
    const history = CRAnalyzer.historyActivity({ entries: [
      { parent_id: 'SERIES', date_played: new Date(now - 86400000).toISOString(), playhead: 300 },
      { parent_id: 'SERIES', date_played: new Date(now - 2 * 86400000).toISOString(), fully_watched: true },
      { parent_id: 'ACCIDENTAL', date_played: new Date(now).toISOString(), playhead: 1 },
    ] }, {});
    equal(history.get('SERIES'), now - 86400000);
    equal(history.has('ACCIDENTAL'), false);
    equal(BWL.sortRows([{ title: 'Old', lastWatchedAt: now - 86400000 }, { title: 'Unknown' },
      { title: 'Recent', lastWatchedAt: now }], { sort: 'watched', favoritesFirst: false }).map(item => item.title), ['Recent', 'Old', 'Unknown']);
    equal(BWL.listOptions(BWL.settings({ lists: { watch: { sort: 'watched' } } }), 'watch').sort, 'watched');
    equal(BWL.sortRows([{ title: 'Recent', lastWatchedAt: now }, { title: 'Unknown' }],
      { watched: '7', favoritesFirst: true }).map(item => item.title), ['Recent']);
  });
  await test('list search ignores case and accents', () => {
    equal(BWL.matchesQuery('École des Héros', 'ECOLE'), true);
    equal(BWL.matchesQuery('Black Clover', ' clover '), true);
    equal(BWL.matchesQuery('Black Clover', 'Naruto'), false);
  });
  await test('manual refresh waits at least thirty seconds after completion', () => {
    equal(BWL.refreshDelay(31000, 1000), 30000);
    equal(BWL.refreshDelay(31000, 30999), 1);
    equal(BWL.refreshDelay(31000, 31000), 0);
    equal(BWL.refreshDelay(31000, 40000), 0);
  });
  await test('no session means no authenticated API request', async () => {
    let rejected = false;
    try { await CRApi.watchlist('en-US'); } catch { rejected = true; }
    equal(rejected, true);
  });
  await test('favorite writes use PATCH, accept empty success and reject server errors', async () => {
    const claims = { account_id: 'test-account', profile_id: 'test-profile', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = 'header.' + btoa(JSON.stringify(claims)).replace(/=/g, '') + '.signature';
    document.dispatchEvent(new CustomEvent('bwl:session', { detail: 'Bearer ' + token }));
    const originalFetch = window.fetch;
    let request;
    try {
      window.fetch = async (url, init) => { request = { url, init }; return new Response(null, { status: 204 }); };
      await CRApi.setFavorite('SERIES', true);
      equal(new URL(request.url).pathname, '/content/v2/test-account/watchlist/SERIES');
      equal(new URL(request.url).origin, location.origin);
      equal(request.init.method, 'PATCH');
      equal(JSON.parse(request.init.body), { is_favorite: true });
      window.fetch = async () => new Response(null, { status: 403 });
      let rejected = false;
      try { await CRApi.setFavorite('SERIES', false); } catch { rejected = true; }
      equal(rejected, true);
    } finally { window.fetch = originalFetch; }
  });
  await test('expired session keeps its identity and shares one renewal between requests', async () => {
    const originalFetch = window.fetch, originalNow = Date.now;
    const at = originalNow();
    const jwt = expires => 'header.' + btoa(JSON.stringify({ account_id: 'renew-account', profile_id: 'renew-profile', exp: expires })).replace(/=/g, '') + '.signature';
    document.dispatchEvent(new CustomEvent('bwl:session', { detail: 'Bearer ' + jwt(Math.floor(at / 1000) + 60) }));
    Date.now = () => at + 120000;
    let renewals = 0;
    try {
      equal(CRApi.scope(), 'renew-account:renew-profile');
      window.fetch = async (url, init) => {
        if (new URL(url).pathname === '/auth/v1/token') {
          renewals++;
          return new Response(JSON.stringify({ access_token: jwt(Math.floor(Date.now() / 1000) + 3600) }), { status: 200 });
        }
        equal(init.headers.Authorization.startsWith('Bearer '), true);
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      };
      await Promise.all([CRApi.seasons('A', 'en-US'), CRApi.seasons('B', 'en-US')]);
      equal(renewals, 1);
      window.fetch = async () => new Response(null, { status: 401 });
      let paused = false;
      try { await CRApi.ensureSession(true); } catch (error) { paused = error.code === 'BWL_SESSION'; }
      equal(paused, true);
      equal(CRApi.scope(), 'renew-account:renew-profile');
    } finally { window.fetch = originalFetch; Date.now = originalNow; }
  });
  await test('synopsis only accepts a matching series and never an episode description', async () => {
    const originalFetch = window.fetch;
    try {
      window.fetch = async () => new Response(JSON.stringify({ data: [
        { id: 'SERIES', type: 'episode', description: 'Episode spoiler' },
        { id: 'OTHER', type: 'series', description: 'Wrong series' },
        { id: 'SERIES', type: 'series', description: 'General series overview' },
      ] }), { status: 200 });
      equal(await CRApi.synopsis('SERIES', 'en-US'), 'General series overview');
      window.fetch = async () => new Response(JSON.stringify({ data: [
        { id: 'SERIES', type: 'episode', description: 'Episode spoiler' },
      ] }), { status: 200 });
      equal(await CRApi.synopsis('SERIES', 'en-US'), '');
    } finally { window.fetch = originalFetch; }
    const records = {};
    const storage = { get: async key => ({ [key]: records[key] }), set: async value => Object.assign(records, value) };
    let calls = 0;
    const api = { synopsis: async () => { calls++; return 'Series overview'; } };
    await Promise.all([BWL.synopsis.load(storage, api, 'P1', 'en-US', 'S'), BWL.synopsis.load(storage, api, 'P1', 'en-US', 'S')]);
    equal(calls, 1);
    BWL.synopsis.clear();
    equal(await BWL.synopsis.load(storage, api, 'P1', 'en-US', 'S'), 'Series overview');
    equal(calls, 1);
    await BWL.synopsis.load(storage, api, 'P2', 'en-US', 'S');
    equal(calls, 2);
  });
  await test('analyzer preserves progress for original Korean audio', async () => {
    const originalApi = CRApi;
    let progress = new Map();
    const episodes = [{ id: 'E1', title: 'One', episode_number: 1, sequence_number: 1,
      audio_locale: 'ko-KR', subtitle_locales: ['fr-FR'], duration_ms: 1200000,
      episode_air_date: '2020-01-01T00:00:00Z', is_premium_only: false }];
    CRApi = { getAccountId: async () => 'test', getProfileId: async () => 'profile',
      seasons: async () => [{ id: 'S1', season_number: 1, audio_locale: 'ko-KR',
        versions: [{ guid: 'S1', audio_locale: 'ko-KR', original: true }] }],
      episodes: async () => episodes, playheads: async () => progress };
    const config = { locale: 'fr-FR', subLang: 'fr-FR', dubLang: 'fr-FR', defaultMode: 'sub', seriesModes: {}, showSkipped: true };
    const entry = { seriesId: 'SERIES', title: 'Example' };
    try {
      const never = await CRAnalyzer.runOne(entry, config);
      equal(never.status, 'never');
      equal(never.startEpisode.number, '1');
      equal(BWL.playbackPath(never), '/watch/E1');
      progress = new Map([['E1', { playhead: 300, fully_watched: false }]]);
      equal((await CRAnalyzer.runOne(entry, config)).status, 'pending');
      progress = new Map([['E1', { playhead: 1200, fully_watched: true }]]);
      equal((await CRAnalyzer.runOne(entry, config)).status, 'uptodate');
      episodes.push({ ...episodes[0], id: 'E2', episode_number: 2, sequence_number: 2 });
      const dub = await CRAnalyzer.runOne(entry, { ...config, defaultMode: 'dub' });
      equal(dub.noDub, true);
      equal(BWL.category(dub), 'dub');
      episodes[1].subtitle_locales = ['en-US'];
      const sub = await CRAnalyzer.runOne(entry, config);
      equal(sub.waitingSub > 0, true);
      equal(BWL.category(sub), 'sub');
    } finally { CRApi = originalApi; }
  });
  await test('ordered audio chooses secondary now, primary when available, and waits if neither exists', async () => {
    const episode = (id, number, audio, future = false) => ({ id, episode_number: number,
      sequence_number: number, audio_locale: audio, duration_ms: 1200000,
      subtitle_locales: ['fr-FR'], availability_starts: future ? '2999-01-01T00:00:00Z' : '2020-01-01T00:00:00Z' });
    const originals = [1,2,3,4].map(n => episode('KO' + n, n, 'ko-KR'));
    const english = [episode('EN2', 2, 'en-US', true), episode('EN3', 3, 'en-US')];
    const french = [episode('FR2', 2, 'fr-FR'), episode('FR3', 3, 'fr-FR')];
    const api = {
      seasons: async () => [{ id: 'KO', season_number: 1, audio_locale: 'ko-KR', versions: [
        { guid: 'KO', audio_locale: 'ko-KR', original: true }, { guid: 'EN', audio_locale: 'en-US' }, { guid: 'FR', audio_locale: 'fr-FR' } ] }],
      episodes: async id => ({ KO: originals, EN: english, FR: french })[id],
      playheads: async () => new Map([['KO1', { fully_watched: true, playhead: 1200 }]]),
    };
    const result = await CRAnalyzer.analyzeEntry({ seriesId: 'S', title: 'Audio test' }, 'preferred', {
      preferredAudio: ['en-US','fr-FR'], subLang: 'fr-FR', locale: 'en-US', showExtras: false,
    }, api);
    equal(result.pending.map(ep => ep.id), ['FR2','EN3']);
    equal(result.waitingDub, 1);
    equal(result.pending.map(ep => ep.audio), ['fr-FR','en-US']);
    const prefs = BWL.settings({ audioPrimary: 'en-US', audioSecondary: 'fr-FR' });
    equal(BWL.audioPreferences(prefs, 'S'), ['en-US','fr-FR']);
    equal(BWL.settings({ audioPrimary: 'ja-JP', audioSecondary: 'ja-JP' }).audioSecondary, 'en-US');
  });
  await test('analysis publishes partial results and times out a stalled series', async () => {
    const progress = [];
    const rows = await BWL.analyzeEntries([{ seriesId: 'slow' }, { seriesId: 'fast' }],
      BWL.settings(), {}, { withSignal: signal => ({ signal }) }, {
        analyzeEntry: async entry => entry.seriesId === 'slow' ? new Promise(() => {}) : { ...entry, status: 'uptodate' },
      }, { signal: new AbortController().signal, timeout: 50,
        onProgress: (items, done, total) => progress.push({ ids: items.map(x => x.seriesId), done, total }) });
    equal(progress[1].ids, ['fast']);
    equal(progress.at(-1).done, 2);
    equal(rows[0].status, 'error');
    equal(rows[1].status, 'uptodate');
  });
  await test('cancel stops stalled analysis without publishing late results', async () => {
    const controller = new AbortController();
    let calls = 0;
    const work = BWL.analyzeEntries([{ seriesId: 'slow' }], BWL.settings(), {},
      { withSignal: signal => ({ signal }) }, { analyzeEntry: () => new Promise(() => {}) },
      { signal: controller.signal, onProgress: () => calls++ });
    controller.abort();
    let cancelled = false;
    try { await work; } catch (error) { cancelled = error.name === 'AbortError'; }
    equal(cancelled, true);
    equal(calls, 1);
  });
  await test('cache restores snapshots, isolates profiles/settings and expires without storing tokens', async () => {
    const values = {};
    const storage = { get: async key => ({ [key]: values[key] }), set: async value => Object.assign(values, value) };
    const prefs = BWL.settings();
    const fingerprint = BWL.cache.signature(prefs, 'fr-FR');
    const at = 1000000;
    await BWL.cache.write(storage, 'profile-A', fingerprint, [{ seriesId: 'ONE', title: 'Anime',
      status: 'pending', favorite: true, rating: { average: 4.7, total: 10 }, lastReleaseAt: 999,
      pending: [{ id: 'EP1', inProgress: true, token: 'secret' }], token: 'secret', pendingRaw: 'secret' }], at);
    const cached = await BWL.cache.read(storage, 'profile-A', fingerprint, at + 1);
    equal(cached.items[0].pending.length, 1);
    equal(BWL.playbackPath(cached.items[0]), '/watch/EP1');
    equal(cached.items[0].favorite, true);
    equal(cached.items[0].rating.average, 4.7);
    equal(cached.items[0].lastReleaseAt, 999);
    await BWL.cache.updateFavorite(storage, 'profile-A', 'ONE', false);
    const changed = await BWL.cache.read(storage, 'profile-A', fingerprint, at + 1);
    equal(changed.items[0].favorite, false); equal(changed.at, at);
    equal(cached.fresh, true);
    equal(JSON.stringify(values).includes('secret'), false);
    equal(await BWL.cache.read(storage, 'profile-B', fingerprint, at + 1), null);
    equal(await BWL.cache.read(storage, 'profile-A', BWL.cache.signature({ ...prefs, audioPrimary: 'en-US' }, 'fr-FR'), at + 1), null);
    equal((await BWL.cache.read(storage, 'profile-A', fingerprint, at + 6 * 60000)).fresh, false);
    equal(await BWL.cache.read(storage, 'profile-A', fingerprint, at + 8 * 86400000), null);
    equal(await BWL.cache.write({ set: async () => { throw new Error('quota'); } }, 'A', fingerprint, []), false);
    await BWL.cache.write(storage, 'profile-A', fingerprint, [{ seriesId: 'FAIL', status: 'error' }], at);
    equal((await BWL.cache.read(storage, 'profile-A', fingerprint, at + 1)).fresh, false);
    await BWL.cache.write(storage, 'profile-A', fingerprint, [{ seriesId: 'OK', status: 'uptodate', checkedAt: at, pending: [] }], at + 100, 2);
    const partial = await BWL.cache.read(storage, 'profile-A', fingerprint, at + 101);
    equal(partial.complete, false);
    equal(BWL.cache.reusable(partial, at + 101).map(item => item.seriesId), ['OK']);
    equal(BWL.cache.reusable(partial, at + 6 * 60000).length, 0);
  });
  await test('reserved space moves positioned page content and follows panel height without accumulation', () => {
    const fixture = document.createElement('div');
    fixture.style.cssText = 'position:relative;min-height:800px';
    const banner = document.createElement('header'); banner.textContent = 'Crunchyroll';
    const host = document.createElement('div'); host.id = 'bwl-panel'; host.style.height = '100px';
    const content = document.createElement('div');
    content.style.cssText = 'position:absolute;top:0;margin-top:7px!important';
    const title = document.createElement('h1'); title.textContent = 'Mes listes'; content.append(title);
    fixture.append(banner, host, content); document.body.append(fixture);
    const spacing = BWL.reserveSpace(host, document);
    try {
      spacing.update();
      equal(content.getBoundingClientRect().top >= host.getBoundingClientRect().bottom + 24, true);
      const firstMargin = content.style.marginTop;
      spacing.update(); spacing.update();
      equal(content.style.marginTop, firstMargin);
      host.style.height = '300px'; spacing.update();
      equal(content.getBoundingClientRect().top >= host.getBoundingClientRect().bottom + 24, true);
      host.style.height = '50px'; spacing.update();
      equal(content.getBoundingClientRect().top >= host.getBoundingClientRect().bottom + 24, true);
      spacing.cleanup();
      equal(content.style.marginTop, '7px');
      equal(content.style.getPropertyPriority('margin-top'), 'important');
    } finally { spacing.cleanup(); fixture.remove(); }
  });
  await test('integrated panel mounts once, keeps native content, hides/restores and cleans up', async () => {
    const originalApi = CRApi, originalAnalyzer = CRAnalyzer;
    const originalRefreshDelay = BWL.refreshDelay;
    const stored = {};
    globalThis.chrome = { storage: { local: {
      get: async key => ({ [key]: stored[key] }), set: async value => Object.assign(stored, value),
    } } };
    let favoriteFail = false, favoriteCalls = 0;
    const watchedAt = Date.now() - 2 * 86400000;
    CRApi = { synopsis: async () => 'Series overview without episode details', scope: () => 'fixture:profile', withSignal: () => ({ watchHistory: async () => ({ complete: true,
      entries: [{ parent_id: 'TEST', date_played: new Date(watchedAt).toISOString(), fully_watched: true }] }) }), setFavorite: async () => {
      favoriteCalls++;
      if (favoriteFail) throw new Error('HTTP 403');
    } };
    let sourceReads = 0, finishInitial, authFail = false;
    let analysisGate = new Promise(resolve => { finishInitial = resolve; });
    CRAnalyzer = { historyActivity: originalAnalyzer.historyActivity,
      readSources: async () => { sourceReads++; if (authFail) { const error = new Error('session'); error.code = 'BWL_SESSION'; throw error; } return []; }, mergeSources: () => [{ seriesId: 'TEST', title: 'Fixture anime' }],
      analyzeEntry: async entry => { if (analysisGate) await analysisGate; return { ...entry, status: 'pending', pending: [{ id: 'EPISODE187', number: '187' }] }; } };
    const attach = Element.prototype.attachShadow;
    let panel;
    Element.prototype.attachShadow = function(options) { panel = attach.call(this, options); return panel; };
    const main = document.createElement('main');
    const native = document.createElement('p'); native.textContent = 'Native list'; main.append(native); document.body.append(main);
    history.replaceState({}, '', '/watchlist');
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = '/extension/src/content.js';
        script.onload = resolve; script.onerror = reject; document.body.append(script);
      });
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('.placeholder-card').length, 4);
      equal(panel.querySelectorAll('[data-action="analysis"]').length, 1);
      equal(panel.querySelector('[data-action="analysis"]').hidden, true);
      equal(panel.querySelector('.view-title').textContent, CRI18n.t('watch'));
      equal(panel.querySelector('[data-view="hidden"]').hidden, true);
      equal(panel.querySelector('[data-view="errors"]').hidden, true);
      panel.querySelector('[data-view="start"]').click();
      equal(panel.querySelector('.view-title').textContent, CRI18n.t('start'));
      equal(panel.querySelectorAll('.placeholder-card').length, 4);
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('watch')).click();
      finishInitial(); analysisGate = null;
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('.placeholder-card').length, 0);
      equal(document.querySelectorAll('#bwl-panel').length, 1);
      equal(main.contains(native), true);
      equal(panel.querySelectorAll('article').length, 1);
      const guardedRefresh = panel.querySelector('[data-action="analysis"]');
      equal(guardedRefresh.hidden, false);
      equal(guardedRefresh.disabled, true);
      const beforeCooldownClick = sourceReads;
      guardedRefresh.click();
      equal(sourceReads, beforeCooldownClick);
      // Timing policy has its own boundary test; keep unrelated UI tests fast.
      BWL.refreshDelay = () => 0;
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('watch')).click();
      main.style.fontFamily = 'Arial, sans-serif';
      equal(getComputedStyle(document.querySelector('#bwl-panel')).fontFamily, getComputedStyle(main).fontFamily);
      equal(getComputedStyle(panel.querySelector('select')).fontFamily, getComputedStyle(main).fontFamily);
      equal(getComputedStyle(panel.querySelector('button')).fontFamily, getComputedStyle(main).fontFamily);
      main.style.removeProperty('font-family');
      main.style.width = '1180px';
      const toolbar = panel.querySelector('.filters');
      equal(toolbar.getBoundingClientRect().height < 60, true);
      const controlRows = [...toolbar.querySelectorAll('select, input[type="search"]')].map(node => Math.round(node.getBoundingClientRect().bottom));
      equal(Math.max(...controlRows) - Math.min(...controlRows) < 3, true);
      main.style.width = '360px';
      for (const control of toolbar.querySelectorAll('select, input')) {
        const bounds = control.getBoundingClientRect(), area = toolbar.getBoundingClientRect();
        equal(bounds.left >= area.left - 1 && bounds.right <= area.right + 1, true);
      }
      main.style.removeProperty('width');
      const toggleCards = panel.querySelector('.toggle-cards');
      const expandedHeight = document.querySelector('#bwl-panel').getBoundingClientRect().height;
      toggleCards.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(panel.querySelector('#bwl-cards').hidden, true);
      equal(toggleCards.getAttribute('aria-expanded'), 'false');
      equal(document.querySelector('#bwl-panel').getBoundingClientRect().height < expandedHeight, true);
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('refresh')).click();
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelector('#bwl-cards').hidden, true);
      equal(stored['bwl:prefs:fixture:profile'].cardsCollapsed, true);
      panel.querySelector('.toggle-cards').click();
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(panel.querySelector('#bwl-cards').hidden, false);
      equal(panel.querySelectorAll('article').length, 1);
      panel.querySelector('.favorite').click();
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(panel.querySelector('.favorite').getAttribute('aria-pressed'), 'true');
      const favoriteConfirm = window.confirm;
      const callsBeforeCancel = favoriteCalls;
      window.confirm = () => false;
      panel.querySelector('.favorite').click();
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(favoriteCalls, callsBeforeCancel);
      equal(panel.querySelector('.favorite').getAttribute('aria-pressed'), 'true');
      let removalPrompt = '';
      window.confirm = message => { removalPrompt = message; return true; };
      favoriteFail = true;
      panel.querySelector('.favorite').click();
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(panel.querySelector('.favorite').getAttribute('aria-pressed'), 'true');
      equal(removalPrompt.includes('Fixture anime'), true);
      equal(favoriteCalls, callsBeforeCancel + 1);
      favoriteFail = false;
      panel.querySelector('.favorite').click();
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(panel.querySelector('.favorite').getAttribute('aria-pressed'), 'false');
      window.confirm = favoriteConfirm;
      const anime = panel.querySelector('article');
      equal(anime.querySelector('.episode-link').textContent, CRI18n.t('continueEpisode').replace('{number}', '187'));
      equal(new URL(anime.querySelector('.episode-link').href).pathname, '/watch/EPISODE187');
      anime.dispatchEvent(new Event('pointerenter'));
      await new Promise(resolve => setTimeout(resolve, 10));
      equal(anime.querySelector('a').title, 'Series overview without episode details');
      const animeRect = anime.getBoundingClientRect();
      const heartRect = anime.querySelector('.favorite').getBoundingClientRect();
      const actionsRect = anime.querySelector('.card-actions').getBoundingClientRect();
      equal(animeRect.right - heartRect.right < 20 && heartRect.right <= animeRect.right, true);
      equal(animeRect.bottom - actionsRect.bottom < 20 && actionsRect.bottom <= animeRect.bottom, true);
      equal([...anime.querySelectorAll('p')].some(node => node.textContent === CRI18n.t('remaining_one').replace('{count}', '1')), true);
      equal(anime.querySelector('.last-watched').textContent, CRI18n.t('watchedMany').replace('{count}', '2'));
      const gear = anime.querySelector('button[aria-controls]');
      const options = anime.querySelector('select').closest('div');
      equal(options.hidden, true);
      equal(gear.getAttribute('aria-expanded'), 'false');
      gear.click();
      equal(options.hidden, false);
      equal(gear.getAttribute('aria-expanded'), 'true');
      const menuRect = anime.querySelector('select').getBoundingClientRect();
      const cardRect = anime.getBoundingClientRect();
      equal(menuRect.left >= cardRect.left && menuRect.right <= cardRect.right, true);
      gear.click();
      equal(options.hidden, true);
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('settings')).click();
      const initialAudio = [...panel.querySelectorAll('select')].slice(1).map(node => node.value);
      equal([...panel.querySelectorAll('input[type="checkbox"]')].filter(node => !node.closest('.support-report')).length, 0);
      equal(panel.querySelector('.support-report input').checked, false);
      const audioControls = panel.querySelectorAll('select');
      equal(audioControls[1].closest('label').textContent.startsWith(CRI18n.t('primaryAudio')), true);
      equal(audioControls[2].closest('label').textContent.startsWith(CRI18n.t('secondaryAudio')), true);
      equal([...audioControls[1].options].map(option => option.value), [...audioControls[2].options].map(option => option.value));
      equal(audioControls[1].value !== audioControls[2].value, true);
      for (const language of ['ja', 'fr', 'en']) {
        const choice = panel.querySelector('select');
        choice.value = language; choice.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        equal(stored['bwl:uiLanguage'], language);
        equal(panel.querySelector('h2').textContent, CRI18n.messages[language].title);
        equal([...panel.querySelectorAll('select')].slice(1).map(node => node.value), initialAudio);
      }
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('search')).click();
      const search = panel.querySelector('input[type="search"]');
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('refresh')).click();
      search.focus(); search.value = 'Fixt';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.setSelectionRange(1, 3);
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelector('input[type="search"]') === search, true);
      equal(panel.activeElement === search, true);
      equal([search.selectionStart, search.selectionEnd], [1, 3]);
      equal(search.value, 'Fixt');
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('watch')).click();
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('refresh')).click();
      const sortMenu = panel.querySelectorAll('.filters select')[1];
      sortMenu.focus(); sortMenu.value = 'rating'; sortMenu.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('.filters select')[1] === sortMenu, true);
      equal(panel.activeElement === sortMenu, true);
      equal(sortMenu.value, 'rating');
      sortMenu.blur();
      const listSearch = panel.querySelector('.list-search input');
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('refresh')).click();
      listSearch.focus(); listSearch.value = 'missing-title';
      listSearch.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelector('.list-search input') === listSearch, true);
      equal(panel.activeElement === listSearch, true);
      equal(panel.querySelectorAll('article').length, 0);
      equal(panel.querySelector('.empty-state').textContent, CRI18n.t('noMatches'));
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('start')).click();
      equal(panel.querySelectorAll('.filters select').length, 2);
      equal(panel.querySelector('.list-search input').value, '');
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('watch')).click();
      equal(panel.querySelector('.list-search input').value, 'missing-title');
      panel.querySelector('.list-search input').value = '';
      panel.querySelector('.list-search input').dispatchEvent(new Event('input'));
      equal(panel.querySelectorAll('article').length, 1);
      panel.querySelector('article button[aria-controls]').click();
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('refresh')).click();
      const audioMenu = panel.querySelector('article select');
      audioMenu.focus();
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelector('article select') === audioMenu, true);
      equal(panel.activeElement === audioMenu, true);
      audioMenu.blur();
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('settings')).click();
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('refresh')).click();
      const settingsMenu = panel.querySelectorAll('select')[1];
      settingsMenu.focus();
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('select')[1] === settingsMenu, true);
      equal(panel.activeElement === settingsMenu, true);
      settingsMenu.blur();
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('watch')).click();
      const banner = document.createElement('header'); banner.textContent = 'Crunchyroll'; main.prepend(banner);
      const grid = document.createElement('div');
      grid.style.cssText = 'position:relative;height:150px';
      const hostileStyle = document.createElement('style');
      hostileStyle.textContent = 'section { position:absolute; top:0; height:0; }';
      main.append(hostileStyle);
      for (const id of ['ONE', 'TWO']) {
        const card = document.createElement('article');
        card.style.cssText = 'position:absolute;top:0;height:100px';
        const link = document.createElement('a'); link.href = '/series/' + id;
        link.append(document.createElement('img')); card.append(link);
        // Simulate separate thumbnail/title image links inside the same card.
        card.append(link.cloneNode(true)); grid.append(card);
      }
      main.append(grid);
      const originalPanel = document.querySelector('#bwl-panel');
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(banner.nextElementSibling === originalPanel, true);
      equal(originalPanel.nextElementSibling === native, true);
      equal(main.firstElementChild === banner, true);
      equal(document.querySelectorAll('#bwl-panel').length, 1);
      equal(originalPanel.getBoundingClientRect().height > 0, true);
      equal(originalPanel.getBoundingClientRect().bottom <= grid.getBoundingClientRect().top, true);
      const tabs = document.createElement('nav');
      for (const name of ['Watchlist', 'Crunchylists', 'Historique']) {
        const tab = document.createElement('button'); tab.textContent = name; tabs.append(tab);
      }
      const clippedTabs = document.createElement('div');
      clippedTabs.style.cssText = 'height:40px;overflow:hidden';
      clippedTabs.append(tabs);
      main.insertBefore(clippedTabs, grid);
      equal(BWL.tabsAnchor(document) === clippedTabs, true);
      const activity = document.createElement('h2'); activity.textContent = 'Activité récente';
      main.insertBefore(activity, grid);
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(clippedTabs.nextElementSibling === originalPanel, true);
      equal(originalPanel.nextElementSibling === activity, true);
      equal(clippedTabs.contains(originalPanel), false);
      equal(BWL.layoutReport(originalPanel, document).placement, 'activity');
      equal(activity.getBoundingClientRect().top >= originalPanel.getBoundingClientRect().bottom, true);
      equal(document.querySelectorAll('#bwl-panel').length, 1);
      hostileStyle.remove();
      grid.remove();
      const hide = panel.querySelector('.visibility[data-hidden="false"]');
      equal(hide.title, CRI18n.t('hideTip'));
      const originalConfirm = window.confirm;
      window.confirm = () => false;
      hide.click(); await new Promise(resolve => setTimeout(resolve, 10));
      equal(stored['bwl:prefs:fixture:profile']?.hidden || [], []);
      let confirmText = '';
      window.confirm = text => { confirmText = text; return true; };
      hide.click(); await new Promise(resolve => setTimeout(resolve, 10));
      window.confirm = originalConfirm;
      equal(confirmText.includes('Fixture anime'), true);
      equal(stored['bwl:prefs:fixture:profile'].hidden, ['TEST']);
      const hiddenTab = [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('hidden') + ' (1)');
      equal(Boolean(hiddenTab), true);
      equal(hiddenTab.hidden, false);
      equal(panel.querySelectorAll('details').length, 0);
      hiddenTab.click();
      equal(panel.querySelectorAll('article').length, 1);
      const restore = panel.querySelector('.visibility[data-hidden="true"]');
      equal(restore.title, CRI18n.t('showTip'));
      equal(getComputedStyle(restore.querySelector('.hover-icon')).display, 'none');
      restore.focus();
      equal(getComputedStyle(restore.querySelector('.rest-icon')).display, 'none');
      equal(getComputedStyle(restore.querySelector('.hover-icon')).display, 'inline');
      restore.click(); await new Promise(resolve => setTimeout(resolve, 10));
      equal(stored['bwl:prefs:fixture:profile'].hidden, []);
      equal(panel.querySelector('.view-title').textContent, CRI18n.t('watch'));
      equal(panel.querySelector('[data-view="hidden"]').hidden, true);
      equal(panel.querySelectorAll('article').length, 1);
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(document.querySelectorAll('#bwl-panel').length, 1);
      history.replaceState({}, '', '/series/TEST');
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(document.querySelectorAll('#bwl-panel').length, 0);
      equal(main.contains(native), true);
      const readsBeforeReopen = sourceReads;
      history.replaceState({}, '', '/watchlist');
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(sourceReads, readsBeforeReopen);
      equal(panel.querySelector('[role="status"]').textContent.includes(CRI18n.t('cached')), true);
      [...panel.querySelectorAll('nav button')].find(x => x.textContent === CRI18n.t('watch')).click();
      const snapshot = stored['bwl:results:fixture:profile'];
      snapshot.at -= 6 * 60000;
      for (const item of snapshot.items) item.checkedAt -= 6 * 60000;
      let finishAnalysis;
      analysisGate = new Promise(resolve => { finishAnalysis = resolve; });
      document.dispatchEvent(new Event('bwl:profile'));
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('article').length, 1);
      equal(panel.querySelector('[role="status"]').textContent.includes(CRI18n.t('backgroundRefresh')), true);
      equal(panel.querySelector('[role="status"]').textContent.includes(CRI18n.t('loading')), false);
      const analysisButton = panel.querySelector('[data-action="analysis"]');
      equal(analysisButton.hidden, true);
      equal(analysisButton.disabled, true);
      finishAnalysis(); analysisGate = null;
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelector('[role="status"]').textContent.includes(CRI18n.t('complete')), true);
      authFail = true;
      panel.querySelector('[data-action="analysis"]').click();
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('article').length, 1);
      equal(panel.querySelector('[role="status"]').textContent, CRI18n.t('sessionPaused'));
      authFail = false;
      document.dispatchEvent(new Event('bwl:session-ready'));
      await new Promise(resolve => setTimeout(resolve, 30));
      equal(panel.querySelectorAll('article').length, 1);
      equal(panel.querySelector('[role="status"]').textContent.includes(CRI18n.t('sessionPaused')), false);
      history.replaceState({}, '', '/series/TEST');
      await new Promise(resolve => setTimeout(resolve, 1100));
      main.remove();
      history.replaceState({}, '', '/fr/watchlist');
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(document.querySelectorAll('#bwl-panel').length, 1);
      equal(document.querySelector('#bwl-panel').parentNode === document.body, true);
      history.replaceState({}, '', '/series/TEST');
      await new Promise(resolve => setTimeout(resolve, 1100));
      equal(document.querySelectorAll('#bwl-panel').length, 0);
    } finally {
      Element.prototype.attachShadow = attach;
      CRApi = originalApi; CRAnalyzer = originalAnalyzer;
      BWL.refreshDelay = originalRefreshDelay;
      main.remove();
    }
  });
  document.querySelector('#results').textContent = (failed ? 'FAILED' : 'PASSED') + '\n' + lines.join('\n');
})();
