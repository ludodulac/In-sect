/* ===============================================================
   IN-SECT — NAV and MENU — Navigation ecrans/modals, selection mode de jeu
   Module 03-nav-menu.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

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

/* ── Feedback ── */
let _feedbackPiece = '';
function selectFeedbackPiece(btn, piece) {
  _feedbackPiece = piece;
  document.querySelectorAll('.feedback-piece-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}
function sendFeedback() {
  const txt    = (document.getElementById('feedback-text').value || '').trim();
  const piece  = _feedbackPiece;
  const wins   = lsGet('insect_wins',  '0');
  const losses = lsGet('insect_losses','0');
  const parts  = [
    piece  ? `Ma pièce favorite : ${piece}` : '',
    txt    ? `Mon message :\n${txt}` : '',
    `Stats : ${wins} victoire(s) / ${losses} défaite(s)`,
  ].filter(Boolean).join('\n\n');
  const subject = encodeURIComponent("Avis IN-SECT — L'Échiquier des Colonies");
  const body    = encodeURIComponent(parts || "Bonjour, voici mon avis sur IN-SECT…");
  window.location.href = `mailto:ludodulac@gmail.com?subject=${subject}&body=${body}`;
  hideModal('feedback');
}

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
  updateStatusBar();
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
  updateStatusBar();
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


