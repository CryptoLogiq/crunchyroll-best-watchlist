/* Same-origin adapter. Only explicit favorite actions write to the account. */
var CRApi = (() => {
  let session = null;
  let generation = 0;
  let renewal = null, retryRenewalAt = 0;
  const renewalDeviceId = crypto.randomUUID();
  const cache = {};
  // Watchroll's cache stays in this isolated world, never in persistent storage.
  globalThis.browser = { storage: { local: {
    get: async key => ({ [key]: cache[key] }),
    set: async values => Object.assign(cache, values),
  } } };
  function decode(value) {
    const part = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
  }
  document.addEventListener('bwl:session', event => {
    try {
      if (typeof event.detail !== 'string' || event.detail.length > 16384) return;
      const token = event.detail.replace(/^Bearer /, '');
      const claims = decode(token);
      const account = claims.account_id || claims.etp_user_id || claims.sub;
      if (typeof account !== 'string' || !/^[a-zA-Z0-9-]+$/.test(account)) return;
      if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) return;
      const scope = account + ':' + (claims.profile_id || '');
      const changed = session?.scope !== scope;
      session = { token, account, profile: claims.profile_id || '', scope, exp: claims.exp * 1000 };
      if (changed) {
        generation++;
        for (const key of Object.keys(cache)) delete cache[key];
        document.dispatchEvent(new Event('bwl:profile'));
      } else document.dispatchEvent(new Event('bwl:session-ready'));
    } catch { /* An invalid event cannot authenticate the adapter. */ }
  });
  document.dispatchEvent(new Event('bwl:ask-session'));
  const requireSession = () => {
    if (!session) throw sessionError();
    return session;
  };
  function sessionError() {
    const error = new Error(CRI18n.t('sessionPaused')); error.code = 'BWL_SESSION'; return error;
  }
  async function ensureSession(force = false) {
    document.dispatchEvent(new Event('bwl:ask-session'));
    if (!force && session && session.exp > Date.now() + 30000) return session;
    if (!session) throw sessionError();
    if (renewal) return renewal;
    if (Date.now() < retryRenewalAt) throw sessionError();
    const expected = session.scope, current = generation;
    renewal = (async () => {
      try {
        let clientId = 'noaihdevm_6iyg0a8l0q'; // Public web client used by upstream Watchroll.
        for (const script of document.querySelectorAll('script:not([src])')) {
          const match = script.textContent.match(/"accountAuthClientId"\s*:\s*"([^"]+)"/);
          if (match) { clientId = match[1]; break; }
        }
        const response = await fetch(new URL('/auth/v1/token', location.origin), {
          method: 'POST', credentials: 'include', signal: AbortSignal.timeout(15000),
          headers: { Authorization: 'Basic ' + btoa(clientId + ':'), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'etp_rt_cookie', device_id: renewalDeviceId, device_type: 'Chrome' }),
        });
        if (!response.ok) throw sessionError();
        const data = await response.json();
        if (typeof data.access_token !== 'string' || generation !== current) throw sessionError();
        document.dispatchEvent(new CustomEvent('bwl:session', { detail: 'Bearer ' + data.access_token }));
        if (!session || session.scope !== expected || session.exp <= Date.now() + 30000) throw sessionError();
        retryRenewalAt = 0; return session;
      } catch {
        retryRenewalAt = Date.now() + 30000;
        throw sessionError();
      } finally { renewal = null; }
    })();
    return renewal;
  }
  async function get(path, params = {}, signal) {
    signal?.throwIfAborted();
    let active = await ensureSession();
    const current = generation;
    const url = new URL(path, location.origin);
    url.search = new URLSearchParams(params).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, { credentials: 'include', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + active.token }, signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]) });
      if (current !== generation) throw new Error(CRI18n.t('session'));
      if (response.status === 401) {
        if (attempt > 0) throw sessionError();
        active = await ensureSession(true); continue;
      }
      if (response.status === 429 && attempt === 0) {
        const delay = Number(response.headers.get('retry-after')) || 2;
        await new Promise(resolve => setTimeout(resolve, Math.min(30, Math.max(1, delay)) * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
  }
  const data = async (path, params, signal) => {
    const body = await get(path, params, signal);
    if (!Array.isArray(body.data)) throw new Error(CRI18n.t('invalid'));
    return body.data;
  };
  const id = value => encodeURIComponent(value);
  async function setFavorite(seriesId, value) {
    if (typeof seriesId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(seriesId) || typeof value !== 'boolean') throw new Error(CRI18n.t('invalid'));
    const active = await ensureSession(), current = generation;
    const response = await fetch(new URL(`/content/v2/${id(active.account)}/watchlist/${id(seriesId)}`, location.origin), {
      method: 'PATCH', credentials: 'include', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + active.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: value }),
    });
    if (generation !== current) throw new Error(CRI18n.t('session'));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Crunchyroll can acknowledge this mutation with 204 and no JSON body.
  }
  async function watchlist(locale, { signal } = {}) {
    const account = requireSession().account;
    const items = [];
    let start = 0;
    for (let page = 0; page < 100; page++) {
      const r = await get(`/content/v2/discover/${id(account)}/watchlist`, { locale, n: 100, start, order: 'desc', ratings: 'true' }, signal);
      if (!Array.isArray(r.data)) throw new Error(CRI18n.t('invalid'));
      items.push(...r.data);
      start += r.data.length;
      if (!r.data.length || (Number.isFinite(r.total) ? start >= r.total : r.data.length < 100)) return items;
    }
    throw new Error(CRI18n.t('incomplete'));
  }
  const client = signal => ({
    scope: () => requireSession().scope,
    getAccountId: async () => requireSession().account,
    getProfileId: async () => requireSession().profile,
    watchlist: locale => watchlist(locale, { signal }),
    synopsis: async (seriesId, locale) => {
      const items = await data(`/content/v2/cms/objects/${id(seriesId)}`, { locale }, signal);
      const series = items.find(item => item.id === seriesId && item.type === 'series');
      return typeof series?.description === 'string' ? series.description : '';
    },
    watchHistory: async locale => {
      const account = requireSession().account, entries = [];
      for (let page = 1; page <= 10; page++) {
        const body = await get(`/content/v2/${id(account)}/watch-history`, { page, page_size: 100, locale }, signal);
        if (!Array.isArray(body.data)) throw new Error(CRI18n.t('invalid'));
        entries.push(...body.data);
        const next = body.meta?.next_page;
        if (!body.data.length || next === '' || next === null || (next === undefined && body.data.length < 100)) return { entries, complete: true };
      }
      return { entries, complete: false };
    },
    seasons: (series, locale) => data(`/content/v2/cms/series/${id(series)}/seasons`, { locale }, signal),
    episodes: (season, locale) => data(`/content/v2/cms/seasons/${id(season)}/episodes`, { locale }, signal),
    movieListing: async (listing, locale) => (await data(`/content/v2/cms/movie_listings/${id(listing)}`, { locale }, signal))[0],
    movies: (listing, locale) => data(`/content/v2/cms/movie_listings/${id(listing)}/movies`, { locale }, signal),
    playheads: async (ids, locale) => {
      const account = requireSession().account;
      const result = new Map();
      const unique = [...new Set(ids)];
      for (let i = 0; i < unique.length; i += 50) {
        const rows = await data(`/content/v2/${id(account)}/playheads`, { locale, content_ids: unique.slice(i, i + 50).join(',') }, signal);
        for (const row of rows) result.set(row.content_id, row);
      }
      return result;
    },
  });
  return { ...client(), withSignal: client, setFavorite, ensureSession };
})();
