/* IN-SECT — persistance de session et récupération autoritaire multijoueur. Aucun wrapper du moteur. */
(function(){
'use strict';
const KEY='insect_mp_active_session_v2';
const LEGACY_KEY='insect_mp_active_session_v1';
const MP=window.INSECT_MP;
const RT=window.INSECT_MP_RUNTIME;
if(!MP||!RT||!/^https:\/\//i.test(String(MP.api||'')))return;
let resumeTimer=null;
let reconciling=false;

function status(message,error=false){
  const el=document.getElementById('mp-status');
  if(el){el.textContent=message||'';el.style.color=error?'#FF6680':'#A9A3D6'}
}
function snapshot(){
  if(!MP.code||!MP.secret||!MP.role||!MP.localColor)return null;
  return{schema:2,code:String(MP.code),secret:String(MP.secret),role:String(MP.role),localColor:String(MP.localColor),savedAt:Date.now()};
}
function save(){const s=snapshot();if(!s)return;try{localStorage.setItem(KEY,JSON.stringify(s));localStorage.removeItem(LEGACY_KEY)}catch(_){}}
function clear(){try{localStorage.removeItem(KEY);localStorage.removeItem(LEGACY_KEY)}catch(_){}}
function valid(s){return!!(s&&[1,2].includes(s.schema)&&s.code&&s.secret&&['host','guest'].includes(s.role)&&['yellow','red'].includes(s.localColor))}
function load(){
  try{
    const modern=JSON.parse(localStorage.getItem(KEY)||'null');if(valid(modern))return modern;
    const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');if(valid(legacy))return legacy;
  }catch(_){}
  return null;
}
function stop(){if(resumeTimer)clearInterval(resumeTimer);resumeTimer=null}
function start(){stop();resumeTimer=setInterval(()=>{if(document.visibilityState==='visible')reconcile(false)},1000)}
function restoreIdentity(s){
  MP.code=String(s.code);MP.secret=String(s.secret);MP.role=String(s.role);MP.localColor=String(s.localColor);
  MP.lastVersion=-1;MP.lastCommittedTurn=null;MP.authoritativeState=null;
  RT.attachSession({code:MP.code,playerId:MP.role,controlledColor:MP.localColor,seat:MP.localColor==='yellow'?'north-west':'south-east',participants:[{playerId:'host',controlledColor:'yellow',seat:'north-west'},{playerId:'guest',controlledColor:'red',seat:'south-east'}],connection:'reconnecting',phase:RT.STATES.RECONNECTING});
}
async function reconcile(forceRestore=false){
  if(reconciling)return false;
  const saved=load();
  if(forceRestore&&!MP.code&&saved)restoreIdentity(saved);
  if(!MP.code||!MP.secret||typeof MP.syncNow!=='function')return false;
  reconciling=true;
  if(forceRestore){RT.beginReconnect();status('Reconnexion à la partie…')}
  try{
    await MP.syncNow(!!forceRestore);
    if(MP.code&&MP.secret){save();start();if(forceRestore)status(`Partie récupérée · version ${MP.lastVersion}`);return true}
    return false;
  }catch(error){
    console.warn('[IN-SECT MP RESUME]',error);
    RT.setError(`Reconnexion : ${error.message||error}`);
    if(forceRestore)status(`Reconnexion impossible : ${error.message||error}`,true);
    return false;
  }finally{reconciling=false}
}

const originalLeave=MP.leave;
MP.leave=function(){clear();stop();return originalLeave?originalLeave.apply(this,arguments):undefined};
for(const name of ['create','join','findOpponent']){
  const original=MP[name];
  if(typeof original==='function')MP[name]=async function(){const result=await original.apply(this,arguments);setTimeout(save,0);return result};
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')save();
  else if(MP.code&&MP.secret){RT.beginReconnect();reconcile(false)}
});
window.addEventListener('pagehide',save);
window.addEventListener('beforeunload',save);
setInterval(save,1500);

const saved=load();
if(saved&&!MP.code){restoreIdentity(saved);reconcile(true)}
MP.resumeSession=()=>reconcile(true);
MP.clearSavedSession=clear;
})();
