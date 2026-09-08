/* IN-SECT — reflet visuel de l'état online. Aucun wrapper du moteur. */
(function(){
'use strict';
const RT=window.INSECT_MP_RUNTIME;
if(!RT)return;

function repaint(state){
  if(!state.online)return;
  requestAnimationFrame(()=>{
    if(typeof updateTurnUI==='function'&&G&&G.order)updateTurnUI();
    const board=document.getElementById('board');
    if(board){
      const enabled=RT.allowsBoardInput()&&typeof cur==='function'&&cur()===state.controlledColor;
      board.dataset.onlineInteractive=enabled?'1':'0';
      board.setAttribute('aria-busy',['waiting_initial_state','action_sent','waiting_confirmation','receiving_opponent_action','animating_accepted_action','reconnecting'].includes(state.phase)?'true':'false');
    }
  });
}
RT.subscribe(repaint);
repaint(RT.snapshot());
})();
