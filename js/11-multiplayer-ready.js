/* IN-SECT — garde d'initialisation multijoueur : pas d'entrée avant premier état serveur + repaint différé. */
(function(){
'use strict';
const MP=window.INSECT_MP;
if(!MP)return;
let seenVersion=Number.isFinite(MP.lastVersion)?Number(MP.lastVersion):-1;

function serverReady(){return !MP.active||Number(MP.lastVersion)>=0}
function repaint(){
  if(!MP.active||!G||G.over)return;
  requestAnimationFrame(()=>{
    if(typeof renderBoard==='function')renderBoard();
    if(typeof renderPlayers==='function')renderPlayers();
    if(typeof updateTurnUI==='function')updateTurnUI();
  });
}

if(typeof isHuman==='function'&&!isHuman.__mpInitialReady){
  const originalIsHuman=isHuman;
  isHuman=function(){
    if(MP.active&&!serverReady())return false;
    return originalIsHuman.apply(this,arguments);
  };
  isHuman.__mpInitialReady=true;
}

setInterval(()=>{
  const v=Number.isFinite(MP.lastVersion)?Number(MP.lastVersion):-1;
  if(v!==seenVersion){
    seenVersion=v;
    if(v>=0)repaint();
  }
},100);
})();
