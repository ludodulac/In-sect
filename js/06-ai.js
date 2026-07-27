/* ===============================================================
   IN-SECT — AI — Moteur intelligence artificielle (niveaux 1/2/3, personnalites)
   Module 06-ai.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

/* ═══════════════════════════════════════════
   [AI] — Moteur d'intelligence artificielle
   ═══════════════════════════════════════════ */
const AI_PERSONALITIES = ['aggressive','opportunist','defensive','manipulator'];
let _aiPersonalities = {};
let _aiDeadline = Infinity; // budget de temps de calcul pour le tour d'IA en cours (garde-fou anti-blocage)

// Assigne une personnalité aléatoire à chaque IA
function assignPersonalities(colors){
  const sh=[...AI_PERSONALITIES].sort(()=>Math.random()-.5);
  colors.forEach((c,i)=>{ _aiPersonalities[c]=sh[i%sh.length]; });
}

function aiTurn(onDone){
  if(G.over)return;
  if(G.spPaused||_animating)return; // Pause SP active — l'IA attend
  const color=cur();
  if(!G.players[color].alive){onDone();return;}
  try{runAI(color,onDone);}catch(e){console.error('AI error',e);renderBoard();onDone();}
}

function runAI(color,onDone){
  let best;
  switch(_aiLevel){
    case 1: best=aiLevel1(color);break;
    case 2: best=aiLevel2(color);break;
    case 3: best=aiLevel3(color);break;
    default:best=aiLevel2(color);
  }
  if(!best){onDone();return;}
  execAIMove(best,color,onDone);
}

function getAllMoves(color){
  const all=[];
  const pieces=G.players[color].pieces.filter(p=>!p.dead&&p.color===color);
  for(const p of pieces){
    const acts=getActionsWithSP(p);
    for(const m of acts.moves){
      all.push({piece:p,type:'move', target:null,toR:m.r,toC:m.c});
      // Pour la Mouche : simuler les kills depuis chaque case de destination
      if(p.type==='reporter'){
        // Sauvegarder position, simuler le déplacement
        const origR=p.r, origC=p.c;
        G.board[origR][origC]=null; p.r=m.r; p.c=m.c; G.board[m.r][m.c]=p;
        const rts=getRepAdj(p);
        G.board[m.r][m.c]=null; p.r=origR; p.c=origC; G.board[origR][origC]=p;
        // Ajouter un coup 'reporter-kill' si au moins une cible ennemie
        for(const rt of rts){
          if(isInvincible(rt.p)) continue;
          // Un coup reporter-kill = "se déplacer en (m.r,m.c) puis tirer dans la direction de rt"
          all.push({piece:p,type:'reporter-kill',target:rt.p,toR:m.r,toC:m.c,isOrtho:rt.ortho});
        }
      }
    }
    for(const k of acts.kills){
      if(isInvincible(k.p)) continue;
      all.push({piece:p,type:'kill', target:k.p, toR:k.r,toC:k.c});
    }
    for(const d of acts.diplT)  all.push({piece:p,type:'dipl', target:d.p, toR:d.r,toC:d.c});
    for(const n of acts.necroT) all.push({piece:p,type:'necro',target:n.p, toR:n.r,toC:n.c});
  }
  return all;
}

// Niveau 1 — basique : bon sens minimal, reste imprévisible
function aiLevel1(color){
  const all=getAllMoves(color);
  if(!all.length) return null;

  // 1. Tuer la Reine ennemie — priorité absolue, la partie finit immédiatement
  const queenKill=all.find(mv=>(mv.type==='kill'||mv.type==='reporter-kill')&&mv.target&&mv.target.type==='chef');
  if(queenKill) return queenKill;

  // 2. Fuir si la propre Reine est en danger immédiat
  const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead);
  if(chef && countThreatsTo(chef.r,chef.c,color)>0){
    const escapes=all.filter(mv=>
      mv.piece.type==='chef' && mv.type==='move' &&
      countThreatsTo(mv.toR,mv.toC,color)===0
    );
    if(escapes.length) return escapes[Math.floor(Math.random()*escapes.length)];
  }

  // 3. Éviter d'envoyer la Reine sur une case menacée
  const safe=all.filter(mv=>
    !(mv.piece.type==='chef' && countThreatsTo(mv.toR,mv.toC,color)>0)
  );
  const pool=safe.length ? safe : all;

  // 4. Aller sur une case aura si le gain est significatif (niveau 1 : 60% de chance de le faire)
  if(Math.random()<0.60){
    const auraMoves=pool.filter(mv=>isAuraCell(mv.toR,mv.toC)&&evalAuraGain(mv.piece,color)>80);
    if(auraMoves.length) return auraMoves[Math.floor(Math.random()*auraMoves.length)];
  }

  // 5. Légère préférence pour les kills (30% de chance)
  if(Math.random()<0.30){
    const kills=pool.filter(mv=>mv.type==='kill');
    if(kills.length) return kills[Math.floor(Math.random()*kills.length)];
  }

  // 5. Sinon : aléatoire dans le pool sûr
  return pool[Math.floor(Math.random()*pool.length)];
}

