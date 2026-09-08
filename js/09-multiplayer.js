/* IN-SECT — transport/session multijoueur. Le runtime 09-multiplayer-runtime.js décide de l'expérience et des entrées. */
(function(){
'use strict';

const RT=window.INSECT_MP_RUNTIME;
if(!RT)return;

const MP=window.INSECT_MP={
  active:false,
  api:String(window.INSECT_MULTIPLAYER_API||'').trim(),
  code:null,
  secret:null,
  role:null,
  localColor:null,
  lastVersion:-1,
  spEnabled:null,
  applyingRemote:false,
  gameTimer:null,
  queueTimer:null,
  queueSecret:null,
  commitInFlight:false,
  lastCommittedTurn:null,
  authoritativeState:null,
  realtimeTopic:null,
  realtimeConnected:false,
};

const enabled=()=>/^https:\/\//i.test(MP.api);
const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function currentColor(state){
  const order=state?.G?.order,idx=state?.G?.idx;
  return Array.isArray(order)&&Number.isInteger(idx)?(order[idx]||null):null;
}
function track(n,p={}){try{if(typeof gaTrack==='function')gaTrack(n,{multiplayer:true,...p})}catch(_){}}
async function api(action,payload={}){
  const r=await fetch(MP.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let d=null;try{d=await r.json()}catch(_){}
  if(!r.ok||!d||d.ok===false){
    const error=new Error(d?.error||`Erreur serveur (${r.status})`);
    error.status=r.status;error.payload=d;throw error;
  }
  return d;
}
function status(m,err=false){const e=document.getElementById('mp-status');if(e){e.textContent=m||'';e.style.color=err?'#FF6680':'#A9A3D6'}}
function show(){document.getElementById('mp-overlay')?.classList.remove('hidden')}
function hide(){document.getElementById('mp-overlay')?.classList.add('hidden')}
function stopGamePoll(){if(MP.gameTimer)clearInterval(MP.gameTimer);MP.gameTimer=null}
function stopQueue(){if(MP.queueTimer)clearInterval(MP.queueTimer);MP.queueTimer=null}
function seatFor(color){return color==='yellow'?'north-west':'south-east'}
function participants(){return[
  {playerId:'host',controlledColor:'yellow',seat:'north-west'},
  {playerId:'guest',controlledColor:'red',seat:'south-east'},
]}
function attachRuntime(phase=RT.STATES.WAITING_INITIAL){
  if(!MP.role||!MP.localColor)return;
  RT.attachSession({code:MP.code,playerId:MP.role,controlledColor:MP.localColor,seat:seatFor(MP.localColor),participants:participants(),connection:'connected',phase});
}
function reset(){
  stopGamePoll();stopQueue();
  Object.assign(MP,{active:false,code:null,secret:null,role:null,localColor:null,lastVersion:-1,spEnabled:null,applyingRemote:false,queueSecret:null,commitInFlight:false,lastCommittedTurn:null,authoritativeState:null,realtimeTopic:null,realtimeConnected:false});
  RT.detach();
}
function serialize(){
  if(!G||!G.players)return null;
  const safe=JSON.parse(JSON.stringify({...G,board:null,sel:null,pendCorpse:null,pendDisp:null,afterCorpse:null,repTargets:[]}));
  return{schema:1,G:safe,mode:1,aiLevel:_aiLevel,selColor:MP.localColor,optSP:!!MP.spEnabled,uid:_uid,turns:_gameTurns,caps:_gameCaps,moveLog:_moveLog||[],sentAt:Date.now()};
}
function turnKey(state=null){
  const game=state?.G||G;if(!game)return null;
  const turns=state?Number(state.turns||0):Number(_gameTurns||0);
  return`${Number(game.turn||0)}:${Number(game.idx||0)}:${turns}`;
}
function rebuild(){
  G.board=Array.from({length:9},()=>Array(9).fill(null));
  for(const c of Object.keys(G.players||{}))for(const p of G.players[c]?.pieces||[]){
    if(Number.isInteger(p.r)&&Number.isInteger(p.c)&&p.r>=0&&p.r<9&&p.c>=0&&p.c<9&&(!p.dead||G.board[p.r][p.c]==null))G.board[p.r][p.c]=p;
  }
}
function flattenPieces(state){
  const out=new Map();
  for(const color of Object.keys(state?.G?.players||{}))for(const p of state.G.players[color]?.pieces||[]){
    if(!out.has(String(p.id)))out.set(String(p.id),{id:p.id,color:p.color,type:p.type,r:p.r,c:p.c,dead:!!p.dead});
  }
  return out;
}
function deriveEvent(before,after,baseVersion){
  const b=flattenPieces(before),a=flattenPieces(after),changes=[];
  const ids=new Set([...b.keys(),...a.keys()]);
  for(const id of ids){
    const from=b.get(id)||null,to=a.get(id)||null;
    if(!from&&to){changes.push({kind:'piece_added',id:to.id,to});continue}
    if(from&&!to){changes.push({kind:'piece_removed',id:from.id,from});continue}
    if(!from||!to)continue;
    const moved=from.r!==to.r||from.c!==to.c;
    const dead=from.dead!==to.dead;
    const color=from.color!==to.color;
    if(moved||dead||color)changes.push({kind:'piece_changed',id:to.id,color:to.color,type:to.type,from:{r:from.r,c:from.c,dead:from.dead,color:from.color},to:{r:to.r,c:to.c,dead:to.dead,color:to.color}});
  }
  return{
    schema:1,
    kind:before?'turn_committed':'match_initialized',
    actor_color:MP.localColor,
    base_version:Number(baseVersion),
    result_version:null,
    turn_before:before?Number(before.G?.turn||0):null,
    turn_after:Number(after?.G?.turn||0),
    current_before:currentColor(before),
    current_after:currentColor(after),
    changes,
    created_at:Date.now(),
  };
}
function badge(){
  if(!MP.active)return;
  const b=document.getElementById('mode-badge');
  if(b)b.textContent=`VOUS · ${String(MP.localColor||'').toUpperCase()} · EN LIGNE · ${MP.code}${MP.spEnabled?' · ⚡ SP':''}`;
}

function applyState(s,version,event=null){
  if(!s?.G)return false;
  MP.applyingRemote=true;
  try{
    _mode=1;_aiLevel=s.aiLevel||1;_selColor=MP.localColor;_optSP=!!s.optSP;
    _uid=Number(s.uid||0);_gameTurns=Number(s.turns||0);_gameCaps=Number(s.caps||0);_moveLog=Array.isArray(s.moveLog)?s.moveLog:[];
    G=clone(s.G);G.human=MP.localColor;G.mode1=true;G.sel=null;G.phase='select';G.spPaused=false;
    // Réseau ≠ IA : les deux sièges restent humains pour empêcher launchCurrentTeam de lancer l'IA.
    for(const c of Object.keys(G.players||{}))G.players[c].human=true;
    rebuild();
    MP.active=true;
    MP.lastVersion=Number(version);
    MP.lastCommittedTurn=turnKey(s);
    MP.authoritativeState=clone(s);
    showScreen('game');buildBoard();renderBoard();renderPlayers();updateTurnUI();updateToggleUI();
    const bz=document.getElementById('bottom-zone');if(bz)bz.style.display='flex';
    badge();hide();
    RT.updateAuthoritative({version:MP.lastVersion,currentPlayer:currentColor(s),event,connection:MP.realtimeConnected?'realtime':'polling',finished:!!s.G.over});
    return true;
  }finally{MP.applyingRemote=false}
}

function eventAnimations(event){
  if(!event||!Array.isArray(event.changes)||!G)return Promise.resolve();
  RT.receiveOpponentEvent(event);RT.beginAcceptedAnimation(event);
  const moved=[],deaths=[];
  for(const change of event.changes){
    if(change.kind!=='piece_changed')continue;
    if(change.from&&change.to&&(change.from.r!==change.to.r||change.from.c!==change.to.c))moved.push(change);
    if(change.from&&!change.from.dead&&change.to?.dead)deaths.push(change);
  }
  for(const change of moved){
    const pe=document.getElementById('p'+change.id);if(!pe||!change.to||change.to.r<0||change.to.c<0)continue;
    const cs=getCellSize();
    const pos=typeof _positionStyle==='function'?_positionStyle(change.to.r,change.to.c,cs,0):{left:change.to.c*cs,top:change.to.r*cs};
    pe.classList.add('moving');pe.style.left=pos.left+'px';pe.style.top=pos.top+'px';
  }
  if(moved.length&&typeof sfxMove==='function')sfxMove();
  for(const change of deaths){const pe=document.getElementById('p'+change.id);if(pe)pe.classList.add('flash-kill')}
  if(deaths.length&&typeof sfxCapture==='function')sfxCapture();
  const duration=(moved.length||deaths.length)?Math.max(420,typeof ANIM_MS==='number'?ANIM_MS+70:420):40;
  return new Promise(resolve=>setTimeout(()=>{
    for(const change of moved){document.getElementById('p'+change.id)?.classList.remove('moving')}
    for(const change of deaths){document.getElementById('p'+change.id)?.classList.remove('flash-kill')}
    resolve();
  },duration));
}

async function consumeUpdate(o){
  const version=Number(o.version);
  if(!o.state||!Number.isFinite(version)||version<=MP.lastVersion)return false;
  const event=o.event||o.state?._mp_event||null;
  const adverse=event&&event.actor_color&&event.actor_color!==MP.localColor&&MP.active&&G&&Number(event.base_version)===Number(MP.lastVersion);
  if(adverse)await eventAnimations(event);
  return applyState(o.state,version,event);
}

async function commitCurrentState(force=false){
  if(!MP.active||MP.applyingRemote||!G||MP.commitInFlight)return false;
  const key=turnKey();
  if(!force&&key===MP.lastCommittedTurn)return true;
  const state=serialize();if(!state)return false;
  const baseVersion=Number(MP.lastVersion);
  if(!Number.isInteger(baseVersion)||baseVersion<0){RT.setError('Version serveur inconnue avant envoi.');return false}
  const event=deriveEvent(MP.authoritativeState,state,baseVersion);
  const pending=RT.beginAction({kind:event.kind,base_version:baseVersion,actor_color:MP.localColor,changes:event.changes});
  if(!pending&&!force)return false;
  MP.commitInFlight=true;
  try{
    if(force&&RT.snapshot().phase!==RT.STATES.ACTION_SENT){
      RT.setPhase(RT.STATES.ACTION_SENT,{pendingAction:{kind:event.kind,base_version:baseVersion,actor_color:MP.localColor,sent_at:Date.now()}});
    }
    const o=await api('commit_turn',{code:MP.code,secret:MP.secret,base_version:baseVersion,state,event});
    const accepted=o.event||{...event,result_version:Number(o.version)};
    MP.lastVersion=Number(o.version);MP.lastCommittedTurn=key;MP.authoritativeState=clone(state);
    RT.markWaitingConfirmation(MP.lastVersion);
    RT.updateAuthoritative({version:MP.lastVersion,currentPlayer:currentColor(state),event:accepted,connection:MP.realtimeConnected?'realtime':'polling',finished:o.status==='finished'||!!state.G?.over});
    status(`Coup confirmé · version ${MP.lastVersion}`);
    track('mp_turn_synced',{version:MP.lastVersion});
    return true;
  }catch(e){
    console.error('[IN-SECT MP COMMIT]',e);
    RT.setError(`Action refusée : ${e.message}`);
    status(`Action refusée : ${e.message}`,true);
    // Un refus n'est jamais masqué : récupération autoritaire immédiate.
    await syncNow(true).catch(()=>{});
    return false;
  }finally{MP.commitInFlight=false}
}

function voteUI(o){
  const box=document.getElementById('mp-vote');if(!box)return;
  box.style.display='block';
  if(o?.sp_decided){
    MP.spEnabled=!!o.sp_enabled;
    box.innerHTML=`<div class="mp-result">${o.sp_random?'🎲 DÉSACCORD — LE HASARD A DÉCIDÉ':'🤝 ACCORD DES DEUX JOUEURS'}<br><b>SUPER POUVOIRS ${MP.spEnabled?'ACTIVÉS ⚡':'DÉSACTIVÉS'}</b></div>`;
    return;
  }
  const mine=MP.role==='host'?o?.host_voted:o?.guest_voted,other=MP.role==='host'?o?.guest_voted:o?.host_voted;
  box.innerHTML=`<div class="mp-vtitle">⚡ SUPER POUVOIRS ?</div><div class="mp-vsub">Chacun vote. En cas de désaccord, tirage serveur 50/50.</div><div class="mp-vbuttons"><button ${mine?'disabled':''} onclick="INSECT_MP.vote(true)">OUI ⚡</button><button ${mine?'disabled':''} onclick="INSECT_MP.vote(false)">NON</button></div><div class="mp-vstate">${mine?'✓ Votre vote':'Votre vote est attendu'} · ${other?'✓ Adversaire a voté':'En attente du vote adverse'}</div>`;
}

async function startHost(){
  if(MP.active)return;
  MP.localColor='yellow';attachRuntime(RT.STATES.PREPARING);
  _mode=1;_selColor='yellow';_aiLevel=1;_optSP=!!MP.spEnabled;
  startGame();_optSP=!!MP.spEnabled;G.human='yellow';
  if(G.players.yellow)G.players.yellow.human=true;
  if(G.players.red)G.players.red.human=true;
  MP.active=true;MP.lastVersion=Math.max(0,Number(MP.lastVersion));
  RT.setPhase(RT.STATES.WAITING_INITIAL,{currentPlayer:'yellow',serverVersion:MP.lastVersion,localVersion:MP.lastVersion});
  badge();
  await commitCurrentState(true);
  hide();track('mp_match_start',{source:'online',super_powers:!!MP.spEnabled});
}

async function syncNow(force=false){
  if(!MP.code||!MP.secret)return false;
  const since=force?-1:Number.isFinite(MP.lastVersion)?MP.lastVersion:-1;
  const o=await api('get',{code:MP.code,secret:MP.secret,since});
  if(o.realtime_topic)MP.realtimeTopic=String(o.realtime_topic);
  voteUI(o);
  if(o.status==='waiting'){status('En attente de votre adversaire…');return false}
  if(!o.sp_decided){status('Votez pour les super pouvoirs.');return false}
  MP.spEnabled=!!o.sp_enabled;
  if(MP.role==='host'&&!MP.active&&!o.state){status('Adversaire trouvé. Préparation…');await startHost();return true}
  if(o.state&&Number(o.version)>MP.lastVersion){await consumeUpdate(o)}
  else if(force&&o.state){applyState(o.state,Number(o.version),o.event||o.state?._mp_event||null)}
  if(o.status==='finished'){MP.active=false;RT.setPhase(RT.STATES.FINISHED);stopGamePoll()}
  return true;
}

async function gamePoll(){
  if(!MP.code||!MP.secret)return;
  try{
    // Le moteur solo termine encore localement le tour pendant cette étape de migration.
    // Dès que le joueur courant local a changé, l'entrée est bloquée par la frontière DOM
    // et le nouvel état est soumis avec base_version explicite.
    if(MP.active&&G&&!MP.applyingRemote&&!MP.commitInFlight&&cur()!==MP.localColor&&turnKey()!==MP.lastCommittedTurn){
      await commitCurrentState(false);
    }
    await syncNow(false);
  }catch(e){
    console.warn('[IN-SECT MP POLL]',e);
    RT.setConnection('degraded');
  }
}
function startGamePoll(){stopGamePoll();gamePoll();MP.gameTimer=setInterval(gamePoll,200)}
async function vote(v){try{const o=await api('vote_sp',{code:MP.code,secret:MP.secret,enabled:!!v});voteUI(o);track('mp_sp_vote',{vote:!!v});await gamePoll()}catch(e){status(e.message,true)}}

function adopt(o){
  MP.code=norm(o.code);MP.secret=o.secret;MP.role=o.role;MP.localColor=o.role==='host'?'yellow':'red';MP.lastVersion=-1;MP.spEnabled=null;MP.lastCommittedTurn=null;MP.authoritativeState=null;
  stopQueue();attachRuntime(RT.STATES.OPPONENT_FOUND);renderMatched();startGamePoll();track('mp_match_found',{role:MP.role});
}
function renderMatched(){
  const s=document.getElementById('mp-search');
  if(s)s.innerHTML=`<div class="mp-result">✅ ADVERSAIRE TROUVÉ<br><b>Vous êtes la colonie ${MP.localColor==='yellow'?'JAUNE':'ROUGE'}</b></div>`;
  status('Adversaire trouvé. Votez pour les super pouvoirs.');
}
async function findOpponent(){
  if(MP.queueSecret)return;
  RT.setPhase(RT.STATES.SEARCHING,{online:false,connection:'searching'});
  status('Recherche d’un adversaire…');
  const s=document.getElementById('mp-search');
  if(s)s.innerHTML='<div class="mp-searching">🔎 Recherche en cours…<br><span>Vous pouvez annuler à tout moment.</span></div><button class="btn-secondary" style="margin-top:9px" onclick="INSECT_MP.cancelSearch()">ANNULER</button>';
  try{const o=await api('matchmake_start');MP.queueSecret=o.queue_secret;track('mp_search_start');if(o.matched)return adopt(o);MP.queueTimer=setInterval(searchStatus,1000)}catch(e){MP.queueSecret=null;RT.detach();status(e.message,true)}
}
async function searchStatus(){if(!MP.queueSecret)return;try{const o=await api('matchmake_status',{queue_secret:MP.queueSecret});if(o.matched)return adopt(o);if(o.expired){stopQueue();MP.queueSecret=null;RT.detach();status('Aucun adversaire trouvé pour le moment. Réessayez.',true);const s=document.getElementById('mp-search');if(s)s.innerHTML=''}}catch(e){console.warn('[IN-SECT MP MATCHMAKING]',e)}}
async function cancelSearch(){
  if(MP.queueSecret){try{const o=await api('matchmake_cancel',{queue_secret:MP.queueSecret});if(o.matched){const s=await api('matchmake_status',{queue_secret:MP.queueSecret});if(s.matched)return adopt(s)}}catch(_){}}
  stopQueue();MP.queueSecret=null;RT.detach();const s=document.getElementById('mp-search');if(s)s.innerHTML='';status('Recherche annulée.');
}
async function create(){
  cancelSearch();status('Création de la partie…');
  try{const o=await api('create');MP.code=norm(o.code);MP.secret=o.secret;MP.role='host';MP.localColor='yellow';MP.lastVersion=Number(o.version??0);MP.spEnabled=null;MP.lastCommittedTurn=null;MP.authoritativeState=null;attachRuntime(RT.STATES.WAITING_INITIAL);invite();status('Partie créée. Envoyez le lien à votre adversaire.');startGamePoll();track('mp_room_created')}catch(e){RT.detach();status(e.message,true)}
}
async function join(v){
  cancelSearch();const code=norm(v);if(code.length!==6)return status('Code invalide.',true);
  status('Connexion…');
  try{const o=await api('join',{code});MP.code=code;MP.secret=o.secret;MP.role='guest';MP.localColor='red';MP.lastVersion=Number(o.version??0);MP.spEnabled=null;MP.lastCommittedTurn=null;MP.authoritativeState=null;attachRuntime(RT.STATES.WAITING_INITIAL);status('Connecté. Votez pour les super pouvoirs.');startGamePoll();track('mp_room_joined')}catch(e){RT.detach();status(e.message,true)}
}
function joinUrl(){const u=new URL(location.href);u.searchParams.set('join',MP.code);u.hash='';return u.toString()}
async function copy(){try{await navigator.clipboard.writeText(joinUrl());status('Lien copié. Envoyez-le à votre adversaire.')}catch(_){window.prompt('Copiez ce lien :',joinUrl())}}
async function share(){try{if(navigator.share)await navigator.share({title:'Défi IN-SECT',text:`⚔️ Je te défie sur IN-SECT. Code ${MP.code}`,url:joinUrl()});else await copy();track('mp_invite_shared')}catch(e){if(e?.name!=='AbortError')await copy()}}
function invite(){const b=document.getElementById('mp-invite');if(!b)return;b.style.display='block';b.innerHTML=`<div class="mp-code-label">CODE DE PARTIE</div><div class="mp-code">${MP.code}</div><div class="mp-vbuttons"><button onclick="INSECT_MP.copyInvite()">COPIER</button><button onclick="INSECT_MP.shareInvite()">PARTAGER</button></div>`}

function inject(){
  if(!enabled())return;
  const cfg=document.querySelector('#s-menu .menu-config');
  if(cfg&&!document.getElementById('mp-open-btn')){const w=document.createElement('div');w.style.cssText='margin-top:10px;padding-top:10px;border-top:1px solid rgba(128,80,255,.18)';w.innerHTML='<button id="mp-open-btn" class="btn-play" style="background:linear-gradient(135deg,#123A56,#146A78)" onclick="INSECT_MP.open()">🌐 MULTIJOUEUR</button>';cfg.appendChild(w)}
  if(document.getElementById('mp-overlay'))return;
  const e=document.createElement('div');e.id='mp-overlay';e.className='modal-overlay hidden';
  e.innerHTML=`<div class="modal-box" style="max-width:390px"><div class="modal-header"><div class="modal-title">🌐 MULTIJOUEUR</div><button class="modal-close" onclick="INSECT_MP.close()">✕</button></div><div class="modal-body" style="gap:13px"><div style="font-size:.82rem;color:#9C96C5;line-height:1.5">Jouez contre un inconnu disponible ou défiez directement un ami.</div><button class="btn-primary" style="background:linear-gradient(135deg,#174B39,#19855F)" onclick="INSECT_MP.findOpponent()">🔎 TROUVER UN ADVERSAIRE</button><div id="mp-search" style="text-align:center"></div><div style="text-align:center;color:#5F5A82;font-size:.72rem">— OU DÉFIER UN AMI —</div><button class="btn-primary" onclick="INSECT_MP.create()">⚔️ CRÉER UNE PARTIE PRIVÉE</button><div id="mp-invite" style="display:none;text-align:center;padding:12px;border:1px solid rgba(212,160,23,.28);border-radius:12px"></div><input id="mp-code-input" maxlength="6" placeholder="CODE DE PARTIE" style="height:46px;border-radius:9px;background:#090713;color:#EEE8FF;text-align:center;font-size:1rem;font-weight:800;letter-spacing:.14em"><button class="btn-secondary" onclick="INSECT_MP.join(document.getElementById('mp-code-input').value)">REJOINDRE AVEC UN CODE</button><div id="mp-vote" style="display:none;text-align:center;padding:12px;border:1px solid rgba(128,80,255,.3);border-radius:12px"></div><div id="mp-status" style="min-height:20px;text-align:center;font-size:.76rem"></div></div></div>`;
  document.body.appendChild(e);
  const s=document.createElement('style');s.textContent='.mp-vtitle{font-weight:900;color:#CDBBFF;margin-bottom:6px}.mp-vsub,.mp-vstate{font-size:.72rem;color:#8E88B8;line-height:1.4;margin:7px 0}.mp-vbuttons{display:flex;gap:8px;margin-top:9px}.mp-vbuttons button{flex:1;min-height:38px;border:1px solid rgba(128,80,255,.35);border-radius:8px;background:rgba(128,80,255,.12);color:#CDBBFF;font-weight:800}.mp-vbuttons button:disabled{opacity:.4}.mp-result{font-size:.78rem;color:#D4A017;line-height:1.6}.mp-code-label{font-size:.7rem;color:#8E88B8}.mp-code{font-size:1.5rem;color:#D4A017;font-weight:900;letter-spacing:.18em;margin:5px 0}.mp-searching{padding:10px;border:1px solid rgba(40,190,220,.25);border-radius:10px;color:#BCECF3;font-size:.8rem;line-height:1.6}.mp-searching span{font-size:.7rem;color:#7C9FA8}';document.head.appendChild(s);
}

function blockInvalidBoardInput(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!target.closest('#board')||!RT.isOnline())return;
  const snap=RT.snapshot();
  const logicalTurn=(typeof cur==='function'&&G&&G.order)?cur():null;
  const allowed=RT.allowsBoardInput()&&logicalTurn===snap.controlledColor&&!MP.commitInFlight;
  if(allowed){if(RT.snapshot().phase===RT.STATES.MY_TURN)RT.beginSelection();return}
  event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
}
for(const name of ['pointerdown','click','dblclick'])document.addEventListener(name,blockInvalidBoardInput,true);

function autoJoin(){const c=norm(new URLSearchParams(location.search).get('join'));if(c){const i=document.getElementById('mp-code-input');if(i)i.value=c;show();status(`Invitation détectée : ${c}`)}}
function receiveAcceptedEvent(event,version){
  if(!event||Number(version)<=MP.lastVersion)return false;
  RT.receiveOpponentEvent(event);
  // La récupération du snapshot reste obligatoire après l'animation.
  eventAnimations(event).then(()=>syncNow(false)).catch(()=>syncNow(false));
  return true;
}

Object.assign(MP,{open:show,close:hide,create,join,vote,copyInvite:copy,shareInvite:share,findOpponent,cancelSearch,leave:reset,commitState:commitCurrentState,syncNow,receiveAcceptedEvent});
function boot(){if(!enabled())return;inject();autoJoin()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
