import assert from 'node:assert/strict';

const MATCH='https://nczdadkyysrxxcsnsrrn.supabase.co/functions/v1/insect-match';
const PLAY='https://nczdadkyysrxxcsnsrrn.supabase.co/functions/v1/insect-play';

async function post(url,body){
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let json=null;try{json=await res.json()}catch{}
  return{status:res.status,json};
}
function initialState(){
  let id=0;
  const starts={
    yellow:[[0,0,'chef'],[0,1,'assassin'],[0,2,'militant'],[1,0,'reporter'],[1,1,'diplomate'],[1,2,'militant'],[2,0,'militant'],[2,1,'militant'],[2,2,'necromobile']],
    red:[[8,8,'chef'],[8,7,'assassin'],[8,6,'militant'],[7,8,'reporter'],[7,7,'diplomate'],[7,6,'militant'],[6,8,'militant'],[6,7,'militant'],[6,6,'necromobile']],
  };
  const players={};
  for(const color of ['yellow','red'])players[color]={color,human:true,alive:true,pieces:starts[color].map(([r,c,type])=>({id:id++,color,type,r,c,dead:false}))};
  return{schema:1,G:{human:'yellow',mode1:true,board:null,players,order:['yellow','red'],idx:0,sel:null,phase:'select',pendCorpse:null,pendDisp:null,repTargets:[],labActive:null,labExtra:-1,turn:0,over:false,lastActor:null,spCells:{},spPieces:{},spNextTrigger:10,queenMovHistory:{},ghostQueue:[]},mode:1,aiLevel:1,selColor:'yellow',optSP:false,uid:id,turns:0,caps:0,moveLog:[]};
}
function initialChanges(state){
  const out=[];
  for(const color of ['yellow','red'])for(const p of state.G.players[color].pieces)out.push({kind:'piece_added',id:p.id,to:{id:p.id,color:p.color,type:p.type,r:p.r,c:p.c,dead:false}});
  return out;
}
function piece(state,id){for(const color of Object.keys(state.G.players))for(const p of state.G.players[color].pieces)if(p.id===id)return p;return null}

const create=await post(MATCH,{action:'create'});assert.equal(create.status,200);assert.equal(create.json.ok,true);
const {code,secret:hostSecret}=create.json;console.log(`SMOKE_CODE=${code}`);
const join=await post(MATCH,{action:'join',code});assert.equal(join.status,200);const guestSecret=join.json.secret;

let vote=await post(MATCH,{action:'vote_sp',code,secret:hostSecret,enabled:false});assert.equal(vote.status,200);
vote=await post(MATCH,{action:'vote_sp',code,secret:guestSecret,enabled:false});assert.equal(vote.status,200);assert.equal(vote.json.sp_decided,true);assert.equal(vote.json.sp_enabled,false);

const state=initialState();
const initEvent={schema:1,kind:'match_initialized',actor_color:'yellow',base_version:0,result_version:null,turn_before:null,turn_after:0,current_before:null,current_after:'yellow',changes:initialChanges(state),created_at:Date.now()};
const init=await post(MATCH,{action:'commit_turn',code,secret:hostSecret,base_version:0,state,event:initEvent});assert.equal(init.status,200);assert.equal(init.json.version,1);

const guestInitial=await post(MATCH,{action:'get',code,secret:guestSecret,since:-1});assert.equal(guestInitial.status,200);assert.equal(guestInitial.json.version,1);assert.equal(guestInitial.json.state.G.order[guestInitial.json.state.G.idx],'yellow');

const redOutOfTurn=await post(PLAY,{action:'play_action',code,secret:guestSecret,base_version:1,intent:{schema:1,kind:'move',piece_id:11,to:{r:8,c:5}}});assert.equal(redOutOfTurn.status,409);assert.match(redOutOfTurn.json.error,/tour/i);

const yellowAction={action:'play_action',code,secret:hostSecret,base_version:1,intent:{schema:1,kind:'move',piece_id:2,to:{r:0,c:3}}};
const double=await Promise.all([post(PLAY,yellowAction),post(PLAY,yellowAction)]);
assert.deepEqual(double.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
const accepted=double.find(x=>x.status===200);assert.equal(accepted.json.version,2);assert.equal(accepted.json.event.actor_color,'yellow');

const guestAfterYellow=await post(MATCH,{action:'get',code,secret:guestSecret,since:1});assert.equal(guestAfterYellow.status,200);assert.equal(guestAfterYellow.json.version,2);assert.deepEqual({r:piece(guestAfterYellow.json.state,2).r,c:piece(guestAfterYellow.json.state,2).c},{r:0,c:3});assert.equal(guestAfterYellow.json.state.G.order[guestAfterYellow.json.state.G.idx],'red');

const staleGuest=await post(PLAY,{action:'play_action',code,secret:guestSecret,base_version:1,intent:{schema:1,kind:'move',piece_id:11,to:{r:8,c:5}}});assert.equal(staleGuest.status,409);assert.match(staleGuest.json.error,/version/i);

const red=await post(PLAY,{action:'play_action',code,secret:guestSecret,base_version:2,intent:{schema:1,kind:'move',piece_id:11,to:{r:8,c:5}}});assert.equal(red.status,200);assert.equal(red.json.version,3);assert.equal(red.json.event.actor_color,'red');

const hostAfterRed=await post(MATCH,{action:'get',code,secret:hostSecret,since:2});assert.equal(hostAfterRed.status,200);assert.equal(hostAfterRed.json.version,3);assert.deepEqual({r:piece(hostAfterRed.json.state,11).r,c:piece(hostAfterRed.json.state,11).c},{r:8,c:5});assert.equal(hostAfterRed.json.state.G.order[hostAfterRed.json.state.G.idx],'yellow');

const legacy=await post(MATCH,{action:'push',code,secret:hostSecret,state:hostAfterRed.json.state});assert.equal(legacy.status,426);
const reconnect=await post(MATCH,{action:'get',code,secret:guestSecret,since:-1});assert.equal(reconnect.status,200);assert.equal(reconnect.json.version,3);assert.deepEqual(reconnect.json.state,hostAfterRed.json.state);

console.log('LIVE_SMOKE_OK versions=1->2->3 wrong-turn=blocked double-action=single-winner stale=blocked legacy-push=blocked reconnect=canonical');