// Vérifie si une case est une case aura SP
function isAuraCell(r,c){
  return !!(G.spCells && G.spCells[`${r},${c}`]);
}

// Évalue le gain réel d'une case aura pour une pièce donnée dans le contexte actuel
function evalAuraGain(piece, color) {
  if (!G.spCells) return 0;
  const spType = SP_TYPES[piece.type];
  if (!spType) return 0;

  let base = 0;

  switch(spType) {
    case 'invincible': {
      // Reine invincible : vaut beaucoup si elle est menacée, peu si elle est déjà safe
      const threats = countThreatsTo(piece.r, piece.c, color);
      const enemyCount = G.order.filter(c=>c!==color&&G.players[c]&&G.players[c].alive).length;
      base = 120 + threats * 150 + enemyCount * 30;
      break;
    }
    case 'area-kill': {
      // Mouche zone 8 dirs : vaut beaucoup si elle a des ennemis proches à portée
      let nearEnemies = 0;
      for (const ec of G.order) {
        if (ec === color) continue;
        if (!G.players[ec] || !G.players[ec].alive) continue;
        for (const ep of G.players[ec].pieces) {
          if (ep.dead) continue;
          const dr = Math.abs(ep.r - piece.r), dc = Math.abs(ep.c - piece.c);
          if (dr <= 2 && dc <= 2) nearEnemies++;
        }
      }
      base = 100 + nearEnemies * 80;
      break;
    }
    case 'double-kill': {
      // Araignée double kill : vaut beaucoup si plusieurs ennemis sont dans sa ligne
      let killTargets = 0;
      const acts = getActions(piece);
      killTargets = acts.kills.length;
      base = 120 + killTargets * 60;
      break;
    }
    case 'queen-move': {
      // Fourmi portée reine : vaut beaucoup en milieu de partie (mobilité)
      const myPieces = G.players[color].pieces.filter(p=>!p.dead).length;
      base = 100 + (6 - Math.min(myPieces, 6)) * 20; // plus utile si peu de pièces
      break;
    }
    case 'resurrect': {
      // Coccinelle SP ressuscite : vaut beaucoup si des dépouilles sont disponibles
      const myCount = G.players[color].pieces.filter(p=>!p.dead).length;
      const corpseCount = G.order.reduce((n,c)=>{
        if(!G.players[c])return n;
        return n + G.players[c].pieces.filter(p=>p.dead&&G.board[p.r]&&G.board[p.r][p.c]===p).length;
      }, 0);
      base = 60 + (7 - Math.min(myCount, 6)) * 40 + corpseCount * 25;
      break;
    }
    case 'free-move-corpse': {
      // Scarabée SP déplacement libre : vaut si des dépouilles bloquantes existent
      const corpseCount = G.order.reduce((n,c)=>{
        if(!G.players[c])return n;
        return n + G.players[c].pieces.filter(p=>p.dead&&G.board[p.r]&&G.board[p.r][p.c]===p).length;
      }, 0);
      base = 60 + corpseCount * 20;
      break;
    }
  }

  // Réduction si un adversaire peut aussi atteindre la case aura avant nous
  // (on cherche si une case aura est disputée)
  // Pas de calcul lourd ici — simple pénalité si l'IA est loin
  return Math.round(base);
}

