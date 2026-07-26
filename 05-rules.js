/* ===============================================================
   IN-SECT — RULES — Regles de mouvement, kills, Nid Sacre, encerclement, victoire, tours
   Module 05-rules.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

/* ═══════════════════════════════════════════
   [RULES] — Règles de mouvement
   ═══════════════════════════════════════════ */
function getActions(piece) {
  if (piece.dead) return { moves:[], kills:[], diplT:[], necroT:[] };
  switch (piece.type) {
    case 'militant':    return getMilitant(piece);
    case 'diplomate':   return getDiplomate(piece);
    case 'necromobile': return getNecromobile(piece);
    case 'reporter':    return getReporter(piece);
    default:            return getLinear(piece);
  }
}

// Chef & Assassin — dame aux échecs
function getLinear(piece) {
  const {r,c,color,type} = piece;
  const moves = [], kills = [];
  for (const [dr,dc] of DIRS8) {
    let nr = r+dr, nc = c+dc;
    while (inB(nr,nc)) {
      const t = G.board[nr][nc];
      const isNid = (nr===LAB.r && nc===LAB.c);
      if (!t) {
        // Case vide : seule la Reine peut s'y arrêter librement sur le Nid
        if (isNid && type!=='chef') { nr+=dr; nc+=dc; continue; }
        moves.push({r:nr,c:nc});
      } else if (t.dead) { break; }
      else {
        // Pièce vivante ennemie : toutes les pièces peuvent tuer, même sur le Nid
        // (sauf les Fourmis → gérées dans getMilitant)
        if (t.color !== color) kills.push({r:nr,c:nc,p:t});
        break;
      }
      nr+=dr; nc+=dc;
    }
  }
  return { moves, kills, diplT:[], necroT:[] };
}

// Militant — portée max 2, ne peut pas attaquer la Reine sur le Nid
function getMilitant(piece) {
  const {r,c,color} = piece;
  const moves = [], kills = [];
  for (const [dr,dc] of DIRS8) {
    for (let s = 1; s <= 2; s++) {
      const nr = r+dr*s, nc = c+dc*s;
      if (!inB(nr,nc)) break;
      const t = G.board[nr][nc];
      if (!t) {
        const isNid = (nr===LAB.r && nc===LAB.c);
        if (isNid) {
          // Traverse le Nid si la portée le permet (s=1 → peut continuer à s=2)
          continue;
        }
        moves.push({r:nr,c:nc});
      } else if (t.dead) { break; }
      else {
        if (t.color !== color) {
          const onNid = (t.type==='chef' && nr===LAB.r && nc===LAB.c);
          if (!onNid) kills.push({r:nr,c:nc,p:t});
        }
        break;
      }
    }
  }
  return {moves,kills,diplT:[],necroT:[]};
}

// Reporter — se déplace sur case vide, puis nuée
function getReporter(piece) {
  const {r,c} = piece;
  const moves = [];
  for (const [dr,dc] of DIRS8) {
    let nr = r+dr, nc = c+dc;
    while (inB(nr,nc)) {
      const t = G.board[nr][nc];
      if (!t) {
        if (nr===LAB.r&&nc===LAB.c) { nr+=dr; nc+=dc; continue; }
        moves.push({r:nr,c:nc});
      }
      else break;
      nr+=dr; nc+=dc;
    }
  }
  return {moves,kills:[],diplT:[],necroT:[]};
}

// Diplomate — pousse une pièce ennemie vivante
function getDiplomate(piece) {
  const {r,c,color} = piece;
  const moves = [], diplT = [];
  for (const [dr,dc] of DIRS8) {
    let nr = r+dr, nc = c+dc;
    while (inB(nr,nc)) {
      const t = G.board[nr][nc];
      if (!t) {
        if (nr===LAB.r&&nc===LAB.c) { nr+=dr; nc+=dc; continue; }
        moves.push({r:nr,c:nc});
      }
      else if (t.dead) { break; }
      else { if (t.color !== color) diplT.push({r:nr,c:nc,p:t}); break; }
      nr+=dr; nc+=dc;
    }
  }
  return {moves,kills:[],diplT,necroT:[]};
}

// Necromobile — déplace les dépouilles
function getNecromobile(piece) {
  const {r,c} = piece;
  const moves = [], necroT = [];
  for (const [dr,dc] of DIRS8) {
    let nr = r+dr, nc = c+dc;
    while (inB(nr,nc)) {
      const t = G.board[nr][nc];
      if (!t) {
        // Le Nid Sacré est traversable (case vide spéciale) mais ne peut pas recevoir de dépouille
        if (nr===LAB.r&&nc===LAB.c) { nr+=dr; nc+=dc; continue; }
        moves.push({r:nr,c:nc});
      }
      else if (t.dead) { necroT.push({r:nr,c:nc,p:t}); break; }
      else { break; } // pièce vivante = bloque
      nr+=dr; nc+=dc;
    }
  }
  return {moves,kills:[],diplT:[],necroT};
}

