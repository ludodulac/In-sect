/* ===============================================================
   IN-SECT — POWERS — Toggles, Super Pouvoirs
   Module 07-powers.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

/* ═══════════════════════════════════════════
   [BOOT] — Démarrage de l'application
   Tout dans DOMContentLoaded pour éviter que
   FX.init() plante si le DOM n'est pas prêt.
   ═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   [TOGGLES] — Options de jeu pendant la partie
   ═══════════════════════════════════════════ */
function updateToggleUI() {
  const cs = document.getElementById('btog-check-sp');
  if (cs) cs.classList.toggle('on', _optSP);
}

function handlePactToggleClick() {} // Pacte supprimé
function handleSPToggleClick(e) {
  showInfoText('✨ Super pouvoirs',
    'Tous les 10 coups, une spirale désigne une case. La pièce présente reçoit un super pouvoir (halo violet). Case vide = pouvoir en attente. Pièce tuée = pouvoir perdu.',
    '#C080FF');
}


/* ═══════════════════════════════════════════
   [PACT] — Pacte supprimé
   ═══════════════════════════════════════════ */
const CNAME_SHORT = { yellow:'Jaune', green:'Vert', blue:'Bleu', red:'Rouge' };

function isPactBlocked(attackerColor, victimColor) { return false; }
function checkPactEnd() {}
function initPactIfNeeded() {}
function toggleSPOption() {
  _optSP = !_optSP;
  updateToggleUI();
  showInfoText('✨ Super pouvoirs', _optSP ? 'Super pouvoirs activés.' : 'Super pouvoirs désactivés.', '#C080FF');
}


/* ═══════════════════════════════════════════
   [SP] — Super Pouvoirs
   ═══════════════════════════════════════════ */
const SP_TYPES = {
  militant:    'queen-move',
  reporter:    'area-kill',
  diplomate:   'resurrect',
  assassin:    'double-kill',
  chef:        'invincible',
  necromobile: 'free-move-corpse',
};
const SP_DESC = {
  'queen-move':       'La Fourmi se déplace désormais comme une Reine (portée illimitée) !',
  'area-kill':        'La Mouche tue maintenant dans les 8 directions autour d\'elle !',
  'resurrect':        'La Coccinelle peut ressusciter n\'importe quelle dépouille — elle rejoint sa colonie !',
  'double-kill':      'L\'Araignée peut tuer deux pièces à la fois dans la même ligne !',
  'invincible':       'La Reine est invincible pendant 4 coups !',
  'free-move-corpse': 'Le Scarabée peut déplacer n\'importe quelle dépouille du plateau vers n\'importe quelle case vide !',
};
const SP_LABEL = {
  'queen-move':       'Portée Reine ✨',
  'area-kill':        'Zone Totale ✨',
  'resurrect':        'Résurrection ✨',
  'double-kill':      'Double Kill ✨',
  'invincible':       'Invincibilité ✨',
  'free-move-corpse': 'Déplacement Libre ✨',
};

function checkSPTrigger() {
  if (!_optSP) return false;
  if (_gameTurns < G.spNextTrigger) return false;
  G.spNextTrigger += 10;
  launchSPAnimation();
  return true; // signale à finishTurn de ne pas continuer
}

