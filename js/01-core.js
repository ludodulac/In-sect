/* ===============================================================
   IN-SECT — CORE — Constantes, etat global, helpers, stats/partage
   Module 01-core.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

/* ═══════════════════════════════════════════════════════════════
   IN-SECT — L'Échiquier des Colonies
   script.js — Gameplay complet

   ARCHITECTURE :
   ┌─ [STATS]    Score victoires/défaites, partage social (localStorage)
   ├─ [AUDIO]    Moteur son WebAudio + jingle
   ├─ [FX]       Particules canvas
   ├─ [NAV]      Écrans & modals
   ├─ [MENU]     Sélection mode/couleur/IA
   ├─ [GAME]     Init, plateau, pièces
   ├─ [RULES]    Mouvements, captures, tour
   ├─ [AI]       Niveaux 1/2/3 + personnalités
   └─ [BOOT]     Démarrage
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   [STATS] — Score et partage social
   ═══════════════════════════════════════════

   Le jeu est en accès libre et illimité (aucun paywall).
   Clés localStorage utilisées :
     insect_wins_*   / insect_losses_*  : score victoires/défaites par mode+difficulté
     insect_tuto_seen                   : badge tutoriel déjà vu

   Un modèle de monétisation (pub, premium, abonnement) peut être branché
   ici selon la stratégie retenue par l'exploitant du jeu.
*/

// ── Clés localStorage ──
const LS = {
  SAVE:     'insect_save',
};

// ── Lecture / écriture localStorage avec fallback ──
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? v : fallback; }
  catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) {}
}

// ── Sauvegarde / restauration de partie ──
function saveGame() {
  if (!G || G.over || !G.board) return;
  try {
    const snap = {
      G: JSON.stringify(G),
      mode: _mode,
      aiLevel: _aiLevel,
      selColor: _selColor,
      optSP: _optSP,
      uid: _uid,
      turns: _gameTurns,
      caps: _gameCaps,
      moveLog: _moveLog,
      ts: Date.now()
    };
    localStorage.setItem(LS.SAVE, JSON.stringify(snap));
  } catch(e) {}
}

function clearSave() {
  try { localStorage.removeItem(LS.SAVE); } catch(e) {}
}

function hasSave() {
  try { return !!localStorage.getItem(LS.SAVE); } catch(e) { return false; }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(LS.SAVE);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    // Restaurer les variables globales
    _mode = snap.mode;
    _aiLevel = snap.aiLevel;
    _selColor = snap.selColor;
    _optSP = snap.optSP;
    _uid = snap.uid;
    _gameTurns = snap.turns;
    _gameCaps = snap.caps;
    _moveLog = snap.moveLog || [];
    G = JSON.parse(snap.G);
    // Reconstruire le board depuis les pièces (JSON ne garde que les données, pas les refs)
    G.board = Array.from({length:9}, ()=>Array(9).fill(null));
    for (const c of G.order) {
      const pl = G.players[c];
      if (!pl) continue;
      for (const p of pl.pieces) {
        if (!p.dead) G.board[p.r][p.c] = p;
      }
    }
    return true;
  } catch(e) { clearSave(); return false; }
}

// ── Met à jour la barre de statut dans le menu ──
const CROWN_SVG = `<svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M1 9h10M1 9L0 3l3 2.5L6 1l3 4.5L12 3l-1 6H1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/></svg>`;

