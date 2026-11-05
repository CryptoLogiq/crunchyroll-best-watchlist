(async () => {
  try { CRI18n.setLanguage((await chrome.storage.local.get('bwl:uiLanguage'))['bwl:uiLanguage']); } catch { CRI18n.setLanguage('en'); }
  const t = key => CRI18n.t(key);
  document.documentElement.lang = CRI18n.lang();
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  document.querySelector('#diagnostic').setAttribute('aria-label', t('popupDiagnostic'));
  BWLReport.mount(document.body, async (includeExample, includeWatchlist) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'bwl:support', includeExample, includeWatchlist });
  });
  const status = document.querySelector('#status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'bwl:diagnostic' });
    document.querySelector('#diagnostic').value = JSON.stringify({ version: result.version, mounted: result.mounted,
      cache: result.cacheState, progress: result.progress, layout: result.layout }, null, 2);
    status.textContent = !result.watchlist ? t('popupWrongPage')
      : !result.mounted ? t('popupNotMounted')
      : result.busy ? t('popupBusy')
      : result.notice || t('popupCount').replace('{count}', result.count);
  } catch {
    status.textContent = t('popupMissing');
  }
})();