// Compte les menaces ennemies sur une case
function countThreatsTo(r,c,myColor){
  let threats=0;
  for(const ec of G.order){
    if(ec===myColor)continue;
    if(!G.players[ec]||!G.players[ec].alive)continue;
    for(const ep of G.players[ec].pieces){
      if(ep.dead||ep.color!==ec)continue;
      const acts=getActions(ep);
      if(acts.kills.some(k=>k.r===r&&k.c===c))threats++;
    }
  }
  return threats;
}

// Vérifie si la Reine est actuellement menacée
function isQueenThreatened(color){
  const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color);
  if(!chef)return false;
  return countThreatsTo(chef.r,chef.c,color)>0;
}

// Score de base pour un coup (tous niveaux)
// Valeur de chaque type de pièce (partagé kill + necro)
const MV_PIECE_VAL = { chef:1000, assassin:220, reporter:200, necromobile:190, diplomate:170, militant:100 };

function scoreAIMove(mv,color){
  let s=0;
  if(mv.type==='kill'){
    // Kill valorisé selon la pièce capturée
    s += MV_PIECE_VAL[mv.target.type] || 100;
  }
  if(mv.type==='move'){
    // Bonus nid pour la Reine
    if(mv.piece.type==='chef'&&mv.toR===LAB.r&&mv.toC===LAB.c)s+=200;
    // Léger bonus centralité
    s+=(4-Math.max(Math.abs(mv.toR-4),Math.abs(mv.toC-4)))*3;
    // Bonus si on rapproche une pièce forte du centre ennemi
    if(mv.piece.type==='assassin'||mv.piece.type==='reporter') s+=6;
  }
  if(mv.type==='necro'){
    // Ressusciter une pièce forte vaut presque autant que la tuer
    const val = (MV_PIECE_VAL[mv.target.type] || 100) * 1.4;
    s += val;
    // Urgence si peu de pièces restantes
    const myCount = G.players[color] ? G.players[color].pieces.filter(p=>!p.dead&&p.color===color).length : 4;
    if (myCount <= 3) s += 200;
  }
  if(mv.type==='dipl'){
    // Diplomatie : valeur de la pièce déplacée (perturbe l'adversaire)
    s += (MV_PIECE_VAL[mv.target.type] || 80) * 0.7;
    // Bonus fort si on déplace la Reine adverse (la sort de sa zone sûre)
    if(mv.target.type==='chef') s += 400;
  }
  // Bonus aura SP : valeur calculée selon l'état réel de la partie
  if((mv.type==='move'||mv.type==='kill') && isAuraCell(mv.toR,mv.toC)){
    const auraGain = evalAuraGain(mv.piece, color);
    // Réduction si la case destination est menacée (risque de se faire tuer avant d'utiliser le SP)
    const destinationRisk = countThreatsTo(mv.toR, mv.toC, color);
    s += Math.max(0, auraGain - destinationRisk * 120);
  }
  s+=Math.random()*8;
  return s;
}

// Score défensif — conscience du danger de la Reine (niveaux 2+)
function scoreAIMoveDefensive(mv,color,queenThreatened){
  let s=scoreAIMove(mv,color);
  const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color);
  if(chef){
    const queenActing=(mv.piece.type==='chef');
    // Position de la Reine APRÈS le coup — correcte pour move ET kill
    const queenR = queenActing ? mv.toR : chef.r;
    const queenC = queenActing ? mv.toC : chef.c;
    // Malus si la Reine se retrouve exposée après son coup
    const threatsAfter = countThreatsTo(queenR, queenC, color);
    if(threatsAfter>0) s -= threatsAfter * 400;
    if(queenActing && threatsAfter>0) s -= 800; // malus supplémentaire si c'est elle qui s'expose
    // Bonus fort si la Reine fuit vers une case sûre
    if(queenThreatened && queenActing){
      if(threatsAfter===0) s += 600;
      else s -= 400;
    }
    // Bonus interposition : rapprocher n'importe quelle pièce de la Reine menacée
    if(queenThreatened && !queenActing && mv.type==='move'){
      const distBefore = Math.max(Math.abs(mv.piece.r-chef.r), Math.abs(mv.piece.c-chef.c));
      const distAfter  = Math.max(Math.abs(mv.toR-chef.r),    Math.abs(mv.toC-chef.c));
      if(distAfter < distBefore) s += 200; // était 80 — trop ignoré
    }
  }
  return s;
}