function updateStatusBar() {
  const counter  = document.getElementById('status-counter');
  const badge    = document.getElementById('status-badge');
  const sharesEl = document.getElementById('status-shares');

  // Score victoires/défaites dans le header — labels courts
  const scoreBar = document.getElementById('menu-score-bar');
  const wLabel   = document.getElementById('score-w-label');
  const lLabel   = document.getElementById('score-l-label');
  if (scoreBar) {
    const wKey = `insect_wins_${_mode}ia_${_aiLevel}`;
    const lKey = `insect_losses_${_mode}ia_${_aiLevel}`;
    const w = parseInt(lsGet(wKey,'0'),10);
    const l = parseInt(lsGet(lKey,'0'),10);
    if (wLabel) wLabel.textContent = `▲ ${w}`;
    if (lLabel) lLabel.textContent = `▼ ${l}`;
    scoreBar.style.display = 'flex';
  }

  if (!counter || !badge) return;

  counter.textContent = '♾️ Parties illimitées';
  counter.className   = 'status-counter';
  badge.innerHTML     = CROWN_SVG + 'Partager le jeu';
  badge.className     = 'status-badge unlocked';
  if (sharesEl) sharesEl.style.display = 'none';

  // Badge tuto : masquer si déjà vu
  const tutoBadge = document.getElementById('tuto-badge');
  if (tutoBadge && lsGet('insect_tuto_seen')) tutoBadge.classList.add('hidden-badge');
  // Bouton Reprendre
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) resumeBtn.style.display = hasSave() ? '' : 'none';
}


// ── Partage via navigator.share() ──
async function doShare() {
  const wins  = parseInt(lsGet('insect_wins',  '0'), 10);
  const losses = parseInt(lsGet('insect_losses','0'), 10);
  const scoreMsg = wins > 0
    ? `🏆 ${wins} victoire${wins>1?'s':''} en ${wins+losses} parties — tu peux faire mieux ?`
    : '⚔️ 4 colonies en guerre. 1 seule survivra.';

  const shareData = {
    title: "IN-SECT — L'Échiquier des Colonies",
    text: `🪲 Je joue à IN-SECT, un jeu de stratégie unique ! Reine Guêpe, Araignée Assassine, Mouche Journaliste… ${scoreMsg} Essaie !`,
    url: window.location.href.split('?')[0],
  };

  // Desktop : pas de navigator.share → popup custom
  if (!navigator.share) {
    openShareDesktopModal(shareData);
    return;
  }

  const bgmWasPlaying = _bgm && !_bgm.paused;
  if (bgmWasPlaying) stopBGM();

  try {
    await navigator.share(shareData);
    toast('🤝 Merci pour le partage !');
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast('Partage annulé.');
    }
  } finally {
    if (bgmWasPlaying) setTimeout(() => playBGM(), 300);
  }
}

