/* Explicit allowlist: never serialize API responses, DOM, errors or storage. */
var BWLReport = (() => {
  const issueURL = 'https://github.com/CryptoLogiq/crunchyroll-best-watchlist/issues/new?template=bug_report.md';
  const choice = (value, allowed, fallback = 'unknown') => allowed.includes(value) ? value : fallback;
  const count = value => Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null;
  const language = value => typeof value === 'string' && BWL.audioLanguages.includes(value) ? value : 'other';
  function environment(ua = navigator.userAgent) {
    const match = /(?:Firefox|Edg|Chrome)\/(\d{1,4})\b/.exec(ua);
    return match ? { browser: match[0].split('/')[0], major: Number(match[1]) } : { browser: 'other', major: null };
  }
  function snapshot(raw = {}, includeExample = false, includeWatchlist = false) {
    const options = BWL.listOptions(raw.prefs || {}, raw.view);
    const data = {
      schema: 2, extension: '0.5.9', environment: environment(),
      interface: choice(raw.lang, ['en', 'fr', 'ja']),
      view: choice(raw.view, ['watch', 'start', 'current', 'dub', 'sub', 'week', 'recent', 'hidden', 'errors', 'search', 'settings']),
      preferences: { primary: language(raw.prefs?.audioPrimary), secondary: language(raw.prefs?.audioSecondary),
        subtitles: language(raw.prefs?.subLang), sort: options.sort, favoritesFirst: options.favoritesFirst,
        onlyFavorites: options.onlyFavorites, watched: options.watched },
      analysis: { busy: raw.busy === true, background: raw.background === true,
        state: choice(raw.cacheState, ['none', 'forced', 'miss', 'fresh', 'stale', 'partial']),
        sessionPaused: raw.sessionPaused === true, mounted: raw.mounted === true,
        done: count(raw.progress?.done), total: count(raw.progress?.total),
        errors: count(raw.errorCount) },
    };
    if (includeExample && raw.example) {
      const item = raw.example;
      data.example = { status: choice(item.status, ['never', 'pending', 'uptodate', 'error']),
        waitingDub: count(item.waitingDub), waitingSub: count(item.waitingSub),
        pendingCount: Array.isArray(item.pending) ? count(item.pending.length) : null,
        // Only structural playback information, never an episode ID or exact viewing date.
        nextEpisode: count(BWL.playbackEpisode(item)?.number),
        availableAudio: Array.isArray(item.audios?.any)
          ? [...new Set(item.audios.any.map(language))].slice(0, 30) : [] };
    }
    if (includeWatchlist && Array.isArray(raw.results)) {
      const publicId = value => typeof value === 'string' && /^[A-Z0-9]{6,20}$/.test(value) ? value : null;
      const episode = ep => ({ id: publicId(ep?.id), number: count(ep?.number), season: count(ep?.season),
        audio: language(ep?.audio), inProgress: ep?.inProgress === true });
      data.watchlist = raw.results.slice(0, 2000).map(item => ({
        seriesId: publicId(item.seriesId),
        title: typeof item.title === 'string' ? item.title.slice(0, 300) : '',
        status: choice(item.status, ['never', 'pending', 'uptodate', 'error']),
        category: choice(BWL.category(item), ['watch', 'start', 'current', 'dub', 'sub', 'errors']),
        favorite: item.favorite === true,
        hidden: Array.isArray(raw.prefs?.hidden) && raw.prefs.hidden.includes(item.seriesId),
        waitingDub: count(item.waitingDub), waitingSub: count(item.waitingSub),
        availableAudio: Array.isArray(item.audios?.any) ? [...new Set(item.audios.any.map(language))].slice(0, 30) : [],
        pending: Array.isArray(item.pending) ? item.pending.slice(0, 2000).map(episode) : [],
        nextEpisode: BWL.playbackEpisode(item) ? episode(BWL.playbackEpisode(item)) : null,
      }));
      data.watchlistTruncated = raw.results.length > 2000 || raw.results.some(item => item.pending?.length > 2000);
    }
    return data;
  }
  function mount(parent, getSnapshot) {
    const t = key => CRI18n.t(key);
    const node = (tag, text, container = parent) => {
      const element = document.createElement(tag);
      if (text) element.textContent = text;
      container.append(element); return element;
    };
    const section = node('details'); section.className = 'support-report';
    node('summary', t('reportProblem'), section);
    node('p', t('reportPrivacy'), section);
    const label = node('label', '', section);
    const example = node('input', '', label); example.type = 'checkbox';
    label.append(document.createTextNode(t('reportExample')));
    const listLabel = node('label', '', section);
    const watchlist = node('input', '', listLabel); watchlist.type = 'checkbox';
    listLabel.append(document.createTextNode(t('reportWatchlist')));
    node('p', t('reportEncodingHelp'), section);
    const preview = node('textarea', '', section); preview.rows = 14;
    preview.setAttribute('aria-label', t('reportPreview'));
    preview.style.cssText = 'display:block;box-sizing:border-box;width:100%;max-width:100%;margin:8px 0';
    const status = node('p', '', section); status.setAttribute('role', 'status');
    const prepare = node('button', t('reportPrepare'), section); prepare.type = 'button';
    let revision = 0;
    async function generate() {
      prepare.disabled = true; encodedCopy.disabled = true;
      const generation = ++revision;
      try {
        const report = await getSnapshot(example.checked, watchlist.checked);
        if (generation !== revision) return;
        preview.value = '## Technical report\n```json\n' + JSON.stringify(report, null, 2) + '\n```\n';
        encodedCopy.disabled = false; encodedOutput.hidden = true;
        status.textContent = t('reportReview');
      } catch { if (generation === revision) { preview.value = ''; status.textContent = t('reportUnavailable'); } }
      finally { if (generation === revision) prepare.disabled = false; }
    }
    prepare.onclick = generate;
    example.onchange = generate;
    watchlist.onchange = generate;
    const encodedCopy = node('button', t('reportCopyEncoded'), section);
    encodedCopy.type = 'button'; encodedCopy.disabled = true;
    const encodedOutput = node('textarea', '', section); encodedOutput.hidden = true;
    encodedOutput.readOnly = true; encodedOutput.rows = 5;
    encodedOutput.setAttribute('aria-label', t('reportCopyEncoded'));
    encodedOutput.style.cssText = 'box-sizing:border-box;width:100%;max-width:100%';
    preview.addEventListener('input', () => { encodedOutput.value = ''; encodedOutput.hidden = true; });
    encodedCopy.onclick = async () => {
      encodedCopy.disabled = true;
      try {
        const revisionAtClick = revision, visibleText = preview.value;
        const encoded = await BWLReportCrypto.encrypt(visibleText);
        if (revisionAtClick !== revision || preview.value !== visibleText) return;
        encodedOutput.value = encoded;
        try { await navigator.clipboard.writeText(encoded); status.textContent = t('reportCopied'); }
        catch {
          encodedOutput.hidden = false; encodedOutput.focus(); encodedOutput.select();
          status.textContent = t('reportCopyManual');
        }
      } catch { status.textContent = t('reportEncodeFailed'); }
      finally { encodedCopy.disabled = prepare.disabled || !preview.value; }
    };
    const link = node('a', t('reportGithub'), section);
    link.href = issueURL; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.style.marginInlineStart = '8px';
    // No report in the URL: publishing remains a separate, explicit GitHub action.
    section.addEventListener('toggle', () => { if (section.open && !preview.value) generate(); });
    return section;
  }
  return { snapshot, mount, issueURL };
})();