// Niveau 2 — scoring avec auto-préservation
function aiLevel2(color){
  const all=getAllMoves(color);if(!all.length)return null;
  // Priorité absolue : tuer la Reine ennemie — la partie finit là, pas de risque après
  const queenKill=all.find(mv=>(mv.type==='kill'||mv.type==='reporter-kill')&&mv.target&&mv.target.type==='chef');
  if(queenKill) return queenKill;
  const queenThreatened=isQueenThreatened(color);
  // Filtre : la Reine ne va jamais vers une case menacée (déplacement OU kill), sauf dernier recours
  const safe=all.filter(mv=>
    !(mv.piece.type==='chef'&&countThreatsTo(mv.toR,mv.toC,color)>0)
  );
  const pool=safe.length?safe:all;
  const scored=pool.map(mv=>({mv,s:scoreAIMoveDefensive(mv,color,queenThreatened)}));
  scored.sort((a,b)=>b.s-a.s);
  return scored[0].mv;
}

// ── Minimax léger — simulation plateau ──

// Copie légère du plateau (pièces clonées, pas de DOM)
function cloneState() {
  const players = {};
  const board = Array.from({length:9}, ()=>Array(9).fill(null));
  for (const c of G.order) {
    const pl = G.players[c];
    if (!pl) continue;
    const pieces = pl.pieces.map(p => ({...p}));
    players[c] = { ...pl, pieces };
    for (const p of pieces) {
      if (!p.dead) board[p.r][p.c] = p;
    }
  }
  return { players, board };
}

// Applique un coup sur un état cloné (sans animations, sans DOM)
function applyMoveToState(state, mv) {
  const { players, board } = state;
  // Trouver la pièce dans le clone
  const piece = findInState(state, mv.piece.id);
  if (!piece) return;
  if (mv.type === 'move') {
    board[piece.r][piece.c] = null;
    piece.r = mv.toR; piece.c = mv.toC;
    board[mv.toR][mv.toC] = piece;
  } else if (mv.type === 'kill') {
    const target = findInState(state, mv.target.id);
    if (target) { target.dead = true; board[target.r][target.c] = null; }
    board[piece.r][piece.c] = null;
    piece.r = mv.toR; piece.c = mv.toC;
    board[mv.toR][mv.toC] = piece;
    if (target && target.type === 'chef') {
      const pl = players[target.color];
      if (pl) pl.alive = false;
    }
  } else if (mv.type === 'dipl') {
    const target = findInState(state, mv.target.id);
    if (target) { board[target.r][target.c] = null; }
    board[piece.r][piece.c] = null;
    piece.r = mv.toR; piece.c = mv.toC;
    board[mv.toR][mv.toC] = piece;
    // Placer la cible sur une case libre quelconque
    if (target) {
      for (let r=0;r<9;r++) for(let c=0;c<9;c++) {
        if (!board[r][c]) { target.r=r; target.c=c; board[r][c]=target; r=c=99; }
      }
    }
  }
}

function findInState(state, id) {
  for (const c of G.order) {
    const pl = state.players[c];
    if (!pl) continue;
    const p = pl.pieces.find(p => p.id === id);
    if (p) return p;
  }
  return null;
}

// Évalue statiquement une position pour une couleur donnée (sur l'état cloné)
const PIECE_W = { chef:10000, necromobile:600, reporter:500, assassin:480, diplomate:420, militant:300 };
function evalState(state, color) {
  let score = 0;
  for (const c of G.order) {
    const pl = state.players[c];
    if (!pl) continue;
    const sign = (c === color) ? 1 : -1;
    for (const p of pl.pieces) {
      if (p.dead) continue;
      const w = PIECE_W[p.type] || 200;
      score += sign * w;
      // Bonus centralité pour pièces non-reine
      if (p.type !== 'chef') {
        score += sign * (4 - Math.max(Math.abs(p.r-4), Math.abs(p.c-4))) * 8;
      }
    }
    // Malus si la reine de notre couleur est exposée — basé sur kills réels, pas proximité
    if (c === color && pl.alive) {
      const chef = pl.pieces.find(p => p.type==='chef' && !p.dead);
      if (chef) {
        // Vérifier les kills réels possibles depuis le state cloné
        let threats = 0;
        for (const oc of G.order) {
          if (oc === color) continue;
          const opl = state.players[oc];
          if (!opl || !opl.alive) continue;
          for (const op of opl.pieces) {
            if (op.dead) continue;
            // Proximité 1 case = menace potentielle (approx rapide sans recalc actions)
            const dr = Math.abs(op.r - chef.r), dc = Math.abs(op.c - chef.c);
            if (dr<=1 && dc<=1 && op.type!=='chef') threats++; // la Reine adverse ne tue pas directement
          }
        }
        if (threats > 0) score -= threats * 900; // fort malus
        if (threats >= 2) score -= 500; // malus supplémentaire si double menace
      }
    }
  }
  return score;
}

