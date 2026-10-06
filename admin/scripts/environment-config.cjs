const fs = require('node:fs');
const path = require('node:path');
const { resolveEnvironment } = require('../../shared/environment.cjs');
function adminConfig(env, mode) {
  if (!['development','staging','production'].includes(mode)) throw new Error('Ingly configuration: choose development, staging or production mode.');
  if (env.APP_ENV !== mode) throw new Error('Ingly configuration: APP_ENV must match the explicit Vite mode.');
  return resolveEnvironment({ environment: env.APP_ENV, url: env.SUPABASE_URL,
    publicKey: env.SUPABASE_PUBLISHABLE_KEY, expectedProjectRef: env.SUPABASE_PROJECT_REF,
    allowLocalHttp: env.ALLOW_LOCAL_HTTP === 'true' });
}
function environmentPlugin(config) {
  const source = fs.readFileSync(path.resolve(__dirname,'../../shared/environment.cjs'),'utf8');
  // Serialize only the allowlisted public contract, never process.env/loadEnv.
  const deployment = {environment:config.environment,url:config.url,publicKey:config.publicKey,
    expectedProjectRef:config.projectRef,allowLocalHttp:config.projectRef==='local'};
  const serialized = JSON.stringify(deployment).replace(/</g,'\\u003c');
  return { name:'ingly-explicit-environment',
    configureServer(server) { server.middlewares.use('/environment.js',(_req,res) => {
      res.setHeader('Content-Type','application/javascript');res.end(source);
    }); },
    transformIndexHtml(html) {
      return {html:html.replace('CONFIG REQUIRED',config.environment.toUpperCase()+' · '+config.projectRef),
        tags:[{tag:'script',children:'window.inglyDeployment = Object.freeze('+serialized+');',injectTo:'head-prepend'}]};
    },
    generateBundle() { this.emitFile({type:'asset',fileName:'environment.js',source}); }
  };
}
module.exports = { adminConfig, environmentPlugin };
