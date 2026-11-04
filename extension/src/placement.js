/* Locate the watchlist navigation separately from the global site banner. */
BWL.activityAnchor = (document) => {
  const heading = [...document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')]
    .find(node => /^(activité récente|recent activity|recently added|ordre alphabétique|alphabetical)$/i.test(node.textContent.trim()));
  if (!heading) return null;
  const list = BWL.listAnchor(document);
  const tabs = BWL.tabsAnchor(document);
  let anchor = heading;
  while (anchor.parentElement && anchor.parentElement !== document.body &&
    (!list || !anchor.parentElement.contains(list)) &&
    (!tabs || !anchor.parentElement.contains(tabs))) anchor = anchor.parentElement;
  return anchor;
};
BWL.tabsAnchor = (document) => {
  const candidates = [...document.querySelectorAll('a, button, [role="tab"]')]
    .filter(node => !node.closest('header, [role="banner"], #bwl-panel'));
  const label = node => node.textContent.trim().toLowerCase();
  const watch = candidates.find(node => label(node) === 'watchlist');
  const lists = candidates.find(node => label(node) === 'crunchylists');
  const history = candidates.find(node => ['historique', 'history'].includes(label(node)));
  if (!watch || !lists || !history) return null;
  let tabs = watch.parentElement;
  while (tabs && !(tabs.contains(lists) && tabs.contains(history))) tabs = tabs.parentElement;
  if (!tabs || tabs === document.body || tabs === document.documentElement) return null;
  // Tabs often live in fixed-height, clipped navigation wrappers. Insert outside
  // those wrappers, rather than placing a large panel inside their clipped area.
  while (tabs.parentElement && tabs.parentElement !== document.body) {
    const style = getComputedStyle(tabs.parentElement);
    if (!['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY)) break;
    tabs = tabs.parentElement;
  }
  return tabs;
};
BWL.layoutReport = (host, document) => {
  function describe(node) {
    if (!node) return null;
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return { tag: node.tagName, classes: [...node.classList].slice(0, 8),
      position: style.position, display: style.display, overflow: style.overflowY,
      top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width) };
  }
  const ancestors = [];
  for (let node = host?.parentElement; node && ancestors.length < 6; node = node.parentElement) ancestors.push(describe(node));
  return { panel: describe(host), placement: host?.dataset.placement, ancestors,
    activity: describe(BWL.activityAnchor(document)), tabs: describe(BWL.tabsAnchor(document)) };
};
BWL.bannerAnchor = (document) => {
  const banner = document.querySelector('header, [role="banner"], [data-t="header"], [class*="erc-header"]');
  if (!banner || banner.closest('#bwl-panel')) return null;
  // A fixed navigation wrapper must not become the panel's parent.
  let anchor = banner;
  for (let parent = banner.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (['fixed', 'sticky'].includes(getComputedStyle(parent).position)) anchor = parent;
  }
  return anchor;
};
BWL.contentAnchor = (document, host) => {
  if (['watchlist-tabs', 'activity'].includes(host.dataset.placement)) {
    const next = host.nextElementSibling || BWL.listAnchor(document);
    return next && !next.contains(host) ? next : null;
  }
  const banner = BWL.bannerAnchor(document);
  const headings = [...document.querySelectorAll('h1, h2')];
  let target = headings.find(node => /^(mes listes|my lists|watchlist|my watchlist)$/i.test(node.textContent.trim()))
    || document.querySelector('main, [role="main"]') || BWL.listAnchor(document);
  if (!target || target.contains(host) || (banner && target.contains(banner))) return null;
  // Shift the content branch as a whole, including its title, tabs and cards.
  while (target.parentElement && target.parentElement !== document.body &&
    !target.parentElement.contains(host) && (!banner || !target.parentElement.contains(banner))) {
    target = target.parentElement;
  }
  return target;
};

// A fixed header or an absolutely positioned content branch does not reserve
// space for a sibling panel. Compensate only for the measured overlap.
BWL.reserveSpace = (host, document) => {
  let target, original, baseMargin = 0, applied = 0, frame;
  function restore() {
    if (target) {
      if (original.value) target.style.setProperty('margin-top', original.value, original.priority);
      else target.style.removeProperty('margin-top');
    }
    target = null; applied = 0;
  }
  function update() {
    if (!host.isConnected) return;
    const next = BWL.contentAnchor(document, host);
    if (next !== target) {
      restore(); target = next;
      if (!target) return;
      original = { value: target.style.getPropertyValue('margin-top'), priority: target.style.getPropertyPriority('margin-top') };
      baseMargin = parseFloat(getComputedStyle(target).marginTop) || 0;
    }
    if (!target) return;
    const naturalTop = target.getBoundingClientRect().top - applied;
    const required = Math.max(0, Math.ceil(host.getBoundingClientRect().bottom + 24 - naturalTop));
    if (required !== applied) {
      applied = required;
      target.style.setProperty('margin-top', `${baseMargin + applied}px`, 'important');
    }
  }
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame); frame = requestAnimationFrame(update);
  });
  observer.observe(host);
  return { update, cleanup() { observer.disconnect(); cancelAnimationFrame(frame); restore(); } };
};
BWL.listAnchor = (document) => {
  const links = [...document.querySelectorAll('a[href*="/series/"], a[href*="/watch/"]')]
    .filter(link => link.querySelector('img') && !link.closest('header, nav, footer, #bwl-panel'));
  const first = links[0];
  if (!first) return null;
  // One card can contain several illustrated links. Use the ancestor of ALL
  // cards, not the first pair of links (which may belong to the same card).
  const targets = new Set(links.map(link => new URL(link.href).pathname));
  if (targets.size > 1) {
    let collection = first.parentElement;
    while (collection && !links.every(link => collection.contains(link))) {
      collection = collection.parentElement;
    }
    if (collection && collection !== document.body && collection !== document.documentElement) {
      // Leave positioned/transparent wrappers so the panel takes its own space.
      while (collection.parentElement !== document.body &&
        ['absolute', 'fixed'].includes(getComputedStyle(collection).position)) {
        collection = collection.parentElement;
      }
      return collection;
    }
  }
  // A watchlist containing only one card still needs a useful insertion point.
  const card = first.closest('article, li, [data-t*="watch-list-card"], [data-t*="watchlist-card"], [class*="watchlist-card"], [class*="watch-list-card"]');
  return card || first;
};