// Récupère les mouvements possibles depuis un état cloné (sans modifier G)
function getMovesFromState(state, color) {
  // Swap temporaire de G, executer getAllMoves, restaurer
  const savedPlayers = G.players;
  const savedBoard = G.board;
  G.players = state.players;
  G.board = state.board;
  let moves;
  try { moves = getAllMoves(color); } catch(e) { moves = []; }
  G.players = savedPlayers;
  G.board = savedBoard;
  return moves;
}

// Depth-3 : depuis un état donné, quel est mon meilleur coup suivant ?
// Respecte le budget de temps global (_aiDeadline) pour ne jamais geler l'appareil.
function myBestFollowUp(state, myColor, limit) {
  const moves = getMovesFromState(state, myColor);
  if (!moves.length) return evalState(state, myColor);
  const scored = moves.map(mv => ({ mv, s: scoreAIMove(mv, myColor) }));
  scored.sort((a,b) => b.s - a.s);
  let best = -Infinity;
  for (const { mv } of scored.slice(0, limit)) {
    if (Date.now() > _aiDeadline) break; // budget de temps dépassé : on s'arrête proprement
    if (mv.type === 'kill' && mv.target && mv.target.type === 'chef') return 1000000;
    const state3 = { players: {}, board: state.board.map(r=>[...r]) };
    for (const c of G.order) state3.players[c] = state.players[c] ? { ...state.players[c], pieces: state.players[c].pieces.map(p=>({...p})) } : null;
    applyMoveToState(state3, mv);
    const e = evalState(state3, myColor);
    if (e > best) best = e;
  }
  return best === -Infinity ? evalState(state, myColor) : best;
}

// Minimax profondeur 3 : mon coup → meilleures réponses adverses → mon meilleur
// coup suivant. Élagage alpha + budget de temps global (_aiDeadline) : passé ce
// budget, on arrête d'approfondir et on se contente de l'évaluation superficielle
// déjà en main — ça garantit un temps de réponse borné quel que soit le nombre
// de pièces en jeu (important sur mobile).
function minimaxScore(mv, myColor, alpha = -Infinity) {
  // 1. Cloner et appliquer mon coup
  const state1 = cloneState();
  applyMoveToState(state1, mv);

  // Si j'ai tué la reine ennemie → score maximal immédiat
  if (mv.type === 'kill' && mv.target.type === 'chef') return 1000000;

  // 2. Trouver la meilleure réponse de chaque adversaire vivant
  let worstForMe = evalState(state1, myColor);
  const opponents = G.order.filter(c => c !== myColor && G.players[c] && G.players[c].alive);
  for (const opp of opponents) {
    const oppMoves = getMovesFromState(state1, opp);
    if (!oppMoves.length) continue;

    // 8 réponses adverses plausibles, évaluées superficiellement d'abord
    const oppScored = oppMoves.map(omv => ({ omv, s: scoreAIMove(omv, opp) }));
    oppScored.sort((a,b) => b.s - a.s);
    const candidates = oppScored.slice(0, 8).map(({ omv }) => {
      const state2 = { players: {}, board: state1.board.map(r=>[...r]) };
      for (const c of G.order) state2.players[c] = state1.players[c] ? { ...state1.players[c], pieces: state1.players[c].pieces.map(p=>({...p})) } : null;
      applyMoveToState(state2, omv);
      return { state2, e: evalState(state2, myColor) };
    });
    candidates.sort((a,b) => a.e - b.e); // la plus dangereuse pour moi en tête

    // Seule la réponse la plus dangereuse est creusée un coup plus loin (profondeur 3),
    // et seulement si le budget de temps le permet encore
    let worstHere = candidates.length ? candidates[0].e : worstForMe;
    if (candidates.length && Date.now() < _aiDeadline) {
      const deep = myBestFollowUp(candidates[0].state2, myColor, 4);
      if (deep < worstHere) worstHere = deep;
    }

    worstForMe = Math.min(worstForMe, worstHere);
    // Élagage : ce coup ne battra plus le meilleur candidat déjà trouvé, inutile de continuer
    if (worstForMe <= alpha) return worstForMe;
  }
  return worstForMe;
}

