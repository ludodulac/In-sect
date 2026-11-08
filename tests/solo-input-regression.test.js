const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const core = fs.readFileSync('js/01-core.js', 'utf8');
const nav = fs.readFileSync('js/03-nav-menu.js', 'utf8');
const multiplayer = fs.readFileSync('js/09-multiplayer.js', 'utf8');
const resume = fs.readFileSync('js/10-multiplayer-resume.js', 'utf8');

function soloHarness({loadedClient = true} = {}) {
  const values = new Map([
    ['insect_mp_active_session_v2', JSON.stringify({
      schema: 2, code: 'ABC123', secret: 'old-secret', role: 'host', localColor: 'yellow'
    })],
    ['insect_mp_active_session_v1', '{"legacy":true}'],
  ]);
  const localStorage = {
    getItem: k => values.has(k) ? values.get(k) : null,
    setItem: (k,v) => values.set(k, String(v)),
    removeItem: k => values.delete(k),
  };
  let starts = 0, leaves = 0, detaches = 0, attaches = 0;
  const runtime = {
    online: true,
    isOnline() { return this.online; },
    detach() { this.online = false; detaches++; },
    attachSession() { this.online = true; attaches++; },
  };
  const mp = loadedClient ? {leave() {leaves++;runtime.detach();}} : null;
  const window = {INSECT_MP: mp, INSECT_MP_RUNTIME:runtime, addEventListener(){}};
  const document = {
    visibilityState: 'visible',
    getElementById() {return null;},
    createElement() {return {id:'',src:'',async:false};},
    body:{appendChild(){}},
    addEventListener(){},
  };
  const context = vm.createContext({
    window, document, localStorage,
    startGame(){assert.equal(runtime.online,false);starts++;},
    loadSave(){return false;},
    updateStatusBar(){},
    setInterval(){return 1;},
    clearInterval(){},
    setTimeout(){return 1;},
  });
  vm.runInContext(core, context, {filename:'js/01-core.js'});
  vm.runInContext(nav, context, {filename:'js/03-nav-menu.js'});
  return {context, window, runtime, localStorage, values,
    counts:()=>({starts,leaves,detaches,attaches})};
}

test('a new solo game clears a previously active multiplayer session before starting',()=>{
  const h=soloHarness();
  vm.runInContext('tryStartGame()',h.context);
  assert.equal(h.counts().starts,1);
  assert.equal(h.counts().leaves,1);
  assert.equal(h.runtime.online,false);
  assert.equal(h.localStorage.getItem('insect_mp_active_session_v2'),null);
  assert.equal(h.localStorage.getItem('insect_mp_active_session_v1'),null);
  assert.equal(h.window.INSECT_SOLO_SELECTED,true);
});

test('solo stays interactive when the multiplayer client has not loaded yet',()=>{
  const h=soloHarness({loadedClient:false});
  vm.runInContext('tryStartGame()',h.context);
  assert.equal(h.counts().starts,1);
  assert.equal(h.counts().detaches,1);
  assert.equal(h.runtime.online,false);
  assert.equal(h.localStorage.getItem('insect_mp_active_session_v2'),null);
});

test('resuming a saved solo game also exits multiplayer',()=>{
  const h=soloHarness();
  vm.runInContext('resumeGame()',h.context);
  assert.equal(h.counts().starts,0);
  assert.equal(h.counts().leaves,1);
  assert.equal(h.runtime.online,false);
});

test('late multiplayer script loading cannot auto-restore over an explicit solo choice',()=>{
  const h=soloHarness({loadedClient:false});
  vm.runInContext('tryStartGame()',h.context);
  // Simulates a previously scheduled storage write landing while lazy scripts load.
  h.localStorage.setItem('insect_mp_active_session_v2',
    JSON.stringify({schema:2,code:'ABC123',secret:'old-secret',role:'host',localColor:'yellow'}));
  h.window.INSECT_MP={
    api:'https://example.com/insect-match',
    syncNow:async()=>{},
    leave(){h.runtime.detach();},
  };
  vm.runInContext(resume,h.context,{filename:'js/10-multiplayer-resume.js'});
  assert.equal(h.counts().attaches,0);
  assert.equal(h.runtime.online,false);
});

test('a late server response cannot reactivate a multiplayer session after leave',async()=>{
  let release;
  const pendingFetch=new Promise(resolve=>{release=resolve});
  let detached=0;
  const runtime={detach(){detached++}};
  const context=vm.createContext({
    window:{INSECT_MULTIPLAYER_API:'https://example.com/insect-match',INSECT_MP_RUNTIME:runtime},
    document:{readyState:'loading',addEventListener(){}},
    fetch(){return pendingFetch;},
  });
  vm.runInContext(multiplayer,context,{filename:'js/09-multiplayer.js'});
  const mp=context.window.INSECT_MP;
  mp.code='ABC123'; mp.secret='old-secret'; mp.role='host'; mp.localColor='yellow';
  const request=mp.syncNow(true);
  mp.leave();
  release({ok:true,status:200,json:async()=>({ok:true,version:4,status:'active',state:{G:{order:['yellow','red'],idx:0}}})});
  assert.equal(await request,false);
  assert.equal(mp.active,false);
  assert.equal(mp.code,null);
  assert.equal(detached,1);
});
