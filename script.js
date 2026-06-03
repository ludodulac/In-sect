/* ═══════════════════════════════════════════════════════════════
   IN-SECT — L'Échiquier des Colonies
   script.js — Gameplay complet + système freemium

   ARCHITECTURE :
   ┌─ [FREEMIUM] Compteur, partages, premium (localStorage)
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
   [FREEMIUM] — Système de parties et accès
   ═══════════════════════════════════════════

   Clés localStorage utilisées :
     insect_games_left   : nombre de parties restantes (entier, défaut 20)
     insect_shares       : nombre de partages validés (0, 1 ou 2)
     insect_freemium     : "1" si accès freemium illimité débloqué (2 partages)
     insect_premium      : "1" si accès premium débloqué (Stripe)

   Logique :
     - Chaque nouvelle partie décrémente insect_games_left
     - Si compteur = 0 ET pas freemium ET pas premium → popup bloquante
     - 2 partages réussis → freemium illimité
     - Retour depuis Stripe avec ?premium=true → premium
*/

// ── URL Stripe à personnaliser ──
const STRIPE_URL = "https://buy.stripe.com/aFa7sMb6V7NA4tU6rz1VK01";

// ── Clés localStorage ──
const LS = {
  GAMES:    'insect_games_left',
  SHARES:   'insect_shares',
  FREEMIUM: 'insect_freemium',
  PREMIUM:  'insect_premium',
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

// ── Getters d'état freemium ──
function getGamesLeft()   { return parseInt(lsGet(LS.GAMES, '20'), 10); }
function getSharesDone()  { return parseInt(lsGet(LS.SHARES, '0'), 10); }
function isFreemium()     { return lsGet(LS.FREEMIUM) === '1'; }
function isPremium()      { return lsGet(LS.PREMIUM)  === '1'; }
function hasAccess()      { return isFreemium() || isPremium() || getGamesLeft() > 0; }

// ── Détecte un retour depuis Stripe ──
function checkPremiumReturn() {
  if (window.location.search.includes('premium=true')) {
    lsSet(LS.PREMIUM, '1');
    // Nettoyer l'URL sans recharger la page
    history.replaceState({}, '', window.location.pathname);
    return true;
  }
  return false;
}

// ── Décrémente le compteur de parties (appelé à chaque startGame) ──
function consumeGame() {
  if (isFreemium() || isPremium()) return; // accès illimité
  const n = getGamesLeft();
  if (n > 0) lsSet(LS.GAMES, n - 1);
}

// ── Met à jour la barre de statut dans le menu ──
const CROWN_SVG = `<svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M1 9h10M1 9L0 3l3 2.5L6 1l3 4.5L12 3l-1 6H1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/></svg>`;

function updateStatusBar() {
  const counter  = document.getElementById('status-counter');
  const badge    = document.getElementById('status-badge');
  const sharesEl = document.getElementById('status-shares');

  // Score victoires/défaites — indépendant du freemium
  const scoreBar = document.getElementById('menu-score-bar');
  const wLabel   = document.getElementById('score-w-label');
  const lLabel   = document.getElementById('score-l-label');
  if (scoreBar) {
    const w = parseInt(lsGet('insect_wins','0'),10);
    const l = parseInt(lsGet('insect_losses','0'),10);
    if (w > 0 || l > 0) {
      if (wLabel) wLabel.textContent = `▲ ${w} Victoire${w!==1?'s':''}`;
      if (lLabel) lLabel.textContent = `▼ ${l} Défaite${l!==1?'s':''}`;
      scoreBar.style.display = 'flex';
    } else {
      scoreBar.style.display = 'none';
    }
  }

  if (!counter || !badge) return;

  const left    = getGamesLeft();
  const shares  = getSharesDone();
  const premium = isPremium();
  const freemium = isFreemium();

  if (premium) {
    counter.textContent  = '♾️ Parties illimitées';
    counter.className    = 'status-counter';
    badge.innerHTML      = CROWN_SVG + 'Partager le jeu';
    badge.className      = 'status-badge unlocked';
    if (sharesEl) sharesEl.style.display = 'none';
  } else if (freemium) {
    counter.textContent  = '♾️ Parties illimitées';
    counter.className    = 'status-counter';
    badge.innerHTML      = CROWN_SVG + 'Partager le jeu';
    badge.className      = 'status-badge unlocked';
    if (sharesEl) sharesEl.style.display = 'none';
  } else {
    counter.textContent  = `Il vous reste ${left} partie${left !== 1 ? 's' : ''}`;
    counter.className    = 'status-counter' + (left <= 3 ? ' danger' : '');
    badge.innerHTML      = CROWN_SVG + 'Parties illimitées';
    badge.className      = 'status-badge free';
    if (sharesEl) {
      sharesEl.textContent = shares > 0 ? `${shares}/2 partages effectués` : '';
      sharesEl.style.display = shares > 0 ? '' : 'none';
    }
  }

  // Badge tuto : masquer si déjà vu
  const tutoBadge = document.getElementById('tuto-badge');
  if (tutoBadge && lsGet('insect_tuto_seen')) tutoBadge.classList.add('hidden-badge');
  // Bouton Reprendre
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) resumeBtn.style.display = hasSave() ? '' : 'none';
}

// ── Met à jour les pastilles de progression dans la popup freemium ──
function updateShareDots() {
  const n = getSharesDone();
  document.querySelectorAll('.share-dot').forEach((dot, i) => {
    dot.classList.toggle('done', i < n);
  });
  const btn = document.getElementById('btn-share');
  if (btn) {
    const unlocked = isFreemium() || isPremium();
    if (unlocked) {
      btn.innerHTML = '🤝 Partager';
    } else {
      const badge = btn.querySelector('.share-badge');
      if (badge) badge.textContent =
        n === 0 ? '2 partages requis' :
        n === 1 ? 'encore 1 partage' :
        '✅ Débloqué !';
    }
  }
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

  try {
    await navigator.share(shareData);

    // Partage réussi — incrémenter le compteur
    const done = getSharesDone() + 1;

    lsSet(LS.SHARES, done);
    updateShareDots();

    if (done >= 2) {
      // Accès freemium débloqué !
      lsSet(LS.FREEMIUM, '1');
      setTimeout(() => {
        hideModal('freemium');
        updateStatusBar();
        toast('🎉 Accès illimité débloqué ! Merci pour les partages.');
        // Autoriser la partie
        startGame();
      }, 600);
    } else {
      toast(`✅ Partage ${done}/2 validé ! Encore ${2 - done} pour débloquer.`);
      updateShareDots();
      updateStatusBar();
    }
  } catch (err) {
    // L'utilisateur a annulé ou refusé
    if (err.name !== 'AbortError') {
      toast('Partage annulé.');
    }
  }
}

