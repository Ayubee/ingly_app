// Offline fixtures only; no Supabase/network/SQL. Exercise real verifier and manifest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {validate,loadConfiguration,files} = require('../scripts/staging-readiness.cjs');
const {verifyManifest} = require('../backend/scripts/migration-manifest.cjs');
const {preparePlan} = require('../backend/scripts/prepare-staging-plan.cjs');
const {PRODUCTION_PROJECT_REF} = require('../shared/environment.cjs');
const ref = 'abcdefghijklmnopqrst', key = 'sb_publishable_offline_fixture_not_a_real_key';
const fixture = () => ({admin:{APP_ENV:'staging',SUPABASE_URL:'https://'+ref+'.supabase.co',
  SUPABASE_PROJECT_REF:ref,SUPABASE_PUBLISHABLE_KEY:key,ALLOW_LOCAL_HTTP:'false'},
mobile:{EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_SUPABASE_URL:'https://'+ref+'.supabase.co',
  EXPO_PUBLIC_SUPABASE_PROJECT_REF:ref,EXPO_PUBLIC_SUPABASE_ANON_KEY:key,
  EXPO_PUBLIC_ALLOW_LOCAL_HTTP:'false',EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS:'false'}});
const tests=[];const test=(name,run)=>tests.push([name,run]);
test('explicit public staging config passes and requires no server credential',()=>{
  const c=validate(fixture());assert.equal(c.admin.projectRef,ref);
  assert.equal(c.admin.storagePrefix,'@ingly_env:staging:'+ref+':');
  assert(!JSON.stringify(c).includes('SERVICE_ROLE'));
});
test('staging accepts explicit mock opt-in while rejecting production and local HTTP',()=>{
  for(const flag of ['false','true']) {
    const f=fixture();f.mobile.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS=flag;
    assert.equal(validate(f).mobile.environment,'staging');
    for(const patch of [{EXPO_PUBLIC_APP_ENV:'production'},
      {EXPO_PUBLIC_SUPABASE_URL:'https://'+PRODUCTION_PROJECT_REF+'.supabase.co',EXPO_PUBLIC_SUPABASE_PROJECT_REF:PRODUCTION_PROJECT_REF},
      {EXPO_PUBLIC_ALLOW_LOCAL_HTTP:'true'}]) {
      const rejected=structuredClone(f);Object.assign(rejected.mobile,patch);assert.throws(()=>validate(rejected));
    }
    assert.throws(()=>validate(f,{EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS:flag==='true'?'false':'true'}),/shell\/file disagreement/);
  }
});
test('staging verifier rejects missing required fields with no fallback',()=>{
  for(const [client,values] of Object.entries(fixture()))for(const name of Object.keys(values)){
    const f=fixture();delete f[client][name];assert.throws(()=>validate(f),/missing.*no fallback/);
  }
});
test('known production, wrong environment, HTTP and ref mismatch are rejected',()=>{
  for(const patch of [{APP_ENV:'production'},{APP_ENV:'development'},
    {SUPABASE_URL:'https://'+PRODUCTION_PROJECT_REF+'.supabase.co',SUPABASE_PROJECT_REF:PRODUCTION_PROJECT_REF},
    {SUPABASE_URL:'http://'+ref+'.supabase.co'},{SUPABASE_PROJECT_REF:'b'.repeat(20)},
    {SUPABASE_URL:'https://'+PRODUCTION_PROJECT_REF+'.supabase.co'},
    {SUPABASE_PROJECT_REF:PRODUCTION_PROJECT_REF}]){
    const f=fixture();Object.assign(f.admin,patch);assert.throws(()=>validate(f));
  }
});
test('secret keys/variables, invalid flags, client disagreement and shell overrides are rejected',()=>{
  for(const patch of [{SUPABASE_PUBLISHABLE_KEY:'sb_secret_offline_fixture'},
    {SUPABASE_SERVICE_ROLE_KEY:'offline_fixture'},{VITE_SERVER_PASSWORD:'offline_fixture'},
    {ALLOW_LOCAL_HTTP:'true'}]){
    const f=fixture();Object.assign(f.admin,patch);assert.throws(()=>validate(f));
  }
  const serviceJwt=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({role:'service_role',ref})).toString('base64url'),'fixture'].join('.');
  const f=fixture();f.admin.SUPABASE_PUBLISHABLE_KEY=serviceJwt;assert.throws(()=>validate(f),/public key/);
  for(const flag of ['TRUE','1','yes',' true ']) {
    const mock=fixture();mock.mobile.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS=flag;assert.throws(()=>validate(mock),/must explicitly be true or false/);
  }
  const mismatch=fixture();mismatch.mobile.EXPO_PUBLIC_SUPABASE_PROJECT_REF='b'.repeat(20);
  mismatch.mobile.EXPO_PUBLIC_SUPABASE_URL='https://'+'b'.repeat(20)+'.supabase.co';
  assert.throws(()=>validate(mismatch),/Admin\/Mobile disagree/);
  assert.throws(()=>validate(fixture(),{APP_ENV:'production'}),/shell\/file disagreement/);
  assert.doesNotThrow(()=>validate(fixture(),fixture().admin));
});
test('file loader uses only two explicit private files; base env cannot become a fallback',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ingly-staging-verifier-'));
  try {
    for(const client of ['admin','mobile']){
      fs.mkdirSync(path.join(directory,client));fs.writeFileSync(path.join(directory,client,'.env'),'APP_ENV=production\n');
    }
    assert.throws(()=>loadConfiguration(directory,{}),/Missing admin\/\.env.staging.local/);
    for(const [client,values]of Object.entries(fixture()))fs.writeFileSync(path.join(directory,files[client]),
      Object.entries(values).map(([k,v])=>k+'='+v).join('\n'));
    assert.equal(loadConfiguration(directory,{}).configs.mobile.projectRef,ref);
    fs.appendFileSync(path.join(directory,files.admin),'\nAPP_ENV=production\n');
    assert.throws(()=>loadConfiguration(directory,{}),/duplicate env/);
  } finally {
    // Explicit files only: never recursive-delete a computed directory on Windows.
    for(const client of ['admin','mobile']) {
      for(const file of ['.env','.env.staging.local'])fs.rmSync(path.join(directory,client,file),{force:true});
      fs.rmdirSync(path.join(directory,client));
    }
    fs.rmdirSync(directory);
  }
});
test('manifest rejects changed checksum, ordering, missing file entry and ambiguous mapping',()=>{
  const m=verifyManifest();
  assert.equal(m.executionApproved,false);assert.equal(m.projectRef,null);
  for(const edit of [x=>x.migrations[0].sha256='0'.repeat(64),x=>x.migrations.reverse(),
    x=>x.migrations.pop(),x=>x.migrations[1].proposedUniqueVersion=x.migrations[0].proposedUniqueVersion,
    x=>x.duplicateSourceVersions=[],x=>x.executionApproved=true]) {
    const changed=structuredClone(m);edit(changed);assert.throws(()=>verifyManifest(changed));
  }
});
test('fresh plan inventories before schema; existing plan preserves all three migrations in order',()=>{
  for(const baseline of ['fresh','existing']){
    const p=preparePlan({environment:'staging',projectRef:ref,baseline});
    assert.equal(p.executionApproved,false);assert.equal(p.targetVerifiedRemotely,false);
    assert.equal(p.steps[0].file,baseline==='fresh'?'backend/supabase_fresh_preflight.sql':'backend/supabase_migration_preflight.sql');
    const migrations=p.steps.filter(s=>s.proposedUniqueVersion);
    assert.deepEqual(migrations.map(s=>s.proposedUniqueVersion),baseline==='fresh'
      ?['20261005000000','20261005000200','20261006000100']:['20261005000100','20261005000200','20261006000100']);
    assert(p.steps.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));
  }
});
test('CLI has no force, auth, SQL or deployment entry point',()=>{
  const script=path.join(__dirname,'../scripts/staging-readiness.cjs');
  for(const args of [['verify','--force'],['deploy'],['sql'],['auth'],['mobile-export','web'],['plan','production']]){
    assert.throws(()=>execFileSync(process.execPath,[script,...args],{stdio:'pipe'}),error=>{
      assert.equal(error.status,1);assert(error.stderr.toString().includes('No force, deploy or SQL'));return true;
    });
  }
});
test('checked build/export commands pin verified env, disable Expo dotenv and never pass credentials as arguments',()=>{
  const script=path.join(__dirname,'../scripts/staging-readiness.cjs'),realRequire=createRequire(script);
  const source=fs.readFileSync(script,'utf8');
  for(const flag of ['false','true']) {
  const f=fixture();f.mobile.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS=flag;
  const virtualFiles=new Map(Object.entries(files).map(([client,file])=>[
    path.resolve(__dirname,'..',file),Object.entries(f[client]).map(([k,v])=>k+'='+v).join('\n')]));
  for(const args of [['verify'],['admin-build'],['mobile-export','android'],['mobile-export','ios'],['plan','fresh']]) {
    const calls=[],logs=[],contextModule={exports:{}};
    const requireMock=name=>name==='node:fs'?{...fs,
      existsSync:p=>virtualFiles.has(p)||fs.existsSync(p),
      readFileSync:(p,...rest)=>virtualFiles.has(p)?virtualFiles.get(p):fs.readFileSync(p,...rest)}:
      name==='node:child_process'?{spawnSync:(...call)=>{calls.push(call);return {status:0};}}:realRequire(name);
    requireMock.main=contextModule;
    const context={require:requireMock,module:contextModule,__dirname:path.dirname(script),
      process:{argv:[process.execPath,script,...args],execPath:process.execPath,env:{}},
      console:{log:s=>logs.push(s),error:s=>{throw new Error(s);}}};
    vm.runInNewContext(source,context,{filename:script});
    assert(!logs.join('\n').includes(key));
    assert.equal(calls.length,args[0]==='admin-build'?2:args[0]==='mobile-export'?1:0);
    for(const [executable,command,options]of calls) {
      assert.equal(executable,process.execPath);assert(!command.join(' ').includes(key));
      assert.equal(options.env.APP_ENV,'staging');assert.equal(options.env.EXPO_PUBLIC_APP_ENV,'staging');
      assert.equal(options.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,ref);
      assert.equal(options.env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS,flag);
      assert.equal(options.env.EXPO_NO_DOTENV,'1');assert.equal(options.env.EXPO_OFFLINE,'1');
      assert.equal(options.env.SUPABASE_SERVICE_ROLE_KEY,undefined);
      if(args[0]==='mobile-export') {
        assert(command.includes('dist/staging-'+args[1]));assert(command.includes('--clear'));
      }
    }
  }
  }
});
(async()=>{let failed=0;for(const [name,run]of tests){try{await run();console.log('PASS: '+name);}catch(e){failed++;console.error('FAIL: '+name,e);}}
  console.log(`STAGING READINESS: ${tests.length-failed} PASS, ${failed} FAIL. Local fixtures only.`);process.exitCode=failed?1:0;})();
