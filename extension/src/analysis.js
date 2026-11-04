/* Bounded work, partial results and cancellation, independent of the UI. */
BWL.analyzeEntries = async (entries, prefs, config, api, analyzer, { signal, onProgress, timeout = 60000 }) => {
  prefs = structuredClone(prefs);
  let cursor = 0, done = 0;
  const results = new Array(entries.length);
  onProgress([], 0, entries.length);
  async function worker() {
    while (cursor < entries.length) {
      signal.throwIfAborted();
      const index = cursor++, entry = entries[index];
      const budget = AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
      const scoped = api.withSignal(budget);
      let stop;
      const aborted = new Promise((_, reject) => {
        stop = () => reject(budget.reason);
        budget.addEventListener('abort', stop, { once: true });
      });
      try {
        const work = async () => {
          return analyzer.analyzeEntry(entry, 'preferred', { ...config,
            preferredAudio: BWL.audioPreferences(prefs, entry.seriesId) }, scoped);
        };
        results[index] = await Promise.race([work(), aborted]);
      } catch (error) {
        signal.throwIfAborted();
        if (error.code === 'BWL_SESSION') throw error;
        results[index] = { ...entry, status: 'error', pending: [],
          error: error.name === 'TimeoutError' ? CRI18n.t('timeout') : error.message };
      } finally { budget.removeEventListener('abort', stop); }
      signal.throwIfAborted();
      onProgress(results.filter(Boolean), ++done, entries.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, entries.length) }, worker));
  return results;
};
