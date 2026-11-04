/* Only series descriptions are accepted by the API adapter, never episodes. */
BWL.synopsis = (() => {
  const pending = new Map();
  function load(storage, api, scope, locale, seriesId) {
    const key = `bwl:synopsis:${scope}:${locale}:${seriesId}`;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const now = Date.now();
      try {
        const cached = (await storage.get(key))[key];
        if (cached && typeof cached.text === 'string' && Number.isFinite(cached.at) &&
          now >= cached.at && now - cached.at < 7 * 86400000) return cached.text;
      } catch { /* A storage failure must not prevent a live read. */ }
      const text = (await api.synopsis(seriesId, locale)).slice(0, 6000).trim();
      if (text) {
        try { await storage.set({ [key]: { text, at: now } }); } catch { /* Memory cache remains available. */ }
      } else pending.delete(key);
      return text;
    })().catch(error => { pending.delete(key); throw error; });
    pending.set(key, request);
    return request;
  }
  return { load, clear: () => pending.clear() };
})();