// Cibles adjacentes du Reporter après déplacement
function getRepAdj(piece) {
  const res = [];
  for (const dirs of [DIRS_ORTHO, DIRS_DIAG]) {
    for (const [dr,dc] of dirs) {
      const nr = piece.r+dr, nc = piece.c+dc;
      if (!inB(nr,nc)) continue;
      const t = G.board[nr][nc];
      if (t&&!t.dead&&t.color!==piece.color) res.push({r:nr,c:nc,p:t,ortho:dirs===DIRS_ORTHO,dr,dc});
    }
  }
  return res;
}


/* ═══════════════════════════════════════════
   KILL / ÉLIMINATION
   ═══════════════════════════════════════════ */
function executeKill(killer, victim) {
  victim.dead = true; _gameCaps++;
  // Si la victime avait un SP → la marquer pour résurrection automatique dans 30 tours
  if (G.spPieces && G.spPieces[victim.id]) {
    if (!G.ghostQueue) G.ghostQueue = [];
    G.ghostQueue.push({ piece: victim, reviveTurn: G.turn + 30 });
    // Marquer comme "ghost" au lieu de supprimer — la dépouille garde son aura visible
    G.spPieces[victim.id] = { ...G.spPieces[victim.id], ghost: true };
  }
  const isChef = (victim.type === 'chef');
  const pos = getPiecePos(victim);
  if (pos) {
    if (isChef) FX.spawnQueen(pos.x, pos.y, victim.color);
    else        FX.spawn(pos.x, pos.y, victim.color);
  }
  if (isChef) { sfxQueenKill(); screenFlash('queen'); boardShake(); }
  else        { sfxCapture();   boardShake(); }
  const pe = document.getElementById('p'+victim.id);
  if (pe) {
    pe.classList.add('flash-kill');
    setTimeout(() => {
      pe.classList.remove('flash-kill');
      const cv = pe.querySelector('canvas');
      if (cv) drawPiece(cv, victim.color, SYM[victim.type], true, false);
      pe.style.filter = 'none'; pe.style.zIndex = '2';
    }, 460);
  }
  if (isChef) { removeFromBoard(victim); elimPlayer(victim.color, killer.color); return false; }
  if (killer.type === 'reporter') { removeFromBoard(victim); return false; }
  removeFromBoard(victim);
  G.pendCorpse = { piece:victim };
  return true;
}

function elimPlayer(loserColor, killerColor) {
  const pl = G.players[loserColor]; if (!pl || !pl.alive) return;
  pl.alive = false;
  const kpl = G.players[killerColor];
  if (kpl && kpl.alive) {
    for (const p of pl.pieces) { if (!p.dead) { p.color = killerColor; kpl.pieces.push(p); } }
    pl.pieces = pl.pieces.filter(p => p.dead);
  } else {
    for (const p of pl.pieces) if (!p.dead) p.dead = true;
  }
  G.order = G.order.filter(c => c !== loserColor);
  if (G.idx >= G.order.length) G.idx = 0;
  if (loserColor === G.human) {
    G.over = true; if (_aiTimer) clearTimeout(_aiTimer);
    clearSave();
    setTimeout(() => {
      sfxDefeat();
      setText('etitle','DÉFAITE');
      document.getElementById('etitle').style.cssText = 'background:linear-gradient(135deg,#6A0010,#FF3050,#6A0010);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:"Cinzel Decorative",serif;font-size:2.2rem;';
      document.getElementById('ecrown').textContent = '💀';
      if (_mode === 3) {
        setText('esub', 'Vous ne connaîtrez pas les vainqueurs de cette guerre.');
      } else {
        setText('esub','Votre colonie a été anéantie.');
      }
      setText('ewinner','');
      setText('end-turns', _gameTurns); setText('end-caps', _gameCaps);
      showScreen('end');
    }, 700);
  }
}


/* ═══════════════════════════════════════════
   NID SACRÉ
   ═══════════════════════════════════════════ */
