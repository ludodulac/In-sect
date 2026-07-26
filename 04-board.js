/* ===============================================================
   IN-SECT — BOARD — Initialisation partie, dessin du plateau et des pieces
   Module 04-board.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

/* ═══════════════════════════════════════════
   [GAME] — Initialisation
   ═══════════════════════════════════════════ */
function startGame() {
  // startGame() est appelé APRÈS vérification dans tryStartGame()
  const humanColor = resolveColor();
  const activeColors = _mode === 1 ? ['yellow','red'] : ['yellow','green','red','blue'];
  _uid = 0; _animating = false; _gameTurns = 0; _gameCaps = 0; _moveLog = [];
  if (_aiTimer) clearTimeout(_aiTimer);
  assignPersonalities(activeColors.filter(c => c !== humanColor));

  G = {
    human: humanColor, mode1: (_mode === 1),
    board: Array.from({length:9}, () => Array(9).fill(null)),
    players: {}, order: [...activeColors], idx: 0,
    sel: null, phase: 'select',
    pendCorpse: null, pendDisp: null, pendDispType: null, afterCorpse: null,
    repTargets: [],
    labActive: null, labExtra: -1,
    turn: 0, over: false, lastActor: null,
    // Super pouvoirs
    spCells: {},          // { "r,c": true } — cases avec aura en attente
    spPieces: {},         // { pieceId: superPowerType }
    spNextTrigger: 10,    // prochain déclenchement (tous les 10 coups)
    queenMovHistory: {},  // filet de sécurité pat
    pendNecroColor: null, // couleur cible pour la résurrection
  };

  for (const c of activeColors) {
    G.players[c] = { color:c, human:(c === humanColor), pieces:[], alive:true };
    for (const sp of START[c]) {
      const p = { id:_uid++, color:c, type:sp.t, r:sp.r, c:sp.c, dead:false };
      G.players[c].pieces.push(p);
      G.board[sp.r][sp.c] = p;
    }
  }

  showScreen('game');
  buildBoard(); renderBoard(); updateTurnUI();
  stopBGM(); setTimeout(() => playBGM(), 150);

  // Message de bienvenue dans info-zone
  const humanCol = CNAME_SHORT[humanColor] || humanColor;
  const welcomeDesc = _mode === 1
    ? `Vous dirigez la colonie <b style="color:${CCSS[humanColor]}">${humanCol}</b>. Sélectionnez une pièce pour voir ses mouvements possibles. Protégez votre Reine !`
    : `Vous dirigez la colonie <b style="color:${CCSS[humanColor]}">${humanCol}</b>. 3 colonies adverses vous affrontent. Éliminez leurs Reines pour survivre !`;
  showInfoText('⚔️ La bataille commence…', welcomeDesc, CCSS[humanColor]);

  // Afficher la zone bas dans les deux modes
  const bz = document.getElementById('bottom-zone');
  if (bz) bz.style.display = 'flex';
  const pactRow = document.getElementById('btog-pact-row');
  if (pactRow) pactRow.style.display = 'none';
  updateToggleUI();

  // Lancer le pacte automatiquement dès le début (mode 3 IA)
  initPactIfNeeded();

  if (!isHuman()) {
    _aiTimer = setTimeout(() => aiTurn(finishTurn), 900);
  }
  sfxStart();
}


/* ═══════════════════════════════════════════
   BOARD — Dessin des pièces
   ═══════════════════════════════════════════ */
const CFILL  = { yellow:'#E8B820', green:'#20C050', blue:'#2878FF', red:'#EE2040' };
const CGLOW2 = { yellow:'rgba(232,184,32,.7)', green:'rgba(32,192,80,.7)', blue:'rgba(40,120,255,.7)', red:'rgba(238,32,64,.7)' };

// Cache des images PNG pour éviter de les recharger à chaque frame
const _imgCache = {};
function _loadImg(src) {
  if (_imgCache[src]) return _imgCache[src];
  const img = new Image(); img.src = src;
  _imgCache[src] = img;
  return img;
}

