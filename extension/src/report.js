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
  function snapshot(raw = {}, includeExample = false) {
    const options = BWL.listOptions(raw.prefs || {}, raw.view);
    const data = {
      schema: 1, extension: '0.5.7', environment: environment(),
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
    const preview = node('textarea', '', section); preview.rows = 14;
    preview.setAttribute('aria-label', t('reportPreview'));
    preview.style.cssText = 'display:block;box-sizing:border-box;width:100%;max-width:100%;margin:8px 0';
    const status = node('p', '', section); status.setAttribute('role', 'status');
    const prepare = node('button', t('reportPrepare'), section); prepare.type = 'button';
    async function generate() {
      prepare.disabled = true;
      try {
        const report = await getSnapshot(example.checked);
        preview.value = '## Technical report\n```json\n' + JSON.stringify(report, null, 2) + '\n```\n';
        copy.disabled = false;
        status.textContent = t('reportReview');
      } catch { preview.value = ''; copy.disabled = true; status.textContent = t('reportUnavailable'); }
      finally { prepare.disabled = false; }
    }
    prepare.onclick = generate;
    example.onchange = generate;
    const copy = node('button', t('reportCopy'), section); copy.type = 'button'; copy.disabled = true;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(preview.value); status.textContent = t('reportCopied'); }
      catch { preview.focus(); preview.select(); status.textContent = t('reportCopyManual'); }
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
