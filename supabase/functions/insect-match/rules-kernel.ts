/* IN-SECT — noyau de règles multijoueur pur.
   Aucune dépendance DOM/audio. Le snapshot d'entrée n'est jamais muté.
   V1: duel Jaune/Rouge, actions complètes hors orchestration visuelle. */

export type Coord = { r:number; c:number }
export type Intent = {
  schema: 1
  kind: 'move'|'kill'|'dipl'|'necro'|'resurrect'
  piece_id: number|string
  to?: Coord
  target_id?: number|string
  displaced_to?: Coord
  corpse_to?: Coord
  nid_bonus_to?: Coord
  reporter_mode?: 'ortho'|'diag'|'all'
  base_version?: number
}
export type ResolveResult = { ok:true; state:any; event:any } | { ok:false; error:string }

type Piece = { id:any;color:string;type:string;r:number;c:number;dead:boolean }
const LAB={r:4,c:4}
const DIRS8=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] as const
const ORTHO=[[0,1],[0,-1],[1,0],[-1,0]] as const
const DIAG=[[1,1],[1,-1],[-1,1],[-1,-1]] as const
const inB=(r:number,c:number)=>r>=0&&r<9&&c>=0&&c<9
const key=(r:number,c:number)=>`${r},${c}`
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v))

function rebuild(G:any){
  G.board=Array.from({length:9},()=>Array(9).fill(null))
  for(const color of Object.keys(G.players||{}))for(const p of G.players[color]?.pieces||[]){
    if(inB(Number(p.r),Number(p.c))&&(!p.dead||G.board[p.r][p.c]==null))G.board[p.r][p.c]=p
  }
}
function allPieces(G:any):Piece[]{
  const out:Piece[]=[]; const seen=new Set<string>()
  for(const color of Object.keys(G.players||{}))for(const p of G.players[color]?.pieces||[]){const k=String(p.id);if(!seen.has(k)){seen.add(k);out.push(p)}}
  return out
}
function pieceById(G:any,id:any):Piece|null{return allPieces(G).find(p=>String(p.id)===String(id))||null}
function cur(G:any){return Array.isArray(G.order)&&Number.isInteger(G.idx)?G.order[G.idx]||null:null}
function setCell(G:any,r:number,c:number,p:any){if(inB(r,c))G.board[r][c]=p}
function movePiece(G:any,p:Piece,r:number,c:number){if(inB(p.r,p.c)&&G.board[p.r][p.c]===p)G.board[p.r][p.c]=null;p.r=r;p.c=c;setCell(G,r,c,p)}
function removePiece(G:any,p:Piece){if(inB(p.r,p.c)&&G.board[p.r][p.c]===p)G.board[p.r][p.c]=null;p.r=-1;p.c=-1}
function placePiece(G:any,p:Piece,r:number,c:number){p.r=r;p.c=c;setCell(G,r,c,p)}
function emptyForPlacement(G:any,r:number,c:number,allowDead=false){if(!inB(r,c))return false;const t=G.board[r][c];return !t||(allowDead&&t.dead)}