function handleNid(piece) {
  if (piece.type !== 'chef') return;
  const onNid = (piece.r === LAB.r && piece.c === LAB.c);
  if (onNid) {
    if (G.labActive !== piece.color) { G.labActive = piece.color; G.labExtra = -1; sfxNid(); showInfoText('👑 Nid Sacré', `La Reine <b style="color:${CCSS[piece.color]}">${CNAME_SHORT[piece.color]}</b> occupe le Nid Sacré et rejoue après chaque adversaire.`, '#D4A017'); }
  } else {
    if (G.labActive === piece.color) { G.labActive = null; G.labExtra = -1; }
  }
  if (G.labActive && (!G.players[G.labActive]||!G.players[G.labActive].alive||!G.order.includes(G.labActive))) {
    G.labActive = null; G.labExtra = -1;
  }
}


/* ═══════════════════════════════════════════
   ENCERCLEMENT
   ═══════════════════════════════════════════ */
function isQueenTrapped(color) {
  const pl = G.players[color]; if (!pl||!pl.alive) return false;
  const chef = pl.pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color); if (!chef) return false;
  // Scarabée vivant = pas piégée (peut déplacer les dépouilles)
  const hasNecro = pl.pieces.some(p=>!p.dead&&p.type==='necromobile'&&p.color===color);
  if (hasNecro) return false;

  // Les dépouilles + bords divisent le plateau en zones.
  // On mesure la taille de la zone de la Reine.
  // Si c'est la plus petite zone (< moitié des cases), c'est une prison.
  function floodSize(startR, startC) {
    const seen = new Set();
    const q = [[startR, startC]];
    seen.add(`${startR},${startC}`);
    while (q.length) {
      const [r,c] = q.shift();
      for (const [dr,dc] of DIRS8) {
        const nr=r+dr, nc=c+dc;
        if (!inB(nr,nc)) continue;
        const key=`${nr},${nc}`; if (seen.has(key)) continue;
        const cell=G.board[nr][nc];
        if (cell && cell.dead) continue; // dépouille = mur
        seen.add(key);
        q.push([nr,nc]);
      }
    }
    return seen.size;
  }

  const queenZoneSize = floodSize(chef.r, chef.c);
  return queenZoneSize < (9 * 9) / 2; // prison = zone strictement inférieure à la moitié
}

// Suivi des répétitions de mouvement par reine
if (!G.queenMovHistory) G.queenMovHistory = {};

function recordQueenMove(piece, fromR, fromC, toR, toC) {
  if (piece.type !== 'chef') return;
  const key = piece.color;
  const mov = `${fromR},${fromC}->${toR},${toC}`;
  if (!G.queenMovHistory[key]) G.queenMovHistory[key] = { last: null, count: 0 };
  const h = G.queenMovHistory[key];
  if (h.last === mov) {
    h.count++;
    if (h.count >= 4) {
      showInfoText('🔒 Pat',
        `La Reine <b style="color:${CCSS[piece.color]}">${CNAME_SHORT[piece.color]}</b> a répété le même mouvement 4 fois — elle est éliminée !`,
        CCSS[piece.color]);
      eliminateTrapped(piece.color, G.lastActor);
    }
  } else {
    h.last = mov; h.count = 1;
  }
}

// Résurrection automatique des pièces mortes avec SP (après 30 tours)
function checkGhostResurrections() {
  if (!G.ghostQueue || !G.ghostQueue.length) return;
  const toRevive = G.ghostQueue.filter(e => G.turn >= e.reviveTurn);
  if (!toRevive.length) return;
  G.ghostQueue = G.ghostQueue.filter(e => G.turn < e.reviveTurn);
  for (const entry of toRevive) {
    const p = entry.piece;
    // Vérifier que la colonie d'origine est encore en vie
    if (!G.players[p.color] || !G.players[p.color].alive) continue;
    // La pièce reste sur sa case actuelle (pas de pickFreeCell)
    // Si sa case est occupée par une autre pièce, trouver la case adjacente la plus proche
    let targetR = p.r, targetC = p.c;
    if (G.board[p.r] && G.board[p.r][p.c] && G.board[p.r][p.c] !== p) {
      // Case occupée par quelqu'un d'autre — chercher adjacente libre
      let found = false;
      for (const [dr,dc] of DIRS8) {
        const nr = p.r+dr, nc = p.c+dc;
        if (inB(nr,nc) && !G.board[nr][nc]) { targetR=nr; targetC=nc; found=true; break; }
      }
      if (!found) continue; // pas de place du tout
    }
    p.dead = false;
    placeOnBoard(p, targetR, targetC);
    // Supprimer le marqueur ghost
    if (G.spPieces && G.spPieces[p.id]) delete G.spPieces[p.id];
    // Son de résurrection
    sfxGhostResurrect();
    // Redessiner la pièce vivante
    const pe = document.getElementById('p' + p.id);
    if (pe) {
      const cv = pe.querySelector('canvas');
      if (cv) drawPiece(cv, p.color, SYM[p.type], false, false);
      pe.classList.remove('has-sp', 'ghost-sp');
      pe.style.filter = `drop-shadow(0 0 4px ${CGLOW2[p.color]||'rgba(255,255,255,.3)'})`;
    }
    const pieceName = PNAME_SHORT[p.type] || p.type;
    const colName = COLOR_FR[p.color] || p.color;
    showInfoText('👻 Résurrection !',
      `<b style="color:${CCSS[p.color]}">${pieceName} ${colName}</b> ressuscite après 30 tours — elle revient dans la bataille !`,
      CCSS[p.color]);
    logMove({ color: CCSS[p.color], text: `<b style="color:${CCSS[p.color]}">${pieceName} ${colName}</b> ressuscite et revient dans la bataille !` });
  }
  renderBoard();
}

