/* Authenticated hybrid encryption using the browser's native Web Crypto API. */
var BWLReportCrypto = (() => {
  const MAX_BYTES = 2_000_000;
  function base64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
  }
  async function encrypt(text, config = BWLReportKey) {
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > MAX_BYTES) throw new Error('REPORT_TOO_LARGE');
    if (!/^[a-f0-9]{24}$/.test(config.id)) throw new Error('INVALID_REPORT_KEY');
    const spki = Uint8Array.from(atob(config.spki), c => c.charCodeAt(0));
    const fingerprint = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
    const keyId = [...fingerprint].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
    if (keyId !== config.id) throw new Error('INVALID_REPORT_KEY');
    const publicKey = await crypto.subtle.importKey('spki', spki,
      { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey']);
    if (publicKey.algorithm.modulusLength < 3072) throw new Error('INVALID_REPORT_KEY');
    const compressed = await new Response(new Blob([bytes]).stream()
      .pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const additionalData = new TextEncoder().encode('BWL2:' + config.id);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, compressed);
    const wrapped = await crypto.subtle.wrapKey('raw', key, publicKey, { name: 'RSA-OAEP' });
    const envelope = { v: 2, kid: config.id, ek: base64(new Uint8Array(wrapped)),
      iv: base64(iv), ct: base64(new Uint8Array(ciphertext)) };
    return 'BWL2:' + base64(new TextEncoder().encode(JSON.stringify(envelope)));
  }
  return { encrypt };
})();