function launchSPAnimation() {
  const targetR = Math.floor(Math.random() * 9);
  const targetC = Math.floor(Math.random() * 9);
  const spiralOrder = buildSpiralOrder();
  const targetIdx = spiralOrder.findIndex(([r,c]) => r === targetR && c === targetC);

  // Durée totale : 3000ms répartis sur ~60 frames + ralentissement final
  const TOTAL_MS = 3000;
  const FAST_FRAMES = 50;   // 50 frames rapides (50ms chacune = 2.5s)
  const SLOW_FRAMES = targetIdx + 1; // frames finales pour s'arrêter sur la cible

  // Délais : rapide au début (30ms), ralentit vers la fin (150ms)
  const delays = [];
  for (let i = 0; i < FAST_FRAMES; i++) delays.push(30);
  const remainMs = TOTAL_MS - FAST_FRAMES * 30;
  for (let i = 0; i < SLOW_FRAMES; i++) {
    const p = i / Math.max(1, SLOW_FRAMES - 1);
    delays.push(Math.round(30 + p * (remainMs / Math.max(1, SLOW_FRAMES) * 2.5)));
  }

  // Message dans info-phase
  setInfoPhase(`<span class="sp-spin-msg">✨ Spirale du Super Pouvoir ✨</span>`);
  sfxSPSpiral();

  let frame = 0;
  let lastCell = null;

  // Injecter style highlight si absent
  if (!document.getElementById('sp-spin-style')) {
    const s = document.createElement('style');
    s.id = 'sp-spin-style';
    s.textContent = `.sp-hl{background:rgba(255,255,255,.85)!important;box-shadow:inset 0 0 0 2px #fff,0 0 18px rgba(255,255,255,.9),0 0 8px rgba(200,150,255,.8)!important;}`;
    document.head.appendChild(s);
  }

  function step() {
    if (G.over) { cleanup(); return; }
    if (lastCell) lastCell.classList.remove('sp-hl');

    const isLastPhase = frame >= FAST_FRAMES;
    const localIdx = isLastPhase ? (frame - FAST_FRAMES) : (frame % spiralOrder.length);
    const [r, c] = spiralOrder[localIdx % spiralOrder.length];
    const cell = document.getElementById(`cell-${r}-${c}`);
    if (cell) { cell.classList.add('sp-hl'); lastCell = cell; }

    frame++;
    const delay = delays[frame] || 150;

    if (isLastPhase && (frame - FAST_FRAMES) >= SLOW_FRAMES) {
      if (lastCell) lastCell.classList.remove('sp-hl');
      const finalCell = document.getElementById(`cell-${targetR}-${targetC}`);
      if (finalCell) {
        finalCell.classList.add('sp-hl');
        setTimeout(() => { finalCell.classList.remove('sp-hl'); cleanup(); onSPLand(targetR, targetC); }, 600);
      } else { cleanup(); onSPLand(targetR, targetC); }
      return;
    }
    setTimeout(step, delay);
  }

  function cleanup() {
    setInfoPhase('');
    document.querySelectorAll('.sp-hl').forEach(c => c.classList.remove('sp-hl'));
  }

  step();
}

function buildSpiralOrder() {
  // Spirale depuis le centre (4,4) vers l'extérieur
  const visited = Array.from({length:9}, () => Array(9).fill(false));
  const order = [];
  let r = 4, c = 4;
  // Directions : droite, bas, gauche, haut
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  let dir = 0, steps = 1, turned = 0;
  order.push([r,c]); visited[r][c] = true;
  let moves = 0;
  while (order.length < 81) {
    const [dr,dc] = dirs[dir % 4];
    const nr = r+dr, nc = c+dc;
    if (!inB(nr,nc) || visited[nr][nc]) {
      dir++; turned++;
      if (turned === 2) { turned = 0; steps++; }
      continue;
    }
    r = nr; c = nc;
    visited[r][c] = true;
    order.push([r,c]);
    moves++;
    if (moves === steps) { moves = 0; dir++; turned++; if (turned === 2) { turned = 0; steps++; } }
  }
  // Si l'ordre ne contient pas toutes les cases (spirale non idéale), compléter
  for (let rr=0;rr<9;rr++) for (let cc=0;cc<9;cc++) if (!visited[rr][cc]) order.push([rr,cc]);
  return order;
}

function onSPLand(r, c) {
  const piece = G.board[r][c];
  if (piece && !piece.dead) {
    // Pièce présente — elle reçoit le super pouvoir
    const spType = SP_TYPES[piece.type];
    if (spType) {
      G.spPieces[piece.id] = { type: spType, turns: spType === 'invincible' ? 4 : Infinity };
      // Aura permanente sur la case supprimée — aura sur la pièce
      renderBoard();
      const pEl = document.getElementById('p' + piece.id);
      if (pEl) pEl.classList.add('has-sp');
      showSPResult(piece, spType);
    }
  } else {
    const corpse = G.board[r][c]; // peut être une dépouille
    if (corpse && corpse.dead) {
      // Dépouille présente — elle obtient le SP et rejoint la file de résurrection
      const spType = SP_TYPES[corpse.type];
      if (spType) {
        if (!G.ghostQueue) G.ghostQueue = [];
        const reviveTurn = G.turn + 30;
        G.ghostQueue.push({ piece: corpse, reviveTurn });
        G.spPieces[corpse.id] = { type: spType, turns: spType === 'invincible' ? 4 : Infinity, ghost: true };
        renderBoard();
        const pEl = document.getElementById('p' + corpse.id);
        if (pEl) { pEl.classList.add('has-sp', 'ghost-sp'); }
        showInfoText('👻 Dépouille chargée !',
          `La dépouille de <b style="color:${CCSS[corpse.color]}">${PNAME_SHORT[corpse.type]} ${COLOR_FR[corpse.color]}</b> a reçu un super pouvoir — elle ressuscitera dans <b>30 coups</b> !`,
          '#C080FF');
      }
      G.spPaused = false;
      _animating = false;
      _resumeAfterSP();
    } else {
      // Case vide — aura en attente
      G.spCells[`${r},${c}`] = true;
      G.spPaused = false;
      _animating = false;
      renderBoard();
      showInfoText('✨ Super pouvoir en attente',
        `Cette case est chargée d'énergie — la première pièce à s'y poser reçoit un super pouvoir !`,
        '#C080FF');
      _resumeAfterSP();
    }
  }
}