function checkStalemates() {
  for (const color of [...G.order]) {
    if (!G.players[color].alive) continue;
    const trapped = isQueenTrapped(color);
    if (trapped) {
      showInfoText('🔒 Reine encerclée !',
        `La Reine <b style="color:${CCSS[color]}">${CNAME_SHORT[color]}</b> est encerclée — sa colonie est éliminée !`,
        CCSS[color]);
      eliminateTrapped(color, G.lastActor);
    }
  }
}

function eliminateTrapped(color, killerColor) {
  const pl = G.players[color]; if (!pl||!pl.alive) return;
  pl.alive = false;
  const kpl = (killerColor && killerColor !== color) ? G.players[killerColor] : null;
  const kpc = killerColor ? CCSS[killerColor] : '#aaa';
  const kpn = killerColor ? `<b style="color:${kpc}">${COLOR_FR[killerColor]}</b>` : 'une colonie';
  const vpc = CCSS[color];
  const vpn = `<b style="color:${vpc}">${COLOR_FR[color]}</b>`;
  logMove({ color: vpc, text: `💀 Reine ${vpn} encerclée — équipe ${vpn} rejoint la colonie ${kpn}`, isKill: true });
  if (kpl && kpl.alive) {
    // Les pièces vivantes (sauf la Reine) rejoignent le vainqueur
    for (const p of pl.pieces) {
      if (!p.dead && p.type !== 'chef') { p.color = killerColor; kpl.pieces.push(p); }
    }
    pl.pieces = pl.pieces.filter(p => p.dead || p.type === 'chef');
    const chef = pl.pieces.find(p => p.type === 'chef' && !p.dead);
    if (chef) chef.dead = true;
  } else {
    for (const p of pl.pieces) if (!p.dead) p.dead = true;
  }
  G.order = G.order.filter(c => c !== color);
  if (G.idx >= G.order.length) G.idx = 0;
  if (G.labActive === color) { G.labActive = null; G.labExtra = -1; }
  if (color === G.human) {
    G.over = true; if (_aiTimer) clearTimeout(_aiTimer);
    setTimeout(() => {
      sfxDefeat();
      setText('etitle', 'DÉFAITE');
      document.getElementById('etitle').style.cssText = 'background:linear-gradient(135deg,#6A0010,#FF3050,#6A0010);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:"Cinzel Decorative",serif;font-size:2.2rem;';
      document.getElementById('ecrown').textContent = '💀';
      setText('esub', 'Votre Reine a été encerclée sans Scarabée pour la libérer.');
      const ewinnerEl = document.getElementById('ewinner');
      if (ewinnerEl) ewinnerEl.innerHTML = '';
      setText('end-turns', _gameTurns); setText('end-caps', _gameCaps);
      showScreen('end');
    }, 700);
  }
}


/* ═══════════════════════════════════════════
   VICTOIRE
   ═══════════════════════════════════════════ */
function checkWin() {
  const alive = G.order.filter(c=>G.players[c].alive);
  if (alive.length <= 1) { endGame(alive[0]||null); return true; }
  return false;
}

