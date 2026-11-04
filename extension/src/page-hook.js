// Observe only the site's own authenticated requests. Tokens never leave this tab.
(() => {
  let last = '';
  const report = (url, headers) => {
    try {
      const target = new URL(url, location.href);
      if (target.origin !== location.origin) return;
      const value = new Headers(headers).get('authorization') || '';
      if (!/^Bearer [\w.-]+$/.test(value) || value === last) return;
      last = value;
      document.dispatchEvent(new CustomEvent('bwl:session', { detail: value }));
    } catch { /* Ignore unrelated requests. */ }
  };
  const original = window.fetch;
  window.fetch = function(input, init) {
    report(input instanceof Request ? input.url : input,
      init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const request = original.apply(this, arguments);
    try {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (url.origin === location.origin && url.pathname === '/auth/v1/token') {
        request.then(response => {
          if (response.ok) response.clone().json().then(data => {
            if (typeof data.access_token === 'string') report(url.href, { authorization: 'Bearer ' + data.access_token });
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch { /* Leave the site's fetch behavior unchanged. */ }
    return request;
  };
  const open = XMLHttpRequest.prototype.open;
  const set = XMLHttpRequest.prototype.setRequestHeader;
  const urls = new WeakMap();
  XMLHttpRequest.prototype.open = function(method, url) {
    urls.set(this, url);
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (/^authorization$/i.test(name)) report(urls.get(this), { authorization: value });
    return set.apply(this, arguments);
  };
  document.addEventListener('bwl:ask-session', () => {
    if (last) document.dispatchEvent(new CustomEvent('bwl:session', { detail: last }));
  });
})();