function showSPResult(piece, spType) {
  const name = PNAME[piece.type];
  const col  = CCSS[piece.color];
  G.spPaused = true;
  _animating = true;
  let modal = document.getElementById('modal-sp-result');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-sp-result';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box modal-box--small">
      <div class="modal-header"><div class="modal-title">✨ SUPER POUVOIR</div></div>
      <div class="modal-body" style="text-align:center;gap:12px;">
        <div id="sp-result-text" style="font-size:.88rem;color:var(--text);line-height:1.6;"></div>
        <button class="btn-primary" style="height:40px;font-size:.82rem;" onclick="closeSPResult()">OK !</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  const txt = document.getElementById('sp-result-text');
  if (txt) txt.innerHTML =
    `<b style="color:${col}">${name}</b> de la colonie <b style="color:${col}">${CNAME_SHORT[piece.color]}</b><br>a reçu un super pouvoir !<br><br>` +
    `<b style="color:#C080FF;">✨ ${SP_DESC[spType]}</b>`;
  modal.classList.remove('hidden');
  // Toujours attendre le clic OK — humain comme IA
}

function closeSPResult() {
  const modal = document.getElementById('modal-sp-result');
  if (modal) modal.classList.add('hidden');
  G.spPaused = false;
  _animating = false;
  // Reprendre le tour là où finishTurn s'était arrêté
  _resumeAfterSP();
}

function _resumeAfterSP() {
  if (G.over) return;
  G.spPaused = false;
  _animating = false;
  G.spResuming = true; // flag : finishTurn ne doit pas refaire G.turn++
  finishTurn();
  G.spResuming = false;
}

// Vérifie si une case vide avec aura reçoit une pièce
function checkSPCellCapture(piece, r, c) {
  const key = `${r},${c}`;
  if (!G.spCells[key]) return false;
  delete G.spCells[key];
  const spType = SP_TYPES[piece.type];
  if (spType) {
    G.spPieces[piece.id] = { type: spType, turns: spType === 'invincible' ? 4 : Infinity };
    renderBoard();
    const pEl = document.getElementById('p' + piece.id);
    if (pEl) pEl.classList.add('has-sp');
    const pc = CCSS[piece.color];
    const pn = `<b style="color:${pc}">${PNAME_SHORT[piece.type]} ${COLOR_FR[piece.color]}</b>`;
    const spLabel = SP_DESC[spType] ? SP_DESC[spType].split('!')[0] : spType;
    logMove({ color: pc, text: `✨ ${pn} obtient un super pouvoir : ${spLabel} !` });
    // spPaused + _animating : bloque finishTurn jusqu'à closeSPResult → _resumeAfterSP
    G.spPaused = true; _animating = true;
    G.lastActor = cur(); // mémoriser qui vient de jouer avant que _resumeAfterSP avance
    showSPResult(piece, spType);
    return true; // signale à l'appelant de NE PAS appeler finishTurn
  }
  return false;
}

// tickSPTurns — décrémente l'invincibilité uniquement quand la reine invincible joue elle-même
function tickSPTurns(piece) {
  const sp = G.spPieces[piece.id];
  if (!sp || sp.type !== 'invincible') return;
  sp.turns--;
  if (sp.turns <= 0) {
    delete G.spPieces[piece.id];
    const pEl = document.getElementById('p' + piece.id);
    if (pEl) pEl.classList.remove('has-sp');
    showInfoText('⚔️ Invincibilité expirée',
      `La Reine <b style="color:${CCSS[piece.color]}">${CNAME_SHORT[piece.color]}</b> n'est plus invincible !`,
      CCSS[piece.color]);
  }
}

// Vérifie si une pièce est invincible
function isInvincible(piece) {
  const sp = G.spPieces[piece.id];
  return sp && sp.type === 'invincible' && sp.turns > 0;
}


/* ═══════════════════════════════════════════
   [SP] — Surcharge des règles de mouvement
   ═══════════════════════════════════════════ */