function endGame(winner) {
  if (G.over) return;
  G.over = true; if(_aiTimer)clearTimeout(_aiTimer);
  stopBGM();
  setTimeout(()=>{
    const hw = winner&&G.players[winner]&&G.players[winner].human;
    if (hw) { sfxVictory(); launchVictoryParticles(); recordWin(); } else { sfxDefeat(); recordLoss(); }
    setText('etitle', hw?'VICTOIRE !':'DÉFAITE');
    document.getElementById('etitle').style.cssText = `background:linear-gradient(135deg,${hw?'#3010A0,#9050FF,#3010A0':'#6A0010,#FF3050,#6A0010'});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Cinzel Decorative',serif;font-size:2.2rem;`;
    document.getElementById('ecrown').innerHTML = hw
      ? `<img src="reine_guepe_512.webp" alt="Reine" style="width:4rem;height:4rem;object-fit:contain;filter:drop-shadow(0 0 16px rgba(144,80,255,.8)) drop-shadow(0 0 6px rgba(240,192,48,.6));">`
      : '💀';
    setText('esub', hw?'Votre colonie domine toutes les colonies !':'La guerre des colonies est terminée.');
    // innerHTML pour afficher l'image correctement
    const ewinnerEl = document.getElementById('ewinner');
    if (ewinnerEl) ewinnerEl.innerHTML = winner
      ? `<img src="${SYM['chef']}" alt="Reine" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:.3em;"> ${CNAME[winner]} remporte la guerre.`
      : '';
    setText('end-turns',_gameTurns); setText('end-caps',_gameCaps);
    showScreen('end');
  },400);
}

function launchVictoryParticles() {
  const cv = document.getElementById('c-victory'); cv.style.display='block';
  cv.width=innerWidth; cv.height=innerHeight;
  const ctx=cv.getContext('2d');
  const cols=['#9050FF','#C080FF','#F0C030','#30D060','#4090FF'];
  const pts=[];
  for(let i=0;i<90;i++) pts.push({x:Math.random()*cv.width,y:cv.height+10,vx:(Math.random()-.5)*4,vy:-(Math.random()*10+8),r:Math.random()*4+2,c:cols[Math.floor(Math.random()*cols.length)],life:1,decay:.007+Math.random()*.01,rot:Math.random()*Math.PI*2,rotV:(Math.random()-.5)*.2});
  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height); let alive=false;
    for(const p of pts){p.x+=p.vx;p.y+=p.vy;p.vy+=.2;p.life-=p.decay;p.rot+=p.rotV;
      if(p.life<=0)continue;alive=true;
      ctx.save();ctx.globalAlpha=p.life;ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);ctx.restore();}
    if(alive) requestAnimationFrame(draw); else cv.style.display='none';
  }
  draw();
}


/* ═══════════════════════════════════════════
   HUMAN CLICK HANDLER
   ═══════════════════════════════════════════ */