// Niveau 3 — minimax profondeur 2 + instinct de survie
function aiLevel3(color){
  const all=getAllMoves(color); if(!all.length) return null;

  // Budget de temps global pour ce tour d'IA — garantit qu'on ne gèle jamais
  // l'appareil, quel que soit le nombre de pièces/coups en jeu.
  _aiDeadline = Date.now() + 1200;

  // Priorité ABSOLUE : tuer la Reine ennemie si possible.
  const queenKill = all.find(mv => (mv.type==='kill'||mv.type==='reporter-kill') && mv.target && mv.target.type==='chef');
  if (queenKill) return queenKill;

  // Priorité 2 : sauver sa propre reine si menacée
  const queenThreatened = isQueenThreatened(color);
  if (queenThreatened) {
    const chef = G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead);
    if (chef) {
      const escapes = all.filter(mv =>
        mv.piece.type==='chef' && mv.type==='move' && countThreatsTo(mv.toR, mv.toC, color)===0
      );
      if (escapes.length) {
        // Tri préalable par heuristique rapide → meilleur élagage alpha
        escapes.sort((a,b) => scoreAIMove(b,color) - scoreAIMove(a,color));
        let alpha = -Infinity;
        const scored = escapes.map(mv => {
          const s = Date.now() < _aiDeadline ? minimaxScore(mv, color, alpha) : scoreAIMove(mv, color);
          if (s > alpha) alpha = s;
          return { mv, s };
        });
        scored.sort((a,b) => b.s - a.s);
        return scored[0].mv;
      }
    }
  }

  // Filtre : la Reine ne va jamais sur une case menacée (move OU kill) sauf dernier recours
  const safe = all.filter(mv =>
    !(mv.piece.type==='chef' && countThreatsTo(mv.toR, mv.toC, color) > 0)
  );

  // Pénalité : éviter de répéter le dernier coup de la reine
  const lastQ = G.queenMovHistory && G.queenMovHistory[color];
  const pool = safe.length ? safe : all;

  // Tri préalable des coups par heuristique rapide : les coups déjà prometteurs
  // sont testés en premier, ce qui muscle l'élagage alpha sur les coups suivants.
  const preOrdered = [...pool].sort((a,b) => scoreAIMove(b,color) - scoreAIMove(a,color));

  // Seuls les MAX_DEEP meilleurs coups (déjà triés) reçoivent l'analyse complète
  // profondeur 3 ; les autres gardent leur score heuristique rapide. Combiné à
  // la deadline, ça borne totalement le temps de calcul de ce tour.
  const MAX_DEEP = 15;

  let alpha = -Infinity;
  const scored = preOrdered.map((mv, i) => {
    const canGoDeep = i < MAX_DEEP && Date.now() < _aiDeadline;
    const raw = canGoDeep ? minimaxScore(mv, color, alpha) : scoreAIMove(mv, color);
    if (raw > alpha) alpha = raw;
    let s = raw;
    // Pénalité aller-retour reine
    if (lastQ && mv.piece.type==='chef' && mv.type==='move') {
      const reversal = `${mv.toR},${mv.toC}->${mv.piece.r},${mv.piece.c}`;
      if (lastQ.last === reversal) s -= 600;
    }
    // Bonus personnalité
    const pers = _aiPersonalities[color] || 'opportunist';
    if (pers==='aggressive' && mv.type==='kill') s += 100;
    if (pers==='defensive' && mv.piece.type==='chef' && mv.toR===LAB.r && mv.toC===LAB.c) s += 200;
    if (pers==='manipulator' && (mv.type==='dipl'||mv.type==='necro')) s += 120;
    return { mv, s };
  });

  scored.sort((a,b) => b.s - a.s);
  return scored[0].mv;
}

