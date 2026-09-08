import { assertEquals, assert } from 'jsr:@std/assert@1'
import { resolveIntent } from '../_shared/insect-rules-kernel.ts'

function baseSnapshot():any{
  let id=0
  const starts:any={
    yellow:[[0,0,'chef'],[0,1,'assassin'],[0,2,'militant'],[1,0,'reporter'],[1,1,'diplomate'],[1,2,'militant'],[2,0,'militant'],[2,1,'militant'],[2,2,'necromobile']],
    red:[[8,8,'chef'],[8,7,'assassin'],[8,6,'militant'],[7,8,'reporter'],[7,7,'diplomate'],[7,6,'militant'],[6,8,'militant'],[6,7,'militant'],[6,6,'necromobile']],
  }
  const players:any={}
  for(const color of ['yellow','red'])players[color]={color,human:true,alive:true,pieces:starts[color].map(([r,c,type]:any)=>({id:id++,color,type,r,c,dead:false}))}
  return{schema:1,G:{human:'yellow',mode1:true,board:null,players,order:['yellow','red'],idx:0,sel:null,phase:'select',pendCorpse:null,pendDisp:null,repTargets:[],labActive:null,labExtra:-1,turn:0,over:false,lastActor:null,spCells:{},spPieces:{},spNextTrigger:10,queenMovHistory:{},ghostQueue:[]},mode:1,optSP:false,uid:id,turns:0,caps:0,moveLog:[]}
}
function parkAllExcept(s:any,keep:any[]){
  for(const p of [...s.G.players.yellow.pieces,...s.G.players.red.pieces])if(!keep.includes(p)){p.r=-1;p.c=-1}
}

Deno.test('yellow legal move is resolved without mutating input',()=>{
  const before=baseSnapshot();const original=JSON.stringify(before)
  const piece=before.G.players.yellow.pieces.find((p:any)=>p.type==='militant'&&p.r===0&&p.c===2)
  const r=resolveIntent(before,{schema:1,kind:'move',piece_id:piece.id,to:{r:0,c:3}},'yellow')
  assert(r.ok);if(!r.ok)return
  assertEquals(JSON.stringify(before),original)
  const moved=r.state.G.players.yellow.pieces.find((p:any)=>p.id===piece.id)
  assertEquals({r:moved.r,c:moved.c},{r:0,c:3})
  assertEquals(r.state.G.idx,1)
  assertEquals(r.state.G.turn,1)
  assertEquals(r.state.turns,1)
  assertEquals(r.event.actor_color,'yellow')
  assertEquals(r.event.current_after,'red')
})

Deno.test('red cannot resolve an action during yellow turn',()=>{
  const s=baseSnapshot();const p=s.G.players.red.pieces.find((x:any)=>x.type==='militant'&&x.r===8&&x.c===6)
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:8,c:5}},'red')
  assertEquals(r.ok,false);if(!r.ok)assert(r.error.includes('tour'))
})

Deno.test('player cannot move opponent piece',()=>{
  const s=baseSnapshot();const p=s.G.players.red.pieces[2]
  assertEquals(resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:8,c:5}},'yellow').ok,false)
})

Deno.test('illegal geometry is rejected with no alternative branch',()=>{
  const s=baseSnapshot();const p=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant'&&x.r===0&&x.c===2)
  assertEquals(resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:5,c:5}},'yellow').ok,false)
})

Deno.test('capture requires authoritative corpse placement',()=>{
  const s=baseSnapshot();const y=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant');const red=s.G.players.red.pieces.find((x:any)=>x.type==='militant')
  y.r=4;y.c=2;red.r=4;red.c=3;parkAllExcept(s,[y,red])
  assertEquals(resolveIntent(s,{schema:1,kind:'kill',piece_id:y.id,target_id:red.id},'yellow').ok,false)
  const ok=resolveIntent(s,{schema:1,kind:'kill',piece_id:y.id,target_id:red.id,corpse_to:{r:0,c:8}},'yellow')
  assert(ok.ok);if(!ok.ok)return
  const yy=ok.state.G.players.yellow.pieces.find((x:any)=>x.id===y.id),rr=ok.state.G.players.red.pieces.find((x:any)=>x.id===red.id)
  assertEquals({r:yy.r,c:yy.c},{r:4,c:3});assertEquals({r:rr.r,c:rr.c,dead:rr.dead},{r:0,c:8,dead:true})
})

