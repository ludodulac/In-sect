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


/* ═══════════════════════════════════════════
   [ANALYTICS] — Funnel produit / acquisition
   Les données restent dans GA4 (Measurement ID chargé dans index.html).
   Ce module ne bloque jamais le jeu si Analytics est indisponible.
   ═══════════════════════════════════════════ */
function gaTrack(eventName, params = {}) {
  try {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, {
      game_mode: typeof _mode !== 'undefined' ? (_mode === 1 ? 'duel' : '4_colonies') : undefined,
      ai_level: typeof _aiLevel !== 'undefined' ? _aiLevel : undefined,
      super_powers: typeof _optSP !== 'undefined' ? !!_optSP : undefined,
      ...params,
    });
  } catch (e) {
    // Analytics ne doit jamais perturber une partie.
  }
}

function installAnalyticsHooks() {
  // Début de partie : métrique principale du haut de funnel.
  if (typeof startGame === 'function' && !startGame.__gaWrapped) {
    const originalStartGame = startGame;
    const wrappedStartGame = function(...args) {
      gaTrack('game_start', {
        selected_colony: typeof _selColor !== 'undefined' ? _selColor : undefined,
      });
      return originalStartGame.apply(this, args);
    };
    wrappedStartGame.__gaWrapped = true;
    startGame = wrappedStartGame;
  }

  // Reprise d'une partie sauvegardée.
  if (typeof resumeGame === 'function' && !resumeGame.__gaWrapped) {
    const originalResumeGame = resumeGame;
    const wrappedResumeGame = function(...args) {
      gaTrack('game_resume');
      return originalResumeGame.apply(this, args);
    };
    wrappedResumeGame.__gaWrapped = true;
    resumeGame = wrappedResumeGame;
  }

  // Partage : on mesure l'intention. Le navigateur ne fournit pas toujours
  // une confirmation fiable de la destination finale du partage.
  if (typeof doShare === 'function' && !doShare.__gaWrapped) {
    const originalDoShare = doShare;
    const wrappedDoShare = function(...args) {
      gaTrack('share_attempt', {
        turns_played: typeof _gameTurns !== 'undefined' ? _gameTurns : 0,
        victories: (() => {
          try {
            const key = `insect_wins_${_mode}ia_${_aiLevel}`;
            return parseInt(lsGet(key, '0'), 10) || 0;
          } catch(e) { return 0; }
        })(),
      });
      return originalDoShare.apply(this, args);
    };
    wrappedDoShare.__gaWrapped = true;
    doShare = wrappedDoShare;
  }

  // Tutoriel : ouverture explicite ou automatique au premier lancement.
  if (typeof openTuto === 'function' && !openTuto.__gaWrapped) {
    const originalOpenTuto = openTuto;
    const wrappedOpenTuto = function(...args) {
      gaTrack('tutorial_start');
      return originalOpenTuto.apply(this, args);
    };
    wrappedOpenTuto.__gaWrapped = true;
    openTuto = wrappedOpenTuto;
  }

  // Fin de partie sans toucher aux règles : on observe simplement l'écran END.
  const endScreen = document.getElementById('s-end');
  if (endScreen && !endScreen.dataset.gaObserved) {
    endScreen.dataset.gaObserved = '1';
    let wasVisible = !endScreen.classList.contains('hidden');
    const observer = new MutationObserver(() => {
      const isVisible = !endScreen.classList.contains('hidden');
      if (isVisible && !wasVisible) {
        const title = (document.getElementById('etitle')?.textContent || '').trim().toLowerCase();
        const result = title.includes('victoire') ? 'victory' : title.includes('défaite') ? 'defeat' : 'finished';
        gaTrack('game_complete', {
          result,
          turns_played: typeof _gameTurns !== 'undefined' ? _gameTurns : undefined,
          pieces_captured: typeof _gameCaps !== 'undefined' ? _gameCaps : undefined,
        });
      }
      wasVisible = isVisible;
    });
    observer.observe(endScreen, { attributes: true, attributeFilter: ['class'] });
  }
}


document.addEventListener('DOMContentLoaded', () => {

  initAmbientParticles();
  FX.init();
  initBGM();
  installAnalyticsHooks();

  gaTrack('app_loaded', {
    standalone: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches,
    language: navigator.language || undefined,
  });

  // Sauvegarde forcée quand l'onglet est quitté ou l'app mise en arrière-plan
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && G && !G.over) {
      saveGame();
      gaTrack('game_backgrounded', {
        turns_played: typeof _gameTurns !== 'undefined' ? _gameTurns : undefined,
        pieces_captured: typeof _gameCaps !== 'undefined' ? _gameCaps : undefined,
      });
    }
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
  gaTrack('splash_enter');

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