function linear(G:any,p:Piece){
  const moves:any[]=[],kills:any[]=[]
  for(const [dr,dc] of DIRS8){let r=p.r+dr,c=p.c+dc;while(inB(r,c)){const t=G.board[r][c],lab=r===4&&c===4;if(!t){if(!(lab&&p.type!=='chef'))moves.push({r,c})}else if(t.dead)break;else{if(t.color!==p.color)kills.push({r,c,p:t});break}r+=dr;c+=dc}}
  return{moves,kills,diplT:[],necroT:[]}
}
function militant(G:any,p:Piece){
  const moves:any[]=[],kills:any[]=[]
  for(const [dr,dc] of DIRS8)for(let s=1;s<=2;s++){const r=p.r+dr*s,c=p.c+dc*s;if(!inB(r,c))break;const t=G.board[r][c];if(!t){if(r===4&&c===4)continue;moves.push({r,c})}else if(t.dead)break;else{if(t.color!==p.color&&!(t.type==='chef'&&r===4&&c===4))kills.push({r,c,p:t});break}}
  return{moves,kills,diplT:[],necroT:[]}
}
function reporter(G:any,p:Piece){
  const moves:any[]=[];for(const[dr,dc]of DIRS8){let r=p.r+dr,c=p.c+dc;while(inB(r,c)){const t=G.board[r][c];if(!t){if(!(r===4&&c===4))moves.push({r,c})}else break;r+=dr;c+=dc}}
  return{moves,kills:[],diplT:[],necroT:[]}
}
function diplomat(G:any,p:Piece){
  const moves:any[]=[],diplT:any[]=[];for(const[dr,dc]of DIRS8){let r=p.r+dr,c=p.c+dc;while(inB(r,c)){const t=G.board[r][c];if(!t){if(!(r===4&&c===4))moves.push({r,c})}else if(t.dead)break;else{if(t.color!==p.color)diplT.push({r,c,p:t});break}r+=dr;c+=dc}}
  return{moves,kills:[],diplT,necroT:[]}
}
function necro(G:any,p:Piece){
  const moves:any[]=[],necroT:any[]=[];for(const[dr,dc]of DIRS8){let r=p.r+dr,c=p.c+dc;while(inB(r,c)){const t=G.board[r][c];if(!t){if(!(r===4&&c===4))moves.push({r,c})}else if(t.dead){necroT.push({r,c,p:t});break}else break;r+=dr;c+=dc}}
  return{moves,kills:[],diplT:[],necroT}
}
function baseActions(G:any,p:Piece){if(p.dead)return{moves:[],kills:[],diplT:[],necroT:[]};if(p.type==='militant')return militant(G,p);if(p.type==='reporter')return reporter(G,p);if(p.type==='diplomate')return diplomat(G,p);if(p.type==='necromobile')return necro(G,p);return linear(G,p)}
function actions(G:any,p:Piece){
  const base=baseActions(G,p),sp=G.spPieces?.[p.id]
  if(!sp)return base
  if(sp.type==='queen-move'){
    const q=linear(G,p),seen=new Set(base.moves.map((m:any)=>key(m.r,m.c)))
    return{...base,moves:[...base.moves,...q.moves.filter((m:any)=>!seen.has(key(m.r,m.c)))],kills:[...base.kills,...q.kills.filter((k:any)=>!base.kills.some((x:any)=>x.r===k.r&&x.c===k.c))]}
  }
  if(sp.type==='resurrect')return{...base,necroT:allPieces(G).filter(x=>x.dead&&inB(x.r,x.c)).map(x=>({r:x.r,c:x.c,p:x})),resurrectMode:true}
  if(sp.type==='free-move-corpse')return{...base,moves:[],necroT:allPieces(G).filter(x=>x.dead&&inB(x.r,x.c)).map(x=>({r:x.r,c:x.c,p:x})),freeMoveCorpse:true}
  return base
}
function includesCoord(list:any[],to?:Coord){return !!to&&list.some(x=>x.r===to.r&&x.c===to.c)}
function isInvincible(G:any,p:Piece){const sp=G.spPieces?.[p.id];return !!(sp&&sp.type==='invincible'&&Number(sp.turns)>0)}
function tickSP(G:any,p:Piece){const sp=G.spPieces?.[p.id];if(sp?.type==='invincible'){sp.turns--;if(sp.turns<=0)delete G.spPieces[p.id]}}
function handleNid(G:any,p:Piece){if(p.type!=='chef')return;const on=p.r===4&&p.c===4;if(on){if(G.labActive!==p.color){G.labActive=p.color;G.labExtra=-1}}else if(G.labActive===p.color){G.labActive=null;G.labExtra=-1}}