// ── Popup de partage Desktop ──
function openShareDesktopModal(shareData) {
  // Incrémenter quand même le compteur (action de partage initiée)
  const done = getSharesDone() + 1;
  lsSet(LS.SHARES, done);
  updateShareDots();
  if (done >= 2 && !isFreemium() && !isPremium()) {
    lsSet(LS.FREEMIUM, '1');
    setTimeout(() => { hideModal('freemium'); updateStatusBar(); toast('🎉 Accès illimité débloqué ! Merci !'); startGame(); }, 600);
  }
  updateStatusBar();

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
  lsSet('insect_wins', '0');
  lsSet('insect_losses', '0');
  updateStatusBar();
}

// ── Log des derniers coups ──
const PNAME_SHORT = { chef:'Reine', assassin:'Araignée', reporter:'Mouche', necromobile:'Scarabée', diplomate:'Coccinelle', militant:'Fourmi' };
const COLOR_FR = { yellow:'Jaune', green:'Verte', blue:'Bleue', red:'Rouge' };
let _moveLog = [];

function logMove(entry) {
  _moveLog.unshift(entry); // plus récent en premier
  if (_moveLog.length > 5) _moveLog.length = 5;
  renderMoveLog();
}

function renderMoveLog() {
  // Met à jour la pop-up si elle est ouverte
  _renderMoveLogBody();
}

function _renderMoveLogBody() {
  const el = document.getElementById('movelog-body');
  if (!el) return;
  if (!_moveLog.length) {
    el.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);font-style:italic;text-align:center;padding:8px 0;">Aucun coup joué</div>';
    return;
  }
  el.innerHTML = _moveLog.map((e, i) => `
    <div class="move-log-entry" style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
      <span class="mle-dot" style="background:${e.color}"></span>
      <span class="mle-txt">${e.text}</span>
      <span class="mle-num">#${_gameTurns - i}</span>
    </div>`).join('');
}

function openMoveLogModal() {
  _renderMoveLogBody();
  showModal('movelog');
}

function logMoveAction(piece, type, target) {
  const pc = CCSS[piece.color];
  const pn = `<b style="color:${pc}">${PNAME_SHORT[piece.type]} ${COLOR_FR[piece.color]}</b>`;
  let text = '';
  if (type === 'move') {
    text = `${pn} avance`;
  } else if (type === 'kill') {
    const tc = CCSS[target.color];
    const tn = `<b style="color:${tc}">${PNAME_SHORT[target.type]} ${COLOR_FR[target.color]}</b>`;
    text = `${pn} tue ${tn}`;
  } else if (type === 'dipl') {
    const tc = CCSS[target.color];
    const tn = `<b style="color:${tc}">${PNAME_SHORT[target.type]} ${COLOR_FR[target.color]}</b>`;
    text = `${pn} déplace ${tn}`;
  } else if (type === 'necro') {
    text = `${pn} ressuscite une dépouille`;
  } else if (type === 'resurrect') {
    const tc = CCSS[target.color];
    const tn = `<b style="color:${tc}">${PNAME_SHORT[target.type]} ${COLOR_FR[target.color]}</b>`;
    text = `${pn} ressuscite ${tn}`;
  } else {
    text = `${pn} joue`;
  }
  logMove({ color: CCSS[piece.color], text });
}

function recordWin()  { clearSave(); lsSet('insect_wins',  parseInt(lsGet('insect_wins','0'),10)  + 1); updateStatusBar(); }
function recordLoss() { clearSave(); lsSet('insect_losses',parseInt(lsGet('insect_losses','0'),10) + 1); updateStatusBar(); }


function goPremium() {
  window.location.href = STRIPE_URL;
}

// Ouvre la popup freemium.
// La croix est toujours visible — l'utilisateur peut toujours fermer.
function openFreemiumModal(blocking = false) {
  const closeBtn = document.getElementById('freemium-close');
  if (closeBtn) closeBtn.style.display = 'flex';

  const unlocked = isFreemium() || isPremium();
  const title    = document.querySelector('#modal-freemium .modal-title');
  const ftitle   = document.querySelector('#modal-freemium .freemium-title');
  const fsub     = document.querySelector('#modal-freemium .freemium-sub');
  const progress = document.querySelector('#modal-freemium .share-progress');

  if (unlocked) {
    if (title)    title.textContent   = 'Vous aimez IN-SECT ?';
    if (ftitle)   ftitle.textContent  = 'Soutenez le jeu';
    if (fsub)     fsub.innerHTML      = 'Partagez-le autour de vous ou offrez un coup de pouce avec le paiement unique. Chaque soutien compte !';
    if (progress) progress.style.display = 'none';
  } else {
    if (title)    title.textContent   = 'Vos 20 parties gratuites sont écoulées ?';
    if (ftitle)   ftitle.textContent  = 'Débloquez l\'accès illimité';
    if (fsub)     fsub.innerHTML      = 'Choisissez une méthode pour continuer à jouer.';
    if (progress) progress.style.display = '';
  }

  showModal('freemium');
  updateShareDots();
}
function tryStartGame() {
  if (hasAccess()) {
    consumeGame();
    updateStatusBar();
    startGame();
  } else {
    openFreemiumModal(true);
  }
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
  reporter:   "Se déplace sur une case <b>vide uniquement</b>. Depuis sa nouvelle position, <b>attaque toutes les pièces ennemies adjacentes</b> (orthogonales ET diagonales). Peut éliminer plusieurs cibles en un seul tour.",
  necromobile:"<b>Déplace une dépouille 💀</b> vers n'importe quelle case vide du plateau. <b>Pièce vitale</b> : sans elle, la Reine ne peut plus être protégée ou encerclée.",
  diplomate:  "<b>Déplace une pièce ennemie vivante</b> vers n'importe quelle case vide — sans la tuer. Permet de repositionner les menaces adverses à votre avantage.",
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


/* ═══════════════════════════════════════════
   [AUDIO] — Moteur WebAudio
   ═══════════════════════════════════════════ */
let _audioCtx = null;
function getACtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}
function tone(freq, type, vol, dur, attack = .015) {
  if (_sfxMuted) return;
  try {
    const ctx = getACtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + dur * .7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + .05);
  } catch(e) {}
}
function sfxSelect()   { tone(500,'square',.06,.07); setTimeout(()=>tone(700,'square',.04,.06),40); }
function sfxMove()     { tone(380,'triangle',.08,.09); setTimeout(()=>tone(480,'triangle',.055,.07),55); }
function sfxCapture()  {
  tone(180,'sawtooth',.18,.06,.005);
  setTimeout(()=>tone(120,'sawtooth',.14,.1,.005),30);
  setTimeout(()=>tone(80,'square',.1,.18,.01),60);
  setTimeout(()=>tone(1200,'square',.06,.04,.003),10);
}
function sfxQueenKill(){
  tone(200,'sawtooth',.22,.08,.004);
  setTimeout(()=>tone(140,'sawtooth',.18,.12,.005),25);
  setTimeout(()=>tone(80,'square',.15,.22,.01),50);
  setTimeout(()=>tone(1400,'square',.1,.05,.003),8);
  setTimeout(()=>tone(900,'square',.08,.08,.005),60);
  setTimeout(()=>tone(400,'triangle',.12,.3,.02),100);
}
function sfxDefeat()  { [330,280,220,180].forEach((f,i)=>setTimeout(()=>tone(f,'sawtooth',.14,.16,.025),i*150)); }
function sfxVictory() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,'square',.15,.35),i*110)); }
function sfxNid()     { tone(880,'square',.1,.09); setTimeout(()=>tone(1100,'triangle',.12,.18),80); }
function sfxStart()   { tone(261,'triangle',.1,.12); setTimeout(()=>tone(392,'triangle',.1,.12),120); setTimeout(()=>tone(523,'triangle',.14,.25),240); }
function sfxSPSpiral() {
  // Montée rapide puis descente — arpège magique sur 3s
  const notes = [523,659,784,1047,1319,1047,784,659,523,440,523,659,784];
  notes.forEach((f,i) => setTimeout(() => tone(f,'sine',.07,.18,.01), i * 220));
}

