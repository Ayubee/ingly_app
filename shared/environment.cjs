// One public configuration contract for browser, Expo and local plan tooling.
// The production project reference is a deny/allow guard, never a URL/key fallback.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InglyEnvironment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PRODUCTION_PROJECT_REF = 'lbsqxownrjfmjoojdsfk';
  function invalid(message) { throw new Error('Ingly configuration: ' + message); }
  function jwtClaims(key) {
    const parts = key.split('.');
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || parts[1].length > 8192) return null;
    try {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let bits = 0, value = 0, encoded = '';
      for (const ch of parts[1].replace(/-/g,'+').replace(/_/g,'/')) {
        value = (value << 6) | alphabet.indexOf(ch); bits += 6;
        if (bits >= 8) { bits -= 8; encoded += '%' + ((value >> bits) & 255).toString(16).padStart(2,'0'); }
      }
      return JSON.parse(decodeURIComponent(encoded));
    } catch { return null; }
  }
  function resolveEnvironment(input = {}) {
    const environment = String(input.environment || '').trim();
    if (!['development','staging','production'].includes(environment)) invalid('APP_ENV must explicitly be development, staging or production.');
    const url = String(input.url || '').trim().replace(/\/$/,'');
    const publicKey = String(input.publicKey || '').trim();
    const expectedProjectRef = String(input.expectedProjectRef || '').trim();
    if (!url || !publicKey || !expectedProjectRef) invalid(environment + ' requires URL, public key and expected project reference; no fallback is available.');
    // Only canonical hosted Supabase endpoints or an explicitly enabled loopback
    // are allowed. Credentials, paths, query strings, custom domains and remote
    // HTTP cannot redirect an account's bearer token to another server.
    const remote = url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/);
    const loopback = /^http:\/\/(?:127\.0\.0\.1|localhost):54321$/.test(url);
    let projectRef;
    if (remote) projectRef = remote[1];
    else if (environment === 'development' && input.allowLocalHttp === true && loopback) projectRef = 'local';
    else invalid('HTTPS hosted Supabase URL required; loopback HTTP is development-only and opt-in.');
    if (projectRef !== expectedProjectRef) invalid('URL does not match the expected project reference.');
    if (environment === 'production' && projectRef !== PRODUCTION_PROJECT_REF) invalid('production must use the reviewed production project.');
    if (environment !== 'production' && projectRef === PRODUCTION_PROJECT_REF) invalid('production project is forbidden in development/staging.');
    if (environment === 'production' && input.enableMockPayments === true) invalid('mock payments cannot be enabled in production configuration.');
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publicKey)) {
      const claims = jwtClaims(publicKey);
      if (!claims || claims.role !== 'anon' || (remote && claims.ref !== projectRef))
        invalid('only a project-matching anon JWT or publishable public key is allowed; never a secret/service-role key.');
    }
    return Object.freeze({ environment, url, publicKey, projectRef,
      // Keep deployed production sessions/journals/queues in place. All other
      // environments/projects get disjoint namespaces and no legacy reads.
      storagePrefix: environment === 'production' ? '' : '@ingly_env:' + environment + ':' + projectRef + ':' });
  }
  function scopeAsyncStorage(storage, config) {
    const prefix = config.storagePrefix;
    const scoped = {
      getItem: key => storage.getItem(prefix + key),
      setItem: (key,value) => storage.setItem(prefix + key,value),
      removeItem: key => storage.removeItem(prefix + key)
    };
    if (storage.getAllKeys) scoped.getAllKeys = async () => (await storage.getAllKeys())
      .filter(key => prefix ? key.startsWith(prefix) : !key.startsWith('@ingly_env:'))
      .map(key => key.slice(prefix.length));
    return scoped;
  }
  function scopeBrowserStorage(storage, config) {
    return Object.freeze({
      getItem: key => storage.getItem(config.storagePrefix + key),
      setItem: (key,value) => storage.setItem(config.storagePrefix + key,value),
      removeItem: key => storage.removeItem(config.storagePrefix + key)
    });
  }
  return { PRODUCTION_PROJECT_REF, resolveEnvironment, scopeAsyncStorage, scopeBrowserStorage };
});
