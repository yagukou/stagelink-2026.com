const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('Participant.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function setup(source = html) {
  const elements = new Map();
  const element = () => ({ value: '', style: {}, children: [], attributes:{}, open:false, isConnected:true,
    focus(){state.focus=this},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},showModal(){this.open=true},close(){this.open=false},
    classList: {add(){}, remove(){}}, appendChild(c){this.children.push(c)}, set innerHTML(v){this.html=v;this.children=[]}, get innerHTML(){return this.html || ''} });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const state = { rows: [], accounts:[], storage:new Map(), error: null, writes: [], alerts: [], zeroUpdates: false, reads:[], release:null, hold:false, holdWrites:false, writeWaiters:[], notifications:[], toasts:[] };
  const db = { from(table) {
    let payload, participant, single=false, filters=[];
    const q = { select(){return q}, order(){return q}, eq(k,v){filters.push(r=>r[k]===v);return q},single(){single=true;return q},
      or(expression){const m=/^fromTroupeId\.eq\.("(?:[^"\\]|\\.)*"),toTroupeId\.eq\.("(?:[^"\\]|\\.)*")$/.exec(expression);assert.ok(m);assert.equal(m[1],m[2]);participant=JSON.parse(m[1]);return q},
      update(v){payload=v;state.writes.push({table, payload:v});return q},
      insert(v){payload=v[0];state.writes.push({table,payload});return q},
      range(a,b){assert.ok(participant);state.reads.push({table,participant,a,b});const result={data:state.rows.filter(r=>r.fromTroupeId===participant||r.toTroupeId===participant).slice(a,b+1),error:state.error};return state.hold?new Promise(resolve=>{state.release=()=>resolve(result)}):Promise.resolve(result)},
      then(resolve,reject){let data=table==='troupes'?state.accounts.filter(r=>filters.every(f=>f(r))):payload && !state.zeroUpdates ? [{...payload}] : [];if(single)data=data[0]||null;return (payload && state.holdWrites ? new Promise(done=>state.writeWaiters.push(()=>done({data,error:state.error}))) : Promise.resolve({data,error:state.error})).then(resolve,reject)} };
    return q;
  }};
  const context = vm.createContext({ window: {supabase:{createClient:()=>db},addEventListener(){}},localStorage:{getItem:k=>state.storage.get(k)||null,setItem:(k,v)=>state.storage.set(k,v),removeItem:k=>state.storage.delete(k)},
    document:{getElementById:get,querySelector:()=>get('search'),querySelectorAll:()=>[],createElement:element,addEventListener(){}},
    fetch:(url,options)=>{state.notifications.push({url,options});return Promise.resolve({})},console:{error(){},warn(){}}, alert:m=>state.alerts.push(m), setInterval:fn=>{state.poll=fn;return 1}, clearInterval(){},
    URLSearchParams, location:{search:'?page=chat&with=b',pathname:'/Participant.html'}, history:{replaceState(){}},
  });
  for (const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1],context);
  const run = code => vm.runInContext(code,context);
  run(`currentUser={id:'a',name:'A'}; troupesData=[{id:'a',name:'A'},{id:'b',name:'創像工房 in front of.',affiliation:'大学B'},{id:'c',name:'劇団EnTRoPy',affiliation:'大学C'},{id:'d',name:'D'}];`);
  run('showToast=(message,kind)=>{}');
  return {run,get,state};
}
test('all inline scripts and event handlers parse',()=>{
  for (const script of scripts) new vm.Script(script);
  for (const m of html.matchAll(/\bon\w+="([^"]*)"/g)) new vm.Script('(function(event){'+m[1]+'})');
});
test('partial, case insensitive, trimmed, university and acceptance filters',()=>{
  const {run,get}=setup(); run('renderTroupes = rows => globalThis.filtered = rows; getAcceptanceStatus = p => ({accept:p.accept});');
  for(const [term,id] of [['創像','b'],[' entropy ','c'],['大学B','b']]) {get('search').value=term;run('filterTroupes()');assert.equal(run('filtered[0].id'),id);}
  get('univ-filter').value='大学B';run('filterTroupes()');assert.equal(run('filtered.length'),1);
  get('search').value='';get('accept-filter').value='true';run("performancesData=[{troupeId:'b',accept:true}];filterTroupes()");assert.equal(run('filtered.length'),1);
  get('accept-filter').value='false';run('filterTroupes()');assert.equal(run('filtered.length'),0);
});
test('only incoming/outgoing partners, newest first, unread retained and invalid date safe',()=>{
 const {run,get}=setup();
 run(`messagesData=[{id:'msg_1000',fromTroupeId:'a',toTroupeId:'b',timestamp:'19:05'}, {id:'uuid',fromTroupeId:'c',toTroupeId:'a',timestamp:'2026-11-17',read:false},{fromTroupeId:'a',toTroupeId:'a'},{fromTroupeId:'d',toTroupeId:'b'}];renderChatConversations();`);
 const list=get('conv-list');assert.equal(list.children.length,2);assert.match(list.children[0].innerHTML,/EnTRoPy/);assert.match(list.children[0].innerHTML,/chat-unread/);
 assert.equal(run("messageSortKey({id:'123-ab',timestamp:'bad'})"),0);
 assert.equal(run("messageSortKey({id:'msg_1000',timestamp:null})"),1000);
 run('messagesData=[];renderChatConversations()');assert.match(list.innerHTML,/会話履歴はまだありません/);
});
test('new chat stays out of list until successful send; failure keeps draft',async()=>{
 const {run,get,state}=setup();run('notifyMessage=()=>{}');
 await run("selectChatPartner('b')");assert.equal(get('conv-list').children.length,0);assert.match(get('chat-messages').innerHTML,/スタート/);
 get('chat-text-input').value='hello';state.error={message:'offline'};await run('sendChatMessage()');assert.equal(run('messagesData.length'),0);assert.equal(get('chat-text-input').value,'hello');
 state.error=null;await run('sendChatMessage()');assert.equal(get('conv-list').children.length,1);assert.equal(get('chat-text-input').value,'');
 await run("selectChatPartner('a')");assert.equal(run('activeChatPartnerId'),'b');
});
test('detail start preserves login continuation and LINE deep links',async()=>{
 const {run,state}=setup();run("showPage=p=>globalThis.page=p; closeTroupeModal=()=>{}; currentUser=null;");
 await run("startTroupeChat('b')");assert.equal(run('page'),'mypage');assert.equal(run('pendingDeepLink.withId'),'b');assert.equal(state.writes.length,0);
 run("currentUser={id:'a'}");await run('applyDeepLink()');assert.equal(run('page'),'chat');assert.equal(run('activeChatPartnerId'),'b');
 assert.equal(run('readDeepLink().withId'),'b');
});
test('poll refresh reorders, tracks timestamp edits and retains cache on failure',async()=>{
 const {run,get,state}=setup();
 state.rows=[{id:'1',fromTroupeId:'a',toTroupeId:'b',timestamp:'2026-01-01'},{id:'2',fromTroupeId:'a',toTroupeId:'c',timestamp:'2026-02-01'}];
 await run('refreshMessages()');run('startChatPolling()');
 state.rows=[{...state.rows[0],timestamp:'2026-03-01'},state.rows[1]];await state.poll();assert.match(get('conv-list').children[0].innerHTML,/創像/);
 state.error={message:'offline'};await run('refreshMessages()');assert.equal(run('messagesData.length'),2);
});
test('pagination includes old data beyond 1000 rows',async()=>{
 const {run,state}=setup();state.rows=Array.from({length:1201},(_,id)=>({id,fromTroupeId:'a',toTroupeId:'b'}));assert.equal((await run('loadMessages()')).data.length,1201);
});
test('existing history opens and marks incoming messages read; new outgoing moves to top',async()=>{
 const {run,get,state}=setup();run('notifyMessage=()=>{}');
 state.rows=[{id:'msg_1',fromTroupeId:'b',toTroupeId:'a',text:'old message',timestamp:'2025-01-01',read:false},{id:'msg_2',fromTroupeId:'a',toTroupeId:'c',text:'other',timestamp:'2025-02-01',read:true}];
 await run("selectChatPartner('b')");assert.match(get('chat-messages').children[0].innerHTML,/old message/);assert.equal(run('messagesData[0].read'),true);
 get('chat-text-input').value='new message';await run('sendChatMessage()');assert.match(get('conv-list').children[0].innerHTML,/創像/);
});
test('requester sees saved reason escaped and historical missing reason',()=>{
 const {run,get}=setup();
 run("fillProfileForm=()=>{};renderLineLinkCard=()=>{};incomingRequests=[{id:'r',fromTroupeId:'a',toTroupeId:'b',status:'declined',decline_reason:'<b>満員</b>'},{id:'old',fromTroupeId:'a',toTroupeId:'c',status:'declined'}];renderMyPage()");
 assert.match(get('dashboard-sent').children[0].innerHTML,/&lt;b&gt;満員&lt;\/b&gt;/);
 assert.match(get('dashboard-sent').children[1].innerHTML,/過去の依頼/);
});
test('decline modal cancel/blank/valid/error/zero updates; approval and recipient guard',async()=>{
 const {run,state,get}=setup();run("renderMyPage=()=>{};incomingRequests=[{id:'r',toTroupeId:'a',status:'pending'}]");
 await run("handleRequestStatus('r','declined')");assert.equal(state.writes.length,0);
 assert.equal(get('decline-dialog').open,true);run('closeDeclineModal()');assert.equal(get('decline-dialog').open,false);assert.equal(state.writes.length,0);
 await run("handleRequestStatus('r','declined')");
 for(const blank of ['', ' ', '　', '\n', '　 \n ']) {get('decline-reason').value=blank;await run('confirmDecline()');assert.equal(state.writes.length,0);assert.equal(get('decline-reason').value,blank);assert.match(get('decline-error').textContent,/辞退理由/);}
 get('decline-reason').value=' 満員です ';state.error={message:'offline'};await run('confirmDecline()');assert.equal(run('incomingRequests[0].status'),'pending');assert.equal(get('decline-dialog').open,true);assert.equal(get('decline-reason').value,' 満員です ');assert.match(get('decline-error').textContent,/offline/);
 state.error=null;state.zeroUpdates=true;await run('confirmDecline()');assert.equal(run('incomingRequests[0].status'),'pending');
 state.zeroUpdates=false;const pending=run('confirmDecline()');const repeated=run('confirmDecline()');assert.equal(get('decline-confirm').disabled,true);run('closeDeclineModal()');assert.equal(get('decline-dialog').open,true);await pending;await repeated;
 assert.equal(run('incomingRequests[0].decline_reason'),'満員です');assert.equal(run('incomingRequests[0].status'),'declined');assert.equal(get('decline-dialog').open,false);
 assert.match(run("renderDeclineReason({status:'declined',decline_reason:'<script>'})"),/&lt;script&gt;/);
 run("incomingRequests[0].status='pending'");await run("handleRequestStatus('r','accepted')");assert.equal(JSON.stringify(state.writes.at(-1).payload),JSON.stringify({status:'accepted'}));
 run("currentUser={id:'b'}");const n=state.writes.length;await run("handleRequestStatus('r','declined')");assert.equal(state.writes.length,n);
});
test('server-side participant filter, no anonymous fetch, logout clears cached messages',async()=>{
 const {run,state}=setup();state.rows=[{id:'1',fromTroupeId:'b',toTroupeId:'c'},{id:'2',fromTroupeId:'b',toTroupeId:'a'},{id:'3',fromTroupeId:'a',toTroupeId:'c'}];
 await run('refreshMessages()');assert.equal(run('messagesData.length'),2);assert.ok(state.reads.every(r=>r.participant==='a'));
 run('renderMyPage=()=>{};updateAuthUI=()=>{};handleLogout()');assert.equal(run('messagesData.length'),0);const count=state.reads.length;
 await run('refreshMessages()');await run('loadMessages()');assert.equal(state.reads.length,count);
});
test('login and reload restore owner before fetching; anonymous startup does not fetch',async()=>{
 const {run,state,get}=setup();state.accounts=[{id:'a',name:'A',email:'a@local.test',password:'test'}];state.rows=[{id:'m',fromTroupeId:'a',toTroupeId:'b'}];
 run('currentUser=null;updateFilterDropdown=()=>{};renderLegend=()=>{};renderTroupes=()=>{};renderCalendar=()=>{};updateAuthUI=()=>{};applyDeepLink=async()=>{};checkAndOpenTutorial=()=>{};renderMyPage=()=>{};');
 await run('initApp()');assert.equal(state.reads.length,0);
 get('login-email').value='a@local.test';get('login-password').value='test';await run('handleLogin()');assert.equal(run('messagesData.length'),1);assert.equal(run('currentUser.id'),'a');
 run('resetMessageSession();currentUser=null');await run('initApp()');assert.equal(run('currentUser.id'),'a');assert.equal(run('messagesData.length'),1);
});
test('overlapping reads share request; old session response is discarded',async()=>{
 const {run,state}=setup();state.hold=true;
 const first=run('refreshMessages()');const second=run('refreshMessages()');assert.equal(first,second);assert.equal(state.reads.length,1);
 run("resetMessageSession();currentUser={id:'b'}");state.hold=false;await run('refreshMessages()');state.release();await first;
 assert.equal(run('messagesData.length'),0);assert.equal(run('messageRefresh'),null);
});
test('snapshot started before local write cannot overwrite cache',async()=>{
 const {run,state}=setup();state.hold=true;const pending=run('refreshMessages()');run("messageRevision++;messagesData=[{id:'saved'}]");state.release();await pending;assert.equal(run('messagesData[0].id'),'saved');
});
test('preview serves only mock SDK with network-denying CSP; production code has no mock hook',async()=>{
 const {createServer,preview}=require('./local-server.cjs');const page=preview();
 assert.doesNotMatch(page,/<script[^>]+src="https?:/);assert.match(page,/src="\/mock.js"/);assert.match(page,/const NOTIFY_GAS_URL = ''/);assert.doesNotMatch(html,/localMock|\/mock.js/);
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {const response=await fetch(`http://127.0.0.1:${server.address().port}/`);assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);assert.equal(response.status,200);assert.equal(await response.text(),page);
 const denied=await fetch(`http://127.0.0.1:${server.address().port}/../Participant-source.html`);assert.equal(denied.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('local mock runs offline, filters before paging, saves reasons, and blocks network APIs',async()=>{
 const storage=new Map();const ctx=vm.createContext({window:{},navigator:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{addEventListener(){}},setTimeout,location:{reload(){}}});
 vm.runInContext(fs.readFileSync('tests/local-mock.js','utf8'),ctx);
 const exec=source=>vm.runInContext(source,ctx);
 assert.equal((await exec(`window.supabase.createClient().from('messages').select('*').or('fromTroupeId.eq."a",toTroupeId.eq."a"').order('id').range(0,499)`)).data.length,2);
 assert.ok((await exec("window.supabase.createClient().from('messages').select('*')")).error);
 await exec("window.supabase.createClient().from('requests').update({status:'declined',decline_reason:'満員です'}).eq('id','r-ca').select()");
 assert.equal(exec('window.localMock.tables.requests[0].decline_reason'),'満員です');
 await assert.rejects(exec("window.fetch('https://example.invalid')"),/Network disabled/);
 assert.throws(()=>exec("new window.XMLHttpRequest()"),/Network disabled/);
 assert.equal(exec('navigator.sendBeacon()'),false);
});

test('main notification, linking, deep-link and request-submit functions remain unchanged',()=>{
 const cp=require('node:child_process');const base=cp.execFileSync('git',['show','f0cf2f9:Participant.html'],{encoding:'utf8'});const before=setup(base),after=setup();
 for(const name of ['callNotifyGas','notifyMessage','notifyRequest','notifyRequestStatus','issueLineLinkCode','showLineLinkCode','refreshLineStatus','renderLineLinkCard','readDeepLink','applyDeepLink','submitRequestForm'])assert.equal(after.run(name+'.toString()').replace(/\r\n/g,'\n'),before.run(name+'.toString()').replace(/\r\n/g,'\n'),name);
 for(const name of ['handleLogin','handleRegisterTroupe'])assert.equal(after.run(name+'.toString()').replace(/resetMessageSession\(\);\r?\n/g,'').replace(/\r\n/g,'\n'),before.run(name+'.toString()').replace(/\r\n/g,'\n'),name);
});
test('successful message notifies once through current GAS wrapper with keepalive; failures never notify',async()=>{
 const {run,get,state}=setup();run("activeChatPartnerId='b'");get('chat-text-input').value='hello';
 for(const failure of ['error','zero']) {state.error=failure==='error'?{message:'offline'}:null;state.zeroUpdates=failure==='zero';await run('sendChatMessage()');assert.equal(state.notifications.length,0);assert.equal(get('chat-text-input').value,'hello');}
 state.error=null;state.zeroUpdates=false;await run('sendChatMessage()');assert.equal(state.notifications.length,1);const call=state.notifications[0];assert.equal(call.options.keepalive,true);assert.equal(call.options.mode,'no-cors');assert.equal(JSON.parse(call.options.body).type,'message');assert.equal(JSON.parse(call.options.body).messageId,run('messagesData[0].id'));
});
test('pending send survives logout/login, does not overwrite new user cache, and blocks duplicate clicks',async()=>{
 const {run,get,state}=setup();run("activeChatPartnerId='b';renderMyPage=()=>{};updateAuthUI=()=>{}");get('chat-text-input').value='old account';state.holdWrites=true;
 const sending=run('sendChatMessage()');await new Promise(setImmediate);await run('sendChatMessage()');assert.equal(state.writes.length,1);
 run("handleLogout();currentUser={id:'c',name:'C'};messagesData=[{id:'new-user-cache'}]");get('chat-text-input').value='new draft';state.writeWaiters.shift()();await sending;
 assert.equal(state.notifications.length,1);assert.equal(run('messagesData[0].id'),'new-user-cache');assert.equal(get('chat-text-input').value,'new draft');
});
test('successful send notifies before rendering; a render failure never reports a failed save',async()=>{
 const {run,get,state}=setup();run("activeChatPartnerId='b';renderChatConversations=()=>{throw Error('render failed')}");get('chat-text-input').value='hello';await run('sendChatMessage()');assert.equal(state.notifications.length,1);assert.equal(run('messagesData.length'),1);assert.equal(state.alerts.length,0);
});
test('approval and decline retain status notifications, including account change during save',async()=>{
 for(const status of ['accepted','declined']){
  const {run,get,state}=setup();run("renderMyPage=()=>{};updateAuthUI=()=>{};incomingRequests=[{id:'r',toTroupeId:'a',status:'pending'}]");
  if(status==='declined'){await run("handleRequestStatus('r','declined')");get('decline-reason').value='満員です';}
  state.holdWrites=true;const saving=run(status==='declined'?'confirmDecline()':"handleRequestStatus('r','accepted')");await new Promise(setImmediate);
  run("handleLogout();currentUser={id:'c'}");state.writeWaiters.shift()();await saving;
  assert.equal(state.notifications.length,1);assert.deepEqual(JSON.parse(state.notifications[0].options.body),{type:'status',requestId:'r'});assert.equal(state.notifications[0].options.keepalive,true);
 }
});
test('decline cancel/empty/DB failure notify zero times; retry notifies once',async()=>{
 const {run,get,state}=setup();run("renderMyPage=()=>{};incomingRequests=[{id:'r',toTroupeId:'a',status:'pending'}]");
 await run("handleRequestStatus('r','declined')");await run('confirmDecline()');run('closeDeclineModal()');assert.equal(state.notifications.length,0);
 await run("handleRequestStatus('r','declined')");get('decline-reason').value='理由';state.error={message:'missing column'};await run('confirmDecline()');assert.equal(state.notifications.length,0);assert.equal(run('incomingRequests[0].status'),'pending');assert.equal(get('decline-dialog').open,true);
 state.error=null;await run('confirmDecline()');assert.equal(state.notifications.length,1);assert.equal(run('incomingRequests[0].decline_reason'),'理由');
});
test('polling an incoming message adds sender and preserves unread until conversation is opened',async()=>{
 const {run,state,get}=setup();state.rows=[{id:'1',fromTroupeId:'a',toTroupeId:'b',timestamp:'2025-01-01'}];await run('refreshMessages()');run('startChatPolling()');state.rows.push({id:'2',fromTroupeId:'c',toTroupeId:'a',timestamp:'2026-01-01',text:'incoming',read:false});await state.poll();assert.match(get('conv-list').children[0].innerHTML,/EnTRoPy/);assert.match(get('conv-list').children[0].innerHTML,/chat-unread/);await run("selectChatPartner('c')");assert.doesNotMatch(get('conv-list').children[0].innerHTML,/chat-unread/);
});

test('read completion updates current cache even when refresh replaced its objects during save',async()=>{
 const {run,state}=setup();state.rows=[{id:'r',fromTroupeId:'b',toTroupeId:'a',read:false}];await run('refreshMessages()');state.holdWrites=true;const reading=run("markConversationRead('b')");await new Promise(setImmediate);state.rows=[{id:'r',fromTroupeId:'b',toTroupeId:'a',read:false}];await run('refreshMessages()');state.writeWaiters.shift()();await reading;assert.equal(run('messagesData[0].read'),true);
});