function toggleMute() {
  // Cycle : 🔊 tout ON → 🎵 sfx OFF → 🔇 tout OFF → 🔊 (bouton menu)
  if (!_muted && !_sfxMuted) {
    _sfxMuted = true;
    updateSndBtn('🎵');
  } else if (_muted === false && _sfxMuted) {
    _muted = true; _sfxMuted = true;
    stopBGM();
    updateSndBtn('🔇');
  } else {
    _muted = false; _sfxMuted = false;
    playBGM();
    updateSndBtn('🔊');
  }
}

// Ouvre la modal son (depuis le jeu)
function openSoundModal() {
  updateSoundModal();
  showModal('sound');
}

// Met à jour l'état visuel des toggles dans la modal
function updateSoundModal() {
  const trackMusic = document.getElementById('sound-track-music');
  const trackSfx   = document.getElementById('sound-track-sfx');
  if (trackMusic) trackMusic.classList.toggle('on', !_muted);
  if (trackSfx)   trackSfx.classList.toggle('on', !_sfxMuted);
  // Icône bouton son : toujours 🔊 (l'état est visible dans la modale)
  const btnGame = document.getElementById('snd-btn-game');
  const btnMenu = document.getElementById('snd-btn');
  if (btnGame) btnGame.textContent = '🔊';
  if (btnMenu) btnMenu.textContent = '🔊';
}

// Bascule uniquement la musique
function toggleMusic() {
  _muted = !_muted;
  if (_muted) stopBGM(); else playBGM();
  updateSoundModal();
  updateSndBtn('🔊');
}

// Bascule uniquement les bruitages
function toggleSFX() {
  _sfxMuted = !_sfxMuted;
  updateSoundModal();
  updateSndBtn('🔊');
}
function updateSndBtn(icon) {
  // Toujours 🔊, l'état son est visible dans la modale uniquement
  const btn = document.getElementById('snd-btn');
  if (btn) btn.textContent = '🔊';
  const btnGame = document.getElementById('snd-btn-game');
  if (btnGame) btnGame.textContent = '🔊';
}


/* ═══════════════════════════════════════════
   AMBIENT PARTICLES
   (initialisé dans DOMContentLoaded)
   ═══════════════════════════════════════════ */
