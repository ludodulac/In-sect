/* IN-SECT — lecture locale des événements autoritaires. Ne modifie jamais G. */
(function(){
'use strict';
const MP=window.INSECT_MP,RT=window.INSECT_MP_RUNTIME;
if(!MP||!RT)return;

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const moved=ch=>ch?.kind==='piece_changed'&&ch.from&&ch.to&&(ch.from.r!==ch.to.r||ch.from.c!==ch.to.c);
const died=ch=>ch?.kind==='piece_changed'&&ch.from&&!ch.from.dead&&ch.to?.dead;
function pieceEl(id){return document.getElementById('p'+id)}
function toPosition(change){
  if(!change?.to||change.to.r<0||change.to.c<0)return null;
  const cs=typeof getCellSize==='function'?getCellSize():0;
  if(!cs)return null;
  return typeof _positionStyle==='function'?_positionStyle(change.to.r,change.to.c,cs,0):{left:change.to.c*cs,top:change.to.r*cs};
}
async function animateMove(change,duration){
  const pe=pieceEl(change.id),pos=toPosition(change);if(!pe||!pos)return false;
  pe.classList.add('moving');pe.style.left=pos.left+'px';pe.style.top=pos.top+'px';
  await wait(duration);pe.classList.remove('moving');return true;
}
async function animateGroup(changes,duration){
  const valid=changes.filter(moved);if(!valid.length)return false;
  if(typeof sfxMove==='function')sfxMove();
  await Promise.all(valid.map(ch=>animateMove(ch,duration)));return true;
}
async function flashDeaths(changes){
  const deaths=changes.filter(died);if(!deaths.length)return false;
  for(const ch of deaths)pieceEl(ch.id)?.classList.add('flash-kill');
  if(typeof sfxCapture==='function')sfxCapture();
  if(typeof boardShake==='function')boardShake();
  await wait(300);
  for(const ch of deaths)pieceEl(ch.id)?.classList.remove('flash-kill');
  return true;
}
function effectMessage(event){
  const effects=Array.isArray(event?.effects)?event.effects:[];
  if(effects.some(e=>e.kind==='game_finished'))return'PARTIE TERMINÉE';
  if(effects.some(e=>e.kind==='sp_trigger'))return'✨ SUPER POUVOIR DÉCLENCHÉ';
  if(effects.some(e=>e.kind==='sp_acquired'))return'✨ SUPER POUVOIR OBTENU';
  if(effects.some(e=>e.kind==='ghost_revived'||e.kind==='resurrect'))return'✨ RÉSURRECTION';
  if(effects.some(e=>e.kind==='nid_occupied'))return'👑 NID SACRÉ — TOUR BONUS';
  if(effects.some(e=>e.kind==='capture'||e.kind==='reporter_capture'))return'⚔️ CAPTURE CONFIRMÉE';
  return event?.actor_color?`COUP ${String(event.actor_color).toUpperCase()} CONFIRMÉ`:'';
}
async function play(event,version){
  if(!event||!Array.isArray(event.changes))return false;
  const v=Number(version??event.result_version);
  // Réserver immédiatement la version connue : le polling fera get(since=v) et ne
  // remplacera donc pas G au milieu de l'animation. localVersion reste inchangée
  // dans le runtime jusqu'à l'application du snapshot final.
  if(Number.isFinite(v)&&v>Number(MP.lastVersion))MP.lastVersion=v;
  MP.eventPlayback=true;
  const mine=event.actor_color===RT.snapshot().controlledColor;
  if(!mine)RT.receiveOpponentEvent(event);
  RT.beginAcceptedAnimation(event);
  const message=effectMessage(event);if(message&&typeof setInfoPhase==='function')setInfoPhase(message);
  const duration=Math.max(220,Math.min(420,typeof ANIM_MS==='number'?ANIM_MS+30:300));
  try{
    const actorId=event.action?.piece_id;
    const actor=event.changes.find(ch=>String(ch.id)===String(actorId)&&moved(ch));
    if(actor)await animateGroup([actor],duration);
    const secondary=event.changes.filter(ch=>ch!==actor&&moved(ch));
    if(secondary.length)await animateGroup(secondary,Math.max(180,duration-60));
    await flashDeaths(event.changes);
    if(!actor&&!secondary.length&&!event.changes.some(died))await wait(80);
    return true;
  }finally{MP.eventPlayback=false}
}

const baseReceive=MP.receiveAcceptedEvent;
MP.playAcceptedEvent=play;
MP.receiveAcceptedEvent=function(event,version){
  const v=Number(version);
  if(!event||!Number.isFinite(v)||v<=Number(MP.lastVersion))return false;
  play(event,v).then(()=>MP.syncNow?.(true)).catch(error=>{console.error('[IN-SECT MP EVENT]',error);RT.setError(error);MP.syncNow?.(true)});
  return true;
};
MP._legacyReceiveAcceptedEvent=baseReceive;
})();
