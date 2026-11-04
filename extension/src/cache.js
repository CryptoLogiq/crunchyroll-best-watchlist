/* Local display snapshots only: no session tokens or raw API responses. */
BWL.cache = (() => {
  const VERSION = 5, FRESH = 5 * 60000, MAX_AGE = 7 * 86400000;
  const key = scope => 'bwl:results:' + scope;
  const signature = (prefs, locale) => JSON.stringify({ locale, audioPrimary: prefs.audioPrimary,
    audioSecondary: prefs.audioSecondary, subLang: prefs.subLang,
    series: Object.entries(prefs.series).sort(([a], [b]) => a.localeCompare(b)) });
  async function read(storage, scope, fingerprint, now = Date.now()) {
    try {
      const record = (await storage.get(key(scope)))[key(scope)];
      if (!record || ![1, 2, 3, 4, VERSION].includes(record.version) || record.signature !== fingerprint ||
        !Number.isFinite(record.at) || now < record.at || now - record.at > MAX_AGE ||
        !Array.isArray(record.items) || !record.items.every(item => typeof item.seriesId === 'string' && Array.isArray(item.pending))) return null;
      const items = record.items.map(item => ({ ...item, checkedAt: item.checkedAt || record.at }));
      return { ...record, items, fresh: record.version === VERSION && record.complete &&
        items.every(item => now >= item.checkedAt && now - item.checkedAt < FRESH) && now - record.at < FRESH };
    } catch { return null; }
  }
  async function write(storage, scope, fingerprint, rows, now = Date.now(), expectedTotal = rows.length) {
    const items = rows.filter(row => row.status !== 'error').map(row => ({
      seriesId: row.seriesId, title: row.title, image: row.image, status: row.status,
      checkedAt: row.checkedAt || now,
      lastWatchedAt: row.lastWatchedAt || null,
      startEpisode: row.startEpisode ? { id: row.startEpisode.id, number: row.startEpisode.number, season: row.startEpisode.season } : null,
      favorite: row.favorite === true, lastReleaseAt: row.lastReleaseAt || null,
      rating: row.rating ? { average: row.rating.average, total: row.rating.total } : null,
      audios: row.audios ? { any: row.audios.any, latest: row.audios.latest } : null,
      pending: (row.pending || []).map(ep => ({
        id: typeof ep.id === 'string' ? ep.id : undefined,
        audio: typeof ep.audio === 'string' ? ep.audio : undefined,
        number: ep.number, season: ep.season,
        inProgress: Boolean(ep.inProgress), skipped: Boolean(ep.skipped), extra: Boolean(ep.extra),
      })),
      waitingDub: row.waitingDub, waitingSub: row.waitingSub,
      noDub: row.noDub, noSub: row.noSub, fallbackUsed: row.fallbackUsed,
      next: row.next ? { at: row.next.at, estimated: Boolean(row.next.estimated) } : null,
    }));
    const record = { version: VERSION, at: now, signature: fingerprint, items,
      complete: items.length === expectedTotal };
    if (JSON.stringify(record).length > 2_000_000) return false;
    try { await storage.set({ [key(scope)]: record }); return true; }
    catch { return false; } // Storage failure must not discard live results.
  }
  async function updateFavorite(storage, scope, seriesId, favorite) {
    try {
      const record = (await storage.get(key(scope)))[key(scope)];
      if (!Array.isArray(record?.items)) return;
      record.items = record.items.map(item => item.seriesId === seriesId ? { ...item, favorite } : item);
      await storage.set({ [key(scope)]: record });
    } catch { /* Live server-confirmed state remains usable if the cache fails. */ }
  }
  function reusable(record, now = Date.now()) {
    if (!record || record.version !== VERSION) return [];
    return record.items.filter(item => item.status !== 'error' && now >= item.checkedAt && now - item.checkedAt < FRESH);
  }
  return { read, write, signature, updateFavorite, reusable };
})();
