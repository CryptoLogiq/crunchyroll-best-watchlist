/* Pure rules shared by the content script and browser tests. */
globalThis.BWL = (() => {
  const defaults = { audio: 'original', dubLang: 'fr-FR', subLang: 'fr-FR',
    fallback: true, showDub: false, showSub: false, showWeek: false, series: {}, hidden: [] };
  function language(url, htmlLang = '') {
    const u = new URL(url);
    const path = u.pathname.split('/')[1];
    if (/^fr(?:-|$)/i.test(path)) return 'fr';
    if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(path)) return 'en';
    if (u.hostname.endsWith('.fr')) return 'fr';
    return /^fr(?:-|$)/i.test(htmlLang) ? 'fr' : 'en';
  }
  const watchlist = path => /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watchlist\/?$/i.test(path);
  function category(item) {
    if (item.status === 'error') return 'errors';
    if (item.status === 'never') return 'start';
    if (item.pending?.length) return 'watch';
    if (item.waitingDub || item.noDub) return 'dub';
    if (item.waitingSub || item.noSub) return 'sub';
    return item.status === 'uptodate' ? 'current' : 'errors';
  }
  function inWeek(item, now = Date.now()) {
    return Number.isFinite(item.next?.at) && item.next.at > now && item.next.at <= now + 7 * 86400000;
  }
  function settings(raw = {}) {
    const result = { ...defaults, ...raw };
    result.series = raw.series && typeof raw.series === 'object' ? raw.series : {};
    result.hidden = Array.isArray(raw.hidden) ? raw.hidden.filter(x => typeof x === 'string') : [];
    result.lists = raw.lists && typeof raw.lists === 'object' ? raw.lists : {};
    result.audioPrimary = raw.audioPrimary || (raw.audio === 'dub' ? raw.dubLang || 'fr-FR' : 'ja-JP');
    result.audioSecondary = raw.audioSecondary || (result.audioPrimary === 'ja-JP' ? raw.dubLang || 'fr-FR' : 'ja-JP');
    if (result.audioSecondary === result.audioPrimary) result.audioSecondary = result.audioPrimary === 'ja-JP' ? 'en-US' : 'ja-JP';
    result.series = Object.fromEntries(Object.entries(result.series).flatMap(([id, value]) => {
      if (value === 'original') return []; // The new global pair replaces legacy VO mode.
      if (value === 'dub') return [[id, { primary: raw.dubLang || result.audioPrimary, secondary: result.audioSecondary }]];
      return value && typeof value === 'object' ? [[id, value]] : [];
    }));
    return result;
  }
  function playbackEpisode(item) {
    const episodes = (item.pending || []).filter(ep => !ep.skipped && !ep.extra &&
      typeof ep.id === 'string' && /^[A-Za-z0-9_-]+$/.test(ep.id));
    const first = item.status === 'never' && item.startEpisode;
    return episodes.find(ep => ep.inProgress) || episodes[0] ||
      (first && typeof first.id === 'string' && /^[A-Za-z0-9_-]+$/.test(first.id) ? first : null);
  }
  function playbackPath(item) {
    const episode = playbackEpisode(item);
    return episode ? '/watch/' + encodeURIComponent(episode.id) : '/series/' + encodeURIComponent(item.seriesId);
  }
  function listOptions(prefs, view) {
    const raw = prefs.lists?.[view] || {};
    return { sort: ['rating', 'watched'].includes(raw.sort) ? raw.sort : 'release',
      favoritesFirst: raw.favoritesFirst !== false, onlyFavorites: raw.onlyFavorites === true,
      watched: ['1', '7', '30'].includes(raw.watched) ? raw.watched : 'all' };
  }
  function matchesQuery(title, query) {
    const normalize = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return normalize(title).includes(normalize(query).trim());
  }
  function sortRows(rows, options) {
    const score = item => {
      const value = options.sort === 'rating' ? item.rating?.average : options.sort === 'watched' ? item.lastWatchedAt : item.lastReleaseAt;
      return Number.isFinite(value) && value > 0 ? value : -Infinity;
    };
    return rows.filter(item => (!options.onlyFavorites || item.favorite === true) &&
      (options.watched === 'all' || !options.watched || recentlyWatched(item, Number(options.watched))))
      .sort((a, b) => {
      if (options.favoritesFirst && Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
      const left = score(a), right = score(b);
      return (left === right ? 0 : left < right ? 1 : -1) || (a.title || '').localeCompare(b.title || '');
    });
  }
  function recentlyWatched(item, days = 30, now = Date.now()) {
    return Number.isFinite(item.lastWatchedAt) && item.lastWatchedAt > 0 && item.lastWatchedAt <= now && now - item.lastWatchedAt < days * 86400000;
  }
  const refreshDelay = (readyAt, now = Date.now()) => Math.max(0, readyAt - now);
  return { defaults, language, watchlist, category, inWeek, settings, playbackPath, playbackEpisode, listOptions, sortRows, matchesQuery, recentlyWatched, refreshDelay };
})();