function transferEliminated(G:any,loser:string,killer:string|null){
  const pl=G.players?.[loser];if(!pl||!pl.alive)return
  pl.alive=false;const kp=killer&&G.players?.[killer]?.alive?G.players[killer]:null
  if(kp){for(const p of [...pl.pieces])if(!p.dead){p.color=killer;kp.pieces.push(p)};pl.pieces=pl.pieces.filter((p:Piece)=>p.dead)}
  else for(const p of pl.pieces)if(!p.dead)p.dead=true
  G.order=G.order.filter((c:string)=>c!==loser);if(G.idx>=G.order.length)G.idx=0
}
function floodSize(G:any,sr:number,sc:number){const seen=new Set([key(sr,sc)]),q:[[number,number]]=[[sr,sc]];while(q.length){const [r,c]=q.shift()!;for(const[dr,dc]of DIRS8){const nr=r+dr,nc=c+dc,k=key(nr,nc);if(!inB(nr,nc)||seen.has(k))continue;const t=G.board[nr][nc];if(t?.dead)continue;seen.add(k);q.push([nr,nc])}}return seen.size}
function queenTrapped(G:any,color:string){const pl=G.players?.[color];if(!pl?.alive)return false;const q=pl.pieces.find((p:Piece)=>p.type==='chef'&&!p.dead&&p.color===color);if(!q)return false;if(pl.pieces.some((p:Piece)=>!p.dead&&p.type==='necromobile'&&p.color===color))return false;return floodSize(G,q.r,q.c)<40.5}
function eliminateTrapped(G:any,color:string,killer:string|null){const pl=G.players[color];if(!pl?.alive)return;pl.alive=false;const kp=killer&&killer!==color&&G.players[killer]?.alive?G.players[killer]:null;if(kp){for(const p of [...pl.pieces])if(!p.dead&&p.type!=='chef'){p.color=killer;kp.pieces.push(p)};pl.pieces=pl.pieces.filter((p:Piece)=>p.dead||p.type==='chef');const q=pl.pieces.find((p:Piece)=>p.type==='chef'&&!p.dead);if(q)q.dead=true}else for(const p of pl.pieces)if(!p.dead)p.dead=true;G.order=G.order.filter((c:string)=>c!==color);if(G.idx>=G.order.length)G.idx=0;if(G.labActive===color){G.labActive=null;G.labExtra=-1}}
function checkStalemates(G:any){for(const color of [...G.order])if(G.players[color]?.alive&&queenTrapped(G,color))eliminateTrapped(G,color,G.lastActor||null)}
function checkWin(G:any){const alive=G.order.filter((c:string)=>G.players[c]?.alive);if(alive.length<=1){G.over=true;G.winner=alive[0]||null;return true}return false}
function recordQueenMove(G:any,p:Piece,fr:number,fc:number,tr:number,tc:number){if(p.type!=='chef')return;G.queenMovHistory=G.queenMovHistory||{};const mov=`${fr},${fc}->${tr},${tc}`,h=G.queenMovHistory[p.color]||{last:null,count:0};if(h.last===mov){h.count++;if(h.count>=4)eliminateTrapped(G,p.color,G.lastActor||null)}else{h.last=mov;h.count=1}G.queenMovHistory[p.color]=h}

function reporterTargets(G:any,p:Piece,mode:'ortho'|'diag'|'all'){const dirs=mode==='all'?DIRS8:mode==='ortho'?ORTHO:DIAG;return dirs.map(([dr,dc])=>inB(p.r+dr,p.c+dc)?G.board[p.r+dr][p.c+dc]:null).filter((t:any)=>t&&!t.dead&&t.color!==p.color&&!isInvincible(G,t))}
function killReporterTargets(G:any,p:Piece,mode:'ortho'|'diag'|'all',meta:any){for(const t of reporterTargets(G,p,mode)){t.dead=true;meta.caps++;if(t.type==='chef')transferEliminated(G,t.color,p.color)}}
function freeCells(G:any,excludeLab=true){const out<Coord[]>=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!G.board[r][c]&&(!excludeLab||r!==4||c!==4))out.push({r,c});return out}

