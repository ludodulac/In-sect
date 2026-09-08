/* ===============================================================
   IN-SECT — BOOT — Musique de fond, demarrage de application
   Module 08-boot.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

let _bgm = null;
function initBGM(){_bgm=new Audio('insect.mp3');_bgm.loop=true;_bgm.volume=.45;_bgm.preload='auto'}
function playBGM(){if(_bgm&&!_muted&&_bgm.paused)_bgm.play().catch(()=>{})}
function stopBGM(){if(_bgm&&!_bgm.paused)_bgm.pause()}
function preloadPieceSprites(){try{if(typeof SYM==='undefined')return;for(const src of[...new Set(Object.values(SYM).filter(Boolean))]){const img=new Image();img.decoding='async';img.src=src}}catch(_){}}
function gaTrack(eventName,params={}){try{if(typeof window.gtag!=='function')return;window.gtag('event',eventName,{game_mode:typeof _mode!=='undefined'?(_mode===1?'duel':'4_colonies'):undefined,ai_level:typeof _aiLevel!=='undefined'?_aiLevel:undefined,super_powers:typeof _optSP!=='undefined'?!!_optSP:undefined,...params})}catch(e){}}
function installAnalyticsHooks(){
  if(typeof startGame==='function'&&!startGame.__gaWrapped){const original=startGame;const wrapped=function(...args){gaTrack('game_start',{selected_colony:typeof _selColor!=='undefined'?_selColor:undefined});return original.apply(this,args)};wrapped.__gaWrapped=true;startGame=wrapped}
  if(typeof resumeGame==='function'&&!resumeGame.__gaWrapped){const original=resumeGame;const wrapped=function(...args){gaTrack('game_resume');return original.apply(this,args)};wrapped.__gaWrapped=true;resumeGame=wrapped}
  if(typeof doShare==='function'&&!doShare.__gaWrapped){const original=doShare;const wrapped=function(...args){gaTrack('share_attempt',{turns_played:typeof _gameTurns!=='undefined'?_gameTurns:0});return original.apply(this,args)};wrapped.__gaWrapped=true;doShare=wrapped}
  if(typeof openTuto==='function'&&!openTuto.__gaWrapped){const original=openTuto;const wrapped=function(...args){gaTrack('tutorial_start');return original.apply(this,args)};wrapped.__gaWrapped=true;openTuto=wrapped}
  const endScreen=document.getElementById('s-end');if(endScreen&&!endScreen.dataset.gaObserved){endScreen.dataset.gaObserved='1';let wasVisible=!endScreen.classList.contains('hidden');const observer=new MutationObserver(()=>{const visible=!endScreen.classList.contains('hidden');if(visible&&!wasVisible){const title=(document.getElementById('etitle')?.textContent||'').trim().toLowerCase();const result=title.includes('victoire')?'victory':title.includes('défaite')?'defeat':'finished';gaTrack('game_complete',{result,turns_played:_gameTurns,pieces_captured:_gameCaps})}wasVisible=visible});observer.observe(endScreen,{attributes:true,attributeFilter:['class']})}
}
function loadScriptOnce(id,src){return new Promise((resolve,reject)=>{const existing=document.getElementById(id);if(existing){if(existing.dataset.loaded==='1')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const script=document.createElement('script');script.id=id;script.src=src;script.onload=()=>{script.dataset.loaded='1';resolve()};script.onerror=reject;document.body.appendChild(script)})}
async function loadMultiplayerClient(){
  if(document.getElementById('insect-mp-config'))return;
  try{
    await loadScriptOnce('insect-mp-config','js/09-multiplayer-config.js');
    await loadScriptOnce('insect-mp-runtime','js/09-multiplayer-runtime.js');
    await loadScriptOnce('insect-mp-client','js/09-multiplayer.js');
    await loadScriptOnce('insect-mp-event-player','js/09-multiplayer-event-player.js');
    await loadScriptOnce('insect-mp-intent','js/09-multiplayer-intent.js');
    await loadScriptOnce('insect-mp-resume','js/10-multiplayer-resume.js');
    await loadScriptOnce('insect-mp-ready','js/11-multiplayer-ready.js');
    await loadScriptOnce('insect-mp-realtime','js/12-multiplayer-realtime.js');
  }catch(error){console.error('[IN-SECT MP BOOT]',error);if(window.INSECT_MP_RUNTIME)window.INSECT_MP_RUNTIME.setError(error)}
}
function isOnlineSession(){return!!(window.INSECT_MP_RUNTIME&&window.INSECT_MP_RUNTIME.isOnline())}
document.addEventListener('DOMContentLoaded',()=>{
  initAmbientParticles();FX.init();initBGM();preloadPieceSprites();installAnalyticsHooks();loadMultiplayerClient();gaTrack('app_loaded',{standalone:window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches,language:navigator.language||undefined});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&G&&!G.over){if(!isOnlineSession())saveGame();gaTrack('game_backgrounded',{turns_played:_gameTurns,pieces_captured:_gameCaps})}if(document.visibilityState==='visible'){const gameScreen=document.getElementById('s-game');const isGameScreen=gameScreen&&!gameScreen.classList.contains('hidden');if(isGameScreen&&G&&!G.over){buildBoard();renderBoard();renderPlayers();updateTurnUI()}}});
  window.addEventListener('beforeunload',()=>{if(G&&!G.over&&!isOnlineSession())saveGame()});window.addEventListener('pagehide',()=>{if(G&&!G.over&&!isOnlineSession())saveGame()});setInterval(()=>{if(G&&!G.over&&!isOnlineSession())saveGame()},15000);window.addEventListener('pageshow',e=>{if(e.persisted&&G&&!G.over){buildBoard();renderBoard();renderPlayers();updateTurnUI()}});setTimeout(()=>{const btn=document.getElementById('splash-enter-btn');if(btn)btn.style.animation='splashBtnPulse 1.5s ease-in-out infinite'},1800)
});
function splashEnter(){gaTrack('splash_enter');if(!_audioCtx)try{getACtx()}catch(e){}playBGM();showScreen('menu');selMode(1);selCol('yellow');selAI(1);updateModePreview(1);updateStatusBar();if(!lsGet('insect_tuto_seen')){lsSet('insect_tuto_seen','1');setTimeout(()=>openTuto(),600)}}