// Choisit une case libre pour placer une dépouille (IA)
function pickFreeCell(forbidNid=true, killerColor=null){
  const free=[];
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(G.board[r][c])continue;
    if(forbidNid&&r===LAB.r&&c===LAB.c)continue;
    free.push({r,c});
  }
  if(!free.length) return null;
  if(!killerColor) return free[Math.floor(Math.random()*free.length)];

  const myPieces = G.players[killerColor]?.pieces || [];
  const chef = myPieces.find(p=>p.type==='chef'&&!p.dead);
  // Trouver le propre Scarabée — pour placer des dépouilles à portée stratégique
  const myScarab = myPieces.find(p=>p.type==='necromobile'&&!p.dead);

  const scored = free.map(cell => {
    let s = 0;

    // Distance alliés — garder les dépouilles accessibles à nos pièces
    let minAllyDist = 99;
    for(const p of myPieces){
      if(p.dead) continue;
      const d = Math.max(Math.abs(p.r-cell.r), Math.abs(p.c-cell.c));
      if(d < minAllyDist) minAllyDist = d;
    }
    s -= minAllyDist * 8; // pénalité réduite (était 15)

    // Proximité ennemie — moins systématique (réduit de 20 à 10)
    for(const ec of G.order){
      if(ec===killerColor||!G.players[ec]||!G.players[ec].alive) continue;
      for(const ep of G.players[ec].pieces){
        if(ep.dead) continue;
        const d = Math.max(Math.abs(ep.r-cell.r), Math.abs(ep.c-cell.c));
        if(d<=2) s += (3-d)*10; // était (3-d)*20
      }
    }

    // Bonus stratégique : placer près de notre Scarabée pour préparer un encerclement futur
    // (environ 1 fois sur 3 — aléatoire mais structuré)
    if(myScarab && Math.random() < 0.35){
      const dScarab = Math.max(Math.abs(myScarab.r-cell.r), Math.abs(myScarab.c-cell.c));
      if(dScarab <= 3) s += (4-dScarab)*12; // bonus stockage stratégique
    }

    // Proche du centre = légèrement mieux
    s += (4-Math.max(Math.abs(cell.r-4),Math.abs(cell.c-4)))*3;

    // Pas trop proche de notre propre Reine
    if(chef){
      const dChef = Math.max(Math.abs(chef.r-cell.r), Math.abs(chef.c-cell.c));
      if(dChef<=1) s -= 40;
    }

    s += Math.random()*18; // imprévisibilité augmentée (était 10)
    return { cell, s };
  });

  scored.sort((a,b)=>b.s-a.s);
  return scored[0].cell;
}