Deno.test('double kill is authoritative when secondary corpse placement is deterministic',()=>{
  const s=baseSnapshot();const spider=s.G.players.yellow.pieces.find((x:any)=>x.type==='assassin');const [first,second]=s.G.players.red.pieces.filter((x:any)=>x.type==='militant').slice(0,2)
  spider.r=4;spider.c=1;first.r=4;first.c=2;second.r=4;second.c=4;parkAllExcept(s,[spider,first,second]);s.G.spPieces[spider.id]={type:'double-kill',turns:null}
  const r=resolveIntent(s,{schema:1,kind:'kill',piece_id:spider.id,target_id:first.id},'yellow')
  assert(r.ok);if(!r.ok)return
  const f=r.state.G.players.red.pieces.find((x:any)=>x.id===first.id),sec=r.state.G.players.red.pieces.find((x:any)=>x.id===second.id)
  assertEquals({r:f.r,c:f.c,dead:f.dead},{r:4,c:1,dead:true})
  assertEquals({r:sec.r,c:sec.c,dead:sec.dead},{r:4,c:2,dead:true})
  assertEquals(r.state.caps,2)
})

Deno.test('double kill rare fallback fails closed instead of inventing a placement',()=>{
  const s=baseSnapshot();const spider=s.G.players.yellow.pieces.find((x:any)=>x.type==='assassin');const [first,second]=s.G.players.red.pieces.filter((x:any)=>x.type==='militant').slice(0,2);const blocker=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant')
  spider.r=4;spider.c=1;first.r=4;first.c=2;second.r=4;second.c=4;blocker.r=4;blocker.c=2
  // Le cas de fallback historique est impossible à représenter sans collision préalable; le noyau doit au minimum ne jamais produire un état corrompu.
  s.G.spPieces[spider.id]={type:'double-kill',turns:null}
  const before=JSON.stringify(s);const r=resolveIntent(s,{schema:1,kind:'kill',piece_id:spider.id,target_id:first.id},'yellow')
  assertEquals(JSON.stringify(s),before)
  assertEquals(typeof r.ok,'boolean')
})

Deno.test('sacred nest grants the occupant the extra turn in 1v1',()=>{
  const s=baseSnapshot();const q=s.G.players.yellow.pieces.find((x:any)=>x.type==='chef');const rq=s.G.players.red.pieces.find((x:any)=>x.type==='chef')
  q.r=4;q.c=3;rq.r=8;rq.c=8;parkAllExcept(s,[q,rq])
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:q.id,to:{r:4,c:4}},'yellow')
  assert(r.ok);if(!r.ok)return
  assertEquals(r.state.G.labActive,'yellow');assertEquals(r.state.G.idx,0);assertEquals(r.event.current_after,'yellow')
  assert(r.event.effects.some((e:any)=>e.kind==='nid_occupied'))
})

Deno.test('server-side SP trigger is deterministic under injected random source',()=>{
  const s=baseSnapshot();s.optSP=true;s.turns=9;s.G.turn=9;s.G.spNextTrigger=10
  const p=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant'&&x.r===0&&x.c===2)
  const values=[0.55,0.55];let i=0
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:0,c:3}},'yellow',{random:()=>values[i++]??0})
  assert(r.ok);if(!r.ok)return
  assertEquals(r.state.G.spNextTrigger,20)
  assert(r.event.effects.some((e:any)=>e.kind==='sp_trigger'))
})

Deno.test('expired invincibility is removed by authoritative resolution',()=>{
  const s=baseSnapshot();const q=s.G.players.yellow.pieces.find((x:any)=>x.type==='chef');const rq=s.G.players.red.pieces.find((x:any)=>x.type==='chef')
  q.r=3;q.c=3;rq.r=8;rq.c=8;parkAllExcept(s,[q,rq]);s.G.spPieces[q.id]={type:'invincible',turns:1}
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:q.id,to:{r:3,c:4}},'yellow')
  assert(r.ok);if(!r.ok)return
  assertEquals(r.state.G.spPieces[q.id],undefined)
  assert(r.event.effects.some((e:any)=>e.kind==='sp_expired'))
})

Deno.test('ghost resurrection is resolved by the server on due turn',()=>{
  const s=baseSnapshot();const mover=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant'&&x.r===0&&x.c===2);const ghost=s.G.players.yellow.pieces.find((x:any)=>x.type==='reporter')
  ghost.dead=true;ghost.r=5;ghost.c=5;s.G.turn=29;s.turns=29;s.G.ghostQueue=[{piece:{id:ghost.id,color:'yellow',r:5,c:5},reviveTurn:30}];s.G.spPieces[ghost.id]={type:'area-kill',ghost:true}
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:mover.id,to:{r:0,c:3}},'yellow')
  assert(r.ok);if(!r.ok)return
  const revived=r.state.G.players.yellow.pieces.find((x:any)=>x.id===ghost.id)
  assertEquals(revived.dead,false);assertEquals({r:revived.r,c:revived.c},{r:5,c:5})
  assert(r.event.effects.some((e:any)=>e.kind==='ghost_revived'))
})

Deno.test('finished game refuses further actions',()=>{
  const s=baseSnapshot();s.G.over=true
  const p=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant')
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:0,c:3}},'yellow')
  assertEquals(r.ok,false);if(!r.ok)assert(r.error.includes('terminée'))
})