function drawPiece(cv, color, sym, dead, selected) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height, cx = w/2, cy = h/2, r = w*.44;
  ctx.clearRect(0, 0, w, h);

  // Cercle de fond coloré (vivant) ou grisé (mort)
  if (dead) {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle = 'rgba(30,30,50,.7)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = w*.06; ctx.stroke();
  } else {
    const grd = ctx.createRadialGradient(cx-r*.2, cy-r*.25, r*.05, cx, cy, r);
    const fc = CFILL[color] || '#888';
    grd.addColorStop(0, lighten(fc,.38));
    grd.addColorStop(.55, fc);
    grd.addColorStop(1, darken(fc,.32));
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = lighten(fc,.55); ctx.lineWidth = w*.025; ctx.stroke();
    if (selected) {
      ctx.beginPath(); ctx.arc(cx,cy,r+w*.07,0,Math.PI*2);
      ctx.strokeStyle = CGLOW2[color] || 'rgba(255,255,255,.9)'; ctx.lineWidth = w*.055; ctx.stroke();
    }
  }

  // Image PNG — légèrement réduite pour respirer dans le disque
  const img = _loadImg(sym);
  const imgSize = w * 0.92;
  const imgX = (w - imgSize) / 2;
  const imgY = (h - imgSize) / 2;

  if (dead) ctx.globalAlpha = 0.35;

  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
  } else {
    img.onload = () => { try { drawPiece(cv, color, sym, dead, selected); } catch(e){} };
  }
  ctx.globalAlpha = 1;
}

function lighten(hex, amt) { return adjustColor(hex,  amt); }
function darken(hex, amt)  { return adjustColor(hex, -amt); }
function adjustColor(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.min(255, Math.max(0, Math.round(r+255*amt)));
  g = Math.min(255, Math.max(0, Math.round(g+255*amt)));
  b = Math.min(255, Math.max(0, Math.round(b+255*amt)));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function buildBoard() {
  const el = document.getElementById('board'); el.innerHTML = ''; _boardBuilt = false;
  const cs = getCellSize(), sz = 9*cs;
  el.style.width = sz+'px'; el.style.height = sz+'px';
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const cell = document.createElement('div');
    const isLab = (r === LAB.r && c === LAB.c);
    cell.id = `cell-${r}-${c}`;
    cell.className = 'cell ' + (isLab ? 'lab' : ((r+c)%2===0?'l':'d'));
    cell.style.cssText = `left:${c*cs}px;top:${r*cs}px;width:${cs}px;height:${cs}px`;
    if (isLab) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 100 100'); svg.classList.add('labsvg');
      svg.innerHTML = '<circle cx="50" cy="50" r="30" fill="none" stroke="#D4A820" stroke-width="6"/><line x1="50" y1="20" x2="50" y2="80" stroke="#D4A820" stroke-width="3.5"/><line x1="20" y1="50" x2="80" y2="50" stroke="#D4A820" stroke-width="3.5"/>';
      cell.appendChild(svg);
    }
    cell.addEventListener('click', () => humanClickCell(r,c));
    el.appendChild(cell);
  }
  const psize = cs * 1.0, offset = 0;
  for (const c of G.order) {
    for (const p of G.players[c].pieces) {
      const pe = document.createElement('div');
      pe.id = 'p'+p.id; pe.className = `piece ${p.color}`;
      pe.style.cssText = `left:${p.c*cs+offset}px;top:${p.r*cs+offset}px;width:${psize}px;height:${psize}px;--anim:${ANIM_MS}ms`;
      const cv = document.createElement('canvas');
      const dpr = window.devicePixelRatio||1;
      cv.width = Math.round(psize*dpr); cv.height = Math.round(psize*dpr);
      cv.style.width = psize+'px'; cv.style.height = psize+'px';
      pe.appendChild(cv);
      drawPiece(cv, p.color, SYM[p.type], p.dead, false);
      pe.addEventListener('click', e => { e.stopPropagation(); humanClickCell(p.r,p.c); });
      el.appendChild(pe);
    }
  }
  _boardBuilt = true;
}

