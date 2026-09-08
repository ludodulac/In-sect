/* IN-SECT — runtime multijoueur explicite : état d'expérience, perspective et diagnostics. */
(function(root,factory){
  const exported=factory();
  if(typeof module==='object'&&module.exports)module.exports=exported;
  if(root){
    root.INSECT_MP_RUNTIME_FACTORY=exported;
    if(!root.INSECT_MP_RUNTIME)root.INSECT_MP_RUNTIME=exported.createRuntime();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const STATES=Object.freeze({
  IDLE:'idle',
  SEARCHING:'searching_opponent',
  OPPONENT_FOUND:'opponent_found',
  PREPARING:'preparing_match',
  WAITING_INITIAL:'waiting_initial_state',
  MY_TURN:'my_turn',
  LOCAL_SELECTION:'local_selection',
  ACTION_SENT:'action_sent',
  WAITING_CONFIRMATION:'waiting_confirmation',
  ANIMATING_ACCEPTED:'animating_accepted_action',
  OPPONENT_TURN:'opponent_turn',
  RECEIVING_OPPONENT:'receiving_opponent_action',
  RECONNECTING:'reconnecting',
  FINISHED:'finished',
  SYNC_ERROR:'sync_error',
});
const VALID_STATES=new Set(Object.values(STATES));
const INPUT_STATES=new Set([STATES.MY_TURN,STATES.LOCAL_SELECTION]);

function clone(value){
  if(value==null)return value;
  return JSON.parse(JSON.stringify(value));
}
function normalizeVersion(value){
  const n=Number(value);
  return Number.isInteger(n)&&n>=0?n:-1;
}
function normalizeQuarterTurns(value){
  const n=((Number(value)||0)%4+4)%4;
  return n;
}
function mapByQuarterTurns(r,c,turns,size=9){
  let rr=Number(r),cc=Number(c);
  const max=size-1;
  for(let i=0;i<normalizeQuarterTurns(turns);i++){
    const nr=cc,nc=max-rr;rr=nr;cc=nc;
  }
  return{r:rr,c:cc};
}
function seatQuarterTurns(seat,controlledColor){
  if(seat&&Number.isInteger(Number(seat.quarterTurns)))return normalizeQuarterTurns(seat.quarterTurns);
  if(typeof seat==='string'){
    if(seat==='north-west'||seat==='north'||seat==='top')return 2;
    if(seat==='west'||seat==='left')return 1;
    if(seat==='east'||seat==='right')return 3;
    if(seat==='south-east'||seat==='south'||seat==='bottom')return 0;
  }
  return controlledColor==='yellow'?2:0;
}

function createRuntime(){
  const listeners=new Set();
  const state={
    phase:STATES.IDLE,
    online:false,
    connection:'offline',
    code:null,
    playerId:null,
    controlledColor:null,
    seat:null,
    participants:[],
    currentPlayer:null,
    serverVersion:-1,
    localVersion:-1,
    pendingAction:null,
    lastActionSent:null,
    lastEventReceived:null,
    lastError:null,
    updatedAt:Date.now(),
  };

  function emit(){
    state.updatedAt=Date.now();
    const snap=snapshot();
    for(const fn of listeners){try{fn(snap)}catch(_){}}
    renderDebug();
    return snap;
  }
  function snapshot(){return clone(state)}
  function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn)}
  function setPhase(phase,patch={}){
    if(!VALID_STATES.has(phase))throw new Error(`Unknown multiplayer state: ${phase}`);
    Object.assign(state,patch||{});state.phase=phase;return emit();
  }
  function attachSession(session={}){
    state.online=true;
    state.code=session.code||state.code;
    state.playerId=session.playerId||session.role||state.playerId;
    state.controlledColor=session.controlledColor||session.localColor||state.controlledColor;
    state.seat=session.seat||state.seat||((state.controlledColor==='yellow')?'north-west':'south-east');
    if(Array.isArray(session.participants))state.participants=clone(session.participants);
    if(session.connection)state.connection=session.connection;
    if(session.phase)return setPhase(session.phase);
    return emit();
  }
  function detach(){
    Object.assign(state,{phase:STATES.IDLE,online:false,connection:'offline',code:null,playerId:null,controlledColor:null,seat:null,participants:[],currentPlayer:null,serverVersion:-1,localVersion:-1,pendingAction:null,lastActionSent:null,lastEventReceived:null,lastError:null});
    return emit();
  }
  function setConnection(connection){state.connection=String(connection||'offline');return emit()}
  function setError(error){state.lastError=error?String(error.message||error):null;return setPhase(STATES.SYNC_ERROR)}
  function clearError(){state.lastError=null;return emit()}
  function updateAuthoritative(info={}){
    const version=normalizeVersion(info.version);
    if(version>=0)state.serverVersion=version;
    if(info.applied!==false&&version>=0)state.localVersion=version;
    if(info.currentPlayer!==undefined)state.currentPlayer=info.currentPlayer;
    if(info.event!==undefined&&info.event!==null)state.lastEventReceived=clone(info.event);
    if(info.connection)state.connection=info.connection;
    if(info.finished)return setPhase(STATES.FINISHED);
    if(!state.online)return emit();
    if(state.pendingAction){
      const resultVersion=normalizeVersion(state.pendingAction.resultVersion);
      if(version>=0&&resultVersion>=0&&version>=resultVersion)state.pendingAction=null;
    }
    const mine=state.currentPlayer&&state.currentPlayer===state.controlledColor;
    return setPhase(mine?STATES.MY_TURN:STATES.OPPONENT_TURN);
  }
  function beginSelection(){if(!allowsBoardInput())return false;setPhase(STATES.LOCAL_SELECTION);return true}
  function clearSelection(){if(state.phase===STATES.LOCAL_SELECTION)setPhase(STATES.MY_TURN);return true}
  function beginAction(action){
    if(!allowsBoardInput()||state.pendingAction)return false;
    const baseVersion=normalizeVersion(action?.base_version??action?.baseVersion??state.localVersion);
    if(baseVersion<0||baseVersion!==state.localVersion||baseVersion!==state.serverVersion)return false;
    const enriched={...clone(action||{}),base_version:baseVersion,actor_color:action?.actor_color||state.controlledColor,sent_at:Date.now()};
    state.pendingAction=enriched;state.lastActionSent=clone(enriched);setPhase(STATES.ACTION_SENT);return clone(enriched);
  }
  function markWaitingConfirmation(resultVersion){
    if(!state.pendingAction)return false;
    state.pendingAction.resultVersion=normalizeVersion(resultVersion);
    setPhase(STATES.WAITING_CONFIRMATION);return true;
  }
  function receiveOpponentEvent(event){state.lastEventReceived=clone(event);return setPhase(STATES.RECEIVING_OPPONENT)}
  function beginAcceptedAnimation(event){if(event)state.lastEventReceived=clone(event);return setPhase(STATES.ANIMATING_ACCEPTED)}
  function beginReconnect(){state.connection='reconnecting';return setPhase(STATES.RECONNECTING)}
  function isOnline(){return!!state.online}
  function isLocalTurn(){return!!(state.online&&state.currentPlayer&&state.currentPlayer===state.controlledColor)}
  function allowsBoardInput(){
    return!!(state.online&&INPUT_STATES.has(state.phase)&&isLocalTurn()&&!state.pendingAction&&state.connection!=='offline');
  }
  function shouldRunAI(){return!state.online}
  function mapLogicalToView(r,c){return mapByQuarterTurns(r,c,seatQuarterTurns(state.seat,state.controlledColor),9)}
  function mapViewToLogical(r,c){return mapByQuarterTurns(r,c,4-seatQuarterTurns(state.seat,state.controlledColor),9)}
  function getTurnLabel(color,colorName){
    if(!state.online)return null;
    const name=colorName||String(color||'').toUpperCase();
    return color===state.controlledColor?`VOTRE TOUR — ${name}`:`TOUR DE ${name.replace(/^COLONIE\s+/i,'')}`;
  }
  function identityLabel(){return state.controlledColor?`VOUS · ${String(state.controlledColor).toUpperCase()}`:'EN LIGNE'}
  function diagnostics(){return snapshot()}

  function renderDebug(){
    if(typeof document==='undefined'||typeof location==='undefined')return;
    const params=new URLSearchParams(location.search||'');
    if(params.get('mpdebug')!=='1')return;
    let el=document.getElementById('insect-mp-debug');
    if(!el){
      el=document.createElement('pre');el.id='insect-mp-debug';
      el.style.cssText='position:fixed;left:6px;bottom:6px;z-index:99999;max-width:min(94vw,520px);max-height:42vh;overflow:auto;margin:0;padding:8px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(0,0,0,.88);color:#D8F8E8;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:none';
      document.body.appendChild(el);
    }
    const d=snapshot();
    el.textContent=['IN-SECT MP DEBUG',`phase=${d.phase} connection=${d.connection}`,`code=${d.code||'-'} player=${d.playerId||'-'} color=${d.controlledColor||'-'} seat=${typeof d.seat==='string'?d.seat:JSON.stringify(d.seat)}`,`current=${d.currentPlayer||'-'} serverV=${d.serverVersion} localV=${d.localVersion}`,`pending=${d.pendingAction?JSON.stringify(d.pendingAction):'-'}`,`lastAction=${d.lastActionSent?JSON.stringify(d.lastActionSent):'-'}`,`lastEvent=${d.lastEventReceived?JSON.stringify(d.lastEventReceived):'-'}`,`error=${d.lastError||'-'}`].join('\n');
  }

  return{STATES,snapshot,diagnostics,subscribe,setPhase,attachSession,detach,setConnection,setError,clearError,updateAuthoritative,beginSelection,clearSelection,beginAction,markWaitingConfirmation,receiveOpponentEvent,beginAcceptedAnimation,beginReconnect,isOnline,isLocalTurn,allowsBoardInput,shouldRunAI,mapLogicalToView,mapViewToLogical,getTurnLabel,identityLabel};
}

return{STATES,createRuntime,mapByQuarterTurns,seatQuarterTurns};
});