function humanClickCell(r,c){
  if (!isHuman()||_animating||G.over||G.spPaused) return;
  const clicked = G.board[r][c];

  if (G.phase === 'nid-bonus') {
    const mv = G._nidBonusMoves && G._nidBonusMoves.find(m=>m.r===r&&m.c===c);
    if (!mv) { toast('Vous devez quitter le Nid — choisissez une case vide.'); return; }
    const piece = G.sel;
    G._nidBonusMoves = null; G.phase = 'select';
    animMove(piece, r, c).then(()=>{
      handleNid(piece); G.sel=null; renderBoard(); finishTurn();
    });
    return;
  }
  if (G.phase === 'place-corpse'){    if (G.board[r][c]) { toast('Case occupée'); return; }
    if (r===LAB.r&&c===LAB.c) { toast('Le Nid Sacré ne peut pas recevoir une dépouille'); return; }
    placeOnBoard(G.pendCorpse.piece,r,c); G.pendCorpse=null; G.phase='select';
    renderBoard();
    if (G.afterCorpse) { const cb=G.afterCorpse; G.afterCorpse=null; cb(); }
    else finishTurn();
    return;
  }
  if (G.phase === 'place-dipl'){
    if (G.board[r][c]) { toast('Case occupée'); return; }
    placeOnBoard(G.pendDisp,r,c); G.pendDisp=null; G.phase='select'; renderBoard(); finishTurn(); return;
  }
  if (G.phase === 'place-resurrect'){
    const corpse = G.pendDisp;
    // Retirer d'abord la dépouille du board (libère sa case avant toute vérification)
    if (inB(corpse.r, corpse.c) && G.board[corpse.r][corpse.c] === corpse) {
      G.board[corpse.r][corpse.c] = null;
    }
    // Vérifier la case cible : doit être vide ou être l'ancienne case de la dépouille
    const target = G.board[r][c];
    if (target && !target.dead) {
      showInfoText('❌ Case occupée', 'Choisissez une case vide pour ressusciter la pièce.', '#FF6060');
      // Remettre la dépouille sur son ancienne case
      G.board[corpse.r][corpse.c] = corpse;
      return;
    }
    // Si une autre dépouille occupe la case cible, la retirer
    if (target && target.dead) removeFromBoard(target);
    // Changer équipe
    const oldColor = corpse.color;
    corpse.color = G.pendNecroColor;
    corpse.dead = false;
    if (G.players[oldColor]) G.players[oldColor].pieces = G.players[oldColor].pieces.filter(p=>p.id!==corpse.id);
    if (G.players[corpse.color]) G.players[corpse.color].pieces.push(corpse);
    placeOnBoard(corpse, r, c);
    G.pendDisp = null; G.pendNecroColor = null; G.phase = 'select';
    showInfoText('💀 Résurrection !',
      `Une pièce ressuscite dans la colonie <b style="color:${CCSS[corpse.color]}">${CNAME_SHORT[corpse.color]}</b> !`,
      CCSS[corpse.color]);
    sfxCapture();
    renderBoard(); finishTurn(); return;
  }
  if (G.phase === 'place-necro'){
    if (G.board[r][c]) { toast('Case occupée'); return; }
    if (r===LAB.r&&c===LAB.c) { toast('Le Nid Sacré ne peut pas recevoir une dépouille'); return; }
    placeOnBoard(G.pendDisp,r,c); G.pendDisp=null; G.phase='select'; renderBoard(); finishTurn(); return;
  }
  if (G.phase === 'reporter-choose'){
    const hit = G.repTargets.find(t=>t.r===r&&t.c===c);
    if (hit) { execReporterNuee(G.sel,hit.ortho); }
    else { handleNid(G.sel); G.sel=null; G.phase='select'; G.repTargets=[]; renderBoard(); finishTurn(); }
    return;
  }
  if (G.phase !== 'select') return;

  if (r===LAB.r&&c===LAB.c&&!clicked&&!G.sel){
    showInfoText('👑 Nid Sacré', 'La Reine ici rejoue après chaque adversaire. Immunisée contre la Fourmi.', '#D4A017');
    return;
  }

  if (clicked&&!clicked.dead&&clicked.color===G.human&&!G.sel) { selectPiece(clicked); return; }
  if (clicked&&!clicked.dead&&clicked.color===G.human&&G.sel)  {
    // Si la pièce sélectionnée est une coccinelle avec SP resurrect, vérifier si cet allié est une cible diplT
    if (G.sel) {
      const acts = getActionsWithSP(G.sel);
      const dl = acts.diplT.find(d => d.r === r && d.c === c);
      if (dl) { doDipl(G.sel, dl.p, r, c); return; }
    }
    selectPiece(clicked); return;
  }
  if (!G.sel) return;

  const piece=G.sel, acts=getActionsWithSP(piece);
  const mv=acts.moves.find(m=>m.r===r&&m.c===c);
  const kl=acts.kills.find(k=>k.r===r&&k.c===c);
  const dl=acts.diplT.find(d=>d.r===r&&d.c===c);
  const nc=acts.necroT.find(n=>n.r===r&&n.c===c);

  if (!mv&&!kl&&!dl&&!nc) { G.sel=null; resetTopbar(); renderBoard(); return; }
  if (mv)       doMove(piece,r,c);
  else if (kl)  doKill(piece,kl.p,r,c);
  else if (dl)  doDipl(piece,dl.p,r,c);
  else if (nc)  doNecro(piece,nc.p,r,c);
}

function selectPiece(piece) { G.sel=piece; sfxSelect(); updatePieceInfo(piece); renderBoard(); }

function doMove(piece,r,c){
  const fromR = piece.r, fromC = piece.c;
  logMoveAction(piece, 'move', null);
  _animating=true;
  animMove(piece,r,c).then(()=>{
    recordQueenMove(piece, fromR, fromC, r, c);
    if (checkSPCellCapture(piece,r,c)) return; // SP déclenché → _resumeAfterSP appellera finishTurn
    tickSPTurns(piece);
    if (piece.type==='reporter'){
      const sp = G.spPieces[piece.id];
      if (sp && sp.type === 'area-kill') {
        execReporterAreaKill(piece);
        handleNid(piece); G.sel=null; renderBoard(); finishTurn(); return;
      }
      const rts=getRepAdj(piece);
      if (rts.length>0) { G.phase='reporter-choose'; G.repTargets=rts; G.sel=piece; renderBoard(); updateTurnUI(); return; }
    }
    handleNid(piece); G.sel=null; renderBoard(); finishTurn();
  });
}