// ── Popup de partage Desktop ──
function openShareDesktopModal(shareData) {
  const url = shareData.url;
  const txt = encodeURIComponent(shareData.text);
  const existing = document.getElementById('modal-share-desktop');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-share-desktop';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:600;display:flex;align-items:flex-end;justify-content:center;padding-bottom:var(--safe-bot,0px);backdrop-filter:blur(6px);';
  overlay.innerHTML = `
    <div style="background:linear-gradient(170deg,#0D0B1E,#08060F);border:1px solid rgba(212,160,23,.4);border-radius:18px 18px 0 0;width:100%;max-width:500px;padding:20px 20px 28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-family:'Exo 2',sans-serif;font-size:.8rem;font-weight:900;letter-spacing:.2em;color:#D4A017;">🤝 ENVOIE IN-SECT À UN AMI</div>
        <button onclick="document.getElementById('modal-share-desktop').remove()" style="background:transparent;border:1px solid rgba(212,160,23,.4);border-radius:7px;color:#8A6800;font-size:.9rem;width:32px;height:32px;cursor:pointer;">✕</button>
      </div>
      <p style="font-size:.82rem;color:#9090C8;line-height:1.6;margin-bottom:18px;">Choisis comment partager le jeu :</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="https://wa.me/?text=${txt}%20${encodeURIComponent(url)}" target="_blank" style="display:flex;align-items:center;gap:12px;height:52px;border-radius:10px;background:linear-gradient(160deg,#0A3A0A,#18A830);color:#E0FFE8;text-decoration:none;padding:0 18px;font-family:'Exo 2',sans-serif;font-size:.92rem;font-weight:900;letter-spacing:.06em;">
          <span style="font-size:1.4rem;">💬</span> WhatsApp
        </a>
        <a href="mailto:?subject=${encodeURIComponent(shareData.title)}&body=${txt}%20${encodeURIComponent(url)}" style="display:flex;align-items:center;gap:12px;height:52px;border-radius:10px;background:linear-gradient(160deg,#1A2A4A,#2060A0);color:#E0F0FF;text-decoration:none;padding:0 18px;font-family:'Exo 2',sans-serif;font-size:.92rem;font-weight:900;letter-spacing:.06em;">
          <span style="font-size:1.4rem;">✉️</span> E-mail
        </a>
        <button onclick="navigator.clipboard.writeText('${url}').then(()=>{document.getElementById('modal-share-desktop').remove();toast('🔗 Lien copié !')})" style="display:flex;align-items:center;gap:12px;height:52px;border-radius:10px;background:rgba(128,80,255,.18);color:#C090FF;border:1px solid rgba(128,80,255,.35);padding:0 18px;font-family:'Exo 2',sans-serif;font-size:.92rem;font-weight:900;letter-spacing:.06em;cursor:pointer;width:100%;">
          <span style="font-size:1.4rem;">🔗</span> Copier le lien
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Suivi victoires / défaites ──
function resetScore() {
  const modes = [1,3], levels = [1,2,3];
  for (const m of modes) for (const l of levels) {
    lsSet(`insect_wins_${m}ia_${l}`, '0');
    lsSet(`insect_losses_${m}ia_${l}`, '0');
  }
  updateStatusBar();
}

// ── Log des derniers coups ──
const PNAME_SHORT = { chef:'Reine', assassin:'Araignée', reporter:'Mouche', necromobile:'Scarabée', diplomate:'Coccinelle', militant:'Fourmi' };
const COLOR_FR = { yellow:'Jaune', green:'Verte', blue:'Bleue', red:'Rouge' };
let _moveLog = [];

function logMove(entry) {
  _moveLog.unshift(entry);
  if (_moveLog.length > 20) _moveLog.length = 20;
}

function openMoveLogModal() {
  const el = document.getElementById('movelog-body');
  if (!el) return;
  if (!_moveLog.length) {
    el.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);font-style:italic;text-align:center;padding:12px 0;">Aucun coup joué pour l\'instant.</div>';
  } else {
    el.innerHTML = _moveLog.map((e, i) => `
      <div style="display:flex;align-items:baseline;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);flex-shrink:0;">
        <span style="width:8px;height:8px;border-radius:50%;background:${e.color};flex-shrink:0;margin-top:5px;"></span>
        <span style="font-size:.78rem;line-height:1.4;color:rgba(224,220,255,.88);flex:1;">${e.text}</span>
        <span style="font-size:.68rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">T${_gameTurns - i < 1 ? 1 : _gameTurns - i}</span>
      </div>`).join('');
  }
  // Scroll en haut (coup le plus récent)
  el.scrollTop = 0;
  showModal('movelog');
}

function openReplayModal() {
  openMoveLogModal();
}

// Vérifie si l'équipe courante peut jouer, sinon avance jusqu'à en trouver une qui peut
function skipBlockedTeams() {
  let skips = 0;
  while (skips < G.order.length) {
    const c = cur();
    if (!G.players[c] || !G.players[c].alive) { G.idx=(G.idx+1)%G.order.length; skips++; continue; }
    const pieces = G.players[c].pieces.filter(p=>!p.dead);
    const hasMove = pieces.some(p => {
      const acts = getActions(p);
      return acts.moves.length > 0 || acts.kills.length > 0 || acts.diplT.length > 0 || acts.necroT.length > 0;
    });
    if (hasMove) break;
    logMove({ color: CCSS[c], text: `<b style="color:${CCSS[c]}">${COLOR_FR[c]}</b> passe (bloquée)` });
    G.idx=(G.idx+1)%G.order.length; skips++;
  }
}

function launchCurrentTeam() {
  skipBlockedTeams();
  renderBoard(); renderPlayers(); updateTurnUI();
  if (G.players[cur()] && !G.players[cur()].human && G.players[cur()].alive) {
    _aiTimer = setTimeout(() => aiTurn(finishTurn), 500+Math.random()*400);
  }
}

function logMoveAction(piece, type, target) {
  const pc = CCSS[piece.color];
  const pn = `<b style="color:${pc}">${PNAME_SHORT[piece.type]} ${COLOR_FR[piece.color]}</b>`;
  let text = '';
  if (type === 'move') {
    text = `${pn} se déplace`;
  } else if (type === 'kill') {
    const tc = CCSS[target.color];
    const tn = `<b style="color:${tc}">${PNAME_SHORT[target.type]} ${COLOR_FR[target.color]}</b>`;
    text = `${pn} tue ${tn}`;
  } else if (type === 'dipl') {
    const tc = CCSS[target.color];
    const tn = `<b style="color:${tc}">${PNAME_SHORT[target.type]} ${COLOR_FR[target.color]}</b>`;
    text = `${pn} déplace ${tn} vers une case libre`;
  } else if (type === 'necro') {
    text = `${pn} repositionne une dépouille 💀`;
  } else if (type === 'resurrect') {
    const tc = CCSS[target.color] || '#aaa';
    const tn = target ? `<b style="color:${tc}">${PNAME_SHORT[target.type]} ${COLOR_FR[target.color]}</b>` : 'une dépouille';
    text = `${pn} ressuscite ${tn} dans sa colonie ✨`;
  } else if (type === 'place-corpse') {
    text = `${pn} place une dépouille 💀 sur une case choisie`;
  } else {
    text = `${pn} joue`;
  }
  logMove({ color: CCSS[piece.color], text, isKill: type === 'kill' });
}

function _scoreKey(type) {
  // Clé unique par mode+difficulté ex: "insect_wins_1ia_2"
  return `insect_${type}_${_mode}ia_${_aiLevel}`;
}
function recordWin()  { clearSave(); lsSet(_scoreKey('wins'),  parseInt(lsGet(_scoreKey('wins'),'0'),10)  + 1); updateStatusBar(); }
function recordLoss() { clearSave(); lsSet(_scoreKey('losses'),parseInt(lsGet(_scoreKey('losses'),'0'),10) + 1); updateStatusBar(); }


function tryStartGame() {
  startGame();
}


/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */
const CNAME = { yellow:'Colonie Jaune', green:'Colonie Verte', blue:'Colonie Bleue', red:'Colonie Rouge' };
const CCSS  = { yellow:'#F0C030', green:'#30D060', blue:'#4090FF', red:'#FF3050' };
const CGLOW = { yellow:'rgba(240,192,48,.4)', green:'rgba(48,208,96,.4)', blue:'rgba(64,144,255,.4)', red:'rgba(255,48,80,.4)' };
const SYM   = { chef:'reine_guepe_512.webp', assassin:'araignee_512.webp', reporter:'mouche_512.webp', necromobile:'scarabee_512.webp', diplomate:'coccinelle_512.webp', militant:'fourmi_512.webp' };
const PNAME = { chef:'Reine Guêpe', assassin:'Araignée', reporter:'Mouche', necromobile:'Scarabée', diplomate:'Coccinelle', militant:'Fourmi' };
// Noms complets (pour le showcase au-dessus de l'échiquier)
const PFULL = { chef:'Reine Guêpe — Pièce Maîtresse', assassin:'Araignée Assassine', reporter:'Mouche Journaliste', necromobile:'Scarabée Déplaceur', diplomate:'Coccinelle Déplaceuse', militant:'Fourmi Soldate' };
const PDESC = {
  chef:       "Se déplace sur n'importe quelle case libre ou ennemie. <b>Tue</b> la pièce adverse — vous choisissez où poser la dépouille 💀 sur n'importe quelle case vide. Seule pièce autorisée à entrer sur le <b>Nid Sacré 👑</b>. Sa mort entraîne l'effondrement immédiat de toute la colonie.",
  assassin:   "<b>Tue</b> une pièce ennemie en se déplaçant sur sa case, puis <b>retourne immédiatement</b> à sa case de départ. La dépouille reste sur la case d'attaque.",
  reporter:   "Se déplace sur une case <b>vide uniquement</b>. Depuis sa nouvelle position, <b>choisit</b> d'attaquer soit les 4 cases orthogonales ↑↓←→, soit les 4 cases diagonales ↗↘↙↖. Toutes les pièces ennemies de la direction choisie sont <b>tuées simultanément</b>.",
  necromobile:"<b>Déplace une dépouille 💀</b> dans sa ligne de vision vers n'importe quelle case vide. <b>Avec Super Pouvoir</b> : peut choisir <b>n'importe quelle dépouille</b> du plateau et la replacer librement. <b>Pièce vitale</b> : sans elle, la Reine ne peut plus être protégée ou encerclée.",
  diplomate:  "<b>Déplace une pièce ennemie vivante</b> vers n'importe quelle case vide — sans la tuer. <b>Avec Super Pouvoir</b> : peut <b>ressusciter</b> n'importe quelle dépouille — elle rejoint la colonie de la Coccinelle (garde son SP si elle en avait un).",
  militant:   "<b>Portée maximale de 2 cases</b> (orthogonales ou diagonales). Tue une pièce ennemie en se déplaçant sur sa case. 🚫 Ne peut <b>pas</b> attaquer la Reine sur le Nid Sacré."
};

const LAB = { r:4, c:4 };
const DIRS8      = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
const DIRS_ORTHO = [[0,1],[0,-1],[1,0],[-1,0]];
const DIRS_DIAG  = [[1,1],[1,-1],[-1,1],[-1,-1]];
const ANIM_MS    = 350;

// Positions de départ (9 pièces par colonie)
const START = {
  yellow:[{r:0,c:0,t:'chef'},{r:0,c:1,t:'assassin'},{r:0,c:2,t:'militant'},{r:1,c:0,t:'reporter'},{r:1,c:1,t:'diplomate'},{r:1,c:2,t:'militant'},{r:2,c:0,t:'militant'},{r:2,c:1,t:'militant'},{r:2,c:2,t:'necromobile'}],
  green: [{r:0,c:8,t:'chef'},{r:0,c:7,t:'assassin'},{r:0,c:6,t:'militant'},{r:1,c:8,t:'reporter'},{r:1,c:7,t:'diplomate'},{r:1,c:6,t:'militant'},{r:2,c:8,t:'militant'},{r:2,c:7,t:'militant'},{r:2,c:6,t:'necromobile'}],
  blue:  [{r:8,c:0,t:'chef'},{r:8,c:1,t:'assassin'},{r:8,c:2,t:'militant'},{r:7,c:0,t:'reporter'},{r:7,c:1,t:'diplomate'},{r:7,c:2,t:'militant'},{r:6,c:0,t:'militant'},{r:6,c:1,t:'militant'},{r:6,c:2,t:'necromobile'}],
  red:   [{r:8,c:8,t:'chef'},{r:8,c:7,t:'assassin'},{r:8,c:6,t:'militant'},{r:7,c:8,t:'reporter'},{r:7,c:7,t:'diplomate'},{r:7,c:6,t:'militant'},{r:6,c:8,t:'militant'},{r:6,c:7,t:'militant'},{r:6,c:6,t:'necromobile'}],
};


/* ═══════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════ */
let G = {}, _uid = 0, _animating = false, _mode = 1, _selColor = 'yellow', _aiLevel = 1;
let _muted = false, _sfxMuted = false, _gameTurns = 0, _gameCaps = 0;
let _boardBuilt = false;
let _aiTimer = null;
// Options (toggleables en jeu)
// _optPact supprimé — pacte de non-agression retiré du jeu
let _optSP   = true;  // Super pouvoirs activés


/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
const inB  = (r,c) => r >= 0 && r < 9 && c >= 0 && c < 9;
const cur  = ()    => G.order[G.idx];
const isHuman = () => G.players[cur()] && G.players[cur()].human;
function getCellSize() { return Math.min(window.innerWidth * .098, 52); }
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }


