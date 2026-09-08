const assert=require('node:assert/strict');
const test=require('node:test');
const {createRuntime,mapByQuarterTurns}=require('../js/09-multiplayer-runtime.js');

function online(color='yellow'){
  const rt=createRuntime();
  rt.attachSession({code:'ABC123',playerId:color==='yellow'?'host':'guest',controlledColor:color,seat:color==='yellow'?'north-west':'south-east',participants:[{playerId:'host',controlledColor:'yellow'},{playerId:'guest',controlledColor:'red'}],connection:'connected',phase:rt.STATES.WAITING_INITIAL});
  return rt;
}

test('initial online state blocks board input until authoritative state arrives',()=>{
  const rt=online('red');
  assert.equal(rt.allowsBoardInput(),false);
  rt.updateAuthoritative({version:1,currentPlayer:'yellow'});
  assert.equal(rt.snapshot().phase,rt.STATES.OPPONENT_TURN);
  assert.equal(rt.allowsBoardInput(),false);
});

test('only controlled color receives board input on its turn',()=>{
  const yellow=online('yellow');
  const red=online('red');
  yellow.updateAuthoritative({version:1,currentPlayer:'yellow'});
  red.updateAuthoritative({version:1,currentPlayer:'yellow'});
  assert.equal(yellow.allowsBoardInput(),true);
  assert.equal(red.allowsBoardInput(),false);
});

test('double action is rejected while one action is pending',()=>{
  const rt=online('yellow');
  rt.updateAuthoritative({version:4,currentPlayer:'yellow'});
  const first=rt.beginAction({kind:'turn_commit',piece_id:1,from:{r:0,c:1},to:{r:2,c:3}});
  assert.ok(first);
  assert.equal(first.base_version,4);
  assert.equal(rt.beginAction({kind:'turn_commit',piece_id:2}),false);
  assert.equal(rt.allowsBoardInput(),false);
});

test('stale base version cannot begin an action',()=>{
  const rt=online('yellow');
  rt.updateAuthoritative({version:7,currentPlayer:'yellow'});
  assert.equal(rt.beginAction({kind:'turn_commit',base_version:6,piece_id:1}),false);
  assert.equal(rt.snapshot().pendingAction,null);
});

test('confirmation clears pending action and switches turn from authoritative state',()=>{
  const rt=online('yellow');
  rt.updateAuthoritative({version:2,currentPlayer:'yellow'});
  assert.ok(rt.beginAction({kind:'turn_commit'}));
  rt.markWaitingConfirmation(3);
  assert.equal(rt.snapshot().phase,rt.STATES.WAITING_CONFIRMATION);
  rt.updateAuthoritative({version:3,currentPlayer:'red',event:{result_version:3}});
  assert.equal(rt.snapshot().pendingAction,null);
  assert.equal(rt.snapshot().phase,rt.STATES.OPPONENT_TURN);
});

test('yellow perspective maps logical top-left to visual bottom-right without rotating content',()=>{
  const rt=online('yellow');
  assert.deepEqual(rt.mapLogicalToView(0,0),{r:8,c:8});
  assert.deepEqual(rt.mapLogicalToView(8,8),{r:0,c:0});
  assert.deepEqual(rt.mapViewToLogical(8,8),{r:0,c:0});
});

test('red perspective preserves current logical coordinates',()=>{
  const rt=online('red');
  assert.deepEqual(rt.mapLogicalToView(8,8),{r:8,c:8});
  assert.deepEqual(rt.mapLogicalToView(0,0),{r:0,c:0});
});

test('quarter-turn mapper remains invertible for future seats',()=>{
  const p={r:2,c:6};
  const turned=mapByQuarterTurns(p.r,p.c,1,9);
  const back=mapByQuarterTurns(turned.r,turned.c,3,9);
  assert.deepEqual(back,p);
});

test('reconnection state blocks input until a new authoritative state is applied',()=>{
  const rt=online('red');
  rt.updateAuthoritative({version:9,currentPlayer:'red'});
  assert.equal(rt.allowsBoardInput(),true);
  rt.beginReconnect();
  assert.equal(rt.allowsBoardInput(),false);
  rt.setConnection('connected');
  rt.updateAuthoritative({version:10,currentPlayer:'yellow'});
  assert.equal(rt.allowsBoardInput(),false);
  assert.equal(rt.snapshot().phase,rt.STATES.OPPONENT_TURN);
});
