// Real mobile modules against controlled storage/network/timers; never calls production.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const babel=require('../mobile/node_modules/@babel/core');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function moduleAt(file,deps={},globals={}){
  const code=babel.transformSync(read(file),{filename:file,babelrc:false,configFile:false,plugins:[
    require.resolve('../mobile/node_modules/@babel/plugin-transform-react-jsx'),
    require.resolve('../mobile/node_modules/@babel/plugin-transform-modules-commonjs')]}).code;
  const ctx={exports:{},console,Date,Map,Set,Math,Promise,AbortController,setTimeout,clearTimeout,...globals,
    require:name=>{assert(name in deps,'Unmocked import: '+name);return deps[name];}};
  vm.runInNewContext(code,ctx,{filename:file});return ctx.exports;
}
function storageFixture(memory=new Map()){
  let paused=null,broken=false;
  const native={getItem:async key=>{const value=memory.get(key)??null;if(paused){const gate=paused;paused=null;await gate.promise;}return value;},
    setItem:async(key,value)=>{if(broken)throw new Error('Disk full');memory.set(key,value);},removeItem:async key=>memory.delete(key)};
  const storage=moduleAt('mobile/src/services/storage.js',{'@react-native-async-storage/async-storage':{default:native}});
  return{storage,memory,pause:gate=>paused=gate,breakWrites:value=>broken=value};
}
function timers(){
  let sequence=0,now=0;const pending=new Map();
  return{setTimeout:(fn,delay=0)=>{const id=++sequence;pending.set(id,{fn,at:now+delay,delay});return id;},
    clearTimeout:id=>pending.delete(id),pending,
    runNext:async()=>{const next=[...pending.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next)return false;
      pending.delete(next[0]);now=next[1].at;next[1].fn();await flush();return true;}};
}
function syncFixture(storage,options={}){
  const clock=timers(),calls=[];let identity=options.identity||'A',events,off=false;
  const conflicts=moduleAt('mobile/src/services/syncConflict.js',{'./storage.js':storage});
  const client={auth:{getSession:async()=>options.sessionPromise?await options.sessionPromise:{data:{session:{user:{id:identity},access_token:identity+'-token'}}}},
    rpc:(name,body)=>{
      const call={name,body};calls.push(call);
      const query={setHeader:(_k,value)=>{call.bearer=value;return query;},abortSignal:signal=>{call.signal=signal;return query;},
        then:(ok,bad)=>Promise.resolve().then(async()=>{
          if(name==='read_learning_sync')return{data:options.snapshot||{epoch:'initial',revision:1,entities:[]},error:null};
          if(options.reply)return options.reply(call);
          return{data:{success:true,acknowledged:body.p_operations.map(op=>({id:op.id,sequence:op.sequence}))},error:null};
        }).then(ok,bad)};return query;
    }};
  const sync=moduleAt('mobile/src/services/syncEngine.js',{'./supabaseClient':{supabase:client},'./storage':storage,
    './syncConflict.js':conflicts,'./networkEvents.js':{subscribeSyncEvents:(recovery,foreground,background)=>{
      events={recovery,foreground,background};return()=>off=true;}}},clock);
  return{sync,calls,clock,events:()=>events,off:()=>off,identity:value=>identity=value,conflicts,client};
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+passed+': '+name);}
(async()=>{
  await test('offline learning commits word, aggregate and outbox atomically; restart preserves operation identity',async()=>{
    const f=storageFixture(),s=f.storage;s.setStorageAccountId('A');
    await s.saveWordProgress(1,'mastered',{book:1,unit:1});
    const q=plain(await s.getSyncQueue());assert.equal(q.length,1);assert.equal(q[0].owner,'A');assert.equal(q[0].changes['word:1'].completed,true);
    const reloaded=storageFixture(f.memory).storage;reloaded.setStorageAccountId('A');
    assert.deepEqual(plain(await reloaded.getSyncQueue()),q);assert.equal((await reloaded.getAllProgress())[1].completed,true);
    assert.equal((await reloaded.getStorageItem(s.STORAGE_KEYS.USER_PROFILE)).totalWordsLearned,1);
  });
  await test('disk failure reports failure and preserves BOTH prior progress and prior outbox',async()=>{
    const f=storageFixture(),s=f.storage;s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');
    const before=f.memory.get('@ingly_account:A:'+s.JOURNAL_KEY);f.breakWrites(true);
    await assert.rejects(s.saveWordProgress(2,'mastered'),/Disk full/);assert.equal(f.memory.get('@ingly_account:A:'+s.JOURNAL_KEY),before);
  });
  await test('serialized concurrent learning avoids lost updates; repeat reviews and custom mastery do not inflate textbooks',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');
    await Promise.all(Array.from({length:20},(_,i)=>s.saveWordProgress(i+1,'mastered',{book:1,unit:1,unitWordIds:Array.from({length:20},(_,j)=>j+1)})));
    await s.saveWordProgress(1,'review',{book:1,unit:1});await s.saveWordProgress(1,'mastered',{book:1,unit:1});
    await s.addCustomWord({id:'custom_one',original:'one',learned:true});
    const p=await s.getStorageItem(s.STORAGE_KEYS.USER_PROFILE);assert.equal(p.totalWordsLearned,20);assert.equal(p.wordsLearnedToday,20);
    assert.equal(p.completedUnits['1:1'],true);assert.equal(p.bookLearnedCounts[1],20);assert.equal((await s.getAllProgress())[1].review_count,3);
  });
  await test('exact acknowledgement removes only its operation/version; newer same-word edit survives',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');
    const [old]=await s.getSyncQueue();await s.markSyncAttempt([old]);await s.saveWordProgress(1,'hard');
    await s.clearSyncQueue([{id:old.id,sequence:old.sequence+1}]);assert.equal((await s.getSyncQueue()).length,2);
    await s.clearSyncQueue([{id:old.id,sequence:old.sequence}]);assert.equal((await s.getSyncQueue()).length,1);
    assert.equal((await s.getSyncQueue())[0].changes['word:1'].status,'hard');await assert.rejects(s.clearSyncQueue([1]));await assert.rejects(s.clearSyncQueue());
  });
  await test('account caches and vocabulary are isolated; A→B→A invalidates delayed private writes',async()=>{
    const f=storageFixture(),s=f.storage;s.setStorageAccountId('A');await s.addCustomWord({id:'A_word',original:'private'});
    const token=s.captureStorageSession(),gate=deferred();f.pause(gate);
    const old=s.addCustomWord({id:'stale',original:'old'},token);await flush();
    s.setStorageAccountId('B');assert.equal((await s.getCustomWords()).length,0);
    s.setStorageAccountId('A');gate.resolve();await assert.rejects(old,/session changed/i);
    assert.equal((await s.getCustomWords()).length,1);assert.equal(s.isStorageSessionCurrent(token),false);
    s.setStorageAccountId(null);assert.equal((await s.getCustomWords()).length,0);
  });
  await test('new token for the SAME account invalidates old generation',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A','old-token');const token=s.captureStorageSession();
    s.setStorageAccountId('A','new-token');await assert.rejects(s.addCustomWord({original:'stale'},token));
    assert.equal(s.isStorageSessionCurrent(token),false);
  });
  await test('malformed current journal and legacy queues fail closed without deleting original bytes',async()=>{
    for(const value of ['{broken',JSON.stringify({schema:3,owner:'A',values:{},outbox:'bad'})]){
      const f=storageFixture(),s=f.storage;s.setStorageAccountId('A');const key='@ingly_account:A:'+s.JOURNAL_KEY;f.memory.set(key,value);
      await assert.rejects(s.getSyncQueue(),/Corrupt/);await assert.rejects(s.saveWordProgress(1,'mastered'));assert.equal(f.memory.get(key),value);
    }
    const f=storageFixture(),s=f.storage;s.setStorageAccountId('A');const key='@ingly_account:A:'+s.STORAGE_KEYS.SYNC_QUEUE;f.memory.set(key,'{"not":"array"}');
    await assert.rejects(s.getSyncQueue(),/Corrupt/);assert.equal(f.memory.get(key),'{"not":"array"}');
  });
  await test('only explicitly owned Phase 2 data migrates; unscoped historical data stays quarantined',async()=>{
    const f=storageFixture(),s=f.storage,k=s.STORAGE_KEYS;f.memory.set(k.CUSTOM_WORDS,'[{"id":"unknown-owner"}]');
    f.memory.set('@ingly_account:A:'+k.CUSTOM_WORDS,'[{"id":"owned_A","original":"owned"}]');
    f.memory.set('@ingly_account:A:'+k.SYNC_QUEUE,'[{"word_id":1,"status":"mastered"}]');
    s.setStorageAccountId('B');assert.equal((await s.getCustomWords()).length,0);
    s.setStorageAccountId('A');assert.equal((await s.getCustomWords())[0].id,'owned_A');
    const changes=(await s.getSyncQueue())[0].changes;assert(changes['word:1']&&changes['custom:owned_A']);
    assert(f.memory.has(k.CUSTOM_WORDS));
  });
  await test('successful RPC acks exact IDs; empty queue causes no additional network calls',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const f=syncFixture(s);
    assert.equal((await f.sync.syncOfflineProgress()).success,true);assert.equal((await s.getSyncQueue()).length,0);
    const calls=f.calls.length;assert.equal((await f.sync.syncOfflineProgress()).success,true);assert.equal(f.calls.length,calls);
    const call=f.calls.find(c=>c.name==='sync_learning_operations');assert.equal(call.bearer,'Bearer A-token');assert(!('p_user_id' in call.body));
  });
  await test('failed RPC and invalid/partial acknowledgements retain pending operations',async()=>{
    for(const reply of [{error:{message:'Offline'},data:null}, {error:null,data:{success:true,acknowledged:[]}},
      {error:null,data:{success:true,synced_count:100}}, {error:null,data:{success:true,acknowledged:[{id:'invented',sequence:1}]}}]){
      const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const f=syncFixture(s,{reply:()=>reply});
      assert.equal((await f.sync.syncOfflineProgress()).success,false);assert.equal((await s.getSyncQueue()).length,1);assert.equal((await s.getSyncQueue())[0].attempts,1);
    }
  });
  await test('old in-flight response preserves a newer edit and cannot overwrite its word/daily progress',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const gate=deferred();
    const f=syncFixture(s,{reply:call=>gate.promise.then(()=>({data:{success:true,acknowledged:call.body.p_operations.map(op=>({id:op.id,sequence:op.sequence})),current_streak:0},error:null}))});
    const pending=f.sync.syncOfflineProgress();await flush();await s.saveWordProgress(1,'hard');await s.saveWordProgress(2,'mastered');gate.resolve();await pending;
    assert.equal((await s.getSyncQueue()).length,1);assert.equal((await s.getAllProgress())[1].status,'hard');assert.equal((await s.getUserStreak()).words_learned_today,2);
  });
  await test('processor mutex is acquired BEFORE asynchronous storage/Auth operations',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const gate=deferred();
    const f=syncFixture(s,{reply:()=>gate.promise});const one=f.sync.syncOfflineProgress(),two=await f.sync.syncOfflineProgress();
    assert.equal(two.reason,'sync_already_in_progress');await flush();assert.equal(f.calls.filter(c=>c.name==='sync_learning_operations').length,1);
    const batch=f.calls.find(c=>c.name==='sync_learning_operations').body.p_operations;gate.resolve({data:{success:true,acknowledged:batch.map(op=>({id:op.id,sequence:op.sequence}))},error:null});await one;
  });
  await test('mismatched SDK account cannot send A outbox using B JWT',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const f=syncFixture(s,{identity:'B'});
    assert.equal((await f.sync.syncOfflineProgress()).reason,'auth');assert.equal(f.calls.length,0);assert.equal((await s.getSyncQueue()).length,1);
  });
  await test('logout and A→B→A invalidate in-flight acknowledgement and retain both queues',async()=>{
    for(const switchBack of [false,true]){
      const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const gate=deferred();
      const f=syncFixture(s,{reply:call=>gate.promise.then(()=>({data:{success:true,acknowledged:call.body.p_operations.map(op=>({id:op.id,sequence:op.sequence}))},error:null}))});
      const pending=f.sync.syncOfflineProgress();await flush();s.setStorageAccountId(null);f.sync.stopAutoSync();s.setStorageAccountId('B');await s.saveWordProgress(2,'review');
      if(switchBack)s.setStorageAccountId('A');gate.resolve();assert.equal((await pending).success,false);
      s.setStorageAccountId('A');assert.equal((await s.getSyncQueue()).length,1);s.setStorageAccountId('B');assert.equal((await s.getSyncQueue()).length,1);
    }
  });
  await test('auth/permanent failures keep the outbox and do not schedule automatic retries',async()=>{
    for(const reply of [{error:{message:'Expired',code:'PGRST301'},status:401},{error:{message:'Invalid',code:'22023'},status:400}]){
      const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const f=syncFixture(s,{reply:()=>reply});
      f.sync.startAutoSync();await f.clock.runNext();assert.equal((await s.getSyncQueue()).length,1);assert.equal(f.clock.pending.size,0);
      assert(['auth','permanent'].includes((await f.sync.getSyncStatus()).blocked_reason));f.sync.stopAutoSync();assert(f.off());
    }
  });
  await test('offline mutation stays local; network restoration and foreground events trigger sync',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');const f=syncFixture(s);f.sync.startAutoSync();f.events().background('offline');
    await s.saveWordProgress(1,'mastered');assert.equal(f.calls.length,0);assert.equal(f.clock.pending.size,0);
    f.events().recovery();await f.clock.runNext();assert.equal((await s.getSyncQueue()).length,0);
    f.events().foreground();await f.clock.runNext();assert(f.calls.filter(c=>c.name==='read_learning_sync').length===2);f.sync.stopAutoSync();
  });
  await test('transient retries use bounded backoff; idle engine has no polling timer',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const f=syncFixture(s,{reply:()=>({error:{message:'Network'},data:null})});
    f.sync.startAutoSync();await f.clock.runNext();let attempts=1;
    while(f.clock.pending.size){const timer=[...f.clock.pending.values()][0];assert(timer.delay>=2500&&timer.delay<=138000);await f.clock.runNext();attempts++;assert(attempts<=6);}
    assert.equal(attempts,6);assert.equal((await f.sync.getSyncStatus()).blocked_reason,'transient');assert.equal((await s.getSyncQueue()).length,1);
    f.sync.stopAutoSync();assert(!read('mobile/src/services/syncEngine.js').includes('setInterval'));
    assert(read('mobile/src/services/networkEvents.js').includes('reachabilityShouldRun: () => false'));
  });
  await test('hung SDK request times out, releases mutex, and preserves queue',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const gate=deferred();
    const f=syncFixture(s,{sessionPromise:gate.promise});const pending=f.sync.syncOfflineProgress();await flush();await f.clock.runNext();
    assert.equal((await pending).reason,'transient');assert.equal((await f.sync.getSyncStatus()).is_syncing,false);assert.equal((await s.getSyncQueue()).length,1);
  });
  await test('server snapshot preserves pending entities, unions completion, and never reduces aggregate progress',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered',{book:1});await s.saveWordProgress(1,'hard',{book:1});
    const f=syncFixture(s);await f.conflicts.mergeRemoteSnapshot({epoch:'initial',revision:2,entities:[
      {entity_key:'word:1',payload:{word_id:1,status:'review',completed:false,review_count:1}},
      {entity_key:'word:2',payload:{word_id:2,status:'mastered',completed:true,book:1,review_count:1}},
      {entity_key:'learning',payload:{totalWordsLearned:0,streakDays:0,wordsLearnedToday:0}}]},s.captureStorageSession());
    assert.equal((await s.getAllProgress())[1].status,'hard');assert.equal((await s.getAllProgress())[1].completed,true);
    assert.equal((await s.getStorageItem(s.STORAGE_KEYS.USER_PROFILE)).totalWordsLearned,2);assert.equal((await s.getSyncQueue()).length,1);
  });
  await test('reset clears local textbook state atomically, keeps custom words, and queues an epoch boundary',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');await s.addCustomWord({id:'mine',original:'mine'});
    await s.resetLocalProgress();assert.deepEqual(plain(await s.getAllProgress()),{});assert.equal((await s.getCustomWords()).length,1);
    const reset=(await s.getSyncQueue()).find(op=>op.action==='reset');assert(reset.next_epoch&&reset.epoch!==reset.next_epoch);
    await s.saveWordProgress(2,'mastered');assert.equal((await s.getSyncQueue()).at(-1).epoch,reset.next_epoch);
    const f=syncFixture(s);await f.conflicts.mergeRemoteSnapshot({epoch:'initial',revision:2,entities:[{entity_key:'word:1',payload:{completed:true}}]},s.captureStorageSession());
    assert.equal((await s.getAllProgress())[1],undefined);
  });
  await test('remote reset conflict retains offline changes rather than guessing or silently clearing them',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');
    const f=syncFixture(s,{snapshot:{epoch:'other-device-reset',revision:3,entities:[]}});assert.equal((await f.sync.syncOfflineProgress()).reason,'conflict');
    assert.equal((await s.getSyncQueue()).length,1);
  });
  await test('valid SDK cache restores local identity; profile-only and expired cache cannot authenticate',async()=>{
    const {storage:s}=storageFixture();const cache=moduleAt('mobile/src/services/sessionCache.js',{'./storage.js':s});
    await s.authStorage.setItem('ingly_supabase_auth_v2',JSON.stringify({user:{id:'A'},access_token:'token',refresh_token:'refresh',expires_at:Date.now()/1000+600}));
    assert.equal((await cache.readCachedAuthSession()).user.id,'A');
    await s.authStorage.setItem('ingly_supabase_auth_v2',JSON.stringify({user:{id:'A'},access_token:'token',refresh_token:'refresh',expires_at:1}));
    assert.equal(await cache.readCachedAuthSession(),null);await s.authStorage.removeItem('ingly_supabase_auth_v2');
    s.setStorageAccountId('A');await s.setStorageItem(s.STORAGE_KEYS.USER_PROFILE,{id:'A',isLoggedIn:true});assert.equal(await cache.readCachedAuthSession(),null);
  });
  await test('UserProvider renders cached progress before unresolved SDK/network work completes',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.setStorageItem(s.STORAGE_KEYS.USER_PROFILE,{id:'A',name:'Cached',totalWordsLearned:4,isPremium:true,unlockedBooks:[1,2,3,4,5,6]});s.setStorageAccountId(null);
    await s.authStorage.setItem('ingly_supabase_auth_v2',JSON.stringify({user:{id:'A'},access_token:'token',refresh_token:'refresh',expires_at:Date.now()/1000+600}));
    const cache=moduleAt('mobile/src/services/sessionCache.js',{'./storage.js':s}),gate=deferred(),states=[],effects=[];let hook=0;
    const React={createContext:()=>({Provider:'provider'}),createElement:()=>null,useContext:()=>null,useRef:value=>({current:value}),
      useState:value=>{const id=hook++;states[id]=value;return[value,next=>states[id]=typeof next==='function'?next(states[id]):next];},useEffect:fn=>effects.push(fn)};
    const user=moduleAt('mobile/src/context/UserContext.js',{'react':React,'react-native':{Alert:{alert:()=>{}}},'../services/storage.js':s,
      '../services/userService.js':{fetchUserRemoteStatus:()=>gate.promise},'../services/syncEngine.js':{startAutoSync:()=>{},stopAutoSync:()=>{}},
      '../services/sessionCache.js':cache,'../data/all_words.json':JSON.parse(read('mobile/src/data/all_words.json')),
      '../services/leaderboardService.js':{syncUserLeaderboardScore:async()=>{}},'../services/supabaseClient.js':{supabase:{auth:{getSession:()=>gate.promise,onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})}}},
      '../services/authService.js':{}},{process:{env:{}},__DEV__:false});
    user.UserProvider({children:null});const cleanup=effects[0]();await flush();await flush();assert.equal(states[1],false);
    assert.equal(states[0].id,'A');assert.equal(states[0].totalWordsLearned,4);assert.equal(states[0].isPremium,false);
    await s.saveWordProgress(1,'mastered');await flush();assert.equal(states[0].isPremium,false);assert.deepEqual(plain(states[0].unlockedBooks),[1]);cleanup();
  });
  await test('native network adapter uses connection/lifecycle events, avoids background recovery, and cleans listeners',async()=>{
    let network,lifecycle,config,removed=0,recoveries=0,foregrounds=0;
    const adapter=moduleAt('mobile/src/services/networkEvents.js',{'@react-native-community/netinfo':{configure:c=>config=c,
      addEventListener:fn=>{network=fn;return()=>removed++;},refresh:async()=>{}},'react-native':{AppState:{currentState:'active',
      addEventListener:(_name,fn)=>{lifecycle=fn;return{remove:()=>removed++};}}}});
    const cleanup=adapter.subscribeSyncEvents(()=>recoveries++,()=>foregrounds++,()=>{});assert.equal(config.reachabilityShouldRun(),false);
    network({isConnected:false,type:'none'});network({isConnected:true,type:'wifi'});network({isConnected:true,type:'wifi'});assert.equal(recoveries,1);
    lifecycle('background');network({isConnected:true,type:'cellular'});assert.equal(recoveries,1);lifecycle('active');assert.equal(foregrounds,1);
    cleanup();assert.equal(removed,2);
  });
  await test('bundled lesson content opens without any Supabase calls and uses the actual course IDs',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');const words=moduleAt('mobile/src/services/wordsData.js',{'./storage':s,'../data/all_words.json':JSON.parse(read('mobile/src/data/all_words.json'))});
    const list=await words.getUnitWords(2,1);assert.equal(list.length,20);assert.equal(list[0].id,601);assert.equal(list[0].word,JSON.parse(read('mobile/src/data/all_words.json')).find(w=>w.id===601).word);
    const source=read('mobile/src/screens/LearnScreen.js'),tree=require('../mobile/node_modules/@babel/parser').parse(source,{sourceType:'module',plugins:['jsx']});let action;
    function find(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id.name==='handleOpenUnit')action=source.slice(node.init.start,node.init.end);
      for(const [key,value] of Object.entries(node))if(key!=='loc')Array.isArray(value)?value.forEach(find):find(value);}
    find(tree);assert(action);const gate=deferred();let navigated=0;
    const handler=vm.runInNewContext('('+action+')',{account:{current:s.captureStorageSession()},isStorageSessionCurrent:s.isStorageSessionCurrent,
      setActiveLesson:()=>gate.promise,selectedBook:2,onNavigate:()=>navigated++,Alert:{alert:()=>{}}});
    const pending=handler(1);assert.equal(navigated,0);gate.resolve();await pending;assert.equal(navigated,1);
  });
  await test('Phase 3 SQL statically preserves auth.uid, grants, RLS, transaction receipts and safe search paths',async()=>{
    const sql=read('backend/migrations/20261005_repair_phase3_offline_sync.sql');
    assert(sql.includes('actor UUID := auth.uid()'));assert(!/p_user_id/.test(sql));assert.equal((sql.match(/SECURITY DEFINER SET search_path = ''/g)||[]).length,2);
    const helperSchema=read('backend/migrations/20261005_security_phase2.sql').match(/FUNCTION (\w+)\.active_account\(/)[1];
    assert(sql.includes('ENABLE ROW LEVEL SECURITY'));assert(sql.includes('user_id=auth.uid() AND '+helperSchema+'.active_account()'));
    assert(sql.includes('FUNCTION '+helperSchema+'.merge_learning_state'));assert(!/\bprivate\./.test(sql));
    assert(sql.includes('PRIMARY KEY(user_id,operation_id)'));assert(sql.includes('FOR UPDATE'));assert(sql.includes("canonical := op - 'attempts' - 'last_attempt_at'"));
    assert(sql.includes('FROM PUBLIC, anon, authenticated'));assert(sql.includes('TO authenticated'));assert(!/GRANT EXECUTE[^;]+TO (?:anon|PUBLIC)/i.test(sql));
    assert(sql.trim().endsWith('COMMIT;'));assert(!read('mobile/src/context/UserContext.js').includes('syncUserWithSupabase'));
    assert(!read('mobile/src/services/wordsData.js').includes(".from('words')"));
  });
  await test('tail compaction creates a new identity; an acknowledgement captured before compaction cannot erase it',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');const [captured]=await s.getSyncQueue();
    await s.saveWordProgress(1,'hard');await s.saveWordProgress(2,'mastered');const q=await s.getSyncQueue();
    assert.equal(q.length,1);assert.notEqual(q[0].id,captured.id);assert(q[0].changes['word:1']&&q[0].changes['word:2']);
    await s.clearSyncQueue([{id:captured.id,sequence:captured.sequence}]);assert.equal((await s.getSyncQueue()).length,1);
  });
  await test('paged journal limits individual values; interruption before manifest commit leaves old state readable',async()=>{
    const memory=new Map();let hold=null;
    const native={getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>{
      if(k.includes(':page:')&&hold){const gate=hold;hold=null;memory.set(k,v);await gate.promise;}else memory.set(k,v);
    },removeItem:async k=>memory.delete(k)};
    const open=()=>moduleAt('mobile/src/services/storage.js',{'@react-native-async-storage/async-storage':{default:native}});
    const s=open();s.setStorageAccountId('A');await s.saveWordProgress(1,'mastered');
    const gate=deferred();hold=gate;const interrupted=s.setStorageItem('@ingly_translation_cache',[{query:'large',result:{text:'a'.repeat(200000)}}]);await flush();
    const restarted=open();restarted.setStorageAccountId('A');assert.equal((await restarted.getAllProgress())[1].completed,true);
    assert.equal((await restarted.getStorageItem('@ingly_translation_cache',[])).length,0);
    s.setStorageAccountId(null);gate.resolve();assert.equal(await interrupted,false);
    await restarted.setStorageItem('@ingly_translation_cache',[{query:'large',result:{text:'a'.repeat(200000)}}]);
    const manifest=JSON.parse(memory.get('@ingly_account:A:'+s.JOURNAL_KEY));assert(manifest.parts.length>1);
    assert(manifest.parts.every(k=>memory.get(k).length<=65536));assert.equal((await restarted.getStorageItem('@ingly_translation_cache'))[0].result.text.length,200000);
  });
  await test('translation cache is durable and private; known bundled vocabulary and cached translations work offline',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');let requests=0,offline=false;
    const translator=moduleAt('mobile/src/services/translatorService.js',{'./storage.js':s,'../data/all_words.json':JSON.parse(read('mobile/src/data/all_words.json'))},
      {fetch:async()=>{requests++;if(offline)throw new Error('Offline');return{ok:true,json:async()=>['test translation']};}});
    assert((await translator.translateText('afraid')).isLocal);assert.equal(requests,0);
    assert((await translator.translateText('nonexistentword_xyz')).success);const count=requests;offline=true;
    assert((await translator.translateText('nonexistentword_xyz')).isCached);assert.equal(requests,count);
    s.setStorageAccountId('B');assert.equal((await translator.translateText('nonexistentword_xyz')).success,false);assert(requests>count);
    s.setStorageAccountId('A');assert((await translator.translateText('nonexistentword_xyz')).isCached);
  });
  await test('learning snapshot fields cannot change premium/roles; stale profile fetch cannot query the replacement account',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');const gate=deferred();let queried=0;
    const service=moduleAt('mobile/src/services/userService.js',{'./storage.js':s,'./supabaseClient.js':{supabase:{auth:{getSession:()=>gate.promise},from:()=>{queried++;throw new Error('Should not query');}}}});
    const pending=service.fetchUserRemoteStatus();s.setStorageAccountId('B');gate.resolve({data:{session:{user:{id:'B'},access_token:'B-token'}}});
    await assert.rejects(pending,/identity changed/);assert.equal(queried,0);
    const f=syncFixture(s);const merged=f.conflicts.mergeLearning({isPremium:false,totalWordsLearned:5},{isPremium:true,role:'admin',totalWordsLearned:2});
    assert.equal(merged.isPremium,false);assert.equal(merged.role,undefined);assert.equal(merged.totalWordsLearned,5);
  });
  await test('delayed profile validation cannot overwrite a newer preference even after its operation was acknowledged',async()=>{
    const {storage:s}=storageFixture();s.setStorageAccountId('A');await s.setStorageItem(s.STORAGE_KEYS.USER_PROFILE,{id:'A',name:'Cached'});s.setStorageAccountId(null);
    await s.authStorage.setItem('ingly_supabase_auth_v2',JSON.stringify({user:{id:'A'},access_token:'token',refresh_token:'refresh',expires_at:Date.now()/1000+600}));
    const cache=moduleAt('mobile/src/services/sessionCache.js',{'./storage.js':s}),profileGate=deferred(),sdkGate=deferred(),states=[],effects=[],refs=[];let hook=0,refIndex=0,requested=false;
    const React={createContext:()=>({Provider:'provider'}),createElement:(_type,props)=>props,useContext:()=>null,useRef:value=>{const id=refIndex++;return refs[id]||=( {current:value});},
      useState:value=>{const id=hook++;if(!(id in states))states[id]=value;return[states[id],next=>states[id]=typeof next==='function'?next(states[id]):next];},useEffect:fn=>effects.push(fn)};
    const user=moduleAt('mobile/src/context/UserContext.js',{'react':React,'react-native':{Alert:{alert:()=>{}}},'../services/storage.js':s,
      '../services/userService.js':{fetchUserRemoteStatus:()=>{requested=true;return profileGate.promise;}},'../services/syncEngine.js':{startAutoSync:()=>{},stopAutoSync:()=>{}},
      '../services/sessionCache.js':cache,'../data/all_words.json':JSON.parse(read('mobile/src/data/all_words.json')),
      '../services/leaderboardService.js':{syncUserLeaderboardScore:async()=>{}},'../services/supabaseClient.js':{supabase:{auth:{getSession:()=>sdkGate.promise,onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})}}},
      '../services/authService.js':{}},{process:{env:{}},__DEV__:false});
    user.UserProvider({children:null});const cleanup=effects[0]();await flush();await flush();assert(requested);
    hook=0;refIndex=0;const api=user.UserProvider({children:null}).value;
    await api.updateProfile({name:'Latest'});const queue=await s.getSyncQueue();await s.clearSyncQueue(queue.map(op=>({id:op.id,sequence:op.sequence})));
    profileGate.resolve({id:'A',auth_user_id:'A',full_name:'Stale',username:'test',daily_goal:20,is_premium:false,is_blocked:false});await flush();await flush();
    assert.equal(states[0].name,'Latest');assert.equal((await s.getStorageItem(s.STORAGE_KEYS.USER_PROFILE)).name,'Latest');
    s.setStorageAccountId('B');s.setStorageAccountId('A');
    await assert.rejects(api.recordWordLearned(1,'mastered'),/session changed/);await assert.rejects(api.resetProgress(),/session changed/);
    assert.equal((await s.getSyncQueue()).length,0);cleanup();
  });
  console.log(`PHASE 3: ${passed} PASS, 0 FAIL. SQL/RLS runtime and native-device checks require staging/device verification.`);
})().catch(error=>{console.error('FAIL:',error);process.exitCode=1;});