// Version augmentée de getActions qui tient compte des super pouvoirs
function getActionsWithSP(piece) {
  const sp = G.spPieces[piece.id];
  const base = getActions(piece);

  if (!sp) return base;

  switch (sp.type) {
    case 'queen-move': {
      // Fourmi → se déplace comme une Reine (getLinear)
      const queenLike = getLinear(piece);
      // Fusionner moves et kills
      const moves = [...new Set([...base.moves.map(m=>`${m.r},${m.c}`), ...queenLike.moves.map(m=>`${m.r},${m.c}`)])].map(k=>{const[r,c]=k.split(',').map(Number);return{r,c};});
      const kills = [...base.kills, ...queenLike.kills.filter(k=>!base.kills.some(b=>b.r===k.r&&b.c===k.c))];
      return { moves, kills, diplT: base.diplT, necroT: base.necroT };
    }
    case 'resurrect': {
      // Coccinelle SP → peut choisir n'importe quelle dépouille sur le plateau pour la ressusciter dans sa colonie
      const corpseTargets = [];
      for (let rr=0;rr<9;rr++) for (let cc=0;cc<9;cc++) {
        const t = G.board[rr][cc];
        if (t && t.dead) corpseTargets.push({r:rr,c:cc,p:t});
      }
      return { moves: base.moves, kills: base.kills, diplT: base.diplT, necroT: corpseTargets, resurrectMode: true };
    }
    case 'free-move-corpse': {
      // Scarabée SP → peut choisir n'importe quelle dépouille sur le plateau et la déplacer librement
      // Le SP consomme le tour entier : pas de mouvement normal en plus
      const corpseTargets = [];
      for (let rr=0;rr<9;rr++) for (let cc=0;cc<9;cc++) {
        const t = G.board[rr][cc];
        if (t && t.dead) corpseTargets.push({r:rr,c:cc,p:t});
      }
      return { moves: [], kills: base.kills, diplT: base.diplT, necroT: corpseTargets, freeMoveCorpse: true };
    }
    case 'area-kill': {
      // Mouche → tue dans les 8 directions (pas seulement l'ortho ou la diag choisie)
      // On garde les moves de base, kills reste vide (la mouche ne tue qu'en se posant)
      return base;
    }
    default:
      return base;
  }
}

// Exécution du double kill de l'araignée
function executeDoubleKill(piece, victim, fromR, fromC) {
  // Tuer la première victime normalement
  const dir = [victim.r - fromR, victim.c - fromC];
  const len = Math.max(Math.abs(dir[0]), Math.abs(dir[1]));
  if (len === 0) return false;
  const dr = dir[0] / len, dc = dir[1] / len;
  // Chercher une 2e pièce ennemie derrière la victime dans la même direction
  let nr = victim.r + dr, nc = victim.c + dc;
  let second = null;
  while (inB(nr, nc)) {
    const t = G.board[nr][nc];
    if (!t) { nr+=dr; nc+=dc; continue; }
    if (t.dead) break;
    if (t.color !== piece.color) { second = t; break; }
    break;
  }

  // Dépouille 1 → retourne à fromR,fromC (là où était l'araignée)
  victim.dead = true; _gameCaps++;
  const pos1 = getPiecePos(victim); if(pos1) FX.spawn(pos1.x,pos1.y,victim.color);
  sfxCapture(); boardShake();
  removeFromBoard(victim);
  placeOnBoard(victim, fromR, fromC);

  if (second) {
    second.dead = true; _gameCaps++;
    const pos2 = getPiecePos(second); if(pos2) FX.spawn(pos2.x,pos2.y,second.color);
    // Dépouille 2 → une case à côté de fromR,fromC en direction de l'araignée
    const d2r = fromR + dr, d2c = fromC + dc;
    removeFromBoard(second);
    if (inB(d2r,d2c) && !G.board[d2r][d2c]) {
      placeOnBoard(second, d2r, d2c);
    } else {
      // Fallback : chercher une case libre proche
      const cell = pickFreeCell(true);
      if (cell) placeOnBoard(second, cell.r, cell.c);
    }
    if (second.type === 'chef') { elimPlayer(second.color, piece.color); return true; }
  }
  if (victim.type === 'chef') { elimPlayer(victim.color, piece.color); }
  return true;
}

// Exécution du super pouvoir mouche (area kill étendu)
function execReporterAreaKill(reporter) {
  // Tuer dans les 8 directions
  for (const [dr,dc] of DIRS8) {
    const nr = reporter.r+dr, nc = reporter.c+dc; if(!inB(nr,nc)) continue;
    const t = G.board[nr][nc];
    if (t && !t.dead && t.color !== reporter.color && !isInvincible(t)) {
      t.dead = true; _gameCaps++;
      const pos = getPiecePos(t); if(pos) FX.spawn(pos.x,pos.y,t.color);
      const pe = document.getElementById('p'+t.id);
      if(pe){pe.classList.add('flash-kill');setTimeout(()=>{pe.classList.remove('flash-kill');const cv=pe.querySelector('canvas');if(cv)drawPiece(cv,t.color,SYM[t.type],true,false);pe.style.filter='none';pe.style.zIndex='2';},460);}
      if (t.type === 'chef') elimPlayer(t.color, reporter.color);
    }
  }
  sfxCapture(); boardShake();
}


