const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const cp=require('node:child_process');
const html=fs.readFileSync('Participant.html','utf8');
function filter(term,univ='',accept='') {
 const controls={'.search-input':{value:term},'univ-filter':{value:univ},'accept-filter':{value:accept}};
 const ctx=vm.createContext({window:{supabase:{createClient:()=>({})},addEventListener(){}},document:{querySelector:k=>controls[k],getElementById:k=>controls[k],addEventListener(){}}});
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
 vm.runInContext("troupesData=[{id:'b',name:'創像工房 in front of.',affiliation:'大学B'},{id:'c',name:'劇団EnTRoPy',affiliation:'大学C'}];performancesData=[{troupeId:'b',accept:true}];getAcceptanceStatus=p=>({accept:p.accept});renderTroupes=rows=>globalThis.result=rows.map(t=>t.id);filterTroupes()",ctx);
 return JSON.parse(JSON.stringify(ctx.result));
}
test('partial and case-insensitive searches',()=>{assert.deepEqual(filter('創像'),['b']);assert.deepEqual(filter('entropy'),['c']);});
test('university keyword and dropdown',()=>{assert.deepEqual(filter('大学B'),['b']);assert.deepEqual(filter('','大学C'),['c']);assert.deepEqual(filter('entropy','大学B'),[]);});
test('acceptance filters combine with keyword and university',()=>{assert.deepEqual(filter('','', 'true'),['b']);assert.deepEqual(filter('','', 'false'),['c']);assert.deepEqual(filter('創像','大学B','true'),['b']);assert.deepEqual(filter('創像','大学B','false'),[]);});
test('surrounding spaces including full-width and newlines',()=>{assert.deepEqual(filter('  entropy  '),['c']);assert.deepEqual(filter('　創像　'),['b']);assert.deepEqual(filter('\n大学B\n'),['b']);assert.deepEqual(filter('   '),['b','c']);});
test('all inline scripts and handlers parse',()=>{for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);for(const m of html.matchAll(/\bon\w+="([^"]*)"/g))new vm.Script('(function(event){'+m[1]+'})');});
test('production file differs from base only by search trim',()=>{const base=cp.execFileSync('git',['show','f0cf2f92bb5996c0e72c1346942fd68518d6738f:Participant.html'],{encoding:'utf8'}).replace(/\r\n/g,'\n');assert.ok(html.replace(/\r\n/g,'\n')===base.replace("document.querySelector('.search-input').value.toLowerCase()","document.querySelector('.search-input').value.trim().toLowerCase()"));});

test('local preview removes real SDK and denies network connections',()=>{const {preview,csp}=require('./local-server.cjs');const page=preview();assert.doesNotMatch(page,/<script[^>]+src="https?:/);assert.match(page,/src="\/mock.js"/);assert.match(page,/const NOTIFY_GAS_URL = ''/);assert.match(csp,/connect-src 'none'/);});