function initAmbientParticles() {
  const cv = document.getElementById('c-ambient'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, pts = [];
  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  resize(); addEventListener('resize', resize);
  function mkP(rand) {
    return { x:Math.random()*W, y:rand?Math.random()*H:H+8, r:Math.random()*1.6+.3,
      s:Math.random()*.2+.06, op:Math.random()*.25+.05, d:(Math.random()-.5)*.12,
      life:0, ml:200+Math.random()*200 };
  }
  for (let i = 0; i < 24; i++) pts.push(mkP(true));
  let lf = 0;
  requestAnimationFrame(function draw(ts){
    requestAnimationFrame(draw);
    if (ts - lf < 40) return; lf = ts;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; p.x += p.d; p.y -= p.s; p.life++;
      if (p.y < -8 || p.life > p.ml) { pts[i] = mkP(false); continue; }
      const a = p.op * Math.sin((p.life / p.ml) * Math.PI);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(128,80,255,${a.toFixed(2)})`; ctx.fill();
    }
  });
}


/* ═══════════════════════════════════════════
   [FX] — Système de particules d'explosion
   ═══════════════════════════════════════════ */
const FX = {
  cv:null, ctx:null, pts:[], rings:[],
  init() {
    this.cv = document.getElementById('c-fx');
    this.cv.width = innerWidth; this.cv.height = innerHeight;
    addEventListener('resize', () => { this.cv.width = innerWidth; this.cv.height = innerHeight; });
    this.loop();
  },
  spawn(x, y, color) {
    const cs = { yellow:'#F0C030', green:'#30D060', blue:'#4090FF', red:'#FF3050' };
    const c = cs[color] || '#B080FF';
    for (let i = 0; i < 28; i++) {
      const a = Math.random()*Math.PI*2, sp = Math.random()*7+3, size = Math.random()*4+1.5;
      this.pts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:size,life:1,decay:.028+Math.random()*.025,c,type:'circ'});
    }
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2, sp = 6+Math.random()*5;
      this.pts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:2.5,life:1,decay:.045,c:'#FFFFFF',type:'star'});
    }
    this.rings.push({x,y,r:4,maxR:getCellSize()*1.4,life:1,c,speed:3.5});
  },
  spawnQueen(x, y, color) {
    this.spawn(x, y, color);
    const cs = { yellow:'#FFE060', green:'#60FF90', blue:'#80C0FF', red:'#FF8090' };
    const c = cs[color] || '#FFFFFF';
    for (let i = 0; i < 20; i++) {
      const a = Math.random()*Math.PI*2, sp = Math.random()*14+6;
      this.pts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:Math.random()*6+2,life:1,decay:.018+Math.random()*.015,c,type:'circ'});
    }
    this.rings.push({x,y,r:4,maxR:getCellSize()*2.8,life:1,c:'#FFFFFF',speed:5});
    this.rings.push({x,y,r:4,maxR:getCellSize()*2,life:1,c,speed:4});
  },
  loop() {
    requestAnimationFrame(() => this.loop());
    const ctx = this.ctx || (this.ctx = this.cv.getContext('2d'));
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    for (let i = this.rings.length-1; i >= 0; i--) {
      const rg = this.rings[i]; rg.r += rg.speed; rg.life = 1 - rg.r/rg.maxR;
      if (rg.life <= 0) { this.rings.splice(i,1); continue; }
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI*2);
      ctx.strokeStyle = rg.c; ctx.lineWidth = 3*rg.life; ctx.globalAlpha = rg.life*.8; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = this.pts.length-1; i >= 0; i--) {
      const p = this.pts[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=.15; p.life-=p.decay; p.vx*=.9; p.vy*=.96;
      if (p.life <= 0) { this.pts.splice(i,1); continue; }
      ctx.globalAlpha = p.life;
      if (p.type === 'star') {
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy,p.vx));
        ctx.fillStyle = p.c; ctx.fillRect(-p.r*2.5,-p.r*.5,p.r*5,p.r); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fillStyle = p.c; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
};


/* ═══════════════════════════════════════════
   [NAV] — Navigation entre écrans et modals
   ═══════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById('s-' + id);
  if (el) el.classList.remove('hidden');
}
function showModal(id) { document.getElementById('modal-' + id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById('modal-' + id).classList.add('hidden'); }
function resumeGame() {
  if (!loadSave()) { updateStatusBar(); return; }
  showScreen('game');
  buildBoard();
  renderBoard();
  renderPlayers();
  updateTurnUI();
  updateToggleUI();
  const bz = document.getElementById('bottom-zone');
  if (bz) bz.style.display = 'flex';
  showInfoText('▶ Partie reprise', 'Reprenez là où vous en étiez. Bonne chance !', '#8050FF');
  if (!G.players[cur()].human) {
    _aiTimer = setTimeout(() => aiTurn(finishTurn), 800);
  }
}

function goMenu() {
  if (_aiTimer) clearTimeout(_aiTimer);
  _animating = false; G.over = true;
  stopBGM();
  showScreen('menu');
  setTimeout(() => playBGM(), 200);
  updateModePreview(_mode);
  updateStatusBar();
}


/* ═══════════════════════════════════════════
   [MENU] — Sélection du mode de jeu
   ═══════════════════════════════════════════ */
function selMode(n) {
  _mode = n;
  document.getElementById('mbtn-1').classList.toggle('sel', n === 1);
  document.getElementById('mbtn-3').classList.toggle('sel', n === 3);
  document.getElementById('csel-1ia').style.display = n === 1 ? '' : 'none';
  document.getElementById('csel-3ia').style.display = n === 3 ? '' : 'none';
  _selColor = 'yellow';
  document.querySelectorAll('.cbtn').forEach(b => b.classList.remove('sel'));
  const pid = n === 1 ? 'csel-1ia' : 'csel-3ia';
  const btn = document.querySelector('#' + pid + ' .cbtn[data-c="yellow"]');
  if (btn) btn.classList.add('sel');
  updateModePreview(n);
}
function selCol(c) {
  _selColor = c;
  const pid = _mode === 1 ? 'csel-1ia' : 'csel-3ia';
  document.querySelectorAll('#' + pid + ' .cbtn').forEach(b => {
    b.classList.toggle('sel', c === 'random' ? b.dataset.c === 'random' : b.dataset.c === c);
  });
}
function selAI(n) {
  _aiLevel = n;
  document.querySelectorAll('.ailbtn').forEach(b => b.classList.remove('sel'));
  const btn = document.getElementById('ailbtn-' + n);
  if (btn) btn.classList.add('sel');
}
function resolveColor() {
  if (_selColor !== 'random') return _selColor;
  const opts = _mode === 1 ? ['yellow','red'] : ['yellow','green','blue','red'];
  return opts[Math.floor(Math.random() * opts.length)];
}

// Miniature SVG du plateau selon le mode
function updateModePreview(n) {
  const el = document.getElementById('mode-preview'); if (!el) return;
  const grid = Array.from({length:6}, (_,i) =>
    `<line x1="${6+i*12}" y1="6" x2="${6+i*12}" y2="66" stroke="rgba(128,80,255,.15)" stroke-width=".6"/>` +
    `<line x1="6" y1="${6+i*12}" x2="66" y2="${6+i*12}" stroke="rgba(128,80,255,.15)" stroke-width=".6"/>`
  ).join('');
  if (n === 1) {
    el.innerHTML = `<svg class="preview-svg" viewBox="0 0 72 72">
      <rect width="72" height="72" rx="5" fill="#07060F" stroke="rgba(128,80,255,.35)" stroke-width="1.5"/>
      ${grid}
      <rect x="30" y="30" width="12" height="12" rx="2" fill="rgba(212,160,23,.2)" stroke="rgba(212,160,23,.55)" stroke-width="1"/>
      <circle cx="16" cy="16" r="6" fill="#6030A0" stroke="rgba(160,96,255,.6)" stroke-width="1.2"/>
      <image href="reine_guepe_512.webp" x="10" y="10" width="12" height="12"/>
      <circle cx="56" cy="56" r="6" fill="#6A0010" stroke="rgba(255,80,100,.6)" stroke-width="1.2"/>
      <image href="reine_guepe_512.webp" x="50" y="50" width="12" height="12"/>
      <circle cx="28" cy="16" r="3.5" fill="rgba(160,96,255,.6)"/><circle cx="16" cy="28" r="3.5" fill="rgba(160,96,255,.6)"/>
      <circle cx="44" cy="56" r="3.5" fill="rgba(255,80,100,.6)"/><circle cx="56" cy="44" r="3.5" fill="rgba(255,80,100,.6)"/>
      <path d="M26 26 L46 46" stroke="rgba(255,48,80,.6)" stroke-width="1.5" stroke-dasharray="3,2" marker-end="url(#arh)"/>
      <defs><marker id="arh" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="rgba(255,48,80,.8)"/></marker></defs>
    </svg>
    <div class="preview-tagline">Duel stratégique · 2 colonies</div>`;
  } else {
    el.innerHTML = `<svg class="preview-svg" viewBox="0 0 72 72">
      <rect width="72" height="72" rx="5" fill="#07060F" stroke="rgba(212,160,23,.5)" stroke-width="1.5"/>
      ${grid}
      <rect x="30" y="30" width="12" height="12" rx="2" fill="rgba(212,160,23,.28)" stroke="rgba(212,160,23,.65)" stroke-width="1.2"/>
      <circle cx="12" cy="12" r="6" fill="#6030A0" stroke="rgba(240,192,48,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.webp" x="6" y="6" width="12" height="12"/>
      <circle cx="60" cy="12" r="6" fill="#0A5025" stroke="rgba(48,208,96,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.webp" x="54" y="6" width="12" height="12"/>
      <circle cx="12" cy="60" r="6" fill="#001A60" stroke="rgba(64,144,255,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.webp" x="6" y="54" width="12" height="12"/>
      <circle cx="60" cy="60" r="6" fill="#6A0010" stroke="rgba(255,48,80,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.webp" x="54" y="54" width="12" height="12"/>
      <line x1="18" y1="18" x2="30" y2="30" stroke="rgba(240,192,48,.4)" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="54" y1="18" x2="42" y2="30" stroke="rgba(48,208,96,.4)" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="18" y1="54" x2="30" y2="42" stroke="rgba(64,144,255,.4)" stroke-width="1" stroke-dasharray="2,2"/>
      <line x1="54" y1="54" x2="42" y2="42" stroke="rgba(255,48,80,.4)" stroke-width="1" stroke-dasharray="2,2"/>
    </svg>
    <div class="preview-tagline">Guerre totale · 4 colonies</div>`;
  }
}


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
    pe.className = `piece ${p.color}${isSel?' selp':''}${hasSP?' has-sp':''}`;
    pe.style.width = psize+'px'; pe.style.height = psize+'px';
    const cv = pe.querySelector('canvas');
    if (cv) drawPiece(cv, p.color, SYM[p.type], p.dead, isSel);
    if (isSel)      pe.style.filter = `drop-shadow(0 0 8px ${CGLOW2[p.color]||'#fff'}) brightness(1.15)`;
    else if (p.dead) pe.style.filter = 'none';
    else             pe.style.filter = `drop-shadow(0 0 4px ${CGLOW2[p.color]||'rgba(255,255,255,.3)'})`;
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
  if (ttxt)  { ttxt.textContent = `Tour de colonie ${CNAME[c]}${pl.human?' (Vous)':''}`; ttxt.style.color = CCSS[c]; }
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
    'place-resurrect': '💀✨ Choisissez une case pour ressusciter la pièce',
    'reporter-choose': '🪰 Choisissez : ortho 🔴 ou diag 🟠',
  };
  const msg = phases[G.phase] || '';
  setInfoPhase(msg);
}

function updatePieceInfo(piece) {
  // Topbar : icône + nom de la pièce
  const icon = document.getElementById('tban-piece-icon');
  const name = document.getElementById('tban-piece-name');
  const sym  = SYM[piece.type] || '';
  if (icon) { icon.innerHTML = `<img src="${sym}" style="width:26px;height:26px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(0,0,0,.7));" alt="">`; }
  if (name) { name.textContent = PFULL[piece.type] || PNAME[piece.type]; name.style.color = CCSS[piece.color]; }
  // Zone info : description + SP si applicable
  const sp = G.spPieces && G.spPieces[piece.id];
  const spTxt = sp ? `<br><span style="color:#C080FF;font-size:.7rem;">✨ ${SP_DESC[sp.type].split('!')[0]}${sp.type==='invincible'?' ('+sp.turns+' coups restants)':''}</span>` : '';
  setInfoDesc((PDESC[piece.type] || '') + spTxt);
}

function showInfoText(name, desc, color) {
  const icon = document.getElementById('tban-piece-icon');
  const nm   = document.getElementById('tban-piece-name');
  if (icon) icon.innerHTML = '';
  if (nm)   { nm.textContent = name; nm.style.color = color || 'var(--gold)'; }
  setInfoDesc(desc);
}

function setInfoDesc(html) {
  const d = document.getElementById('info-desc');
  if (!d) return;
  d.innerHTML = html || '';
  const zone = document.getElementById('info-zone');
  if (zone) zone.classList.toggle('has-phase', !!(html && document.getElementById('info-phase')?.classList.contains('visible')));
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
      if (!t) {
        const isNid = (nr===LAB.r && nc===LAB.c);
        if (isNid && type!=='chef') {
          nr+=dr; nc+=dc; continue;
        }
        moves.push({r:nr,c:nc});
      } else if (t.dead) { break; }
      else {
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
        if (nr===LAB.r&&nc===LAB.c) { nr+=dr; nc+=dc; continue; }
        moves.push({r:nr,c:nc});
      }
      else if (t.dead) { necroT.push({r:nr,c:nc,p:t}); break; }
      else { break; }
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
    delete G.spPieces[victim.id];
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
  const hasNecro = pl.pieces.some(p=>!p.dead&&p.type==='necromobile'&&p.color===color); if (hasNecro) return false;
  const visited = new Set(), queue = [[chef.r,chef.c]];
  visited.add(`${chef.r},${chef.c}`);
  while (queue.length) {
    const [r,c] = queue.shift();
    for (const [dr,dc] of DIRS8) {
      const nr = r+dr, nc = c+dc; if (!inB(nr,nc)) continue;
      const key = `${nr},${nc}`; if (visited.has(key)) continue;
      const cell = G.board[nr][nc];
      if (cell&&cell.dead) continue;
      visited.add(key); queue.push([nr,nc]);
    }
  }
  let freeFound = false;
  for (const key of visited) {
    const [r,c] = key.split(',').map(Number);
    if (r===chef.r&&c===chef.c) continue;
    if (!G.board[r][c]) { freeFound = true; break; }
  }
  return !freeFound;
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
    // Trouver une case libre
    const cell = pickFreeCell(false);
    if (!cell) continue;
    p.dead = false;
    placeOnBoard(p, cell.r, cell.c);
    // Redessiner la pièce vivante
    const pe = document.getElementById('p' + p.id);
    if (pe) {
      const cv = pe.querySelector('canvas');
      if (cv) drawPiece(cv, p.color, SYM[p.type], false, false);
      pe.classList.remove('has-sp');
    }
    showInfoText('👻 Résurrection fantôme !',
      `<b style="color:${CCSS[p.color]}">${PNAME_SHORT[p.type]} ${COLOR_FR[p.color]}</b> revient à la vie après 30 tours !`,
      CCSS[p.color]);
    logMove({ color: CCSS[p.color], text: `<b style="color:${CCSS[p.color]}">${PNAME_SHORT[p.type]} ${COLOR_FR[p.color]}</b> ressuscite (fantôme)` });
  }
  renderBoard();
}

function checkStalemates() {
  for (const color of [...G.order]) {
    if (!G.players[color].alive) continue;
    if (isQueenTrapped(color)) {
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
  const kpl = killerColor&&killerColor!==color ? G.players[killerColor] : null;
  if (kpl&&kpl.alive) {
    for (const p of pl.pieces) { if (!p.dead) { p.color=killerColor; kpl.pieces.push(p); } }
    pl.pieces = pl.pieces.filter(p=>p.dead);
  } else {
    for (const p of pl.pieces) if (!p.dead) p.dead=true;
  }
  G.order = G.order.filter(c=>c!==color); if (G.idx>=G.order.length) G.idx=0;
  if (G.labActive===color) { G.labActive=null; G.labExtra=-1; }
  if (color===G.human) {
    G.over=true; if(_aiTimer)clearTimeout(_aiTimer);
    setTimeout(()=>{
      sfxDefeat();
      setText('etitle','DÉFAITE');
      document.getElementById('etitle').style.cssText='background:linear-gradient(135deg,#6A0010,#FF3050,#6A0010);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:"Cinzel Decorative",serif;font-size:2.2rem;';
      document.getElementById('ecrown').textContent='💀';
      setText('esub','Votre Reine a été encerclée sans Scarabée pour la libérer.');
      const ewinnerEl = document.getElementById('ewinner');
      if (ewinnerEl) ewinnerEl.innerHTML = '';
      setText('end-turns',_gameTurns);setText('end-caps',_gameCaps);
      showScreen('end');
    },700);
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

  if (G.phase === 'place-corpse'){
    if (G.board[r][c]) { toast('Case occupée'); return; }
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
    if (G.board[r][c] && !(G.board[r][c].dead)) { showInfoText('❌ Case occupée', 'Choisissez une case vide pour ressusciter la pièce.', '#FF6060'); return; }
    const corpse = G.pendDisp;
    // Changer la couleur de la dépouille → couleur du scarabée
    const oldColor = corpse.color;
    corpse.color = G.pendNecroColor;
    corpse.dead = false;
    // Retirer de l'ancienne équipe et ajouter à la nouvelle
    if (G.players[oldColor]) G.players[oldColor].pieces = G.players[oldColor].pieces.filter(p=>p.id!==corpse.id);
    if (G.players[corpse.color]) G.players[corpse.color].pieces.push(corpse);
    // Placer sur le plateau
    if (G.board[r][c] && G.board[r][c].dead) removeFromBoard(G.board[r][c]);
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
    // Si la pièce sélectionnée est une coccinelle avec move-allies, vérifier si cet allié est une cible diplT
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

  if (!mv&&!kl&&!dl&&!nc) { G.sel=null; renderBoard(); return; }
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
    checkSPCellCapture(piece,r,c);
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
  _animating=true;
  animMove(piece,toR,toC).then(()=>{
    tickSPTurns(piece);
    const sp = G.spPieces[piece.id];
    if (piece.type==='assassin' && sp && sp.type==='double-kill') {
      executeDoubleKill(piece, victim, fromR, fromC);
      handleNid(piece); G.sel=null; renderBoard(); finishTurn(); return;
    }
    const needPlace=executeKill(piece,victim);
    if (piece.type==='assassin'){
      placeOnBoard(victim,fromR,fromC);
      handleNid(piece); G.sel=null; renderBoard(); finishTurn(); return;
    }
    if (needPlace){
      G.phase='place-corpse';
      G.afterCorpse=()=>{ handleNid(piece); G.sel=null; finishTurn(); };
      showInfoText('💀 Placez la dépouille', 'Choisissez une case libre pour la dépouille.', '#888');
      renderBoard(); updateTurnUI(); return;
    }
    handleNid(piece); G.sel=null; renderBoard(); finishTurn();
  });
}

function doDipl(piece,victim,toR,toC){
  logMoveAction(piece, 'dipl', victim);
  removeFromBoard(victim); _animating=true;
  animMove(piece,toR,toC).then(()=>{
    G.pendDisp=victim; G.phase='place-dipl';
    showInfoText('🐛 Déplacement', 'Placez la pièce sur une case vide.', '#888');
    renderBoard(); updateTurnUI();
  });
}

function doNecro(piece,corpse,toR,toC){
  const acts = getActionsWithSP(piece);
  if (acts.resurrectMode) {
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
  logMoveAction(piece, 'necro', corpse);
  removeFromBoard(corpse); _animating=true;
  animMove(piece,toR,toC).then(()=>{
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

  // Vérifier fin de pacte et déclencher super pouvoirs
  checkPactEnd();
  if (checkSPTrigger()) return; // SP en cours — finishTurn sera repris par closeSPResult

  const justPlayed=cur();
  const twoPlayer=(G.order.length<=2);
  G.turn++;_gameTurns++;

  // Résurrection automatique : pièces mortes avec SP actif au moment de la mort
  checkGhostResurrections();

  const nidCell=G.board[LAB.r][LAB.c];
  const nidColor=(nidCell&&!nidCell.dead&&nidCell.type==='chef'&&G.order.includes(nidCell.color)&&G.players[nidCell.color]&&G.players[nidCell.color].alive)?nidCell.color:null;
  if(nidColor!==G.labActive){G.labActive=nidColor;G.labExtra=-1;}

  if(twoPlayer){
    if(G.labActive===justPlayed&&G.labExtra===-1){
      G.labExtra=1;
      renderBoard();renderPlayers();updateTurnUI();
      if(!G.players[justPlayed].human){_aiTimer=setTimeout(()=>aiTurn(finishTurn),600);}
      return;
    }
    if(G.labExtra===1&&G.labActive===justPlayed){G.labExtra=-1;}
  } else {
    // FFA : le propriétaire du Nid rejoue après chaque adversaire
    // G.labExtra mémorise l'idx de l'adversaire qui vient de jouer
    // Ordre avec Jaune sur le Nid (order=[jaune,vert,rouge,bleu]) :
    //   Jaune(0)→Vert(1)→Jaune(0)→Rouge(2)→Jaune(0)→Bleu(3)→Jaune(0)→...
    if(G.labActive){
      const nidIdx=G.order.indexOf(G.labActive);
      if(justPlayed===G.labActive){
        // Le proprio du Nid vient de jouer son tour intercalé
        // On avance à l'adversaire suivant (labExtra contient l'idx du dernier adversaire)
        const lastOpponentIdx = G.labExtra >= 0 ? G.labExtra : (nidIdx + G.order.length - 1) % G.order.length;
        let nextIdx = (lastOpponentIdx + 1) % G.order.length;
        // Sauter le proprio du Nid s'il tombe dessus
        if(nextIdx === nidIdx) nextIdx = (nextIdx + 1) % G.order.length;
        G.labExtra = nextIdx;
        G.idx = nextIdx;
        renderBoard();renderPlayers();updateTurnUI();
        if(G.players[cur()]&&!G.players[cur()].human&&G.players[cur()].alive){
          _aiTimer=setTimeout(()=>aiTurn(finishTurn),500+Math.random()*400);
        }
        return;
      } else {
        // Un adversaire vient de jouer — mémoriser son idx et donner la main au Nid
        G.labExtra = G.order.indexOf(justPlayed);
        G.idx = nidIdx;
        renderBoard();renderPlayers();updateTurnUI();
        if(!G.players[cur()].human&&G.players[cur()].alive){
          _aiTimer=setTimeout(()=>aiTurn(finishTurn),500+Math.random()*400);
        }
        return;
      }
    }

  } // fin du else (pas de Nid actif)

  G.idx=(G.idx+1)%G.order.length;
  renderBoard();renderPlayers();updateTurnUI();
  if(G.players[cur()]&&!G.players[cur()].human&&G.players[cur()].alive){
    _aiTimer=setTimeout(()=>aiTurn(finishTurn),500+Math.random()*400);
  }
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


/* ═══════════════════════════════════════════
   [AI] — Moteur d'intelligence artificielle
   ═══════════════════════════════════════════ */
const AI_PERSONALITIES = ['aggressive','opportunist','defensive','manipulator'];
let _aiPersonalities = {};

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
    for(const m of acts.moves)  all.push({piece:p,type:'move', target:null,toR:m.r,toC:m.c});
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
  const queenKill=all.find(mv=>mv.type==='kill'&&mv.target.type==='chef');
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
    case 'move-allies': {
      // Coccinelle déplace alliés : vaut si des alliés sont mal placés
      const myPieces = G.players[color].pieces.filter(p=>!p.dead&&p.type!=='chef');
      const badlyPlaced = myPieces.filter(p => {
        const threats = countThreatsTo(p.r, p.c, color);
        return threats > 0;
      }).length;
      base = 80 + badlyPlaced * 60;
      break;
    }
    case 'resurrect': {
      // Scarabée ressuscite : vaut beaucoup si l'IA a peu de pièces
      const myCount = G.players[color].pieces.filter(p=>!p.dead).length;
      const deadCount = G.players[color].pieces.filter(p=>p.dead).length; // dépouilles dispo
      // Aussi utile si des dépouilles ennemies fortes traînent
      const corpseCount = G.order.reduce((n,c)=>{
        if(!G.players[c])return n;
        return n + G.players[c].pieces.filter(p=>p.dead&&G.board[p.r]&&G.board[p.r][p.c]===p).length;
      }, 0);
      base = 60 + (7 - Math.min(myCount, 6)) * 40 + corpseCount * 25;
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
  const queenKill=all.find(mv=>mv.type==='kill'&&mv.target.type==='chef');
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

// Minimax profondeur 2 : teste mon coup → meilleure réponse adverse → évalue
function minimaxScore(mv, myColor) {
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
    // Scorer chaque réponse adverse sur l'état après mon coup
    let bestOppScore = -Infinity;
    let bestOppEval = worstForMe;
    // Trier par score de base avant de garder les 20 meilleurs (adversaire joue mieux)
    const oppScored = oppMoves.map(omv => ({ omv, s: scoreAIMove(omv, opp) }));
    oppScored.sort((a,b) => b.s - a.s);
    for (const { omv } of oppScored.slice(0, 20)) {
      const state2 = { players: {}, board: state1.board.map(r=>[...r]) };
      for (const c of G.order) state2.players[c] = state1.players[c] ? { ...state1.players[c], pieces: state1.players[c].pieces.map(p=>({...p})) } : null;
      applyMoveToState(state2, omv);
      const e = evalState(state2, myColor);
      // L'adversaire veut minimiser mon score
      if (-e > bestOppScore) { bestOppScore = -e; bestOppEval = e; }
    }
    worstForMe = Math.min(worstForMe, bestOppEval);
  }
  return worstForMe;
}

// Niveau 3 — minimax profondeur 2 + instinct de survie
function aiLevel3(color){
  const all=getAllMoves(color); if(!all.length) return null;

  // Priorité ABSOLUE : tuer la Reine ennemie si possible.
  // La partie se termine immédiatement — peu importe si la case est menacée après,
  // il n'y aura pas de "tour d'après" pour l'adversaire.
  const queenKill = all.find(mv => mv.type==='kill' && mv.target.type==='chef');
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
        const scored = escapes.map(mv => ({ mv, s: minimaxScore(mv, color) }));
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

  const scored = pool.map(mv => {
    let s = minimaxScore(mv, color);
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
    // Le Nid ne vaut le coup que si ça libère une attaque (le minimax le détecte naturellement)
    // Pas besoin de bonus supplémentaire
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

  // Stratégie de placement : scorer chaque case libre
  // But : placer la dépouille là où elle gêne le plus les adversaires
  // et/ou là où nos pièces peuvent facilement l'atteindre
  const chef = G.players[killerColor]?.pieces.find(p=>p.type==='chef'&&!p.dead);
  const scored = free.map(cell => {
    let s = 0;
    // Loin des pièces alliées = mauvais (nos pièces ne peuvent pas facilement y aller)
    let minAllyDist = 99;
    for(const p of (G.players[killerColor]?.pieces||[])){
      if(p.dead) continue;
      const d = Math.max(Math.abs(p.r-cell.r), Math.abs(p.c-cell.c));
      if(d < minAllyDist) minAllyDist = d;
    }
    s -= minAllyDist * 15; // pénalité distance alliés

    // Proche des pièces ennemies = bon (gêne, bloque, menace)
    for(const ec of G.order){
      if(ec===killerColor) continue;
      if(!G.players[ec]||!G.players[ec].alive) continue;
      for(const ep of G.players[ec].pieces){
        if(ep.dead) continue;
        const d = Math.max(Math.abs(ep.r-cell.r), Math.abs(ep.c-cell.c));
        if(d<=2) s += (3-d)*20; // bonus proximité ennemie
      }
    }

    // Proche du centre = légèrement mieux
    s += (4-Math.max(Math.abs(cell.r-4),Math.abs(cell.c-4)))*5;

    // Pas trop proche de notre propre Reine (la protéger)
    if(chef){
      const dChef = Math.max(Math.abs(chef.r-cell.r), Math.abs(chef.c-cell.c));
      if(dChef<=1) s -= 40;
    }

    s += Math.random()*10; // légère imprévisibilité
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
      if(piece.type==='reporter'){
        const rts=getRepAdj(piece);
        if(rts.length>0){
          const orthoCount=rts.filter(t=>t.ortho).length;
          const diagCount=rts.filter(t=>!t.ortho).length;
          execReporterNueeAI(piece,orthoCount>=diagCount,color,onDone);return;
        }
      }
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='kill'){
    logMoveAction(piece,'kill',target);
    const fromR=piece.r,fromC=piece.c;
    animMove(piece,toR,toC).then(()=>{
      const needPlace=executeKill(piece,target);
      if(piece.type==='assassin'){
        placeOnBoard(target,fromR,fromC);
        handleNid(piece);renderBoard();onDone();return;
      }
      if(needPlace){
        const cell=pickFreeCell(true, color);
        if(cell)placeOnBoard(target,cell.r,cell.c);
        G.pendCorpse=null;G.phase='select';
      }
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='dipl'){
    logMoveAction(piece,'dipl',target);
    removeFromBoard(target);
    animMove(piece,toR,toC).then(()=>{
      const cell=pickFreeCell(false, color);
      if(cell)placeOnBoard(target,cell.r,cell.c);
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='necro'){
    logMoveAction(piece,'necro',target);
    const acts = getActionsWithSP(piece);
    if (acts.resurrectMode) {
      // SP Résurrection : changer couleur de la dépouille et la placer sur une case libre
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
        const cell=pickFreeCell(true);
        if(cell)placeOnBoard(target,cell.r,cell.c);
        handleNid(piece);renderBoard();onDone();
      });
    }
  }
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
  diplomate:   'move-allies',
  assassin:    'double-kill',
  chef:        'invincible',
  necromobile: 'resurrect',
};
const SP_DESC = {
  'queen-move':  'La Fourmi se déplace désormais comme une Reine (portée illimitée) !',
  'area-kill':   'La Mouche tue maintenant dans les 8 directions autour d\'elle !',
  'move-allies': 'La Coccinelle peut déplacer ses propres pièces alliées !',
  'double-kill': 'L\'Araignée peut tuer deux pièces à la fois dans la même ligne !',
  'invincible':  'La Reine est invincible pendant 4 coups !',
  'resurrect':   'Le Scarabée peut ressusciter une dépouille et la faire rejoindre sa colonie !',
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
    // Case vide — aura en attente, pas de modal, on débloque et on reprend
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

function showSPResult(piece, spType) {
  const name = PNAME[piece.type];
  const col  = CCSS[piece.color];
  // Pause : bloquer les actions
  G.spPaused = true;
  _animating = true;
  // Créer/réutiliser le modal SP
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
  const justPlayed = G.lastActor;
  const twoPlayer = (G.order.length <= 2);

  const nidCell = G.board[LAB.r][LAB.c];
  const nidColor = (nidCell && !nidCell.dead && nidCell.type === 'chef' && G.order.includes(nidCell.color) && G.players[nidCell.color] && G.players[nidCell.color].alive) ? nidCell.color : null;
  if (nidColor !== G.labActive) { G.labActive = nidColor; G.labExtra = -1; }

  if (twoPlayer) {
    if (G.labActive === justPlayed && G.labExtra === -1) {
      G.labExtra = 1;
      renderBoard(); renderPlayers(); updateTurnUI();
      if (!G.players[justPlayed].human) { _aiTimer = setTimeout(() => aiTurn(finishTurn), 600); }
      return;
    }
    if (G.labExtra === 1 && G.labActive === justPlayed) { G.labExtra = -1; }
  } else {
    if (G.labActive) {
      const nidIdx = G.order.indexOf(G.labActive);
      if (justPlayed === G.labActive) {
        const lastOpponentIdx = G.labExtra >= 0 ? G.labExtra : (nidIdx + G.order.length - 1) % G.order.length;
        let nextIdx = (lastOpponentIdx + 1) % G.order.length;
        if (nextIdx === nidIdx) nextIdx = (nextIdx + 1) % G.order.length;
        G.labExtra = nextIdx; G.idx = nextIdx;
        renderBoard(); renderPlayers(); updateTurnUI();
        if (G.players[cur()] && !G.players[cur()].human && G.players[cur()].alive) {
          _aiTimer = setTimeout(() => aiTurn(finishTurn), 500 + Math.random() * 400);
        }
        return;
      } else {
        G.labExtra = G.order.indexOf(justPlayed);
        G.idx = nidIdx;
        renderBoard(); renderPlayers(); updateTurnUI();
        if (!G.players[cur()].human && G.players[cur()].alive) {
          _aiTimer = setTimeout(() => aiTurn(finishTurn), 500 + Math.random() * 400);
        }
        return;
      }
    }
  }

  G.idx = (G.idx + 1) % G.order.length;
  renderBoard(); renderPlayers(); updateTurnUI();
  if (G.players[cur()] && !G.players[cur()].human && G.players[cur()].alive) {
    _aiTimer = setTimeout(() => aiTurn(finishTurn), 500 + Math.random() * 400);
  }
}

// Vérifie si une case vide avec aura reçoit une pièce
function checkSPCellCapture(piece, r, c) {
  const key = `${r},${c}`;
  if (!G.spCells[key]) return;
  delete G.spCells[key];
  const spType = SP_TYPES[piece.type];
  if (spType) {
    G.spPieces[piece.id] = { type: spType, turns: spType === 'invincible' ? 4 : Infinity };
    renderBoard();
    const pEl = document.getElementById('p' + piece.id);
    if (pEl) pEl.classList.add('has-sp');
    showSPResult(piece, spType);
  }
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
    case 'move-allies': {
      // Coccinelle → peut aussi déplacer ses alliés vivants comme la diplomate le ferait pour les ennemis
      const allyTargets = [];
      const { r, c, color } = piece;
      for (const [dr,dc] of DIRS8) {
        let nr = r+dr, nc = c+dc;
        while (inB(nr,nc)) {
          const t = G.board[nr][nc];
          if (!t) { nr+=dr; nc+=dc; continue; }
          if (t.dead) break;
          if (t.color === color && t.id !== piece.id) { allyTargets.push({r:nr,c:nc,p:t}); break; }
          break;
        }
      }
      // On réutilise diplT pour transporter les alliés (même mécanique)
      return { moves: base.moves, kills: base.kills, diplT: [...base.diplT, ...allyTargets], necroT: base.necroT };
    }
    case 'resurrect': {
      // Scarabée → peut choisir une dépouille sur tout le plateau pour la ressusciter
      const corpseTargets = [];
      for (let rr=0;rr<9;rr++) for (let cc=0;cc<9;cc++) {
        const t = G.board[rr][cc];
        if (t && t.dead) {
          corpseTargets.push({r:rr,c:cc,p:t,isResurrect:true});
        }
      }
      return { moves: base.moves, kills: base.kills, diplT: base.diplT, necroT: corpseTargets, resurrectMode: true };
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


/* ═══════════════════════════════════════════
   [BGM] — Musique de fond (insect.mp3)
   Stratégie identique à Clash Royale :
   - L'élément <audio> est créé dès le boot
   - play() tenté au premier geste (touch/click sur le splash)
   - Si autoplay bloqué, on réessaie à la transition menu
   - toggleMute() coupe/reprend aussi la BGM
   ═══════════════════════════════════════════ */
let _bgm = null;

function initBGM() {
  _bgm = new Audio('insect.mp3');
  _bgm.loop = true;
  _bgm.volume = 0.45;
  _bgm.preload = 'auto';
}

function playBGM() {
  if (!_bgm || _muted) return; // _muted = BGM off
  if (_bgm.paused) {
    _bgm.play().catch(() => {
      // Autoplay bloqué — réessai au prochain geste utilisateur
    });
  }
}

function stopBGM() {
  if (_bgm && !_bgm.paused) _bgm.pause();
}



document.addEventListener('DOMContentLoaded', () => {

  initAmbientParticles();
  FX.init();
  initBGM();

  // Vérifie le retour Stripe dès le chargement
  checkPremiumReturn();

  // Sauvegarde forcée quand l'onglet est quitté ou l'app mise en arrière-plan
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && G && !G.over) saveGame();
  });
  window.addEventListener('beforeunload', () => {
    if (G && !G.over) saveGame();
  });
  window.addEventListener('pagehide', () => {
    if (G && !G.over) saveGame();
  });

  setTimeout(() => {
    const btn = document.getElementById('splash-enter-btn');
    if (btn) btn.style.animation = 'splashBtnPulse 1.5s ease-in-out infinite';
  }, 1800);

});

// Appelé quand l'utilisateur clique sur "Entrer dans la colonie"
function splashEnter() {
  // Ce clic utilisateur débloque l'autoplay audio
  if (!_audioCtx) try { getACtx(); } catch(e) {}
  playBGM();

  showScreen('menu');
  selMode(1); selCol('yellow'); selAI(1);
  updateModePreview(1);
  updateStatusBar();

  // Premier lancement : ouvrir le tuto automatiquement
  if (!lsGet('insect_tuto_seen')) {
    lsSet('insect_tuto_seen', '1');
    setTimeout(() => openTuto(), 600);
  }
}
