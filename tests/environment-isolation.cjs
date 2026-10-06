// Real configuration/storage modules with memory/SDK fixtures. No network/DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const babel = require('../mobile/node_modules/@babel/core');
const environment = require('../shared/environment.cjs');
const { adminConfig, environmentPlugin } = require('../admin/scripts/environment-config.cjs');
const { preparePlan } = require('../backend/scripts/prepare-staging-plan.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const stageRef='abcdefghijklmnopqrst', otherRef='b'.repeat(20);
const publicKey='sb_publishable_offline_fixture_not_a_real_key';
const input=(name='staging',ref=stageRef)=>({environment:name,url:'https://'+ref+'.supabase.co',publicKey,expectedProjectRef:ref});
const production=input('production',environment.PRODUCTION_PROJECT_REF);
const fixtureJwt=claims=>[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify(claims)).toString('base64url'),'not-a-real-signature'].join('.');
const tests=[];const test=(name,run)=>tests.push([name,run]);
function moduleAt(file,deps,globals={}) {
  const code=babel.transformSync(read(file),{filename:file,babelrc:false,configFile:false,
    plugins:[require.resolve('../mobile/node_modules/@babel/plugin-transform-modules-commonjs')]}).code;
  const ctx={exports:{},console,Date,Map,Set,Math,setTimeout,clearTimeout,...globals,
    require:name=>{assert(name in deps,'Unmocked import '+name);return deps[name];}};
  vm.runInNewContext(code,ctx,{filename:file});return ctx.exports;
}
function storage(memory,config) {
  const native={getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>memory.set(k,v),
    removeItem:async k=>memory.delete(k),getAllKeys:async()=>[...memory.keys()]};
  return moduleAt('mobile/src/services/storage.js',{'./environment.js':{isolateStorage:s=>environment.scopeAsyncStorage(s,config)},
    '@react-native-async-storage/async-storage':{default:native}});
}
function browser(deployment,memory=new Map()) {
  let options,url,key,calls=0;
  const native={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const client={auth:{getUser:async()=>({data:{user:null},error:new Error('Denied')}),signOut:async()=>({})}};
  const window={InglyEnvironment:environment,inglyDeployment:deployment,supabase:{createClient:(u,k,o)=>{calls++;url=u;key=k;options=o;return client;}}};
  const context={window,localStorage:native,sessionStorage:native};
  return {start:()=>vm.runInNewContext(read('admin/public/auth.js'),context),window,memory,
    captured:()=>({url,key,options,calls})};
}
test('staging/development reject known production project; production rejects every other project',()=>{
  for(const name of ['staging','development'])assert.throws(()=>environment.resolveEnvironment(input(name,environment.PRODUCTION_PROJECT_REF)),/production project is forbidden/);
  assert.throws(()=>environment.resolveEnvironment(input('production')),/reviewed production project/);
  assert.equal(environment.resolveEnvironment(production).environment,'production');
});
test('missing environment or staging fields fail without any production fallback',()=>{
  assert.throws(()=>environment.resolveEnvironment({}),/APP_ENV/);
  for(const field of ['url','publicKey','expectedProjectRef'])assert.throws(()=>environment.resolveEnvironment({...input(),[field]:''}),/no fallback/);
  const b=browser({...input(),publicKey:''});assert.throws(()=>b.start(),/no fallback/);assert.equal(b.captured().calls,0);
  const absent=browser(undefined);assert.throws(()=>absent.start(),/configured admin build/);assert.equal(absent.captured().calls,0);
});
test('HTTPS URL binding rejects credentials, redirects, remote HTTP and project mismatch',()=>{
  for(const url of ['http://'+stageRef+'.supabase.co','https://evil.invalid','https://user@'+stageRef+'.supabase.co',
    'https://'+stageRef+'.supabase.co/functions/v1/other','https://'+stageRef+'.supabase.co?x=1',
    'https://'+stageRef+'.supabase.co:443'])assert.throws(()=>environment.resolveEnvironment({...input(),url}));
  assert.throws(()=>environment.resolveEnvironment({...input(),expectedProjectRef:otherRef}),/does not match/);
});
test('loopback HTTP is development-only, opt-in, pinned port and separate storage',()=>{
  const local={environment:'development',url:'http://127.0.0.1:54321',expectedProjectRef:'local',publicKey:fixtureJwt({role:'anon'}),allowLocalHttp:true};
  assert.equal(environment.resolveEnvironment(local).storagePrefix,'@ingly_env:development:local:');
  for(const changed of [{allowLocalHttp:false},{environment:'staging'},{environment:'production'},{url:'http://192.168.1.1:54321'},{url:'http://localhost:80'}])
    assert.throws(()=>environment.resolveEnvironment({...local,...changed}));
});
test('public keys only: privileged/secret/authenticated/mismatched JWTs are rejected',()=>{
  for(const key of ['sb_secret_private_fixture',fixtureJwt({role:'service_role',ref:stageRef}),fixtureJwt({role:'authenticated',ref:stageRef}),
    fixtureJwt({role:'anon',ref:otherRef}),'YOUR_STAGING_PUBLIC_KEY'])assert.throws(()=>environment.resolveEnvironment({...input(),publicKey:key}));
  assert.equal(environment.resolveEnvironment({...input(),publicKey:fixtureJwt({role:'anon',ref:stageRef})}).projectRef,stageRef);
  assert.throws(()=>environment.resolveEnvironment({...production,enableMockPayments:true}),/mock payments/);
});
test('admin mode/config and generated badge agree; serialization excludes unrelated secrets',()=>{
  const env={APP_ENV:'staging',SUPABASE_URL:input().url,SUPABASE_PROJECT_REF:stageRef,SUPABASE_PUBLISHABLE_KEY:publicKey,
    SUPABASE_SERVICE_ROLE_KEY:'server-only-fixture',DB_PASSWORD:'server-only-password-fixture'};
  assert.throws(()=>adminConfig(env,'production'),/match/);
  const config=adminConfig(env,'staging'),plugin=environmentPlugin(config);
  const output=plugin.transformIndexHtml('<div>CONFIG REQUIRED</div>');
  assert(output.html.includes('STAGING · '+stageRef));
  assert(!JSON.stringify(output).includes('server-only'));
  assert(!JSON.stringify(output).includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert(environmentPlugin(environment.resolveEnvironment(production)).transformIndexHtml('CONFIG REQUIRED').html.includes('PRODUCTION'));
  let artifact;plugin.generateBundle.call({emitFile:f=>artifact=f});
  const context={};vm.runInNewContext(artifact.source,context);
  assert.equal(context.InglyEnvironment.resolveEnvironment(input()).projectRef,stageRef);
});
test('admin SDK targets staging, local cache/session/logout never touches production bytes',async()=>{
  const memory=new Map([['ingly_admin_auth_v2','production-session'],['ingly_videos_enabled','false'],['ingly_admin_session','legacy-production']]);
  const b=browser(input(),memory);b.start();const {url,key,options}=b.captured();
  assert.equal(url,input().url);assert.equal(key,publicKey);assert.equal(options.auth.storage.getItem('ingly_admin_auth_v2'),null);
  assert.equal(b.window.inglyAuth.localStorage.getItem('ingly_videos_enabled'),null);
  b.window.inglyAuth.localStorage.setItem('ingly_videos_enabled','true');options.auth.storage.setItem('ingly_admin_auth_v2','staging-session');
  await b.window.inglyAuth.logout();assert.equal(memory.get('ingly_admin_auth_v2'),'production-session');
  assert.equal(memory.get('ingly_videos_enabled'),'false');assert.equal(memory.get('ingly_admin_session'),'legacy-production');
  assert.equal(b.window.inglyAuth.localStorage.getItem('ingly_videos_enabled'),'true');
});
test('mobile runtime validates explicit Expo fields and SDK uses the same scoped storage',()=>{
  const env={EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_SUPABASE_URL:input().url,
    EXPO_PUBLIC_SUPABASE_ANON_KEY:publicKey,EXPO_PUBLIC_SUPABASE_PROJECT_REF:stageRef};
  const load=values=>moduleAt('mobile/src/services/environment.js',{'../../../shared/environment.cjs':environment},{process:{env:values}});
  assert.throws(()=>load({...env,EXPO_PUBLIC_SUPABASE_ANON_KEY:''}),/no fallback/);
  assert.throws(()=>load({...env,EXPO_PUBLIC_SUPABASE_URL:production.url,EXPO_PUBLIC_SUPABASE_PROJECT_REF:environment.PRODUCTION_PROJECT_REF}),/forbidden/);
  const target=load(env);let args;
  const memory=new Map(),s=storage(memory,target.APP_CONFIG);
  const client=moduleAt('mobile/src/services/supabaseClient.js',{'./environment.js':target,'./storage.js':s,
    '@supabase/supabase-js':{createClient:(...a)=>{args=a;return{fixture:true};}}});
  assert.equal(client.SUPABASE_URL,input().url);assert.equal(args[0],input().url);assert.equal(args[2].auth.storage,s.authStorage);
});
test('same account UUID across environments cannot share progress/outbox/settings/custom data',async()=>{
  const memory=new Map(),p=storage(memory,environment.resolveEnvironment(production)),s=storage(memory,environment.resolveEnvironment(input()));
  p.setStorageAccountId('same-account');s.setStorageAccountId('same-account');
  await p.saveWordProgress(1,'mastered');await p.addCustomWord({id:'private-prod',original:'private'});
  await p.setStorageItem('ingly_cached_app_settings',{premium_mode_enabled:false});
  await p.setStorageItem('ingly_mock_entitlements',{test:true});
  const before=JSON.stringify(await p.getSyncQueue());
  assert.equal(Object.keys(await s.getAllProgress()).length,0);assert.equal((await s.getSyncQueue()).length,0);
  assert.equal((await s.getCustomWords()).length,0);assert.equal(await s.getStorageItem('ingly_cached_app_settings'),null);
  assert.equal(await s.getStorageItem('ingly_mock_entitlements'),null);
  await s.saveWordProgress(2,'hard');const queue=await s.getSyncQueue();await s.clearSyncQueue(queue.map(op=>({id:op.id,sequence:op.sequence})));
  assert.equal(JSON.stringify(await p.getSyncQueue()),before);assert.equal((await p.getAllProgress())[2],undefined);
  assert(memory.has('@ingly_account:same-account:'+p.JOURNAL_KEY));
  assert(memory.has(environment.resolveEnvironment(input()).storagePrefix+'@ingly_account:same-account:'+s.JOURNAL_KEY));
});
test('staging SDK cache cannot restore production session; namespaces also separate two staging projects',async()=>{
  const memory=new Map(),p=storage(memory,environment.resolveEnvironment(production)),s=storage(memory,environment.resolveEnvironment(input())),
    other=storage(memory,environment.resolveEnvironment(input('staging',otherRef)));
  const session={user:{id:'same-account'},access_token:'offline-token',refresh_token:'offline-refresh',expires_at:Date.now()/1000+600};
  await p.authStorage.setItem('ingly_supabase_auth_v2',JSON.stringify(session));
  const cache=store=>moduleAt('mobile/src/services/sessionCache.js',{'./storage.js':store});
  assert.equal((await cache(p).readCachedAuthSession()).user.id,'same-account');
  assert.equal(await cache(s).readCachedAuthSession(),null);
  await s.authStorage.setItem('ingly_supabase_auth_v2',JSON.stringify(session));
  assert.equal(await cache(other).readCachedAuthSession(),null);
  await s.authStorage.removeItem('ingly_supabase_auth_v2');assert(memory.has('ingly_supabase_auth_v2'));
});
test('legacy production queue remains readable/in place; staging never migrates it',async()=>{
  const memory=new Map(),legacy='@ingly_account:owner:@ingly_sync_queue';
  memory.set(legacy,JSON.stringify([{word_id:1,status:'mastered'}]));memory.set('@ingly_registered_users','quarantined-prod-credentials');
  const s=storage(memory,environment.resolveEnvironment(input()));s.setStorageAccountId('owner');await s.purgeLegacyCredentials();
  assert.equal((await s.getSyncQueue()).length,0);assert(memory.has(legacy));assert(memory.has('@ingly_registered_users'));
  const p=storage(memory,environment.resolveEnvironment(production));p.setStorageAccountId('owner');
  assert.equal((await p.getSyncQueue()).length,1);assert.equal((await p.getSyncQueue())[0].changes['word:1'].status,'mastered');
  assert(memory.has(legacy));
});
test('orphan cleanup is limited to the chosen environment/project journal',async()=>{
  const memory=new Map(),prefix=environment.resolveEnvironment(input()).storagePrefix;
  memory.set('@ingly_account:owner:@ingly_local_v3:page:production:0','keep');
  memory.set(environment.resolveEnvironment(input('staging',otherRef)).storagePrefix+'@ingly_account:owner:@ingly_local_v3:page:other:0','keep');
  memory.set(prefix+'@ingly_account:owner:@ingly_local_v3:page:orphan:0','remove');
  const s=storage(memory,environment.resolveEnvironment(input()));s.setStorageAccountId('owner');await s.getSyncQueue();
  assert(!memory.has(prefix+'@ingly_account:owner:@ingly_local_v3:page:orphan:0'));
  assert.equal([...memory.values()].filter(v=>v==='keep').length,2);
});
test('staging plan rejects production/apply flags and maps unique versions without executing SQL',()=>{
  for(const options of [{environment:'production',projectRef:stageRef,baseline:'existing'},
    {environment:'staging',projectRef:environment.PRODUCTION_PROJECT_REF,baseline:'existing'},
    {environment:'staging',projectRef:stageRef,baseline:'unknown'}])assert.throws(()=>preparePlan(options));
  const p=preparePlan({environment:'staging',projectRef:stageRef,baseline:'existing'});
  assert.equal(p.planOnly,true);assert.equal(p.executionApproved,false);assert.equal(p.targetVerifiedRemotely,false);
  assert.deepEqual(p.steps.filter(s=>s.proposedUniqueVersion).map(s=>s.proposedUniqueVersion),['20261005000100','20261005000200','20261006000100']);
  assert(p.steps.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));
  const fresh=preparePlan({environment:'staging',projectRef:stageRef,baseline:'fresh'});
  assert.equal(fresh.steps[0].file,'backend/supabase_fresh_preflight.sql');
  assert.equal(fresh.steps[1].file,'backend/schema.sql');assert(!fresh.steps.some(s=>s.file.endsWith('20261005_security_phase2.sql')));
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,'backend/scripts/prepare-staging-plan.cjs'),'--apply','true'],{stdio:'pipe'}));
});
test('Expo config has separate install identities and production keeps its original IDs',()=>{
  const fn=require('../mobile/app.config.js'),base=JSON.parse(read('mobile/app.json')).expo;
  const names=['EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PROJECT_REF','EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
  try {
    for(const target of [input(),production]) {
      const values=[target.environment,target.url,target.expectedProjectRef,target.publicKey];names.forEach((k,i)=>process.env[k]=values[i]);
      const result=fn({config:base});assert.equal(result.android.package,target.environment==='staging'?'com.ingly.app.staging':'com.ingly.app');
      assert.equal(result.ios.bundleIdentifier,result.android.package);assert.equal(result.name,target.environment==='staging'?'Ingly (STAGING)':'Ingly');
      assert(!('extra' in result));
    }
  } finally {for(const k of names)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
test('client sources/templates have no production URL fallback, default admin or private-key values',()=>{
  const productionUrl='https://'+environment.PRODUCTION_PROJECT_REF+'.supabase.co';
  for(const file of ['admin/index.html','admin/preview.html','admin/public/auth.js','mobile/src/services/supabaseClient.js','mobile/src/services/environment.js'])
    assert(!read(file).includes(productionUrl),file);
  for(const file of ['.env.example','admin/.env.example','admin/.env.staging.example','admin/.env.production.example',
    'mobile/.env.example','mobile/.env.staging.example','mobile/.env.production.example']) {
    const source=read(file);assert(!/ADMIN_DEFAULT_(?:LOGIN|PASSWORD)\s*=/.test(source));assert(!/sb_secret_|sb_publishable_|eyJ[a-zA-Z0-9_-]{20}/.test(source));
    assert(!/SERVICE_ROLE_KEY\s*=|DB_PASSWORD\s*=|JWT_SECRET\s*=/.test(source));
  }
  assert(read('.gitignore').includes('!.env.*.example'));
  for(const file of ['admin/index.html','admin/preview.html'])assert(!/(?<!inglyAuth\.)localStorage\./.test(read(file)));
});
test('optional built staging artifact has matching badge/config/assets and no production URL',()=>{
  const artifact=process.argv.indexOf('--admin-artifact');if(artifact===-1)return;
  const directory=path.resolve(root,process.argv[artifact+1]);
  for(const file of ['index.html','preview.html']) {
    const html=fs.readFileSync(path.join(directory,file),'utf8');assert(html.includes('STAGING · '+stageRef));
    assert(html.includes('"environment":"staging"'));assert(html.includes(input().url));
    assert(!html.includes('https://'+environment.PRODUCTION_PROJECT_REF+'.supabase.co'));
  }
  for(const file of ['environment.js','auth.js','real-data.js','real-data-ui.js'])assert(fs.existsSync(path.join(directory,file)));
});
(async()=>{let failed=0;for(const [name,run]of tests){try{await run();console.log('PASS: '+name);}catch(error){failed++;console.error('FAIL: '+name,error);}}
  console.log(`ENVIRONMENT ISOLATION: ${tests.length-failed} PASS, ${failed} FAIL. No remote/SQL execution.`);process.exitCode=failed?1:0;})();
