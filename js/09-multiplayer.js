/* IN-SECT — transport/session multijoueur. Le gameplay online est résolu par insect-play ; ce fichier ne pousse qu'un snapshot initial. */
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
  eventPlayback:false,
  gameTimer:null,
  queueTimer:null,
  queueSecret:null,
  initializing:false,
  authoritativeState:null,
  realtimeTopic:null,
  realtimeConnected:false,
};

const enabled=()=>/^https:\/\//i.test(MP.api);
const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function currentColor(state){const order=state?.G?.order,idx=state?.G?.idx;return Array.isArray(order)&&Number.isInteger(idx)?(order[idx]||null):null}
function track(name,params={}){try{if(typeof gaTrack==='function')gaTrack(name,{multiplayer:true,...params})}catch(_){}}
async function api(action,payload={}){
  const response=await fetch(MP.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let data=null;try{data=await response.json()}catch(_){}
  if(!response.ok||!data||data.ok===false){const error=new Error(data?.error||`Erreur serveur (${response.status})`);error.status=response.status;error.payload=data;throw error}
  return data;
}
function status(message,error=false){const el=document.getElementById('mp-status');if(el){el.textContent=message||'';el.style.color=error?'#FF6680':'#A9A3D6'}}
function show(){document.getElementById('mp-overlay')?.classList.remove('hidden')}
function hide(){document.getElementById('mp-overlay')?.classList.add('hidden')}
function stopGamePoll(){if(MP.gameTimer)clearInterval(MP.gameTimer);MP.gameTimer=null}
function stopQueue(){if(MP.queueTimer)clearInterval(MP.queueTimer);MP.queueTimer=null}
function seatFor(color){return color==='yellow'?'north-west':'south-east'}
function participants(){return[{playerId:'host',controlledColor:'yellow',seat:'north-west'},{playerId:'guest',controlledColor:'red',seat:'south-east'}]}
function attachRuntime(phase=RT.STATES.WAITING_INITIAL){if(!MP.role||!MP.localColor)return;RT.attachSession({code:MP.code,playerId:MP.role,controlledColor:MP.localColor,seat:seatFor(MP.localColor),participants:participants(),connection:'connected',phase})}
function reset(){
  stopGamePoll();stopQueue();
  Object.assign(MP,{active:false,code:null,secret:null,role:null,localColor:null,lastVersion:-1,spEnabled:null,applyingRemote:false,eventPlayback:false,queueSecret:null,initializing:false,authoritativeState:null,realtimeTopic:null,realtimeConnected:false});
  RT.detach();
}

function serializeInitial(){
  if(!G||!G.players)return null;
  const safe=clone({...G,board:null,sel:null,pendCorpse:null,pendDisp:null,afterCorpse:null,repTargets:[]});
  return{schema:1,G:safe,mode:1,aiLevel:_aiLevel,selColor:'yellow',optSP:!!MP.spEnabled,uid:_uid,turns:_gameTurns,caps:_gameCaps,moveLog:_moveLog||[],sentAt:Date.now()};
}
function flattenPieces(state){const out=[];for(const color of Object.keys(state?.G?.players||{}))for(const p of state.G.players[color]?.pieces||[])out.push({kind:'piece_added',id:p.id,to:{id:p.id,color:p.color,type:p.type,r:p.r,c:p.c,dead:!!p.dead}});return out}
function initialEvent(state,baseVersion){return{schema:1,kind:'match_initialized',actor_color:'yellow',base_version:Number(baseVersion),result_version:null,turn_before:null,turn_after:Number(state?.G?.turn||0),current_before:null,current_after:currentColor(state),changes:flattenPieces(state),created_at:Date.now()}}
function rebuild(){
  G.board=Array.from({length:9},()=>Array(9).fill(null));
  for(const color of Object.keys(G.players||{}))for(const p of G.players[color]?.pieces||[]){if(Number.isInteger(p.r)&&Number.isInteger(p.c)&&p.r>=0&&p.r<9&&p.c>=0&&p.c<9&&(!p.dead||G.board[p.r][p.c]==null))G.board[p.r][p.c]=p}
}
function badge(){if(!MP.active)return;const el=document.getElementById('mode-badge');if(el)el.textContent=`VOUS · ${String(MP.localColor||'').toUpperCase()} · EN LIGNE · ${MP.code}${MP.spEnabled?' · ⚡ SP':''}`}
function applyState(state,version,event=null){
  if(!state?.G)return false;
  MP.applyingRemote=true;
  try{
    _mode=1;_aiLevel=state.aiLevel||1;_selColor=MP.localColor;_optSP=!!state.optSP;_uid=Number(state.uid||0);_gameTurns=Number(state.turns||0);_gameCaps=Number(state.caps||0);_moveLog=Array.isArray(state.moveLog)?state.moveLog:[];
    G=clone(state.G);G.human=MP.localColor;G.mode1=true;G.sel=null;G.phase='select';G.spPaused=false;
    for(const color of Object.keys(G.players||{}))G.players[color].human=true;
    rebuild();MP.active=true;MP.lastVersion=Number(version);MP.authoritativeState=clone(state);
    showScreen('game');buildBoard();renderBoard();renderPlayers();updateTurnUI();updateToggleUI();
    const bottom=document.getElementById('bottom-zone');if(bottom)bottom.style.display='flex';
    badge();hide();
    RT.updateAuthoritative({version:MP.lastVersion,currentPlayer:currentColor(state),event,connection:MP.realtimeConnected?'realtime':'polling',finished:!!state.G.over});
    return true;
  }finally{MP.applyingRemote=false}
}
async function consumeUpdate(result){
  const version=Number(result.version);if(!result.state||!Number.isFinite(version)||version<=Number(MP.lastVersion))return false;
  const event=result.event||result.state?._mp_event||null;
  const shouldAnimate=event&&event.actor_color&&event.actor_color!==MP.localColor&&MP.active&&G&&Number(event.base_version)===Number(MP.lastVersion)&&typeof MP.playAcceptedEvent==='function';
  if(shouldAnimate)await MP.playAcceptedEvent(event,version);
  return applyState(result.state,version,event);
}

async function initializeHostState(){
  if(MP.initializing||MP.role!=='host'||MP.authoritativeState||!G)return false;
  const state=serializeInitial();if(!state)return false;
  const baseVersion=Number(MP.lastVersion);
  if(!Number.isInteger(baseVersion)||baseVersion<0){RT.setError('Version serveur inconnue avant initialisation.');return false}
  const event=initialEvent(state,baseVersion);MP.initializing=true;
  RT.setPhase(RT.STATES.ACTION_SENT,{pendingAction:{kind:'match_initialized',base_version:baseVersion,actor_color:'yellow',sent_at:Date.now()}});
  try{
    const result=await api('commit_turn',{code:MP.code,secret:MP.secret,base_version:baseVersion,state,event});
    MP.lastVersion=Number(result.version);MP.authoritativeState=clone(state);RT.markWaitingConfirmation(MP.lastVersion);
    RT.updateAuthoritative({version:MP.lastVersion,currentPlayer:'yellow',event:result.event||event,connection:MP.realtimeConnected?'realtime':'polling',finished:false});
    status(`Partie prête · version ${MP.lastVersion}`);track('mp_match_initialized',{version:MP.lastVersion});return true;
  }catch(error){console.error('[IN-SECT MP INIT]',error);RT.setError(`Initialisation refusée : ${error.message}`);status(`Initialisation refusée : ${error.message}`,true);await syncNow(true).catch(()=>{});return false}
  finally{MP.initializing=false}
}

function voteUI(result){
  const box=document.getElementById('mp-vote');if(!box)return;box.style.display='block';
  if(result?.sp_decided){MP.spEnabled=!!result.sp_enabled;box.innerHTML=`<div class="mp-result">${result.sp_random?'🎲 DÉSACCORD — LE HASARD A DÉCIDÉ':'🤝 ACCORD DES DEUX JOUEURS'}<br><b>SUPER POUVOIRS ${MP.spEnabled?'ACTIVÉS ⚡':'DÉSACTIVÉS'}</b></div>`;return}
  const mine=MP.role==='host'?result?.host_voted:result?.guest_voted,other=MP.role==='host'?result?.guest_voted:result?.host_voted;
  box.innerHTML=`<div class="mp-vtitle">⚡ SUPER POUVOIRS ?</div><div class="mp-vsub">Chacun vote. En cas de désaccord, tirage serveur 50/50.</div><div class="mp-vbuttons"><button ${mine?'disabled':''} onclick="INSECT_MP.vote(true)">OUI ⚡</button><button ${mine?'disabled':''} onclick="INSECT_MP.vote(false)">NON</button></div><div class="mp-vstate">${mine?'✓ Votre vote':'Votre vote est attendu'} · ${other?'✓ Adversaire a voté':'En attente du vote adverse'}</div>`;
}
async function startHost(){
  if(MP.active)return;MP.localColor='yellow';attachRuntime(RT.STATES.PREPARING);_mode=1;_selColor='yellow';_aiLevel=1;_optSP=!!MP.spEnabled;
  startGame();_optSP=!!MP.spEnabled;G.human='yellow';if(G.players.yellow)G.players.yellow.human=true;if(G.players.red)G.players.red.human=true;
  MP.active=true;MP.lastVersion=Math.max(0,Number(MP.lastVersion));RT.setPhase(RT.STATES.WAITING_INITIAL,{currentPlayer:'yellow',serverVersion:MP.lastVersion,localVersion:MP.lastVersion});badge();
  const ok=await initializeHostState();if(ok){hide();track('mp_match_start',{source:'online',super_powers:!!MP.spEnabled})}
}
async function syncNow(force=false){
  if(!MP.code||!MP.secret)return false;
  const since=force?-1:(Number.isFinite(MP.lastVersion)?MP.lastVersion:-1);const result=await api('get',{code:MP.code,secret:MP.secret,since});
  if(result.realtime_topic)MP.realtimeTopic=String(result.realtime_topic);voteUI(result);
  if(result.status==='waiting'){status('En attente de votre adversaire…');return false}
  if(!result.sp_decided){status('Votez pour les super pouvoirs.');return false}
  MP.spEnabled=!!result.sp_enabled;
  if(MP.role==='host'&&!MP.active&&!result.state){status('Adversaire trouvé. Préparation…');await startHost();return true}
  if(result.state&&Number(result.version)>Number(MP.lastVersion))await consumeUpdate(result);
  else if(force&&result.state)applyState(result.state,Number(result.version),result.event||result.state?._mp_event||null);
  if(result.status==='finished'){MP.active=false;RT.setPhase(RT.STATES.FINISHED);stopGamePoll()}
  return true;
}
async function gamePoll(){if(!MP.code||!MP.secret||MP.eventPlayback)return;try{await syncNow(false)}catch(error){console.warn('[IN-SECT MP POLL]',error);RT.setConnection('degraded')}}
function startGamePoll(){stopGamePoll();gamePoll();MP.gameTimer=setInterval(gamePoll,350)}
async function vote(value){try{const result=await api('vote_sp',{code:MP.code,secret:MP.secret,enabled:!!value});voteUI(result);track('mp_sp_vote',{vote:!!value});await gamePoll()}catch(error){status(error.message,true)}}

function adopt(result){MP.code=norm(result.code);MP.secret=result.secret;MP.role=result.role;MP.localColor=result.role==='host'?'yellow':'red';MP.lastVersion=-1;MP.spEnabled=null;MP.authoritativeState=null;stopQueue();attachRuntime(RT.STATES.OPPONENT_FOUND);renderMatched();startGamePoll();track('mp_match_found',{role:MP.role})}
function renderMatched(){const el=document.getElementById('mp-search');if(el)el.innerHTML=`<div class="mp-result">✅ ADVERSAIRE TROUVÉ<br><b>Vous êtes la colonie ${MP.localColor==='yellow'?'JAUNE':'ROUGE'}</b></div>`;status('Adversaire trouvé. Votez pour les super pouvoirs.')}
async function findOpponent(){
  if(MP.queueSecret)return;RT.setPhase(RT.STATES.SEARCHING,{online:false,connection:'searching'});status('Recherche d’un adversaire…');
  const el=document.getElementById('mp-search');if(el)el.innerHTML='<div class="mp-searching">🔎 Recherche en cours…<br><span>Vous pouvez annuler à tout moment.</span></div><button class="btn-secondary" style="margin-top:9px" onclick="INSECT_MP.cancelSearch()">ANNULER</button>';
  try{const result=await api('matchmake_start');MP.queueSecret=result.queue_secret;track('mp_search_start');if(result.matched)return adopt(result);MP.queueTimer=setInterval(searchStatus,1000)}catch(error){MP.queueSecret=null;RT.detach();status(error.message,true)}
}
async function searchStatus(){if(!MP.queueSecret)return;try{const result=await api('matchmake_status',{queue_secret:MP.queueSecret});if(result.matched)return adopt(result);if(result.expired){stopQueue();MP.queueSecret=null;RT.detach();status('Aucun adversaire trouvé pour le moment. Réessayez.',true);const el=document.getElementById('mp-search');if(el)el.innerHTML=''}}catch(error){console.warn('[IN-SECT MP MATCHMAKING]',error)}}
async function cancelSearch(){if(MP.queueSecret){try{const result=await api('matchmake_cancel',{queue_secret:MP.queueSecret});if(result.matched){const statusResult=await api('matchmake_status',{queue_secret:MP.queueSecret});if(statusResult.matched)return adopt(statusResult)}}catch(_){}}stopQueue();MP.queueSecret=null;RT.detach();const el=document.getElementById('mp-search');if(el)el.innerHTML='';status('Recherche annulée.')}
async function create(){cancelSearch();status('Création de la partie…');try{const result=await api('create');MP.code=norm(result.code);MP.secret=result.secret;MP.role='host';MP.localColor='yellow';MP.lastVersion=Number(result.version??0);MP.spEnabled=null;MP.authoritativeState=null;attachRuntime(RT.STATES.WAITING_INITIAL);invite();status('Partie créée. Envoyez le lien à votre adversaire.');startGamePoll();track('mp_room_created')}catch(error){RT.detach();status(error.message,true)}}
async function join(value){cancelSearch();const code=norm(value);if(code.length!==6)return status('Code invalide.',true);status('Connexion…');try{const result=await api('join',{code});MP.code=code;MP.secret=result.secret;MP.role='guest';MP.localColor='red';MP.lastVersion=Number(result.version??0);MP.spEnabled=null;MP.authoritativeState=null;attachRuntime(RT.STATES.WAITING_INITIAL);status('Connecté. Votez pour les super pouvoirs.');startGamePoll();track('mp_room_joined')}catch(error){RT.detach();status(error.message,true)}}
function joinUrl(){const url=new URL(location.href);url.searchParams.set('join',MP.code);url.hash='';return url.toString()}
async function copy(){try{await navigator.clipboard.writeText(joinUrl());status('Lien copié. Envoyez-le à votre adversaire.')}catch(_){window.prompt('Copiez ce lien :',joinUrl())}}
async function share(){try{if(navigator.share)await navigator.share({title:'Défi IN-SECT',text:`⚔️ Je te défie sur IN-SECT. Code ${MP.code}`,url:joinUrl()});else await copy();track('mp_invite_shared')}catch(error){if(error?.name!=='AbortError')await copy()}}
function invite(){const el=document.getElementById('mp-invite');if(!el)return;el.style.display='block';el.innerHTML=`<div class="mp-code-label">CODE DE PARTIE</div><div class="mp-code">${MP.code}</div><div class="mp-vbuttons"><button onclick="INSECT_MP.copyInvite()">COPIER</button><button onclick="INSECT_MP.shareInvite()">PARTAGER</button></div>`}

function inject(){
  if(!enabled())return;const cfg=document.querySelector('#s-menu .menu-config');
  if(cfg&&!document.getElementById('mp-open-btn')){const wrap=document.createElement('div');wrap.style.cssText='margin-top:10px;padding-top:10px;border-top:1px solid rgba(128,80,255,.18)';wrap.innerHTML='<button id="mp-open-btn" class="btn-play" style="background:linear-gradient(135deg,#123A56,#146A78)" onclick="INSECT_MP.open()">🌐 MULTIJOUEUR</button>';cfg.appendChild(wrap)}
  if(document.getElementById('mp-overlay'))return;
  const overlay=document.createElement('div');overlay.id='mp-overlay';overlay.className='modal-overlay hidden';overlay.innerHTML=`<div class="modal-box" style="max-width:390px"><div class="modal-header"><div class="modal-title">🌐 MULTIJOUEUR</div><button class="modal-close" onclick="INSECT_MP.close()">✕</button></div><div class="modal-body" style="gap:13px"><div style="font-size:.82rem;color:#9C96C5;line-height:1.5">Jouez contre un inconnu disponible ou défiez directement un ami.</div><button class="btn-primary" style="background:linear-gradient(135deg,#174B39,#19855F)" onclick="INSECT_MP.findOpponent()">🔎 TROUVER UN ADVERSAIRE</button><div id="mp-search" style="text-align:center"></div><div style="text-align:center;color:#5F5A82;font-size:.72rem">— OU DÉFIER UN AMI —</div><button class="btn-primary" onclick="INSECT_MP.create()">⚔️ CRÉER UNE PARTIE PRIVÉE</button><div id="mp-invite" style="display:none;text-align:center;padding:12px;border:1px solid rgba(212,160,23,.28);border-radius:12px"></div><input id="mp-code-input" maxlength="6" placeholder="CODE DE PARTIE" style="height:46px;border-radius:9px;background:#090713;color:#EEE8FF;text-align:center;font-size:1rem;font-weight:800;letter-spacing:.14em"><button class="btn-secondary" onclick="INSECT_MP.join(document.getElementById('mp-code-input').value)">REJOINDRE AVEC UN CODE</button><div id="mp-vote" style="display:none;text-align:center;padding:12px;border:1px solid rgba(128,80,255,.3);border-radius:12px"></div><div id="mp-status" style="min-height:20px;text-align:center;font-size:.76rem"></div></div></div>`;document.body.appendChild(overlay);
  const style=document.createElement('style');style.textContent='.mp-vtitle{font-weight:900;color:#CDBBFF;margin-bottom:6px}.mp-vsub,.mp-vstate{font-size:.72rem;color:#8E88B8;line-height:1.4;margin:7px 0}.mp-vbuttons{display:flex;gap:8px;margin-top:9px}.mp-vbuttons button{flex:1;min-height:38px;border:1px solid rgba(128,80,255,.35);border-radius:8px;background:rgba(128,80,255,.12);color:#CDBBFF;font-weight:800}.mp-vbuttons button:disabled{opacity:.4}.mp-result{font-size:.78rem;color:#D4A017;line-height:1.6}.mp-code-label{font-size:.7rem;color:#8E88B8}.mp-code{font-size:1.5rem;color:#D4A017;font-weight:900;letter-spacing:.18em;margin:5px 0}.mp-searching{padding:10px;border:1px solid rgba(40,190,220,.25);border-radius:10px;color:#BCECF3;font-size:.8rem;line-height:1.6}.mp-searching span{font-size:.7rem;color:#7C9FA8}';document.head.appendChild(style);
}
function blockInvalidBoardInput(event){const target=event.target instanceof Element?event.target:null;if(!target||!target.closest('#board')||!RT.isOnline())return;const snap=RT.snapshot(),logicalTurn=(typeof cur==='function'&&G&&G.order)?cur():null;const allowed=RT.allowsBoardInput()&&logicalTurn===snap.controlledColor&&!MP.initializing;if(allowed)return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation()}
for(const name of ['pointerdown','click','dblclick'])document.addEventListener(name,blockInvalidBoardInput,true);
function autoJoin(){const code=norm(new URLSearchParams(location.search).get('join'));if(code){const input=document.getElementById('mp-code-input');if(input)input.value=code;show();status(`Invitation détectée : ${code}`)}}
function receiveAcceptedEvent(event,version){if(!event||Number(version)<=Number(MP.lastVersion))return false;if(typeof MP.playAcceptedEvent==='function'){MP.playAcceptedEvent(event,version).then(()=>syncNow(true)).catch(()=>syncNow(true));return true}syncNow(true).catch(()=>{});return true}
Object.assign(MP,{open:show,close:hide,create,join,vote,copyInvite:copy,shareInvite:share,findOpponent,cancelSearch,leave:reset,syncNow,receiveAcceptedEvent});
function boot(){if(!enabled())return;inject();autoJoin()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();