function doKill(piece,victim,toR,toC){
  if (isInvincible(victim)) {
    showInfoText('🛡️ Invincible !', `Cette pièce est protégée par un super pouvoir — elle ne peut pas être attaquée !`, '#C080FF');
    G.sel=null; renderBoard(); return;
  }
  logMoveAction(piece, 'kill', victim);
  const fromR=piece.r, fromC=piece.c;
  const killedOnNid = (toR===LAB.r && toC===LAB.c);
  _animating=true;
  animMove(piece,toR,toC).then(()=>{
    tickSPTurns(piece);
    const sp = G.spPieces[piece.id];
    if (piece.type==='assassin' && sp && sp.type==='double-kill') {
      executeDoubleKill(piece, victim, fromR, fromC);
      // Après double kill : coup bonus si on a tué sur le Nid
      if (killedOnNid && piece.type !== 'chef') {
        _triggerNidBonusMove(piece);
      } else {
        handleNid(piece); G.sel=null; renderBoard(); finishTurn();
      }
      return;
    }
    const needPlace=executeKill(piece,victim);
    if (piece.type==='assassin'){
      placeOnBoard(victim,fromR,fromC);
      // Araignée : après kill sur le Nid, coup bonus pour quitter
      if (killedOnNid) {
        _triggerNidBonusMove(piece);
      } else {
        handleNid(piece); G.sel=null; renderBoard(); finishTurn();
      }
      return;
    }
    if (needPlace){
      G.phase='place-corpse';
      // Après placement dépouille : vérifier si on était sur le Nid
      G.afterCorpse=()=>{
        if (killedOnNid && piece.type !== 'chef') {
          _triggerNidBonusMove(piece);
        } else {
          handleNid(piece); G.sel=null; finishTurn();
        }
      };
      showInfoText('💀 Placez la dépouille', 'Choisissez une case libre pour la dépouille.', '#888');
      renderBoard(); updateTurnUI(); return;
    }
    // Pas de dépouille à placer (Mouche) : coup bonus si on a tué sur le Nid
    if (killedOnNid && piece.type !== 'chef') {
      _triggerNidBonusMove(piece);
    } else {
      handleNid(piece); G.sel=null; renderBoard(); finishTurn();
    }
  });
}

// Coup bonus après kill sur le Nid : la pièce doit quitter le Nid immédiatement
function _triggerNidBonusMove(piece) {
  // Forcer la pièce à quitter le Nid — elle ne peut que se déplacer (pas tuer à nouveau)
  const legalMoves = getActions(piece).moves.filter(m => !(m.r===LAB.r && m.c===LAB.c));
  if (legalMoves.length === 0) {
    // Aucune case libre autour : la pièce reste (cas extrêmement rare), on finit le tour
    handleNid(piece); G.sel=null; renderBoard(); finishTurn(); return;
  }
  showInfoText('👑 Quittez le Nid Sacré !',
    'Vous devez immédiatement quitter le Nid avec un coup bonus. Placez votre Reine si vous le souhaitez !',
    '#D4A017');
  G.phase = 'nid-bonus';
  G.sel = piece;
  // Marquer les cases légales (déplacements uniquement, pas kills)
  G._nidBonusMoves = legalMoves;
  renderBoard();
  updateTurnUI();
}

function doDipl(piece,victim,toR,toC){
  logMoveAction(piece, 'dipl', victim);
  removeFromBoard(victim); _animating=true;
  animMove(piece,toR,toC).then(()=>{
    if (checkSPCellCapture(piece,toR,toC)) return;
    G.pendDisp=victim; G.phase='place-dipl';
    showInfoText('🐛 Déplacement', 'Placez la pièce sur une case vide.', '#888');
    renderBoard(); updateTurnUI();
  });
}

function doNecro(piece,corpse,toR,toC){
  const acts = getActionsWithSP(piece);
  if (acts.resurrectMode) {
    // Coccinelle SP : ressusciter la dépouille dans la colonie de la Coccinelle
    logMoveAction(piece, 'resurrect', corpse);
    G.pendDisp = corpse;
    G.pendNecroColor = piece.color;
    G.phase = 'place-resurrect';
    showInfoText('💀 Résurrection',
      `Choisissez une case vide pour ressusciter cette pièce dans la colonie <b style="color:${CCSS[piece.color]}">${CNAME_SHORT[piece.color]}</b>.`,
      CCSS[piece.color]);
    renderBoard(); updateTurnUI();
    return;
  }
  if (acts.freeMoveCorpse) {
    // Scarabée SP : déplacer n'importe quelle dépouille librement (sans résurrection)
    logMoveAction(piece, 'necro', corpse);
    removeFromBoard(corpse);
    G.pendDisp = corpse;
    G.phase = 'place-necro';
    showInfoText('🪲 Déplacement libre', 'Placez la dépouille sur n\'importe quelle case vide du plateau.', '#888');
    renderBoard(); updateTurnUI();
    return;
  }
  logMoveAction(piece, 'necro', corpse);
  removeFromBoard(corpse); _animating=true;
  animMove(piece,toR,toC).then(()=>{
    if (checkSPCellCapture(piece,toR,toC)) return;
    G.pendDisp=corpse; G.phase='place-necro';
    showInfoText('💀 Déplacement de dépouille', 'Placez la dépouille sur une case libre du plateau.', '#888');
    renderBoard(); updateTurnUI();
  });
}