function renderBoard() {
  if (!_boardBuilt) return;
  const cs = getCellSize();
  const hl = {};
  if (G.sel && G.phase === 'select') {
    const acts = getActionsWithSP(G.sel);
    for (const m of acts.moves)  hl[`${m.r},${m.c}`] = 'vm';
    for (const k of acts.kills)  hl[`${k.r},${k.c}`] = 'vk';
    for (const d of acts.diplT)  hl[`${d.r},${d.c}`] = 'vd';
    for (const n of acts.necroT) hl[`${n.r},${n.c}`] = 'vd';
  }
  if (G.phase === 'nid-bonus' && G._nidBonusMoves) {
    for (const m of G._nidBonusMoves) hl[`${m.r},${m.c}`] = 'vm';
  }
  if (G.phase === 'reporter-choose') {
    for (const t of G.repTargets) hl[`${t.r},${t.c}`] = t.ortho ? 'vrep-o' : 'vrep-d';
  }
  if (G.phase === 'place-corpse' || G.phase === 'place-necro' || G.phase === 'place-dipl' || G.phase === 'place-resurrect') {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (!G.board[r][c] || G.board[r][c].dead) hl[`${r},${c}`] = 'vplace';
    }
  }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const cell = document.getElementById(`cell-${r}-${c}`); if (!cell) continue;
    const isLab = (r===LAB.r && c===LAB.c);
    const base  = isLab ? 'lab' : ((r+c)%2===0?'l':'d');
    const hcls  = hl[`${r},${c}`] || '';
    const selcls = (G.sel&&G.sel.r===r&&G.sel.c===c&&G.phase==='select') ? 'sc' : '';
    const spAura = (G.spCells && G.spCells[`${r},${c}`]) ? 'sp-aura' : '';
    cell.className = `cell ${base} ${hcls} ${selcls} ${spAura}`.trim();
  }
  const allPieces = [];
  for (const c of G.order) for (const p of G.players[c].pieces) allPieces.push(p);
  for (const c in G.players) if (!G.players[c].alive) for (const p of G.players[c].pieces) if (!allPieces.includes(p)) allPieces.push(p);
  for (const p of allPieces) {
    const pe = document.getElementById('p'+p.id); if (!pe) continue;
    const onBoard = inB(p.r, p.c);
    pe.style.display = onBoard ? 'block' : 'none';
    if (!onBoard) continue;
    const psize = cs * 1.0, offset = 0;
    if (!pe.classList.contains('moving')) {
      pe.style.left = (p.c*cs+offset)+'px';
      pe.style.top  = (p.r*cs+offset)+'px';
    }
    const isSel = G.sel && G.sel.id === p.id;
    const hasSP = G.spPieces && G.spPieces[p.id];
    const isGhost = hasSP && hasSP.ghost; // dépouille avec SP en attente de résurrection
    pe.className = `piece ${p.color}${isSel?' selp':''}${hasSP?' has-sp':''}${isGhost?' ghost-sp':''}`;
    pe.style.width = psize+'px'; pe.style.height = psize+'px';
    const cv = pe.querySelector('canvas');
    if (cv) drawPiece(cv, p.color, SYM[p.type], p.dead, isSel);
    if (isSel)       pe.style.filter = `drop-shadow(0 0 8px ${CGLOW2[p.color]||'#fff'}) brightness(1.15)`;
    else if (isGhost) pe.style.filter = `drop-shadow(0 0 6px #C080FF) drop-shadow(0 0 3px #C080FF)`; // aura violette sur dépouille
    else if (p.dead)  pe.style.filter = 'none';
    else              pe.style.filter = `drop-shadow(0 0 4px ${CGLOW2[p.color]||'rgba(255,255,255,.3)'})`;
  }
  renderPlayers(); updateTurnUI();
}

function renderPlayers() {
  // Cartes joueurs désactivées — tableau supprimé
}

function updateTurnUI() {
  const c = cur(); if (!c) return;
  const pl = G.players[c];
  // Topbar dot coloré
  const tdot = document.getElementById('tdot');
  if (tdot) { tdot.style.background = CCSS[c]; tdot.style.boxShadow = `0 0 6px ${CCSS[c]}`; }
  const tban = document.getElementById('tban');
  if (tban) { tban.style.borderColor = CCSS[c]+'44'; tban.style.boxShadow = `0 0 14px ${CGLOW[c]}`; }
  // Barre de tour (bas)
  const tdot2 = document.getElementById('turn-dot');
  const ttxt  = document.getElementById('turn-txt');
  if (tdot2) { tdot2.style.background = CCSS[c]; tdot2.style.boxShadow = `0 0 6px ${CCSS[c]}`; }
  if (ttxt)  { ttxt.textContent = `Tour ${CNAME[c]}${pl.human?' — À vous !':''}`; ttxt.style.color = CCSS[c]; }
  // Badge mode
  const modeBadge = document.getElementById('mode-badge');
  if (modeBadge) {
    const modeLabels = { 1:'⚪ Basic', 2:'🟡 Tactique', 3:'🔴 Expert' };
    modeBadge.textContent = modeLabels[_aiLevel] || '';
  }
  // Message de phase dans info-zone
  const phases = {
    'place-corpse':    '💀 Placez la dépouille sur une case libre',
    'place-dipl':      '🐞 Déposez la pièce sur une case vide',
    'place-necro':     '🪲 Déposez la dépouille sur une case libre',
    'place-resurrect': '✨ Choisissez une case\npour ressusciter cette pièce',
    'reporter-choose': '🪰 Choisissez : ortho 🔴 ou diag 🟠',
    'nid-bonus':       '👑 Quittez le Nid Sacré — choisissez votre case',
  };
  const msg = phases[G.phase] || '';
  setInfoPhase(msg);
}

