/* IN-SECT — contrôleur d'intentions online. Les clics online ne mutent jamais G. */
(function(){
'use strict';
const MP=window.INSECT_MP,RT=window.INSECT_MP_RUNTIME;
if(!MP||!RT)return;
const ACTION_API=String(window.INSECT_MULTIPLAYER_ACTION_API||String(MP.api||'').replace(/\/insect-match$/,'/insect-play')).trim();
const UI={pieceId:null,stage:'idle',draft:null,waiting:false};
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const allPieces=()=>Object.values(G?.players||{}).flatMap(p=>p?.pieces||[]);
const byId=id=>allPieces().find(p=>String(p.id)===String(id))||null;
const cell=(r,c)=>document.getElementById(`cell-${r}-${c}`);
const same=(a,b)=>a&&b&&a.r===b.r&&a.c===b.c;

function clearClasses(){document.querySelectorAll('#board .cell').forEach(el=>el.classList.remove('vm','vk','vd','vplace','sc','vrep-o','vrep-d'));document.querySelectorAll('#board .piece').forEach(el=>el.classList.remove('selp'))}
function reset(message=''){UI.pieceId=null;UI.stage='idle';UI.draft=null;clearClasses();RT.clearSelection();if(message&&typeof setInfoPhase==='function')setInfoPhase(message);else if(typeof setInfoPhase==='function')setInfoPhase('')}
function mark(r,c,cls){cell(r,c)?.classList.add(cls)}
function pieceAt(r,c){return G?.board?.[r]?.[c]||null}
function isMine(p){const s=RT.snapshot();return!!(p&&!p.dead&&p.color===s.controlledColor)}
function legalActions(p){try{return typeof getActionsWithSP==='function'?getActionsWithSP(p):getActions(p)}catch(_){return{moves:[],kills:[],diplT:[],necroT:[]}}}
function showPieceChoices(p){clearClasses();document.getElementById('p'+p.id)?.classList.add('selp');const a=legalActions(p);for(const x of a.moves||[])mark(x.r,x.c,'vm');for(const x of a.kills||[])mark(x.r,x.c,'vk');for(const x of a.diplT||[])mark(x.r,x.c,'vd');for(const x of a.necroT||[])mark(x.r,x.c,'vd');if(typeof updatePieceInfo==='function')updatePieceInfo(p);if(typeof setInfoPhase==='function')setInfoPhase('CHOISISSEZ VOTRE ACTION')}
function select(p){if(!isMine(p)||!RT.allowsBoardInput())return false;UI.pieceId=p.id;UI.stage='piece';UI.draft=null;RT.beginSelection();showPieceChoices(p);return true}
function currentPiece(){return byId(UI.pieceId)}
function hypotheticalEmpty(r,c,extras=[]){if(!inB(r,c))return false;const t=pieceAt(r,c);return!t||extras.some(x=>x.r===r&&x.c===c)}
function highlightPlacement(extras=[],allowLab=false,allowDead=false){clearClasses();for(let r=0;r<9;r++)for(let c=0;c<9;c++){if(!allowLab&&r===LAB.r&&c===LAB.c)continue;const t=pieceAt(r,c);if(!t||extras.some(x=>x.r===r&&x.c===c)||(allowDead&&t.dead))mark(r,c,'vplace')}}
function reporterNeedsChoice(to,p){if(G.spPieces?.[p.id]?.type==='area-kill')return false;const has=dirs=>dirs.some(([dr,dc])=>{const r=to.r+dr,c=to.c+dc,t=inB(r,c)?pieceAt(r,c):null;return t&&!t.dead&&t.color!==p.color});return has(DIRS_ORTHO)||has(DIRS_DIAG)}
function askReporterMode(){UI.stage='reporter-mode';clearClasses();const cap=document.getElementById('action-capsule');if(!cap)return;cap.innerHTML='<span style="margin-right:8px">ATTAQUE MOUCHE :</span><button id="mp-rep-o" type="button">ORTHO</button><button id="mp-rep-d" type="button">DIAG</button>';cap.classList.add('visible');document.getElementById('mp-rep-o')?.addEventListener('click',()=>{UI.draft.reporter_mode='ortho';submit(UI.draft)});document.getElementById('mp-rep-d')?.addEventListener('click',()=>{UI.draft.reporter_mode='diag';submit(UI.draft)})}
function stageCorpse(intent,p,target){UI.draft=intent;UI.stage='corpse';UI.draft._actor_from={r:p.r,c:p.c};UI.draft._target={r:target.r,c:target.c};UI.draft._target_type=target.type;UI.draft._killed_on_nid=target.r===LAB.r&&target.c===LAB.c;highlightPlacement([{r:p.r,c:p.c}],false,false);if(typeof setInfoPhase==='function')setInfoPhase('PLACEZ LA DÉPOUILLE')}
function stageDipl(intent,p,target){UI.draft=intent;UI.stage='dipl-place';UI.draft._actor_from={r:p.r,c:p.c};UI.draft._target={r:target.r,c:target.c};highlightPlacement([{r:p.r,c:p.c}],true,false);if(typeof setInfoPhase==='function')setInfoPhase('PLACEZ LA PIÈCE DÉPLACÉE')}
function stageNecro(intent,p,corpse,free){UI.draft=intent;UI.stage='necro-place';UI.draft._free=!!free;UI.draft._actor_from={r:p.r,c:p.c};UI.draft._corpse_from={r:corpse.r,c:corpse.c};highlightPlacement(free?[{r:corpse.r,c:corpse.c}]:[{r:p.r,c:p.c}],false,false);if(typeof setInfoPhase==='function')setInfoPhase('PLACEZ LA DÉPOUILLE')}
function stageResurrect(intent,corpse){UI.draft=intent;UI.stage='resurrect-place';UI.draft._corpse_from={r:corpse.r,c:corpse.c};highlightPlacement([{r:corpse.r,c:corpse.c}],true,true);if(typeof setInfoPhase==='function')setInfoPhase('CHOISISSEZ LA CASE DE RÉSURRECTION')}

/* Prévisualisation locale du seul choix secondaire "sortir du Nid".
   Cette vue n'est jamais appliquée à G; le serveur recalcule toute la légalité. */
function virtualOccupied(r,c,d,actor){
  if(r===LAB.r&&c===LAB.c)return true;
  if(d._actor_from&&r===d._actor_from.r&&c===d._actor_from.c){
    if(actor.type==='assassin')return true; // première dépouille retourne sur l'origine
    if(d.corpse_to&&same({r,c},d.corpse_to))return true;
    return false;
  }
  if(d.corpse_to&&same({r,c},d.corpse_to))return true;
  const t=pieceAt(r,c);
  if(!t)return false;
  if(d._target&&same({r,c},d._target))return false;
  return true;
}
function nidBonusMoves(actor,d){
  const out=[];
  if(actor.type==='militant'){
    for(const[dr,dc]of DIRS8)for(let step=1;step<=2;step++){
      const r=LAB.r+dr*step,c=LAB.c+dc*step;if(!inB(r,c))break;
      if(virtualOccupied(r,c,d,actor))break;
      if(r!==LAB.r||c!==LAB.c)out.push({r,c});
    }
    return out;
  }
  for(const[dr,dc]of DIRS8){let r=LAB.r+dr,c=LAB.c+dc;while(inB(r,c)){if(virtualOccupied(r,c,d,actor))break;out.push({r,c});r+=dr;c+=dc}}
  return out;
}
function stageNidBonus(intent,actor){UI.draft=intent;UI.stage='nid-bonus';clearClasses();const moves=nidBonusMoves(actor,intent);UI.draft._nid_moves=moves;for(const m of moves)mark(m.r,m.c,'vm');if(typeof setInfoPhase==='function')setInfoPhase('👑 QUITTEZ LE NID SACRÉ');if(!moves.length)submit(intent)}
function afterCaptureChoices(intent,actor){if(intent._killed_on_nid&&actor.type!=='chef')return stageNidBonus(intent,actor);return submit(intent)}

function sanitizeIntent(d){const x=clone(d);for(const k of Object.keys(x))if(k.startsWith('_'))delete x[k];return x}
async function submit(draft){
  if(UI.waiting||!RT.allowsBoardInput())return false;
  const intent=sanitizeIntent(draft),base=Number(MP.lastVersion),pending=RT.beginAction({kind:intent.kind,base_version:base,actor_color:RT.snapshot().controlledColor,intent});if(!pending)return false;
  UI.waiting=true;clearClasses();if(typeof setInfoPhase==='function')setInfoPhase('VALIDATION DU COUP…');
  try{
    const r=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'play_action',code:MP.code,secret:MP.secret,base_version:base,intent})});let o=null;try{o=await r.json()}catch(_){}
    if(!r.ok||!o||o.ok===false)throw new Error(o?.error||`Erreur serveur (${r.status})`);
    RT.markWaitingConfirmation(Number(o.version));
    if(typeof MP.playAcceptedEvent==='function')await MP.playAcceptedEvent(o.event,Number(o.version));
    await MP.syncNow(true);reset();return true;
  }catch(e){console.error('[IN-SECT MP INTENT]',e);RT.setError(e);if(typeof toast==='function')toast(`Action refusée : ${e.message||e}`);if(typeof MP.syncNow==='function')await MP.syncNow(true).catch(()=>{});reset();return false}
  finally{UI.waiting=false}
}

