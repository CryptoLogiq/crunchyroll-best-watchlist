/* The native watchlist is never removed; this panel is additive and reversible. */
(() => {
  if (globalThis.__bwlMounted) return;
  globalThis.__bwlMounted = true;
  const t = key => CRI18n.t(key);
  let host, root, prefs = BWL.settings(), results = [], scope = '', busy = false;
  let route = '', epoch = 0, view = 'watch', query = '', notice = '';
  let spacing, runController, progress = null;
  let updateView, renderedView, renderedLanguage;
  let cacheWrites = Promise.resolve(), cacheState = 'none';
  let backgroundAnalysis = false, lastAnalysis = 0;
  let refreshReadyAt = 0, updateRefresh;
  let waitingForSession = false;
  const openCards = new Set();
  const listQueries = new Map();
  const favoriteRequests = new Set(), favoriteChanges = new Map();
  const el = (tag, text, parent) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.append(node);
    return node;
  };
  function button(text, action, parent) {
    const node = el('button', text, parent);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  const storageKey = () => 'bwl:prefs:' + scope;
  const persist = () => chrome.storage.local.set({ [storageKey()]: prefs });
  function select(parent, title, values, value, changed) {
    const label = el('label', title, parent);
    const control = el('select', undefined, label);
    for (const [key, name] of values) {
      const option = el('option', name, control);
      option.value = key;
    }
    control.value = value;
    control.onchange = () => changed(control.value);
    return control;
  }
  const languages = [['fr-FR', 'Français'], ['en-US', 'English'], ['ja-JP', '日本語'], ['ko-KR', '한국어'], ['zh-CN', '中文']];
  function audioChoices() {
    const known = new Set([...BWL.audioLanguages, prefs.audioPrimary, prefs.audioSecondary,
      ...results.flatMap(item => item.audios?.any || [])]);
    const names = new Intl.DisplayNames([CRI18n.lang()], { type: 'language' });
    return [...known].filter(Boolean).map(code => { try { return [code, names.of(code)]; } catch { return [code, code]; } });
  }
  function settings(parent) {
    el('p', t('local'), parent);
    select(parent, t('uiLanguage'), [['en', 'English'], ['fr', 'Français'], ['ja', '日本語']], CRI18n.lang(), async value => {
      await chrome.storage.local.set({ 'bwl:uiLanguage': value });
      CRI18n.setLanguage(value); host.lang = CRI18n.lang(); render();
    });
    const audioLanguages = audioChoices();
    const primary = select(parent, t('primaryAudio'), audioLanguages, prefs.audioPrimary, value => {
      const previous = prefs.audioPrimary;
      prefs.audioPrimary = value;
      if (prefs.audioSecondary === value) { prefs.audioSecondary = previous; secondary.value = previous; }
      updateChoices();
    });
    const secondary = select(parent, t('secondaryAudio'), audioLanguages, prefs.audioSecondary, value => {
      prefs.audioSecondary = value; updateChoices();
    });
    function updateChoices() {
      for (const option of primary.options) option.disabled = option.value === prefs.audioSecondary;
      for (const option of secondary.options) option.disabled = option.value === prefs.audioPrimary;
    }
    updateChoices();
    select(parent, t('subLang'), languages, prefs.subLang, value => { prefs.subLang = value; });
    const help = el('p', t('audioPreferenceHelp'), parent); help.className = 'audio-help';
    button(t('save'), async () => { await persist(); view = 'watch'; await analyze(true); }, parent);
    BWLReport.mount(parent, (includeExample, includeWatchlist) => supportSnapshot(includeExample, includeWatchlist));
  }
  function card(item, parent, hidden = false) {
    const article = el('article', undefined, parent);
    const heading = el('div', undefined, article); heading.className = 'card-heading';
    const link = el('a', item.title || item.seriesId, heading);
    link.href = '/series/' + encodeURIComponent(item.seriesId);
    let playback;
    let synopsisLoaded = false;
    async function showSynopsis() {
      if (synopsisLoaded || !scope) return;
      const activeScope = scope;
      link.title = t('synopsisLoading');
      if (playback) playback.title = link.title;
      try {
        const locale = BWL.language(location.href, document.documentElement.lang) === 'fr' ? 'fr-FR' : 'en-US';
        const summary = await BWL.synopsis.load(chrome.storage.local, CRApi, activeScope, locale, item.seriesId);
        if (scope !== activeScope) return;
        synopsisLoaded = Boolean(summary);
        link.title = summary || t('synopsisUnavailable');
      } catch { link.title = t('synopsisUnavailable'); }
      if (playback) playback.title = link.title;
    }
    article.addEventListener('pointerenter', showSynopsis);
    link.addEventListener('focus', showSynopsis);
    const heart = button(item.favorite ? '♥' : '♡', async () => {
      if (favoriteRequests.has(item.seriesId)) return;
      if (item.favorite && !window.confirm(t('confirmRemoveFavorite').replace('{title}', item.title || item.seriesId))) return;
      const activeScope = scope, value = !item.favorite;
      favoriteRequests.add(item.seriesId); heart.disabled = true;
      try {
        await CRApi.setFavorite(item.seriesId, value);
        if (scope !== activeScope || CRApi.scope() !== activeScope) return;
        favoriteChanges.set(item.seriesId, value);
        results = results.map(row => row.seriesId === item.seriesId ? { ...row, favorite: value } : row);
        cacheWrites = cacheWrites.catch(() => {}).then(() =>
          BWL.cache.updateFavorite(chrome.storage.local, activeScope, item.seriesId, value));
        await cacheWrites;
      } catch (error) {
        if (scope === activeScope) notice = `${t('favoriteError')} ${error.message}`;
      } finally {
        favoriteRequests.delete(item.seriesId);
        if (scope === activeScope) render();
      }
    }, heading);
    heart.className = 'favorite';
    heart.disabled = favoriteRequests.has(item.seriesId);
    heart.title = t(item.favorite ? 'removeFavorite' : 'addFavorite');
    heart.setAttribute('aria-label', heart.title);
    heart.setAttribute('aria-pressed', String(Boolean(item.favorite)));
    if (item.image) {
      try {
        const url = new URL(item.image);
        if (url.protocol === 'https:') {
          playback = el('a', undefined, article);
          playback.className = 'thumbnail';
          playback.addEventListener('focus', showSynopsis);
          playback.href = BWL.playbackPath(item);
          playback.setAttribute('aria-label', `${t(playback.pathname.startsWith('/watch/') ? 'playNext' : 'openSeries')} : ${item.title || item.seriesId}`);
          const image = el('img', undefined, playback); image.src = url.href; image.alt = ''; image.loading = 'lazy';
          if (item.rating?.average) {
            const score = el('span', `★ ${item.rating.average}`, playback); score.className = 'rating-badge';
            score.setAttribute('aria-label', `${t('rating')} : ${item.rating.average} / 5`);
          }
        }
      } catch { /* Text-only card. */ }
    }
    const count = item.pending?.length || 0;
    if (Number.isFinite(item.lastWatchedAt) && item.lastWatchedAt > 0 && item.lastWatchedAt <= Date.now()) {
      const days = Math.floor((Date.now() - item.lastWatchedAt) / 86400000);
      const watched = el('p', days === 0 ? t('watchedToday') : t(days === 1 ? 'watchedOne' : 'watchedMany').replace('{count}', days), article);
      watched.className = 'last-watched';
      watched.title = new Date(item.lastWatchedAt).toLocaleString(CRI18n.lang());
    }
    if (item.rating?.average && !playback) el('p', `★ ${item.rating.average}`, article);
    el('p', hidden ? t('hidden') : count ? t(count === 1 ? 'remaining_one' : 'remaining_many').replace('{count}', count) : t(BWL.category(item)), article);
    if (item.noDub) el('p', t('noDub'), article);
    if (item.noSub) el('p', t('noSub'), article);
    if (item.fallbackUsed) el('p', t('fallbackUsed'), article);
    if (view === 'week' && item.next) {
      el('p', (item.next.estimated ? '~ ' : '') + new Date(item.next.at).toLocaleString(CRI18n.lang()), article);
    }
    if (item.error) el('p', item.error, article);
    const options = el('div', undefined, article);
    options.id = `bwl-options-${encodeURIComponent(item.seriesId)}-${hidden ? 'hidden' : 'visible'}`;
    options.hidden = !openCards.has(item.seriesId);
    const actions = el('div', undefined, article); actions.className = 'card-actions';
    const nextEpisode = BWL.playbackEpisode(item);
    if (nextEpisode?.number !== undefined && String(nextEpisode.number).trim()) {
      const episodeLink = el('a', t(item.status === 'never' ? 'startEpisode' : 'continueEpisode').replace('{number}', nextEpisode.number), actions);
      episodeLink.className = 'episode-link'; episodeLink.href = BWL.playbackPath(item);
      episodeLink.setAttribute('aria-label', `${t('playNext')} : EP${nextEpisode.number}`);
    }
    const gear = button('⚙', () => {
      options.hidden = !options.hidden;
      if (options.hidden) openCards.delete(item.seriesId); else openCards.add(item.seriesId);
      gear.setAttribute('aria-expanded', String(!options.hidden));
    }, actions);
    gear.setAttribute('aria-label', t('cardSettings'));
    gear.title = t('cardSettings');
    gear.setAttribute('aria-expanded', String(!options.hidden));
    gear.setAttribute('aria-controls', options.id);
    for (const [key, label] of [['primary', 'primaryAudio'], ['secondary', 'secondaryAudio']]) {
      const override = prefs.series[item.seriesId];
      select(options, t(label), [['', t('inherit')], ...audioChoices()], typeof override === 'object' ? override[key] || '' : '', async value => {
        const next = { ...(typeof prefs.series[item.seriesId] === 'object' ? prefs.series[item.seriesId] : {}) };
        if (value) next[key] = value; else delete next[key];
        if (Object.keys(next).length) prefs.series[item.seriesId] = next; else delete prefs.series[item.seriesId];
        await persist(); await analyze(true);
      });
    }
    const visibility = button('', async () => {
      if (!hidden && !window.confirm(t('confirmHide').replace('{title}', item.title || item.seriesId))) return;
      prefs.hidden = hidden ? prefs.hidden.filter(id => id !== item.seriesId) : [...new Set([...prefs.hidden, item.seriesId])];
      await persist(); render();
    }, actions);
    visibility.className = 'visibility';
    visibility.setAttribute('aria-label', t(hidden ? 'showTip' : 'hideTip'));
    visibility.title = t(hidden ? 'showTip' : 'hideTip');
    visibility.dataset.hidden = String(hidden);
    function eye(crossed, className) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22');
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', className);
      for (const d of ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z',
        'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', ...(crossed ? ['M3 3 21 21'] : [])]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d); svg.append(path);
      }
      visibility.append(svg);
    }
    eye(hidden, 'rest-icon'); eye(!hidden, 'hover-icon');
  }
  function render() {
    if (!root) return;
    const conditionalViews = ['dub', 'sub', 'week', 'hidden', 'errors'];
    const auxiliaryCount = name => name === 'hidden' ? prefs.hidden.length
      : results.filter(item => !prefs.hidden.includes(item.seriesId) &&
        (name === 'week' ? BWL.inWeek(item) : BWL.category(item) === name)).length;
    if (conditionalViews.includes(view) && auxiliaryCount(view) === 0) view = 'watch';
    // Keep forms and native open dropdowns mounted during background updates.
    if (updateView && renderedView === view && renderedLanguage === CRI18n.lang() && root.childElementCount) {
      updateView();
      return;
    }
    updateView = undefined;
    renderedView = view; renderedLanguage = CRI18n.lang();
    root.replaceChildren();
    const style = el('style', undefined, root);
    style.textContent = BWL.styles;
    el('h2', t('title'), root);
    el('small', t('native'), root);
    const nav = el('nav', undefined, root);
    nav.setAttribute('aria-label', t('title'));
    const views = ['watch', 'start', 'current'];
    views.push('dub', 'sub', 'week');
    views.push('recent', 'hidden', 'errors', 'search', 'settings');
    for (const key of views) {
      const count = key === 'hidden' ? prefs.hidden.length : results.filter(item => BWL.category(item) === 'errors' && !prefs.hidden.includes(item.seriesId)).length;
      const label = ['hidden', 'errors'].includes(key) ? `${t(key)} (${count})` : t(key);
      const b = button(label, () => { view = key; render(); }, nav);
      b.dataset.view = key;
      if (conditionalViews.includes(key)) b.hidden = auxiliaryCount(key) === 0;
      b.setAttribute('aria-pressed', String(view === key));
    }
    const analysisButton = button(t('refresh'), () => {
      if (!busy && BWL.refreshDelay(refreshReadyAt) === 0) analyze(true);
    }, nav);
    analysisButton.dataset.action = 'analysis';
    updateRefresh = () => {
      const delay = BWL.refreshDelay(refreshReadyAt);
      analysisButton.hidden = busy;
      analysisButton.disabled = busy || delay > 0;
      analysisButton.textContent = delay > 0 ? t('refreshWait').replace('{count}', Math.ceil(delay / 1000)) : t('refresh');
      const retryButton = root.querySelector('[data-action="retry"]');
      if (retryButton) retryButton.disabled = busy || delay > 0;
    };
    updateRefresh();
    const statusText = () => {
      if (busy && backgroundAnalysis) return [notice, t('backgroundRefresh')].filter(Boolean).join(' · ');
      const loading = progress ? `${t('loading')} ${progress.done} / ${progress.total}` : t('reading');
      return busy ? [notice, loading].filter(Boolean).join(' · ') : notice;
    };
    const status = el('p', statusText(), root);
    status.setAttribute('role', 'status');
    const updateStatus = () => {
      status.textContent = statusText();
      updateRefresh();
      for (const name of conditionalViews) {
        const tab = nav.querySelector(`[data-view="${name}"]`), count = auxiliaryCount(name);
        tab.textContent = ['hidden', 'errors'].includes(name) ? `${t(name)} (${count})` : t(name);
        tab.hidden = count === 0;
      }
    };
    if (view === 'settings') { settings(root); updateView = updateStatus; return; }
    if (view === 'search') {
      const search = el('input', undefined, root); search.type = 'search'; search.placeholder = t('search');
      search.setAttribute('aria-label', t('search')); search.value = query;
      search.oninput = () => { query = search.value; drawCards(); };
    }
    if (view === 'week') el('p', t('weekNote'), root);
    let restoreAll, retry;
    if (view === 'hidden') {
      el('p', t('hiddenHelp'), root);
      restoreAll = button(t('restoreAll'), async () => { prefs.hidden = []; await persist(); render(); }, root);
      restoreAll.hidden = !prefs.hidden.length;
    }
    if (view === 'errors') { retry = button(t('retry'), () => {
      if (!busy && !BWL.refreshDelay(refreshReadyAt)) analyze(true);
    }, root); retry.dataset.action = 'retry'; retry.disabled = busy || BWL.refreshDelay(refreshReadyAt) > 0; }
    const listHeading = el('div', undefined, root); listHeading.className = 'list-heading';
    const viewTitle = el('h3', t(view), listHeading); viewTitle.className = 'view-title';
    viewTitle.id = 'bwl-view-title';
    const toggleCards = button('', async () => {
      prefs.cardsCollapsed = !prefs.cardsCollapsed;
      syncCollapsed();
      if (!prefs.cardsCollapsed) drawCards();
      requestAnimationFrame(() => spacing?.update());
      await persist();
    }, listHeading);
    toggleCards.className = 'toggle-cards'; toggleCards.setAttribute('aria-controls', 'bwl-cards');
    const filters = el('div', undefined, root); filters.className = 'filters';
    const changeOptions = async patch => {
      prefs.lists[view] = { ...BWL.listOptions(prefs, view), ...patch };
      drawCards(); await persist();
    };
    const options = BWL.listOptions(prefs, view);
    select(filters, t('filter'), [['all', t('allSeries')], ['favorites', t('favoritesOnly')]], options.onlyFavorites ? 'favorites' : 'all',
      value => changeOptions({ onlyFavorites: value === 'favorites' }));
    const sorts = [['release', t('latestRelease')], ['rating', t('rating')]];
    if (view !== 'start') sorts.push(['watched', t('sortWatched')]);
    select(filters, t('sort'), sorts, view === 'start' && options.sort === 'watched' ? 'release' : options.sort,
      value => changeOptions({ sort: value }));
    if (view !== 'start') select(filters, t('watchedFilter'), [['all', t('anyViewing')], ['1', t('lastDay')], ['7', t('lastWeek')], ['30', t('lastMonth')]],
      options.watched, value => changeOptions({ watched: value }));
    filters.classList.toggle('without-viewing', view === 'start');
    const favoriteLabel = el('label', undefined, filters);
    const first = el('input', undefined, favoriteLabel); favoriteLabel.className = 'favorites-first';
    first.type = 'checkbox'; first.checked = options.favoritesFirst;
    first.onchange = () => changeOptions({ favoritesFirst: first.checked });
    favoriteLabel.append(document.createTextNode(t('favoritesFirst')));
    if (view !== 'search') {
      const label = el('label', t('searchList'), filters); label.className = 'list-search';
      const search = el('input', undefined, label); search.type = 'search';
      search.placeholder = t('searchList'); search.value = listQueries.get(view) || '';
      search.setAttribute('aria-label', `${t('searchList')} : ${t(view)}`);
      search.oninput = () => { listQueries.set(view, search.value); drawCards(); };
    }
    const list = el('div', undefined, root); list.className = 'grid';
    list.id = 'bwl-cards'; list.setAttribute('role', 'region'); list.setAttribute('aria-labelledby', viewTitle.id);
    function syncCollapsed() {
      list.hidden = prefs.cardsCollapsed === true;
      toggleCards.textContent = `${list.hidden ? '▸' : '▾'} ${t(list.hidden ? 'expandCards' : 'collapseCards')}`;
      toggleCards.setAttribute('aria-expanded', String(!list.hidden));
    }
    syncCollapsed();
    list.addEventListener('focusout', () => requestAnimationFrame(() => {
      if (list.isConnected) drawCards();
    }));
    function drawCards() {
      if (prefs.cardsCollapsed) return;
      // A card's audio menu must also survive progressive result updates.
      if (root.activeElement?.tagName === 'SELECT' && list.contains(root.activeElement)) return;
      list.replaceChildren();
      list.setAttribute('aria-busy', String(busy));
      const byId = new Map(results.map(item => [item.seriesId, item]));
      const rows = view === 'hidden' ? prefs.hidden.map(seriesId => byId.get(seriesId) || { seriesId, title: t('hiddenSeries'), pending: [] }) : results.filter(item => {
        if (prefs.hidden.includes(item.seriesId)) return false;
        const category = BWL.category(item);
        if (category === 'errors') return view === 'errors';
        if (view === 'recent') return BWL.recentlyWatched(item);
        if (view === 'search') return BWL.matchesQuery(item.title, query);
        if (view === 'week') return BWL.inWeek(item);
        return category === view;
      });
      const localQuery = view === 'search' ? '' : listQueries.get(view) || '';
      const hasQuery = Boolean((view === 'search' ? query : localQuery).trim());
      const listOptions = BWL.listOptions(prefs, view);
      if (view === 'start') { listOptions.watched = 'all'; if (listOptions.sort === 'watched') listOptions.sort = 'release'; }
      const sorted = BWL.sortRows(rows.filter(item => BWL.matchesQuery(item.title, localQuery)), listOptions);
      for (const item of sorted) card(item, list, view === 'hidden');
      if (!sorted.length) {
        const state = el('div', undefined, list); state.className = 'empty-state';
        el('p', hasQuery ? t('noMatches') : busy ? t('loadingList') : t('empty'), state);
        if (busy && !backgroundAnalysis && !hasQuery) for (let index = 0; index < 4; index++) {
          const placeholder = el('div', undefined, list); placeholder.className = 'placeholder-card';
          placeholder.style.width = '240px'; placeholder.setAttribute('aria-hidden', 'true');
          for (const className of ['skeleton', 'skeleton image', 'skeleton short', 'skeleton short']) {
            const line = el('div', undefined, placeholder); line.className = className;
          }
        }
      }
    }
    drawCards();
    updateView = () => {
      updateStatus();
      syncCollapsed();
      if (restoreAll) restoreAll.hidden = !prefs.hidden.length;
      if (retry) retry.disabled = busy || BWL.refreshDelay(refreshReadyAt) > 0;
      drawCards();
    };
  }
  async function analyze(force = false) {
    if (busy || !root) return;
    const current = epoch;
    lastAnalysis = Date.now();
    backgroundAnalysis = !force && results.length > 0;
    if (force && !favoriteRequests.size) favoriteChanges.clear();
    runController?.abort();
    runController = new AbortController();
    const signal = runController.signal;
    let didAnalyze = false;
    busy = true; notice = ''; progress = null; render();
    try {
      const activeScope = CRApi.scope();
      if (scope !== activeScope) {
        scope = activeScope;
        const stored = (await chrome.storage.local.get(storageKey()))[storageKey()];
        const initialLanguage = BWL.language(location.href, document.documentElement.lang) === 'fr' ? 'fr-FR' : 'en-US';
        prefs = BWL.settings(stored || { dubLang: initialLanguage, subLang: initialLanguage });
        updateView = undefined;
      }
      if (epoch !== current) return;
      const locale = BWL.language(location.href, document.documentElement.lang) === 'fr' ? 'fr-FR' : 'en-US';
      const fingerprint = BWL.cache.signature(prefs, locale);
      const cached = await BWL.cache.read(chrome.storage.local, activeScope, fingerprint);
      cacheState = force ? 'forced' : !cached ? 'miss' : cached.fresh ? 'fresh' : cached.complete ? 'stale' : 'partial';
      if (epoch !== current) return;
      if (cached) {
        refreshReadyAt = Math.max(refreshReadyAt, cached.at + 30000);
        results = cached.items;
        backgroundAnalysis = !force && (cached.items.length > 0 || cached.complete);
        notice = `${t('cached')} ${new Date(cached.at).toLocaleString(CRI18n.lang())}`;
        render();
        if (cached.fresh && !force) return;
      }
      didAnalyze = true;
      const config = { locale, dubLang: prefs.dubLang, subLang: prefs.subLang,
        sources: ['watchlist'], seriesModes: {}, defaultMode: 'sub', concurrency: 2, showExtras: false, showSkipped: true };
      const sourceApi = CRApi.withSignal(AbortSignal.any([signal, AbortSignal.timeout(45000)]));
      let historyWarning = '';
      const [sources, history] = await Promise.all([
        CRAnalyzer.readSources(config, sourceApi),
        sourceApi.watchHistory ? sourceApi.watchHistory(locale).catch(() => { historyWarning = t('historyUnavailable'); return null; }) : null,
      ]);
      if (history && !history.complete) historyWarning = t('historyPartial');
      const activity = CRAnalyzer.historyActivity ? CRAnalyzer.historyActivity(history, config) : new Map();
      const previousDates = new Map((cached?.items || []).map(item => [item.seriesId, item.lastWatchedAt]));
      const entries = CRAnalyzer.mergeSources(sources).map(entry => ({ ...entry,
        lastWatchedAt: activity.get(entry.seriesId) || previousDates.get(entry.seriesId) || null }));
      if (epoch !== current) return;
      const reusable = new Map((force ? [] : BWL.cache.reusable(cached)).map(item => [item.seriesId, item]));
      const retained = entries.filter(entry => reusable.has(entry.seriesId)).map(entry => ({ ...reusable.get(entry.seriesId),
        ...entry, rating: entry.rating || reusable.get(entry.seriesId).rating }));
      const work = entries.filter(entry => !reusable.has(entry.seriesId));
      if (retained.length) notice += ` · ${t('cacheReused')} ${retained.length} / ${entries.length}`;
      const previous = new Map([...results, ...retained].map(item => [item.seriesId, item]));
      const valid = new Set(entries.map(item => item.seriesId));
      let analyzedResults = results.filter(item => valid.has(item.seriesId));
      if (!backgroundAnalysis) results = analyzedResults;
      let checkpoint = 0;
      const saveSnapshot = () => {
        const snapshot = analyzedResults.map(item => ({ ...item }));
        cacheWrites = cacheWrites.catch(() => {}).then(() => BWL.cache.write(chrome.storage.local,
          activeScope, fingerprint, snapshot, Date.now(), entries.length));
        return cacheWrites;
      };
      await BWL.analyzeEntries(work, prefs, config, CRApi, CRAnalyzer, {
        signal, onProgress(partial, done, total) {
          if (epoch !== current) return;
          const updated = new Map(partial.map(item => [item.seriesId, item]));
          analyzedResults = entries.map(entry => updated.get(entry.seriesId) || previous.get(entry.seriesId)).filter(Boolean)
            .map(row => favoriteChanges.has(row.seriesId) ? { ...row, favorite: favoriteChanges.get(row.seriesId) } : row);
          progress = { done: retained.length + done, total: entries.length };
          if (!backgroundAnalysis) { results = analyzedResults; render(); }
          if (done > 0 && (done === 1 || done - checkpoint >= 10)) {
            checkpoint = done; saveSnapshot();
          }
        },
      });
      if (epoch === current && CRApi.scope() === activeScope) {
        results = analyzedResults.map(row => favoriteChanges.has(row.seriesId) ? { ...row, favorite: favoriteChanges.get(row.seriesId) } : row);
        analyzedResults = results;
        const saved = await saveSnapshot();
        if (epoch === current) notice = `${t('complete')} ${entries.length}` + (saved ? '' : ` · ${t('cacheFailed')}`) + (historyWarning ? ` · ${historyWarning}` : '');
      }
    } catch (error) {
      if (epoch === current) {
        waitingForSession = error.code === 'BWL_SESSION';
        if (waitingForSession) runController.abort();
        notice = waitingForSession ? t('sessionPaused') : t('error') + ' ' + error.message;
      }
    } finally {
      if (epoch === current) {
        if (didAnalyze) refreshReadyAt = Date.now() + 30000;
        busy = false; render();
      }
    }
  }
  function checkRoute() {
    const path = location.pathname;
    if (!BWL.watchlist(path)) {
      if (host) { epoch++; runController?.abort(); spacing?.cleanup(); spacing = undefined; host.remove(); host = root = undefined; results = []; busy = false; }
      route = path; return;
    }
    const main = document.querySelector('main, [role="main"]') || document.body;
    if (!main) return;
    if (host?.isConnected && route === path) {
      updateRefresh?.();
      placePanel(main);
      spacing?.update();
      if (!busy && scope && Date.now() - lastAnalysis >= 5 * 60000) analyze();
      return;
    }
    epoch++; runController?.abort(); busy = false; spacing?.cleanup(); host?.remove(); results = []; route = path;
    host = document.createElement('section'); host.id = 'bwl-panel';
    host.lang = CRI18n.lang();
    // Site-wide styles also apply to the shadow host. Keep it in normal flow.
    for (const [property, value] of Object.entries({
      position: 'relative', display: 'block', float: 'none', clear: 'both',
      'grid-column': '1 / -1', 'flex-basis': '100%', width: '100%',
      height: 'auto', 'min-width': '0', 'box-sizing': 'border-box',
      inset: 'auto', transform: 'none', 'z-index': 'auto',
    })) host.style.setProperty(property, value, 'important');
    root = host.attachShadow({ mode: 'closed' });
    placePanel(main); render();
    spacing = BWL.reserveSpace(host, document); spacing.update();
    analyze();
  }
  function placePanel(fallback) {
    const activity = BWL.activityAnchor(document);
    if (activity && !activity.contains(host)) {
      host.dataset.placement = 'activity';
      if (host.nextElementSibling !== activity) activity.before(host);
      return;
    }
    const tabs = BWL.tabsAnchor(document);
    if (tabs && !tabs.contains(host)) {
      host.dataset.placement = 'watchlist-tabs';
      if (tabs.nextElementSibling !== host) tabs.after(host);
      return;
    }
    delete host.dataset.placement;
    const banner = BWL.bannerAnchor(document);
    if (banner && !banner.contains(host)) {
      if (banner.nextElementSibling !== host) banner.after(host);
      return;
    }
    const anchor = BWL.listAnchor(document);
    if (anchor && !anchor.contains(host)) {
      if (host.nextElementSibling !== anchor) anchor.before(host);
    } else if (!host.isConnected) {
      // Never put the panel before the site header while cards are loading.
      fallback.append(host);
    }
  }
  document.addEventListener('bwl:profile', () => {
    waitingForSession = false;
    BWL.synopsis.clear();
    listQueries.clear(); query = '';
    updateView = undefined;
    favoriteChanges.clear();
    openCards.clear();
    epoch++; runController?.abort(); busy = false; results = []; scope = ''; prefs = BWL.settings();
    if (root) { render(); analyze(); }
  });
  document.addEventListener('bwl:session-ready', () => {
    if (waitingForSession && !busy && root) { waitingForSession = false; analyze(); }
  });
  function supportSnapshot(includeExample, includeWatchlist) {
    return BWLReport.snapshot({ prefs, view, lang: CRI18n.lang(), busy,
      background: backgroundAnalysis, cacheState, sessionPaused: waitingForSession,
      mounted: Boolean(host?.isConnected), progress,
      errorCount: results.filter(item => item.status === 'error').length,
      example: results.find(item => item.status === 'error') || results[0], results }, includeExample, includeWatchlist);
  }
  chrome.runtime?.onMessage?.addListener((message, _sender, respond) => {
    if (message?.type === 'bwl:support') { respond(supportSnapshot(message.includeExample === true, message.includeWatchlist === true)); return; }
    if (message?.type !== 'bwl:diagnostic') return;
    respond({ version: '0.5.9', watchlist: BWL.watchlist(location.pathname),
      mounted: Boolean(host?.isConnected), busy, count: results.length, notice,
      progress, cacheState, layout: BWL.layoutReport(host, document) });
  });
  // Poll only route/mount presence; do not observe the site's entire DOM tree.
  (async () => {
    try { CRI18n.setLanguage((await chrome.storage.local.get('bwl:uiLanguage'))['bwl:uiLanguage']); }
    catch { CRI18n.setLanguage('en'); }
    setInterval(checkRoute, 1000);
    checkRoute();
  })();
})();