function execAIMove(mv,color,onDone){
  const{piece,type,target,toR,toC}=mv;
  _animating=true;
  if(type==='move'){
    logMoveAction(piece,'move',null);
    animMove(piece,toR,toC).then(()=>{
      if (checkSPCellCapture(piece,toR,toC)) return;
      if(piece.type==='reporter'){
        const rts=getRepAdj(piece);
        if(rts.length>0){
          const hasQueenOrtho = rts.some(t=>t.ortho && t.p.type==='chef');
          const hasQueenDiag  = rts.some(t=>!t.ortho && t.p.type==='chef');
          let isOrtho;
          if (hasQueenOrtho) isOrtho = true;
          else if (hasQueenDiag) isOrtho = false;
          else { const orthoCount=rts.filter(t=>t.ortho).length; isOrtho=orthoCount>=rts.filter(t=>!t.ortho).length; }
          execReporterNueeAI(piece,isOrtho,color,onDone);return;
        }
      }
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='reporter-kill'){
    logMoveAction(piece,'move',null);
    animMove(piece,toR,toC).then(()=>{
      if (checkSPCellCapture(piece,toR,toC)) return;
      execReporterNueeAI(piece, mv.isOrtho, color, onDone);
    });
  } else if(type==='kill'){
    logMoveAction(piece,'kill',target);
    const fromR=piece.r,fromC=piece.c;
    const killedOnNid = (toR===LAB.r && toC===LAB.c);
    animMove(piece,toR,toC).then(()=>{
      checkSPCellCapture(piece,toR,toC);
      const needPlace=executeKill(piece,target);
      if(piece.type==='assassin'){
        placeOnBoard(target,fromR,fromC);
        if (killedOnNid) { _aiNidBonusMove(piece, onDone); } else { handleNid(piece);renderBoard();onDone(); }
        return;
      }
      if(needPlace){
        const cell=pickFreeCell(true, color);
        if(cell)placeOnBoard(target,cell.r,cell.c);
        G.pendCorpse=null;G.phase='select';
      }
      if (killedOnNid && piece.type !== 'chef') {
        _aiNidBonusMove(piece, onDone);
      } else {
        handleNid(piece);renderBoard();onDone();
      }
    });
  } else if(type==='dipl'){
    logMoveAction(piece,'dipl',target);
    removeFromBoard(target);
    animMove(piece,toR,toC).then(()=>{
      if (checkSPCellCapture(piece,toR,toC)) return;
      const cell=pickFreeCell(false, color);
      if(cell)placeOnBoard(target,cell.r,cell.c);
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='necro'){
    logMoveAction(piece,'necro',target);
    const acts = getActionsWithSP(piece);
    if (acts.resurrectMode) {
      const oldColor = target.color;
      target.color = piece.color;
      target.dead = false;
      if (G.players[oldColor]) G.players[oldColor].pieces = G.players[oldColor].pieces.filter(p=>p.id!==target.id);
      if (G.players[target.color]) G.players[target.color].pieces.push(target);
      if (G.board[target.r] && G.board[target.r][target.c] === target) removeFromBoard(target);
      const cell = pickFreeCell(false);
      if (cell) placeOnBoard(target, cell.r, cell.c);
      handleNid(piece); renderBoard(); onDone();
    } else {
      removeFromBoard(target);
      animMove(piece,toR,toC).then(()=>{
        if (checkSPCellCapture(piece,toR,toC)) return;
        const cell=pickFreeCell(true);
        if(cell)placeOnBoard(target,cell.r,cell.c);
        handleNid(piece);renderBoard();onDone();
      });
    }
  }
}

// Coup bonus IA après kill sur le Nid : l'IA déplace automatiquement sa pièce hors du Nid
function _aiNidBonusMove(piece, onDone) {
  const legalMoves = getActions(piece).moves.filter(m => !(m.r===LAB.r && m.c===LAB.c));
  if (!legalMoves.length) { handleNid(piece); renderBoard(); onDone(); return; }
  // L'IA préfère amener sa propre Reine sur le Nid si possible, sinon move aléatoire
  const chef = G.players[piece.color] ? G.players[piece.color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===piece.color) : null;
  // Pour l'instant : choisir un mouvement aléatoire parmi les légaux
  const mv = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  setTimeout(() => {
    animMove(piece, mv.r, mv.c).then(() => {
      handleNid(piece); renderBoard(); onDone();
    });
  }, 400);
}

function execReporterNueeAI(reporter,isOrtho,color,onDone){
  const dirs=isOrtho?DIRS_ORTHO:DIRS_DIAG;
  for(const[dr,dc]of dirs){
    const nr=reporter.r+dr,nc=reporter.c+dc;if(!inB(nr,nc))continue;
    const t=G.board[nr][nc];
    if(t&&!t.dead&&t.color!==reporter.color&&!isInvincible(t)){
      t.dead=true;_gameCaps++;
      const pos=getPiecePos(t);if(pos)FX.spawn(pos.x,pos.y,t.color);
      const pe=document.getElementById('p'+t.id);
      if(pe){pe.classList.add('flash-kill');setTimeout(()=>{pe.classList.remove('flash-kill');const cv=pe.querySelector('canvas');if(cv)drawPiece(cv,t.color,SYM[t.type],true,false);pe.style.filter='none';pe.style.zIndex='2';},460);}
      if(t.type==='chef')elimPlayer(t.color,reporter.color);
    }
  }
  sfxCapture();boardShake();
  handleNid(reporter);renderBoard();onDone();
}


