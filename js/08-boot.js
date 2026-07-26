/* ===============================================================
   IN-SECT — BOOT — Musique de fond, demarrage de application
   Module 08-boot.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

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

  // Sauvegarde forcée quand l'onglet est quitté ou l'app mise en arrière-plan
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && G && !G.over) saveGame();
    if (document.visibilityState === 'visible') {
      const gameScreen = document.getElementById('s-game');
      const isGameScreen = gameScreen && !gameScreen.classList.contains('hidden');
      if (isGameScreen && G && !G.over) {
        // Toujours reconstruire au retour — coût négligeable, fiabilité maximale
        buildBoard(); renderBoard(); renderPlayers(); updateTurnUI();
      }
    }
  });
  window.addEventListener('beforeunload', () => { if (G && !G.over) saveGame(); });
  window.addEventListener('pagehide',      () => { if (G && !G.over) saveGame(); });
  setInterval(() => { if (G && !G.over) saveGame(); }, 15000);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && G && !G.over) {
      buildBoard(); renderBoard(); renderPlayers(); updateTurnUI();
    }
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
