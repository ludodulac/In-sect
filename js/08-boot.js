/* ===============================================================
   IN-SECT — BOOT — Musique de fond, demarrage de application
   Module 08-boot.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

let _bgm = null;

function initBGM() {
  _bgm = new Audio('insect.mp3');
  _bgm.loop = true;
  _bgm.volume = 0.45;
  _bgm.preload = 'auto';
}
function playBGM() { if (_bgm && !_muted && _bgm.paused) _bgm.play().catch(()=>{}); }
function stopBGM() { if (_bgm && !_bgm.paused) _bgm.pause(); }

function gaTrack(eventName, params = {}) {
  try {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, {
      game_mode: typeof _mode !== 'undefined' ? (_mode === 1 ? 'duel' : '4_colonies') : undefined,
      ai_level: typeof _aiLevel !== 'undefined' ? _aiLevel : undefined,
      super_powers: typeof _optSP !== 'undefined' ? !!_optSP : undefined,
      ...params,
    });
  } catch (e) {}
}

function installAnalyticsHooks() {
  if (typeof startGame === 'function' && !startGame.__gaWrapped) {
    const originalStartGame = startGame;
    const wrappedStartGame = function(...args) {
      gaTrack('game_start', { selected_colony: typeof _selColor !== 'undefined' ? _selColor : undefined });
      return originalStartGame.apply(this, args);
    };
    wrappedStartGame.__gaWrapped = true;
    startGame = wrappedStartGame;
  }
  if (typeof resumeGame === 'function' && !resumeGame.__gaWrapped) {
    const originalResumeGame = resumeGame;
    const wrappedResumeGame = function(...args) { gaTrack('game_resume'); return originalResumeGame.apply(this, args); };
    wrappedResumeGame.__gaWrapped = true;
    resumeGame = wrappedResumeGame;
  }
  if (typeof doShare === 'function' && !doShare.__gaWrapped) {
    const originalDoShare = doShare;
    const wrappedDoShare = function(...args) {
      gaTrack('share_attempt', { turns_played: typeof _gameTurns !== 'undefined' ? _gameTurns : 0 });
      return originalDoShare.apply(this, args);
    };
    wrappedDoShare.__gaWrapped = true;
    doShare = wrappedDoShare;
  }
  if (typeof openTuto === 'function' && !openTuto.__gaWrapped) {
    const originalOpenTuto = openTuto;
    const wrappedOpenTuto = function(...args) { gaTrack('tutorial_start'); return originalOpenTuto.apply(this, args); };
    wrappedOpenTuto.__gaWrapped = true;
    openTuto = wrappedOpenTuto;
  }
  const endScreen = document.getElementById('s-end');
  if (endScreen && !endScreen.dataset.gaObserved) {
    endScreen.dataset.gaObserved = '1';
    let wasVisible = !endScreen.classList.contains('hidden');
    const observer = new MutationObserver(() => {
      const isVisible = !endScreen.classList.contains('hidden');
      if (isVisible && !wasVisible) {
        const title = (document.getElementById('etitle')?.textContent || '').trim().toLowerCase();
        const result = title.includes('victoire') ? 'victory' : title.includes('défaite') ? 'defeat' : 'finished';
        gaTrack('game_complete', { result, turns_played: _gameTurns, pieces_captured: _gameCaps });
      }
      wasVisible = isVisible;
    });
    observer.observe(endScreen, { attributes: true, attributeFilter: ['class'] });
  }
}

function loadMultiplayerClient() {
  if (document.getElementById('insect-mp-config')) return;
  const cfg = document.createElement('script');
  cfg.id = 'insect-mp-config';
  cfg.src = 'js/09-multiplayer-config.js';
  cfg.onload = () => {
    const mp = document.createElement('script');
    mp.id = 'insect-mp-client';
    mp.src = 'js/09-multiplayer.js';
    mp.onload = () => {
      const resume = document.createElement('script');
      resume.id = 'insect-mp-resume';
      resume.src = 'js/10-multiplayer-resume.js';
      resume.onload = () => {
        const ready = document.createElement('script');
        ready.id = 'insect-mp-ready';
        ready.src = 'js/11-multiplayer-ready.js';
        document.body.appendChild(ready);
      };
      document.body.appendChild(resume);
    };
    document.body.appendChild(mp);
  };
  document.body.appendChild(cfg);
}

document.addEventListener('DOMContentLoaded', () => {
  initAmbientParticles();
  FX.init();
  initBGM();
  installAnalyticsHooks();
  loadMultiplayerClient();
  gaTrack('app_loaded', { standalone: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches, language: navigator.language || undefined });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && G && !G.over) {
      saveGame();
      gaTrack('game_backgrounded', { turns_played: _gameTurns, pieces_captured: _gameCaps });
    }
    if (document.visibilityState === 'visible') {
      const gameScreen = document.getElementById('s-game');
      const isGameScreen = gameScreen && !gameScreen.classList.contains('hidden');
      if (isGameScreen && G && !G.over) { buildBoard(); renderBoard(); renderPlayers(); updateTurnUI(); }
    }
  });
  window.addEventListener('beforeunload', () => { if (G && !G.over) saveGame(); });
  window.addEventListener('pagehide', () => { if (G && !G.over) saveGame(); });
  setInterval(() => { if (G && !G.over) saveGame(); }, 15000);
  window.addEventListener('pageshow', (e) => { if (e.persisted && G && !G.over) { buildBoard(); renderBoard(); renderPlayers(); updateTurnUI(); } });
  setTimeout(() => { const btn = document.getElementById('splash-enter-btn'); if (btn) btn.style.animation = 'splashBtnPulse 1.5s ease-in-out infinite'; }, 1800);
});

function splashEnter() {
  gaTrack('splash_enter');
  if (!_audioCtx) try { getACtx(); } catch(e) {}
  playBGM();
  showScreen('menu');
  selMode(1); selCol('yellow'); selAI(1);
  updateModePreview(1);
  updateStatusBar();
  if (!lsGet('insect_tuto_seen')) {
    lsSet('insect_tuto_seen', '1');
    setTimeout(() => openTuto(), 600);
  }
}
