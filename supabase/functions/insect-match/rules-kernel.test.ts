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
  assertEquals(r.ok,false)
  if(!r.ok)assert(r.error.includes('tour'))
})

Deno.test('player cannot move opponent piece',()=>{
  const s=baseSnapshot();const p=s.G.players.red.pieces[2]
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:8,c:5}},'yellow')
  assertEquals(r.ok,false)
})

Deno.test('illegal geometry is rejected with no alternative branch',()=>{
  const s=baseSnapshot();const p=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant'&&x.r===0&&x.c===2)
  const r=resolveIntent(s,{schema:1,kind:'move',piece_id:p.id,to:{r:5,c:5}},'yellow')
  assertEquals(r.ok,false)
})

Deno.test('capture requires authoritative corpse placement',()=>{
  const s=baseSnapshot()
  const y=s.G.players.yellow.pieces.find((x:any)=>x.type==='militant')
  const red=s.G.players.red.pieces.find((x:any)=>x.type==='militant')
  y.r=4;y.c=2;red.r=4;red.c=3
  for(const p of [...s.G.players.yellow.pieces,...s.G.players.red.pieces])if(p!==y&&p!==red){p.r=-1;p.c=-1}
  const missing=resolveIntent(s,{schema:1,kind:'kill',piece_id:y.id,target_id:red.id},'yellow')
  assertEquals(missing.ok,false)
  const ok=resolveIntent(s,{schema:1,kind:'kill',piece_id:y.id,target_id:red.id,corpse_to:{r:0,c:8}},'yellow')
  assert(ok.ok);if(!ok.ok)return
  const yy=ok.state.G.players.yellow.pieces.find((x:any)=>x.id===y.id)
  const rr=ok.state.G.players.red.pieces.find((x:any)=>x.id===red.id)
  assertEquals({r:yy.r,c:yy.c},{r:4,c:3})
  assertEquals({r:rr.r,c:rr.c,dead:rr.dead},{r:0,c:8,dead:true})
})

Deno.test('super-power double kill fails closed until parity coverage exists',()=>{
  const s=baseSnapshot();const spider=s.G.players.yellow.pieces.find((x:any)=>x.type==='assassin');const red=s.G.players.red.pieces.find((x:any)=>x.type==='militant')
  spider.r=4;spider.c=2;red.r=4;red.c=3
  for(const p of [...s.G.players.yellow.pieces,...s.G.players.red.pieces])if(p!==spider&&p!==red){p.r=-1;p.c=-1}
  s.G.spPieces[spider.id]={type:'double-kill',turns:null}
  const r=resolveIntent(s,{schema:1,kind:'kill',piece_id:spider.id,target_id:red.id},'yellow')
  assertEquals(r.ok,false)
  if(!r.ok)assert(r.error.includes('certifié'))
})