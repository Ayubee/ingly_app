// Offline fixtures only. Exercise the existing staging simulator and real storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../mobile/node_modules/@babel/core');
const environment = require('../shared/environment.cjs');
const root = path.resolve(__dirname,'..');
const ref = 'abcdefghijklmnopqrst';
const publicKey = 'sb_publishable_offline_fixture_not_a_real_key';
const config = environment.resolveEnvironment({environment:'staging',url:'https://'+ref+'.supabase.co',
  expectedProjectRef:ref,publicKey,enableMockPayments:true});
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setTimeout(resolve,10));
function moduleAt(file,deps,globals={}) {
  const source = fs.readFileSync(path.join(root,file),'utf8');
  const code = babel.transformSync(source,{filename:file,babelrc:false,configFile:false,plugins:[
    require.resolve('../mobile/node_modules/@babel/plugin-transform-modules-commonjs'),
    require.resolve('../mobile/node_modules/@babel/plugin-transform-react-jsx')]}).code;
  const context = {exports:{},console,Date,Map,Set,Math,setTimeout,clearTimeout,...globals,
    require:name=>{assert(name in deps,'Unmocked import: '+name);return deps[name];}};
  vm.runInNewContext(code,context,{filename:file});return context.exports;
}
function storageAt(target,memory) {
  return moduleAt('mobile/src/services/storage.js',{
    './environment.js':{isolateStorage:s=>environment.scopeAsyncStorage(s,target)},
    '@react-native-async-storage/async-storage':{default:{getItem:async k=>memory.get(k)??null,
      setItem:async(k,v)=>memory.set(k,v),removeItem:async k=>memory.delete(k),getAllKeys:async()=>[...memory.keys()]}}});
}
function settingsAt(storage,dev,flag) {
  const deny=()=>{throw new Error('Mock payment attempted a cloud call');};
  return moduleAt('mobile/src/services/appSettingsService.js',{
    './storage':storage,'./supabaseClient':{isSupabaseConfigured:()=>false,supabase:{from:deny,rpc:deny}}},
    {__DEV__:dev,process:{env:{EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS:flag}}});
}
function providerAt(storage,dev,flag) {
  const states=[],refs=[],effects=[];let stateIndex=0,refIndex=0,mounted=false,authEvent;
  const session=id=>({user:{id},access_token:id+'-offline-token'});
  const React={createContext:()=>({Provider:'provider'}),createElement:(_type,props)=>props,
    useContext:()=>null,useRef:value=>refs[refIndex++]||=( {current:value}),
    useState:value=>{const id=stateIndex++;if(!(id in states))states[id]=value;
      return [states[id],next=>states[id]=typeof next==='function'?next(states[id]):next];},
    useEffect:fn=>{if(!mounted)effects.push(fn);}};
  const user=moduleAt('mobile/src/context/UserContext.js',{
    react:React,'react-native':{Alert:{alert:()=>{}}},'../services/storage.js':storage,
    '../services/userService.js':{fetchUserRemoteStatus:()=>new Promise(()=>{})},
    '../services/syncEngine.js':{startAutoSync:()=>{},stopAutoSync:()=>{}},
    '../services/sessionCache.js':{readCachedAuthSession:async()=>session('A')},
    '../data/all_words.json':[], '../services/leaderboardService.js':{syncUserLeaderboardScore:async()=>{}},
    '../services/supabaseClient.js':{supabase:{auth:{getSession:()=>new Promise(()=>{}),
      onAuthStateChange:fn=>{authEvent=fn;return {data:{subscription:{unsubscribe:()=>{}}}};},signOut:async()=>({})}}},
    '../services/authService.js':{}},{__DEV__:dev,process:{env:{EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS:flag}}});
  const render=()=>{stateIndex=0;refIndex=0;return user.UserProvider({children:null}).value;};
  render();mounted=true;const cleanup=effects[0]();
  return {render,cleanup,switchAccount:id=>authEvent('SIGNED_IN',session(id))};
}
async function main() {
  const memory=new Map(),storage=storageAt(config,memory);storage.setStorageAccountId('A');
  await storage.setStorageItem(storage.STORAGE_KEYS.USER_PROFILE,{id:'A',isPremium:false,purchasedBooks:[]});
  const before=plain(await storage.getStorageItem(storage.STORAGE_KEYS.USER_PROFILE));
  const queued=plain(await storage.getSyncQueue());
  const settings=settingsAt(storage,true,'true');
  const tx=await settings.recordTransaction({itemType:'vip',amount:29000,cardNumber:'synthetic-not-a-card'});
  assert.equal(tx.mock,true);assert.equal(tx.status,'mock');assert(!('cardNumber' in tx));
  assert.deepEqual(plain(await storage.getStorageItem(storage.STORAGE_KEYS.USER_PROFILE)),before);
  assert.deepEqual(plain(await storage.getSyncQueue()),queued);
  assert.equal((await storage.getStorageItem('ingly_transactions'))[0].id,tx.id);
  assert([...memory.keys()].some(k=>k.startsWith(config.storagePrefix+'@ingly_account:A:')));
  const production=environment.resolveEnvironment({environment:'production',
    url:'https://'+environment.PRODUCTION_PROJECT_REF+'.supabase.co',
    expectedProjectRef:environment.PRODUCTION_PROJECT_REF,publicKey});
  const productionStorage=storageAt(production,memory);productionStorage.setStorageAccountId('A');
  assert.equal(await productionStorage.getStorageItem('ingly_transactions'),null);
  storage.setStorageAccountId('B');assert.equal(await storage.getStorageItem('ingly_transactions'),null);
  storage.setStorageAccountId(null);await assert.rejects(settings.recordTransaction({}),/Authentication required/);
  storage.setStorageAccountId('A');
  for(const [dev,flag] of [[false,'true'],[true,'false']])
    await assert.rejects(settingsAt(storage,dev,flag).recordTransaction({}),/Mock payments disabled/);
  assert.throws(()=>environment.resolveEnvironment({...production,expectedProjectRef:production.projectRef,enableMockPayments:true}),/mock payments/);
  console.log('PASS: mock transactions stay local, account/staging scoped; no cloud, entitlement, sync or production writes.');

  const provider=providerAt(storage,true,'true');await flush();
  let api=provider.render();const profile=plain(await storage.getStorageItem(storage.STORAGE_KEYS.USER_PROFILE));
  assert.equal((await api.subscribeVipMonthly()).mock,true);
  assert.equal((await api.purchaseBook(2)).mock,true);
  api=provider.render();assert.equal(api.isVipActive,true);assert.equal(api.isBookPurchasedOrFree(2),true);
  assert.equal(api.user.isPremium,false);assert.deepEqual(plain(api.user.purchasedBooks),[]);
  assert.deepEqual(plain(await storage.getStorageItem(storage.STORAGE_KEYS.USER_PROFILE)),profile);
  assert.deepEqual(plain(await storage.getSyncQueue()),queued);
  provider.switchAccount('B');await flush();api=provider.render();
  assert.equal(api.isVipActive,false);assert.equal(api.isBookPurchasedOrFree(2),false);
  await api.subscribeVipMonthly();await api.logout();api=provider.render();assert.equal(api.isVipActive,false);
  provider.cleanup();
  const restarted=providerAt(storage,true,'true');await flush();api=restarted.render();
  assert.equal(api.isVipActive,false);assert.equal(api.isBookPurchasedOrFree(2),false);restarted.cleanup();
  console.log('PASS: mock access is temporary React state; protected profile unchanged; account switch, logout and restart clear it.');

  for(const [dev,flag] of [[false,'true'],[true,'false']]) {
    const disabled=providerAt(storage,dev,flag);await flush();api=disabled.render();
    assert.equal((await api.subscribeVipMonthly()).success,false);
    assert.equal((await api.purchaseBook(2)).success,false);
    assert.equal(disabled.render().isVipActive,false);disabled.cleanup();
  }
  console.log('PASS: release runtime (__DEV__ false) and opt-out cannot grant mock VIP/book access.');
  console.log('STAGING PAYMENTS: 3 PASS, 0 FAIL. Offline fixtures only; no remote operations.');
}
main().catch(error=>{console.error('FAIL:',error);process.exitCode=1;});