function applySPCell(G:any,p:Piece,r:number,c:number){const k=key(r,c);if(!G.spCells?.[k])return false;delete G.spCells[k];const types:any={militant:'queen-move',reporter:'area-kill',diplomate:'resurrect',assassin:'double-kill',chef:'invincible',necromobile:'free-move-corpse'};const type=types[p.type];if(type){G.spPieces=G.spPieces||{};G.spPieces[p.id]={type,turns:type==='invincible'?4:null};return true}return false}
function ghostResurrections(G:any){if(!Array.isArray(G.ghostQueue))return;const due=G.ghostQueue.filter((e:any)=>Number(G.turn)>=Number(e.reviveTurn));G.ghostQueue=G.ghostQueue.filter((e:any)=>Number(G.turn)<Number(e.reviveTurn));for(const e of due){const p=pieceById(G,e.piece?.id??e.piece_id);if(!p||!G.players[p.color]?.alive)continue;let r=p.r,c=p.c;if(!inB(r,c)||G.board[r]?.[c]&&G.board[r][c]!==p){const f=DIRS8.map(([dr,dc])=>({r:(p.r||0)+dr,c:(p.c||0)+dc})).find(x=>inB(x.r,x.c)&&!G.board[x.r][x.c]);if(!f)continue;r=f.r;c=f.c}p.dead=false;placePiece(G,p,r,c);if(G.spPieces?.[p.id])delete G.spPieces[p.id]}}
function triggerSP(G:any,rng:()=>number){if(!G.spNextTrigger)G.spNextTrigger=10;if(Number(G.turn)<Number(G.spNextTrigger))return null;G.spNextTrigger+=10;const r=Math.floor(rng()*9),c=Math.floor(rng()*9),t=G.board[r][c];const types:any={militant:'queen-move',reporter:'area-kill',diplomate:'resurrect',assassin:'double-kill',chef:'invincible',necromobile:'free-move-corpse'};if(t){const type=types[t.type];if(type){G.spPieces=G.spPieces||{};if(t.dead){G.ghostQueue=G.ghostQueue||[];G.ghostQueue.push({piece:{id:t.id},reviveTurn:G.turn+30});G.spPieces[t.id]={type,turns:type==='invincible'?4:null,ghost:true}}else G.spPieces[t.id]={type,turns:type==='invincible'?4:null}}}else{G.spCells=G.spCells||{};G.spCells[key(r,c)]=true}return{r,c,piece_id:t?.id??null}}

function finishTurn(G:any,meta:any,rng:()=>number){
  if(G.over)return
  G.sel=null;G.phase='select';G.lastActor=cur(G)
  checkStalemates(G);if(G.over)return;if(checkWin(G))return
  G.turn=Number(G.turn||0)+1;meta.turns++
  ghostResurrections(G)
  const nid=G.board[4][4],nidColor=nid&&!nid.dead&&nid.type==='chef'&&G.order.includes(nid.color)&&G.players[nid.color]?.alive?nid.color:null
  if(nidColor!==G.labActive){G.labActive=nidColor;G.labExtra=-1}
  if(meta.spEnabled)triggerSP(G,rng)
  const just=cur(G)
  if(G.labActive===just&&G.labExtra===-1){G.labExtra=1;return}
  if(G.labExtra===1&&G.labActive===just)G.labExtra=-1
  G.idx=(G.idx+1)%G.order.length
}

function executeKill(G:any,attacker:Piece,victim:Piece,meta:any){victim.dead=true;meta.caps++;if(G.spPieces?.[victim.id]){G.ghostQueue=G.ghostQueue||[];G.ghostQueue.push({piece:{id:victim.id},reviveTurn:Number(G.turn||0)+30});G.spPieces[victim.id]={...G.spPieces[victim.id],ghost:true}}const queen=victim.type==='chef';if(queen){removePiece(G,victim);transferEliminated(G,victim.color,attacker.color);return false}removePiece(G,victim);return true}

function validateIntentBasics(G:any,intent:Intent,actorColor:string){if(!intent||intent.schema!==1)return'Action invalide.';if(!['move','kill','dipl','necro','resurrect'].includes(intent.kind))return'Type d’action invalide.';const p=pieceById(G,intent.piece_id);if(!p||p.dead)return'Pièce introuvable.';if(p.color!==actorColor)return'Cette pièce ne vous appartient pas.';if(cur(G)!==actorColor)return"Ce n'est pas votre tour.";return null}