function handlePieceStage(r,c,p){
  const actor=currentPiece();if(!actor)return reset();if(p&&isMine(p))return select(p);
  const a=legalActions(actor),mv=(a.moves||[]).find(x=>x.r===r&&x.c===c),kl=(a.kills||[]).find(x=>x.r===r&&x.c===c),dl=(a.diplT||[]).find(x=>x.r===r&&x.c===c),nc=(a.necroT||[]).find(x=>x.r===r&&x.c===c);
  if(mv){const intent={schema:1,kind:'move',piece_id:actor.id,to:{r,c}};if(actor.type==='reporter'&&reporterNeedsChoice({r,c},actor)){UI.draft=intent;askReporterMode();return}return submit(intent)}
  if(kl){
    const target=kl.p,intent={schema:1,kind:'kill',piece_id:actor.id,target_id:target.id,_actor_from:{r:actor.r,c:actor.c},_target:{r:target.r,c:target.c},_target_type:target.type,_killed_on_nid:target.r===LAB.r&&target.c===LAB.c};
    if(actor.type==='assassin'||target.type==='chef')return afterCaptureChoices(intent,actor);
    return stageCorpse(intent,actor,target);
  }
  if(dl)return stageDipl({schema:1,kind:'dipl',piece_id:actor.id,target_id:dl.p.id},actor,dl.p);
  if(nc){const sp=G.spPieces?.[actor.id];if(a.resurrectMode||sp?.type==='resurrect')return stageResurrect({schema:1,kind:'resurrect',piece_id:actor.id,target_id:nc.p.id},nc.p);return stageNecro({schema:1,kind:'necro',piece_id:actor.id,target_id:nc.p.id},actor,nc.p,!!a.freeMoveCorpse)}
  reset();
}
function handlePlacement(r,c){
  const d=UI.draft;if(!d)return reset();
  if(UI.stage==='corpse'){if(!hypotheticalEmpty(r,c,[d._actor_from])||(r===LAB.r&&c===LAB.c))return;d.corpse_to={r,c};return afterCaptureChoices(d,currentPiece())}
  if(UI.stage==='dipl-place'){if(!hypotheticalEmpty(r,c,[d._actor_from])||same({r,c},d._target))return;d.displaced_to={r,c};return submit(d)}
  if(UI.stage==='necro-place'){const extras=d._free?[d._corpse_from]:[d._actor_from];if(!hypotheticalEmpty(r,c,extras)||(r===LAB.r&&c===LAB.c))return;d.corpse_to={r,c};return submit(d)}
  if(UI.stage==='resurrect-place'){const t=pieceAt(r,c);if(t&&!t.dead&&!same({r,c},d._corpse_from))return;d.to={r,c};return submit(d)}
  if(UI.stage==='nid-bonus'){if(!(d._nid_moves||[]).some(m=>m.r===r&&m.c===c))return;d.nid_bonus_to={r,c};return submit(d)}
}
function logicalCellFromEvent(event){const el=event.target instanceof Element?event.target.closest('.cell,.piece'):null;if(!el)return null;if(el.classList.contains('piece')){const p=byId(String(el.id||'').replace(/^p/,''));return p?{r:p.r,c:p.c,p}:null}const m=String(el.id||'').match(/^cell-(\d+)-(\d+)$/);if(!m)return null;const r=Number(m[1]),c=Number(m[2]);return{r,c,p:pieceAt(r,c)}}
function onClick(event){
  if(!RT.isOnline()||!event.target?.closest?.('#board'))return;
  if(!RT.allowsBoardInput()||UI.waiting){event.preventDefault();event.stopImmediatePropagation();return}
  const hit=logicalCellFromEvent(event);if(!hit)return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
  if(UI.stage==='idle')return hit.p&&isMine(hit.p)?select(hit.p):undefined;
  if(UI.stage==='piece')return handlePieceStage(hit.r,hit.c,hit.p);
  if(['corpse','dipl-place','necro-place','resurrect-place','nid-bonus'].includes(UI.stage))return handlePlacement(hit.r,hit.c);
}
document.addEventListener('click',onClick,true);
RT.subscribe(s=>{if(!s.online||![RT.STATES.MY_TURN,RT.STATES.LOCAL_SELECTION].includes(s.phase))if(!UI.waiting)reset()});
MP.cancelLocalIntent=reset;MP.localIntentState=()=>clone(UI);MP.actionApi=ACTION_API;
})();
