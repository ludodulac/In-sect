/* IN-SECT — reprise robuste d'une partie multijoueur après suspension/rechargement mobile. */
(function(){
'use strict';
const KEY='insect_mp_active_session_v1';
let resumeTimer=null;
let reconciling=false;
const MP=window.INSECT_MP;
if(!MP||!/^https:\/\//i.test(String(MP.api||'')))return;

function status(message,error=false){
  const el=document.getElementById('mp-status');
  if(el){el.textContent=message||'';el.style.color=error?'#FF6680':'#A9A3D6'}
}
function snapshot(){
  if(!MP.active||!MP.code||!MP.secret||!MP.role||!MP.localColor)return null;
  return{schema:1,code:String(MP.code),secret:String(MP.secret),role:String(MP.role),localColor:String(MP.localColor),savedAt:Date.now()};
}
function save(){
  const s=snapshot();
  if(!s)return;
  try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}
}
function clear(){
  try{localStorage.removeItem(KEY)}catch(_){}
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!s||s.schema!==1||!s.code||!s.secret||!['host','guest'].includes(s.role)||!['yellow','red'].includes(s.localColor))return null;
    return s;
  }catch(_){return null}
}
async function apiGet(since){
  const r=await fetch(MP.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get',code:MP.code,secret:MP.secret,since}),cache:'no-store'});
  let d=null;try{d=await r.json()}catch(_){}
  if(!r.ok||!d||d.ok===false)throw new Error(d?.error||`Erreur serveur (${r.status})`);
  return d;
}
function turnKey(){
  if(!G)return null;
  return`${Number(G.turn||0)}:${Number(G.idx||0)}:${Number(_gameTurns||0)}`;
}
function rebuild(){
  G.board=Array.from({length:9},()=>Array(9).fill(null));
  for(const color of Object.keys(G.players||{}))for(const p of G.players[color]?.pieces||[]){
    if(Number.isInteger(p.r)&&Number.isInteger(p.c)&&p.r>=0&&p.r<9&&p.c>=0&&p.c<9&&(!p.dead||G.board[p.r][p.c]==null))G.board[p.r][p.c]=p;
  }
}
function applyState(s){
  if(!s?.G)return false;
  MP.applyingRemote=true;
  try{
    _mode=1;
    _aiLevel=s.aiLevel||1;
    _selColor=MP.localColor;
    _optSP=!!s.optSP;
    _uid=Number(s.uid||0);
    _gameTurns=Number(s.turns||0);
    _gameCaps=Number(s.caps||0);
    _moveLog=Array.isArray(s.moveLog)?s.moveLog:[];
    G=s.G;
    G.human=MP.localColor;
    G.mode1=true;
    G.sel=null;
    G.phase='select';
    G.spPaused=false;
    for(const color of Object.keys(G.players||{}))G.players[color].human=true;
    rebuild();
    MP.lastPushedTurn=turnKey();
    if(typeof showScreen==='function')showScreen('game');
    if(typeof buildBoard==='function')buildBoard();
    if(typeof renderBoard==='function')renderBoard();
    if(typeof renderPlayers==='function')renderPlayers();
    if(typeof updateTurnUI==='function')updateTurnUI();
    if(typeof updateToggleUI==='function')updateToggleUI();
    const bz=document.getElementById('bottom-zone');if(bz)bz.style.display='flex';
    const badge=document.getElementById('mode-badge');if(badge)badge.textContent=`EN LIGNE · ${MP.code}${MP.spEnabled?' · ⚡ SP':''}`;
    return true;
  }finally{MP.applyingRemote=false}
}
function startResumePoll(){
  if(resumeTimer)clearInterval(resumeTimer);
  resumeTimer=setInterval(()=>{if(document.visibilityState==='visible')reconcile(false)},1000);
}
function stopResumePoll(){if(resumeTimer)clearInterval(resumeTimer);resumeTimer=null}
async function reconcile(forceRestore=false){
  if(reconciling)return false;
  const saved=load();
  if(forceRestore&&!MP.code&&saved){
    MP.code=saved.code;MP.secret=saved.secret;MP.role=saved.role;MP.localColor=saved.localColor;MP.lastVersion=-1;MP.lastPushedTurn=null;
  }
  if(!MP.code||!MP.secret)return false;
  reconciling=true;
  if(forceRestore)status('Reconnexion à la partie…');
  try{
    const o=await apiGet(Number.isFinite(MP.lastVersion)?MP.lastVersion:-1);
    if(o.status==='finished'){
      MP.active=false;clear();stopResumePoll();status('Partie terminée.');return false;
    }
    if(o.sp_decided)MP.spEnabled=!!o.sp_enabled;
    if(o.state&&Number(o.version)>Number(MP.lastVersion)){
      MP.lastVersion=Number(o.version);
      MP.active=true;
      applyState(o.state);
      save();
    }
    if(MP.active){save();if(forceRestore)status(`Reconnecté · version ${MP.lastVersion}`);startResumePoll();return true}
    return false;
  }catch(e){
    console.warn('[IN-SECT MP RESUME]',e);
    if(forceRestore)status(`Reconnexion en attente : ${e.message}`,true);
    return false;
  }finally{reconciling=false}
}

const originalLeave=typeof MP.leave==='function'?MP.leave:null;
if(originalLeave)MP.leave=function(){clear();stopResumePoll();return originalLeave.apply(this,arguments)};
for(const name of ['create','join']){
  const original=typeof MP[name]==='function'?MP[name]:null;
  if(original)MP[name]=async function(){const r=await original.apply(this,arguments);setTimeout(save,0);return r};
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')save();
  else reconcile(false);
});
window.addEventListener('pagehide',save);
window.addEventListener('beforeunload',save);
setInterval(save,1000);

const saved=load();
if(saved&&!MP.code){
  MP.code=saved.code;MP.secret=saved.secret;MP.role=saved.role;MP.localColor=saved.localColor;MP.lastVersion=-1;MP.lastPushedTurn=null;
  reconcile(true);
}

MP.resumeSession=()=>reconcile(true);
MP.clearSavedSession=clear;
})();