// Stocke le contenu en attente pour le modal d'explication
let _pieceExplainTitle = '';
let _pieceExplainBody  = '';

function _setExplainBtn(label, title, body) {
  _pieceExplainTitle = title;
  _pieceExplainBody  = body;
  const btn  = document.getElementById('btn-piece-explain');
  const nm   = document.getElementById('bpe-name');
  if (nm)  nm.textContent = label;
  if (btn) btn.style.display = '';
}

function updatePieceInfo(piece) {
  const sp        = G.spPieces && G.spPieces[piece.id];
  const pieceName = PFULL[piece.type] || PNAME[piece.type];
  if (sp) {
    // Pièce avec SP : le bouton affiche le nom du SP
    const spLabel = SP_LABEL[sp.type] || pieceName;
    const spBody  = `<b style="color:#C080FF;">${SP_LABEL[sp.type] || 'Super Pouvoir'}</b><br><br>${SP_DESC[sp.type]}${sp.type==='invincible' ? '<br><br><span style="color:#FFB830;">'+sp.turns+' tours restants</span>' : ''}`;
    _setExplainBtn(spLabel, spLabel, spBody);
  } else {
    // Pièce normale : le bouton affiche le nom de la pièce
    _setExplainBtn(pieceName, pieceName, PDESC[piece.type] || '');
  }
}

function resetTopbar() {
  const btn = document.getElementById('btn-piece-explain');
  if (btn) btn.style.display = 'none';
}

function openPieceExplainModal() {
  const title = document.getElementById('piece-explain-title');
  const body  = document.getElementById('piece-explain-body');
  if (title) title.textContent = _pieceExplainTitle;
  if (body)  body.innerHTML   = _pieceExplainBody;
  showModal('piece-explain');
}

function showInfoText(name, desc, color) {
  // Pour le Nid Sacré et messages contextuels avec description longue
  if (desc && desc.length > 30) {
    _setExplainBtn(name, name, desc);
  } else {
    resetTopbar();
  }
}

function setInfoDesc(html) {
  if (html) _pieceExplainBody = html;
}

let _capsuleTimer = null;
function setInfoPhase(msg) {
  const cap = document.getElementById('action-capsule');
  if (!cap) return;
  clearTimeout(_capsuleTimer);
  if (msg) {
    cap.innerHTML = msg;
    cap.classList.add('visible');
  } else {
    cap.classList.remove('visible');
    cap.innerHTML = '';
  }
}


/* ═══════════════════════════════════════════
   BOARD HELPERS
   ═══════════════════════════════════════════ */
function bset(r,c,v)         { if (inB(r,c)) G.board[r][c] = v; }
function movePiece(piece,tr,tc) { bset(piece.r,piece.c,null); piece.r=tr; piece.c=tc; bset(tr,tc,piece); }
function removeFromBoard(piece) { if (inB(piece.r,piece.c)&&G.board[piece.r][piece.c]===piece) G.board[piece.r][piece.c]=null; piece.r=-1; piece.c=-1; }
function placeOnBoard(piece,r,c) { piece.r=r; piece.c=c; bset(r,c,piece); }

function animMove(piece,tr,tc) {
  return new Promise(res => {
    _animating = true;
    const pe = document.getElementById('p'+piece.id);
    if (!pe) { movePiece(piece,tr,tc); _animating=false; res(); return; }
    pe.classList.add('moving');
    const cs = getCellSize(), psize = cs * 1.0, offset = 0;
    pe.style.left = (tc*cs+offset)+'px'; pe.style.top = (tr*cs+offset)+'px';
    sfxMove();
    setTimeout(() => { pe.classList.remove('moving'); movePiece(piece,tr,tc); _animating=false; res(); }, ANIM_MS+30);
  });
}

function boardShake() {
  const f = document.getElementById('bframe'); if (!f) return;
  f.classList.add('shake'); setTimeout(() => f.classList.remove('shake'), 400);
}
function screenFlash(type) {
  const d = document.createElement('div'); d.className = 'cap-flash';
  d.style.background = type==='queen' ? 'rgba(255,20,20,.25)' : 'rgba(128,80,255,.18)';
  document.body.appendChild(d); setTimeout(() => d.remove(), 300);
}
function getPiecePos(piece) {
  const be = document.getElementById('board'); if (!be) return null;
  const br = be.getBoundingClientRect(), cs = getCellSize();
  return { x: br.left+piece.c*cs+cs/2, y: br.top+piece.r*cs+cs/2 };
}


