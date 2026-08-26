/* ===============================================================
   IN-SECT — MULTIJOUEUR EN LIGNE (V1)
   Module volontairement isolé du solo/IA.

   Activation : définir window.INSECT_MULTIPLAYER_API avec l'URL de
   l'Edge Function Supabase `insect-match` AVANT le chargement de ce fichier.
   Tant que cette URL est absente, le jeu solo reste strictement inchangé.
   =============================================================== */
(function () {
  'use strict';

  const MP = window.INSECT_MP = {
    active: false,
    api: String(window.INSECT_MULTIPLAYER_API || '').trim(),
    code: null,
    secret: null,
    localColor: null,
    role: null,
    pollTimer: null,
    lastVersion: -1,
    applyingRemote: false,
    waitingForInitialState: false,
  };

  const SESSION_KEY = 'insect_mp_session_v1';

  function enabled() { return /^https:\/\//i.test(MP.api); }

  function mpTrack(name, params = {}) {
    try {
      if (typeof gaTrack === 'function') gaTrack(name, { multiplayer: true, ...params });
    } catch (_) {}
  }

  async function api(action, payload = {}) {
    if (!enabled()) throw new Error('Serveur multijoueur non configuré.');
    const res = await fetch(MP.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `Erreur serveur (${res.status})`);
    }
    return data;
  }

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        code: MP.code,
        secret: MP.secret,
        localColor: MP.localColor,
        role: MP.role,
        savedAt: Date.now(),
      }));
    } catch (_) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function normalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function serializeState() {
    if (!G || !G.players) return null;
    const safeG = JSON.parse(JSON.stringify({
      ...G,
      board: null,
      sel: null,
      pendCorpse: null,
      pendDisp: null,
      afterCorpse: null,
      repTargets: [],
    }));
    return {
      schema: 1,
      G: safeG,
      mode: _mode,
      aiLevel: _aiLevel,
      selColor: _selColor,
      optSP: _optSP,
      uid: _uid,
      turns: _gameTurns,
      caps: _gameCaps,
      moveLog: _moveLog || [],
      sentAt: Date.now(),
    };
  }

  function rebuildBoardFromPlayers() {
    G.board = Array.from({ length: 9 }, () => Array(9).fill(null));
    for (const color of Object.keys(G.players || {})) {
      const pl = G.players[color];
      if (!pl) continue;
      for (const p of pl.pieces || []) {
        if (Number.isInteger(p.r) && Number.isInteger(p.c) && p.r >= 0 && p.r < 9 && p.c >= 0 && p.c < 9) {
          if (!p.dead || (G.board[p.r][p.c] == null)) G.board[p.r][p.c] = p;
        }
      }
    }
  }

  function applyState(snapshot) {
    if (!snapshot || snapshot.schema !== 1 || !snapshot.G) return false;
    MP.applyingRemote = true;
    try {
      _mode = 1;
      _aiLevel = snapshot.aiLevel || 1;
      _selColor = MP.localColor || snapshot.selColor || 'yellow';
      _optSP = !!snapshot.optSP;
      _uid = Number(snapshot.uid || 0);
      _gameTurns = Number(snapshot.turns || 0);
      _gameCaps = Number(snapshot.caps || 0);
      _moveLog = Array.isArray(snapshot.moveLog) ? snapshot.moveLog : [];
      G = snapshot.G;
      G.human = MP.localColor;
      G.mode1 = true;
      G.sel = null;
      G.phase = 'select';
      G.spPaused = false;
      for (const color of Object.keys(G.players || {})) {
        // Important : empêche le moteur IA de se déclencher. Le contrôle réel
        // du tour est assuré par le wrapper isHuman() plus bas.
        G.players[color].human = true;
      }
      rebuildBoardFromPlayers();
      showScreen('game');
      buildBoard();
      renderBoard();
      renderPlayers();
      updateTurnUI();
      updateToggleUI();
      const bz = document.getElementById('bottom-zone');
      if (bz) bz.style.display = 'flex';
      setMpGameBadge();
      return true;
    } finally {
      MP.applyingRemote = false;
    }
  }

  function setMpGameBadge() {
    if (!MP.active) return;
    const badge = document.getElementById('mode-badge');
    if (badge) badge.textContent = `EN LIGNE · ${MP.code}`;
  }

  async function pushState() {
    if (!MP.active || MP.applyingRemote || !G) return;
    const state = serializeState();
    if (!state) return;
    try {
      const out = await api('push', {
        code: MP.code,
        secret: MP.secret,
        state,
      });
      if (Number.isFinite(out.version)) MP.lastVersion = out.version;
    } catch (err) {
      console.warn('[IN-SECT MP] push:', err);
      toastMp('Connexion instable — nouvelle tentative automatique.');
    }
  }

  async function pollOnce() {
    if (!MP.code || !MP.secret) return;
    try {
      const out = await api('get', {
        code: MP.code,
        secret: MP.secret,
        since: MP.lastVersion,
      });

      if (out.status === 'waiting') {
        setLobbyStatus('En attente de votre adversaire…');
        return;
      }

      if (out.status === 'active' && MP.role === 'host' && !MP.active) {
        await startHostMatch();
        return;
      }

      if (out.state && Number(out.version) > MP.lastVersion) {
        MP.lastVersion = Number(out.version);
        if (!MP.active) MP.active = true;
        applyState(out.state);
        MP.waitingForInitialState = false;
      }

      if (out.status === 'finished') {
        MP.active = false;
        stopPolling();
      }
    } catch (err) {
      console.warn('[IN-SECT MP] poll:', err);
    }
  }

  function startPolling() {
    stopPolling();
    pollOnce();
    MP.pollTimer = setInterval(pollOnce, 1200);
  }

  function stopPolling() {
    if (MP.pollTimer) clearInterval(MP.pollTimer);
    MP.pollTimer = null;
  }

  async function startHostMatch() {
    if (MP.active) return;
    MP.active = true;
    MP.localColor = 'yellow';
    _mode = 1;
    _selColor = 'yellow';
    _aiLevel = 1;
    startGame();
    G.human = 'yellow';
    if (G.players.yellow) G.players.yellow.human = true;
    if (G.players.red) G.players.red.human = true;
    setMpGameBadge();
    await pushState();
    hideMpModal();
    mpTrack('mp_match_start', { mp_role: 'host' });
  }

  async function createMatch() {
    setLobbyStatus('Création de la partie…');
    try {
      const out = await api('create');
      MP.code = normalizeCode(out.code);
      MP.secret = out.secret;
      MP.localColor = 'yellow';
      MP.role = 'host';
      MP.lastVersion = Number(out.version ?? -1);
      saveSession();
      renderInvite(out.join_url || makeJoinUrl(MP.code));
      setLobbyStatus('Partie créée. Envoyez le lien à votre adversaire.');
      startPolling();
      mpTrack('mp_room_created');
    } catch (err) {
      setLobbyStatus(err.message, true);
    }
  }

  async function joinMatch(codeValue) {
    const code = normalizeCode(codeValue);
    if (code.length < 4) return setLobbyStatus('Code de partie invalide.', true);
    setLobbyStatus('Connexion à la partie…');
    try {
      const out = await api('join', { code });
      MP.code = code;
      MP.secret = out.secret;
      MP.localColor = 'red';
      MP.role = 'guest';
      MP.lastVersion = -1;
      MP.waitingForInitialState = true;
      saveSession();
      setLobbyStatus('Connecté. Initialisation du plateau…');
      startPolling();
      mpTrack('mp_room_joined');
    } catch (err) {
      setLobbyStatus(err.message, true);
    }
  }

  function makeJoinUrl(code) {
    const u = new URL(window.location.href);
    u.searchParams.set('join', code);
    u.hash = '';
    return u.toString();
  }

  async function copyInvite() {
    const url = makeJoinUrl(MP.code);
    try {
      await navigator.clipboard.writeText(url);
      toastMp('Lien de défi copié !');
    } catch (_) {
      window.prompt('Copiez ce lien :', url);
    }
  }

  async function shareInvite() {
    const url = makeJoinUrl(MP.code);
    const data = {
      title: 'Défi IN-SECT',
      text: `⚔️ Je te défie sur IN-SECT. Code ${MP.code}`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else await copyInvite();
      mpTrack('mp_invite_shared');
    } catch (e) {
      if (e && e.name !== 'AbortError') await copyInvite();
    }
  }

  function leaveMatch() {
    stopPolling();
    MP.active = false;
    MP.code = null;
    MP.secret = null;
    MP.localColor = null;
    MP.role = null;
    MP.lastVersion = -1;
    clearSession();
  }

  function toastMp(message) {
    try {
      if (typeof toast === 'function') return toast(message);
    } catch (_) {}
    console.info('[IN-SECT MP]', message);
  }

  function setLobbyStatus(message, error = false) {
    const el = document.getElementById('mp-status');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = error ? '#FF6680' : '#A9A3D6';
  }

  function renderInvite(url) {
    const box = document.getElementById('mp-invite');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = `
      <div style="font-size:.74rem;color:#8E88B8;margin-bottom:5px;">CODE DE PARTIE</div>
      <div style="font-family:'Cinzel Decorative',serif;font-size:1.55rem;color:#D4A017;letter-spacing:.18em;margin-bottom:10px;">${MP.code}</div>
      <div style="display:flex;gap:8px;">
        <button class="mp-small" onclick="INSECT_MP.copyInvite()">COPIER LE LIEN</button>
        <button class="mp-small" onclick="INSECT_MP.shareInvite()">PARTAGER</button>
      </div>`;
  }

  function showMpModal() {
    const el = document.getElementById('mp-overlay');
    if (el) el.classList.remove('hidden');
  }

  function hideMpModal() {
    const el = document.getElementById('mp-overlay');
    if (el) el.classList.add('hidden');
  }

  function injectUI() {
    if (!enabled()) return;
    const cfg = document.querySelector('#s-menu .menu-config');
    if (cfg && !document.getElementById('mp-open-btn')) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid rgba(128,80,255,.18);';
      wrap.innerHTML = `<button id="mp-open-btn" class="btn-play" style="background:linear-gradient(135deg,#123A56,#146A78);box-shadow:0 0 18px rgba(40,190,220,.16);" onclick="INSECT_MP.open()">🌐 MULTIJOUEUR</button>`;
      cfg.appendChild(wrap);
    }

    if (!document.getElementById('mp-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'mp-overlay';
      overlay.className = 'modal-overlay hidden';
      overlay.innerHTML = `
        <div class="modal-box" style="max-width:390px;">
          <div class="modal-header">
            <div class="modal-title">🌐 MULTIJOUEUR</div>
            <button class="modal-close" onclick="INSECT_MP.close()">✕</button>
          </div>
          <div class="modal-body" style="gap:14px;">
            <div style="font-size:.82rem;line-height:1.55;color:#9C96C5;">Duel humain 1 contre 1. Créez une partie et envoyez le lien, ou rejoignez avec un code.</div>
            <button class="btn-primary" onclick="INSECT_MP.create()">⚔️ CRÉER UNE PARTIE</button>
            <div id="mp-invite" style="display:none;text-align:center;padding:14px;border:1px solid rgba(212,160,23,.28);border-radius:12px;background:rgba(212,160,23,.05);"></div>
            <div style="display:flex;align-items:center;gap:9px;color:#5F5A82;font-size:.72rem;"><span style="height:1px;background:#27233F;flex:1;"></span>OU<span style="height:1px;background:#27233F;flex:1;"></span></div>
            <input id="mp-code-input" maxlength="6" autocomplete="off" placeholder="CODE EX. BEE742" style="height:48px;border-radius:9px;border:1px solid rgba(128,80,255,.35);background:#090713;color:#EEE8FF;padding:0 14px;text-align:center;font-size:1rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;outline:none;">
            <button class="btn-secondary" onclick="INSECT_MP.join(document.getElementById('mp-code-input').value)">REJOINDRE</button>
            <div id="mp-status" style="min-height:20px;text-align:center;font-size:.76rem;color:#A9A3D6;"></div>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const style = document.createElement('style');
      style.textContent = `.mp-small{flex:1;min-height:38px;border:1px solid rgba(128,80,255,.35);border-radius:8px;background:rgba(128,80,255,.12);color:#CDBBFF;font-family:'Exo 2',sans-serif;font-weight:800;font-size:.69rem;letter-spacing:.05em;cursor:pointer}`;
      document.head.appendChild(style);
    }
  }

  function installGameHooks() {
    if (typeof isHuman === 'function' && !isHuman.__mpWrapped) {
      const original = isHuman;
      const wrapped = function () {
        if (MP.active && G && !G.over) return cur() === MP.localColor;
        return original.apply(this, arguments);
      };
      wrapped.__mpWrapped = true;
      isHuman = wrapped;
    }

    if (typeof finishTurn === 'function' && !finishTurn.__mpWrapped) {
      const original = finishTurn;
      const wrapped = function () {
        const wasMp = MP.active;
        const wasMyTurn = wasMp && G && cur() === MP.localColor;
        const out = original.apply(this, arguments);
        if (wasMp && wasMyTurn && !MP.applyingRemote) {
          setMpGameBadge();
          setTimeout(pushState, 60);
        }
        return out;
      };
      wrapped.__mpWrapped = true;
      finishTurn = wrapped;
    }

    if (typeof goMenu === 'function' && !goMenu.__mpWrapped) {
      const original = goMenu;
      const wrapped = function () {
        if (MP.active) leaveMatch();
        return original.apply(this, arguments);
      };
      wrapped.__mpWrapped = true;
      goMenu = wrapped;
    }
  }

  function autoJoinFromUrl() {
    const code = normalizeCode(new URLSearchParams(location.search).get('join'));
    if (!code) return;
    const input = document.getElementById('mp-code-input');
    if (input) input.value = code;
    showMpModal();
    setLobbyStatus(`Invitation détectée : ${code}`);
  }

  MP.open = showMpModal;
  MP.close = hideMpModal;
  MP.create = createMatch;
  MP.join = joinMatch;
  MP.copyInvite = copyInvite;
  MP.shareInvite = shareInvite;
  MP.leave = leaveMatch;
  MP.pushState = pushState;

  function boot() {
    if (!enabled()) {
      console.info('[IN-SECT MP] module prêt, backend non configuré. Solo/IA inchangé.');
      return;
    }
    injectUI();
    installGameHooks();
    autoJoinFromUrl();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
