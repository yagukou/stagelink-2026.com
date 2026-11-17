/* Loaded BEFORE the application, only by tests/local-server.cjs. No network SDK. */
(() => {
  const key = 'stagelink-local-fixtures-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const seed = () => ({
    troupes: [
      {id:'a',name:'テスト劇団A',affiliation:'大学A',email:'a@local.test',password:'test',description:'ローカル確認用の劇団A'},
      {id:'b',name:'創像工房 in front of.（B）',affiliation:'大学B',email:'b@local.test',password:'test',description:'ローカル確認用の劇団B'},
      {id:'c',name:'劇団EnTRoPy（C）',affiliation:'大学C',email:'c@local.test',password:'test',description:'ローカル確認用の劇団C'}
    ],
    performances:[{id:'p-a',troupeId:'a',title:'Aのテスト公演',start:'2099-12-01',end:'2099-12-02',acceptStart:'2020-01-01',acceptEnd:'2099-11-30',venue:'テスト劇場',maxQuota:500,totalQuota:2000,desc:'ローカル確認',email:'a@local.test'}],
    messages:[
      {id:'msg_1700000000000',fromTroupeId:'a',toTroupeId:'b',text:'AからBへの過去のメッセージ',timestamp:'19:05',read:true},
      {id:'msg_1700000001000',fromTroupeId:'b',toTroupeId:'a',text:'BからAへの未読メッセージ',timestamp:'2025-01-02T10:00:00Z',read:false},
      {id:'msg_1700000002000',fromTroupeId:'b',toTroupeId:'c',text:'BとCだけのメッセージ（Aには取得されません）',timestamp:'2025-01-03T10:00:00Z',read:false}
    ],
    requests:[{id:'r-ca',perfId:'p-a',fromTroupeId:'c',toTroupeId:'a',fromName:'劇団EnTRoPy（C）',fromEmail:'c@local.test',copies:100,size:'A4',deliveryMethod:'対面',timestamp:'2025-01-01',notes:'CからAへの依頼。Aで辞退後にCへ切り替えて理由を確認。',status:'pending'}],
    line_link_codes:[]
  });
  let tables;
  try {tables = JSON.parse(localStorage.getItem(key)) || seed();} catch {tables=seed();}
  const save = () => localStorage.setItem(key,JSON.stringify(tables));
  const api = { tables, queries:[], failNext:false, delay:0, save,
    receive(from,to) {tables.messages.push({id:'msg_'+Date.now(),fromTroupeId:from,toTroupeId:to,text:'モックからの受信 '+new Date().toLocaleTimeString(),timestamp:new Date().toISOString(),read:false});save();},
    reset(){localStorage.removeItem(key);localStorage.removeItem('currentUser');location.reload();}
  };
  const db = {from(table){
    let filters=[],either=null,range=null,sort=null,operation='select',payload,single=false;
    const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},
      or(expression){
        // Support exactly the application's quoted participant OR; reject unfiltered queries below.
        const m=/^fromTroupeId\.eq\.("(?:[^"\\]|\\.)*"),toTroupeId\.eq\.("(?:[^"\\]|\\.)*")$/.exec(expression);
        if(!m)throw Error('Unsupported mock OR: '+expression);
        const from=JSON.parse(m[1]),to=JSON.parse(m[2]);either=r=>r.fromTroupeId===from||r.toTroupeId===to;
        api.queries.push({table,or:expression});return q;
      },
      order(k){sort=k;return q},range(a,b){range=[a,b];return q},single(){single=true;return q},
      update(p){operation='update';payload=p;return q},insert(p){operation='insert';payload=p;return q},delete(){operation='delete';return q},
      then(resolve,reject){return new Promise(done=>setTimeout(()=>{
        // Stage 1: main still selects all messages; allow local fixtures only.
        if(operation!=='select'&&api.failNext){api.failNext=false;done({data:null,error:{message:'テスト用の保存エラーです。再試行できます。'}});return;}
        let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r))&&(!either||either(r)));
        if(operation==='update')rows.forEach(r=>Object.assign(r,payload));
        if(operation==='insert'){rows=clone(Array.isArray(payload)?payload:[payload]);tables[table].push(...rows);}
        if(operation==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));
        if(sort)rows.sort((a,b)=>String(a[sort]).localeCompare(String(b[sort])));
        if(range)rows=rows.slice(range[0],range[1]+1);
        if(operation!=='select')save();
        done({data:clone(single?rows[0]||null:rows),error:null});
      },api.delay)).then(resolve,reject);}
    };return q;
  }};
  window.localMock=api;
  window.supabase={createClient:()=>db};
  // Defense in depth: these entry points cannot initiate network activity.
  window.fetch=()=>Promise.reject(new Error('Network disabled in local preview'));
  window.XMLHttpRequest=class {constructor(){throw Error('Network disabled')}};
  window.WebSocket=class {constructor(){throw Error('Network disabled')}};
  window.EventSource=class {constructor(){throw Error('Network disabled')}};
  navigator.sendBeacon=()=>false;
  window.open=()=>null;
  document.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();},true);
  // Do not show onboarding over the test controls.
  localStorage.setItem('bira_network_hide_tutorial_v1','true');
})();