export function resolveIntent(snapshot:any,intent:Intent,actorColor:string,options:{spEnabled?:boolean;rng?:()=>number}={}):ResolveResult{
  try{
    if(!snapshot?.G)return{ok:false,error:'Snapshot serveur invalide.'}
    const state=clone(snapshot),G=state.G;rebuild(G)
    const basic=validateIntentBasics(G,intent,actorColor);if(basic)return{ok:false,error:basic}
    const p=pieceById(G,intent.piece_id)!;const acts:any=actions(G,p),meta={turns:Number(state.turns||0),caps:Number(state.caps||0),spEnabled:!!options.spEnabled};const rng=options.rng||Math.random
    const from={r:p.r,c:p.c}

    if(intent.kind==='move'){
      if(!includesCoord(acts.moves,intent.to))return{ok:false,error:'Déplacement illégal.'}
      movePiece(G,p,intent.to!.r,intent.to!.c);recordQueenMove(G,p,from.r,from.c,p.r,p.c);applySPCell(G,p,p.r,p.c);tickSP(G,p)
      if(p.type==='reporter'){
        const sp=G.spPieces?.[p.id],targets=reporterTargets(G,p,sp?.type==='area-kill'?'all':(intent.reporter_mode||'ortho'))
        if(sp?.type==='area-kill')killReporterTargets(G,p,'all',meta)
        else if(targets.length){if(!intent.reporter_mode||!['ortho','diag'].includes(intent.reporter_mode))return{ok:false,error:'La direction du Reporter est requise.'};killReporterTargets(G,p,intent.reporter_mode,meta)}
      }
      handleNid(G,p);finishTurn(G,meta,rng)
    }

    else if(intent.kind==='kill'){
      const target=pieceById(G,intent.target_id);if(!target||target.dead)return{ok:false,error:'Cible invalide.'};if(!acts.kills.some((x:any)=>String(x.p.id)===String(target.id)&&x.r===target.r&&x.c===target.c))return{ok:false,error:'Capture illégale.'};if(isInvincible(G,target))return{ok:false,error:'Cette pièce est invincible.'}
      const killedOnNid=target.r===4&&target.c===4;movePiece(G,p,target.r,target.c);tickSP(G,p)
      const sp=G.spPieces?.[p.id]
      if(p.type==='assassin'&&sp?.type==='double-kill')return{ok:false,error:'Double Kill doit être couvert par un test de parité avant activation online.'}
      const needCorpse=executeKill(G,p,target,meta)
      if(p.type==='assassin')placePiece(G,target,from.r,from.c)
      else if(needCorpse){const d=intent.corpse_to;if(!d||!emptyForPlacement(G,d.r,d.c)||d.r===4&&d.c===4)return{ok:false,error:'Placement de dépouille invalide.'};placePiece(G,target,d.r,d.c)}
      if(killedOnNid&&p.type!=='chef'){
        const bonus=baseActions(G,p).moves;const d=intent.nid_bonus_to;if(!d||!includesCoord(bonus,d)||d.r===4&&d.c===4)return{ok:false,error:'Le coup bonus de sortie du Nid est requis.'};movePiece(G,p,d.r,d.c)
      }
      handleNid(G,p);finishTurn(G,meta,rng)
    }

    else if(intent.kind==='dipl'){
      const target=pieceById(G,intent.target_id);if(!target||target.dead)return{ok:false,error:'Cible du Diplomate invalide.'};if(!acts.diplT.some((x:any)=>String(x.p.id)===String(target.id)))return{ok:false,error:'Action du Diplomate illégale.'};const d=intent.displaced_to;if(!d)return{ok:false,error:'Destination de la pièce déplacée requise.'};removePiece(G,target);movePiece(G,p,target.r<0?(acts.diplT.find((x:any)=>String(x.p.id)===String(target.id))?.r):target.r,target.c<0?(acts.diplT.find((x:any)=>String(x.p.id)===String(target.id))?.c):target.c);if(!emptyForPlacement(G,d.r,d.c))return{ok:false,error:'Destination de la pièce déplacée occupée.'};placePiece(G,target,d.r,d.c);handleNid(G,p);finishTurn(G,meta,rng)
    }

    else if(intent.kind==='necro'){
      const corpse=pieceById(G,intent.target_id);if(!corpse||!corpse.dead)return{ok:false,error:'Dépouille invalide.'};const sp=G.spPieces?.[p.id],free=sp?.type==='free-move-corpse';if(!free&&!acts.necroT.some((x:any)=>String(x.p.id)===String(corpse.id)))return{ok:false,error:'Dépouille hors de portée.'};const d=intent.corpse_to;if(!d||!emptyForPlacement(G,d.r,d.c)||d.r===4&&d.c===4)return{ok:false,error:'Destination de dépouille invalide.'};if(!free){const hit=acts.necroT.find((x:any)=>String(x.p.id)===String(corpse.id));removePiece(G,corpse);movePiece(G,p,hit.r,hit.c)}else removePiece(G,corpse);placePiece(G,corpse,d.r,d.c);handleNid(G,p);finishTurn(G,meta,rng)
    }

    else if(intent.kind==='resurrect'){
      const corpse=pieceById(G,intent.target_id);const sp=G.spPieces?.[p.id];if(sp?.type!=='resurrect'||!corpse?.dead)return{ok:false,error:'Résurrection illégale.'};const d=intent.to;if(!d||!inB(d.r,d.c))return{ok:false,error:'Destination de résurrection invalide.'};const occupied=G.board[d.r][d.c];if(occupied&&!occupied.dead)return{ok:false,error:'Destination de résurrection occupée.'};if(occupied?.dead)removePiece(G,occupied);removePiece(G,corpse);const old=corpse.color;corpse.color=p.color;corpse.dead=false;if(G.players[old])G.players[old].pieces=G.players[old].pieces.filter((x:Piece)=>String(x.id)!==String(corpse.id));if(!G.players[p.color].pieces.some((x:Piece)=>String(x.id)===String(corpse.id)))G.players[p.color].pieces.push(corpse);placePiece(G,corpse,d.r,d.c);finishTurn(G,meta,rng)
    }

    state.turns=meta.turns;state.caps=meta.caps;state.G.board=null
    const event={schema:2,kind:'action_accepted',actor_color:actorColor,action:clone(intent),current_after:cur(G),turn_after:Number(G.turn||0),changes:diffPieces(snapshot,state),sp_effects:diffSP(snapshot,state)}
    return{ok:true,state,event}
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Erreur de résolution de règle.'}}
}

function flatState(state:any){const m=new Map<string,any>();for(const color of Object.keys(state?.G?.players||{}))for(const p of state.G.players[color]?.pieces||[])if(!m.has(String(p.id)))m.set(String(p.id),{id:p.id,color:p.color,type:p.type,r:p.r,c:p.c,dead:!!p.dead});return m}
export function diffPieces(before:any,after:any){const b=flatState(before),a=flatState(after),out:any[]=[];for(const id of new Set([...b.keys(),...a.keys()])){const f=b.get(id)||null,t=a.get(id)||null;if(!f&&t){out.push({kind:'piece_added',id:t.id,to:t});continue}if(f&&!t){out.push({kind:'piece_removed',id:f.id,from:f});continue}if(f&&t&&(f.r!==t.r||f.c!==t.c||f.dead!==t.dead||f.color!==t.color))out.push({kind:'piece_changed',id:t.id,color:t.color,type:t.type,from:{r:f.r,c:f.c,dead:f.dead,color:f.color},to:{r:t.r,c:t.c,dead:t.dead,color:t.color}})}return out}
export function diffSP(before:any,after:any){const b={cells:before?.G?.spCells||{},pieces:before?.G?.spPieces||{}},a={cells:after?.G?.spCells||{},pieces:after?.G?.spPieces||{}};return JSON.stringify(b)===JSON.stringify(a)?null:a}