function execReporterNuee(reporter,isOrtho){
  const dirs=isOrtho?DIRS_ORTHO:DIRS_DIAG;
  for(const[dr,dc]of dirs){
    const nr=reporter.r+dr,nc=reporter.c+dc; if(!inB(nr,nc))continue;
    const t=G.board[nr][nc];
    if(t&&!t.dead&&t.color!==reporter.color&&!isInvincible(t)){
      t.dead=true; _gameCaps++;
      const pos=getPiecePos(t); if(pos)FX.spawn(pos.x,pos.y,t.color);
      const pe=document.getElementById('p'+t.id);
      if(pe){pe.classList.add('flash-kill');setTimeout(()=>{pe.classList.remove('flash-kill');const cv=pe.querySelector('canvas');if(cv)drawPiece(cv,t.color,SYM[t.type],true,false);pe.style.filter='none';pe.style.zIndex='2';},460);}
      if(t.type==='chef')elimPlayer(t.color,reporter.color);
    }
  }
  sfxCapture();boardShake();
  G.phase='select';G.repTargets=[];handleNid(reporter);G.sel=null;renderBoard();finishTurn();
}


/* ═══════════════════════════════════════════
   GESTION DES TOURS
   ═══════════════════════════════════════════ */
function finishTurn(){
  if(G.over)return;
  G.sel=null;G.phase='select';G.lastActor=cur();
  checkStalemates();if(G.over)return;
  if(checkWin())return;

  // Sauvegarder l'état après chaque coup
  saveGame();

  // Avancer le compteur de tour seulement si on ne reprend pas après une spirale SP
  if (!G.spResuming) { G.turn++; _gameTurns++; }
  const justPlayed = cur();
  const twoPlayer = (G.order.length <= 2);

  // Résurrection automatique : pièces mortes avec SP actif au moment de la mort
  checkGhostResurrections();

  const nidCell=G.board[LAB.r][LAB.c];
  const nidColor=(nidCell&&!nidCell.dead&&nidCell.type==='chef'&&G.order.includes(nidCell.color)&&G.players[nidCell.color]&&G.players[nidCell.color].alive)?nidCell.color:null;
  if(nidColor!==G.labActive){G.labActive=nidColor;G.labExtra=-1;}

  // Vérifier fin de pacte et déclencher super pouvoirs
  // (après G.turn++ pour que _resumeAfterSP reprenne avec le bon état)
  checkPactEnd();
  if (checkSPTrigger()) return; // SP en cours — finishTurn sera repris par _resumeAfterSP

  if(twoPlayer){
    if(G.labActive===justPlayed&&G.labExtra===-1){
      G.labExtra=1;
      launchCurrentTeam();
      return;
    }
    if(G.labExtra===1&&G.labActive===justPlayed){G.labExtra=-1;}
  } else {
    if(G.labActive){
      const nidIdx=G.order.indexOf(G.labActive);
      if(justPlayed===G.labActive){
        const lastOpponentIdx = G.labExtra >= 0 ? G.labExtra : (nidIdx + G.order.length - 1) % G.order.length;
        let nextIdx = (lastOpponentIdx + 1) % G.order.length;
        if(nextIdx === nidIdx) nextIdx = (nextIdx + 1) % G.order.length;
        G.labExtra = nextIdx;
        G.idx = nextIdx;
        launchCurrentTeam();
        return;
      } else {
        G.labExtra = G.order.indexOf(justPlayed);
        G.idx = nidIdx;
        launchCurrentTeam();
        return;
      }
    }
  }

  G.idx=(G.idx+1)%G.order.length;
  launchCurrentTeam();
}


/* ═══════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════ */
let _toastTimer;
function toast(msg){
  document.querySelectorAll('.toast').forEach(e=>e.remove()); clearTimeout(_toastTimer);
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);_toastTimer=setTimeout(()=>t.remove(),2800);
}


