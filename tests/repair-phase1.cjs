const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const parser = require('../mobile/node_modules/@babel/parser');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ast = s => parser.parse(s, { sourceType: 'unambiguous', plugins: ['jsx'] });
function walk(n, fn) {
  if (!n || typeof n !== 'object') return;
  fn(n);
  for (const [k,v] of Object.entries(n)) if (k !== 'loc') {
    if (Array.isArray(v)) v.forEach(x => walk(x,fn));
    else if (v && typeof v === 'object') walk(v,fn);
  }
}
const scripts = {};
for (const f of ['admin/index.html', 'admin/preview.html']) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(read(f)))) if (m[2].trim()) {
    ast(m[2]);
    if (m[1].includes('text/babel')) scripts[f] = m[2];
  }
  assert(!read(f).includes('admin123'));
}
function extract(s, name) {
  let found;
  walk(ast(s), n => { if (n.type === 'VariableDeclarator' && n.id.name === name) found = s.slice(n.init.start,n.init.end); });
  assert(found, name);
  return found;
}
function harness(result) {
  const state = { users: [{id:'existing',username:'existing'}], messages:[], payload:null };
  const chain = { insert(p) {state.payload=p;return this;}, delete(){return this;}, eq(){return this;}, select(){return this;}, single(){return Promise.resolve(result);}, then(ok,bad){return Promise.resolve(result).then(ok,bad);} };
  const context = {
    users: state.users, newUserForm:{username:'newuser',password:'abcdef',phone:'',name:'Test',isVip:false},
    isSavingNewUser:false,supabaseClient:{from:()=>chain},
    window:{inglyAuth:{authorize:async()=>({id:'admin'}),manage:async(action,payload)=>{state.payload=[payload];const r=await result;if(r.error)throw new Error(r.error.message);return action==='deleteUser'?(Array.isArray(r.data)?r.data[0]:r.data):r.data;}}},
    setUsers: fn => {state.users=fn(state.users);context.users=state.users;},
    setIsSavingNewUser:()=>{},setShowAddUserModal:()=>{},setNewUserForm:()=>{},
    showToast:x=>state.messages.push(x), alert:x=>state.messages.push(x),confirm:()=>true,Date,console
  };
  vm.createContext(context);
  for (const name of ['handleCreateUser','handleDeleteUser']) context[name]=vm.runInContext('('+extract(scripts['admin/index.html'],name)+')',context);
  return {state,context};
}
(async () => {
  for (const f of ['admin/index.html','admin/preview.html']) {
    let blocked=false;
    const login={adminLoginInput:'secondary@example.com',adminPasswordInput:'configured',window:{inglyAuth:{login:async()=>{throw new Error('Not authorized')}}},setAdminPasswordInput:()=>{},setAuthError:()=>{blocked=true}};
    vm.createContext(login);
    await vm.runInContext('('+extract(scripts[f],'handleAdminLogin')+')',login)();
    assert(blocked);
  }
  let release;
  let pending=harness(new Promise(resolve=>{release=resolve}));
  const creating=pending.context.handleCreateUser();
  assert.equal(pending.state.users.length,1);assert.equal(pending.state.messages.length,0);
  release({error:null,data:{id:'confirmed'}});await creating;assert.equal(pending.state.users[0].id,'confirmed');
  let h=harness({error:{message:'Denied'},data:null});
  await h.context.handleCreateUser();
  assert.equal(h.state.users.length,1);assert(h.state.messages[0].includes('Denied'));
  await h.context.handleDeleteUser('existing','existing','Existing');assert.equal(h.state.users.length,1);
  h=harness({error:null,data:{id:'server-uuid',username:'newuser',full_name:'Test',phone:null}});
  await h.context.handleCreateUser();assert.equal(h.state.users[0].id,'server-uuid');assert.equal(h.state.payload[0].phone,null);
  h=harness({error:null,data:{id:'server-uuid'}});h.context.newUserForm.phone='+998 90 123 45 67';
  await h.context.handleCreateUser();assert.equal(h.state.payload[0].phone,'+998901234567');
  for(const updates of [{password:'12345'},{phone:'+998'},{phone:'abc901234567'}]) {
    h=harness({error:null,data:{id:'server-uuid'}});Object.assign(h.context.newUserForm,updates);
    await h.context.handleCreateUser();assert.equal(h.state.payload,null);assert.equal(h.state.users.length,1);
  }
  h=harness({error:null,data:[]});await h.context.handleDeleteUser('existing','existing','Existing');assert.equal(h.state.users.length,1);
  h=harness({error:null,data:[{id:'existing'}]});await h.context.handleDeleteUser('existing','existing','Existing');assert.equal(h.state.users.length,0);
  h=harness({error:null,data:null});h.context.supabaseClient=null;await h.context.handleCreateUser();assert.equal(h.state.users.length,1);
  const my=read('mobile/src/screens/MyWordsScreen.js');
  assert(!my.includes('recordWordLearned'));assert(!my.includes('initialSamples'));
  let loaded;
  const c={account:{current:'account'},getCustomWords:async()=>[],isStorageSessionCurrent:()=>true,setWordsList:x=>loaded=x};vm.createContext(c);
  await vm.runInContext('('+extract(my,'loadWords')+')',c)();assert.equal(loaded.length,0);
  const babel=require('../mobile/node_modules/@babel/core');
  const code=babel.transformSync(read('mobile/src/services/leaderboardService.js'),{babelrc:false,configFile:false,plugins:[require.resolve('../mobile/node_modules/@babel/plugin-transform-modules-commonjs')]}).code;
  const memory=new Map();
  const board={exports:{},console,Date,Map,Set,Math,require:k=>k.includes('supabaseClient')?{isSupabaseConfigured:()=>false}:{getStorageAccountId:()=> 'account',captureStorageSession:()=>({owner:'account',generation:1}),isStorageSessionCurrent:()=>true,STORAGE_KEYS:{CUSTOM_WORDS:'custom'},getStorageItem:async(k,d)=>k==='custom'?[{learned:true}]:memory.get(k)||d,setStorageItem:async(k,v)=>memory.set(k,v)}};
  vm.runInNewContext(code,board);
  const user={id:'account',username:'test',totalWordsLearned:5};
  await board.exports.syncUserLeaderboardScore(user);await board.exports.syncUserLeaderboardScore(user);
  const entry=memory.get('ingly_cached_leaderboard')[0];assert.equal(entry.bookWords,5);assert.equal(entry.customWords,1);assert.equal(entry.totalWords,6);assert.equal(user.totalWordsLearned,5);
  let files=[];
  function scan(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())scan(f);else if(/\.(js|jsx)$/.test(f))files.push(f);}}
  scan(path.join(root,'mobile/src'));scan(path.join(root,'admin/src'));files.push(path.join(root,'mobile/App.js'));
  for(const f of files)walk(ast(fs.readFileSync(f,'utf8')),n=>{
    const k=n.type==='ImportDeclaration'?n.source.value:null;
    if(k && k.startsWith('.'))assert(['','.js','.jsx','.json','/index.js'].some(x=>fs.existsSync(path.resolve(path.dirname(f),k)+x)), f+': '+k);
  });
  const config=JSON.parse(read('mobile/app.json')).expo;
  for(const f of [config.icon,config.web.favicon])assert.equal(fs.readFileSync(path.join(root,'mobile',f)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  console.log('PASS: inline parsers, imports, create/delete outcomes, phone/password validation, disabled fallback, empty MyWords, single custom contribution, PNG configuration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
