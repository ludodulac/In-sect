window.onerror = function(msg, src, line) {
  alert('ERREUR ligne ' + line + ' : ' + msg);
};
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
const STRIPE_URL = "https://buy.stripe.com/4gMfZi3Et2tg5xY8zH1VK00";

// ── Clés localStorage ──
const LS = {
  GAMES:    'insect_games_left',
  SHARES:   'insect_shares',
  FREEMIUM: 'insect_freemium',
  PREMIUM:  'insect_premium',
};

// ── Lecture / écriture localStorage avec fallback ──
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? v : fallback; }
  catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) {}
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
  const shareData = {
    title: "IN-SECT — L'Échiquier des Colonies",
    text: '🪲 Je joue à IN-SECT, un jeu de stratégie avec des insectes ! Reine, Araignée, Mouche... 4 colonies en guerre. Essaie !',
    url: window.location.href.split('?')[0],
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Fallback : copie dans le presse-papier
      await navigator.clipboard.writeText(shareData.url + '\n' + shareData.text);
      toast('🔗 Lien copié dans le presse-papier !');
    }

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

// ── Redirection vers Stripe ──
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
const SYM   = { chef:'reine_guepe_512.png', assassin:'araignee_512.png', reporter:'mouche_512.png', necromobile:'scarabee_512.png', diplomate:'coccinelle_512.png', militant:'fourmi_512.png' };
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
  // Icône bouton jeu + menu (même icône)
  const icon = (_muted && _sfxMuted) ? '🔇' : _muted ? '💥' : _sfxMuted ? '🎵' : '🔊';
  const btnGame = document.getElementById('snd-btn-game');
  const btnMenu = document.getElementById('snd-btn');
  if (btnGame) btnGame.textContent = icon;
  if (btnMenu) btnMenu.textContent = icon;
}

// Bascule uniquement la musique
function toggleMusic() {
  _muted = !_muted;
  if (_muted) stopBGM(); else playBGM();
  updateSoundModal();
  updateSndBtn(_muted && _sfxMuted ? '🔇' : _muted ? '🎵' : '🔊');
}

// Bascule uniquement les bruitages
function toggleSFX() {
  _sfxMuted = !_sfxMuted;
  updateSoundModal();
  updateSndBtn(_muted && _sfxMuted ? '🔇' : _sfxMuted ? '💥' : '🔊');
}
function updateSndBtn(icon) {
  const btn = document.getElementById('snd-btn');
  if (btn) btn.textContent = icon;
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
function goMenu() {
  if (_aiTimer) clearTimeout(_aiTimer);
  _animating = false; G.over = true;
  showScreen('menu');
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
      <image href="reine_guepe_512.png" x="10" y="10" width="12" height="12"/>
      <circle cx="56" cy="56" r="6" fill="#6A0010" stroke="rgba(255,80,100,.6)" stroke-width="1.2"/>
      <image href="reine_guepe_512.png" x="50" y="50" width="12" height="12"/>
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
      <image href="reine_guepe_512.png" x="6" y="6" width="12" height="12"/>
      <circle cx="60" cy="12" r="6" fill="#0A5025" stroke="rgba(48,208,96,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.png" x="54" y="6" width="12" height="12"/>
      <circle cx="12" cy="60" r="6" fill="#001A60" stroke="rgba(64,144,255,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.png" x="6" y="54" width="12" height="12"/>
      <circle cx="60" cy="60" r="6" fill="#6A0010" stroke="rgba(255,48,80,.7)" stroke-width="1"/>
      <image href="reine_guepe_512.png" x="54" y="54" width="12" height="12"/>
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
  _uid = 0; _animating = false; _gameTurns = 0; _gameCaps = 0;
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
    const acts = getActions(G.sel);
    for (const m of acts.moves)  hl[`${m.r},${m.c}`] = 'vm';
    for (const k of acts.kills)  hl[`${k.r},${k.c}`] = 'vk';
    for (const d of acts.diplT)  hl[`${d.r},${d.c}`] = 'vd';
    for (const n of acts.necroT) hl[`${n.r},${n.c}`] = 'vd';
  }
  if (G.phase === 'reporter-choose') {
    for (const t of G.repTargets) hl[`${t.r},${t.c}`] = t.ortho ? 'vrep-o' : 'vrep-d';
  }
  if (G.phase === 'place-corpse' || G.phase === 'place-necro' || G.phase === 'place-dipl') {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (!G.board[r][c]) hl[`${r},${c}`] = 'vplace';
    }
  }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const cell = document.getElementById(`cell-${r}-${c}`); if (!cell) continue;
    const isLab = (r===LAB.r && c===LAB.c);
    const base  = isLab ? 'lab' : ((r+c)%2===0?'l':'d');
    const hcls  = hl[`${r},${c}`] || '';
    const selcls = (G.sel&&G.sel.r===r&&G.sel.c===c&&G.phase==='select') ? 'sc' : '';
    cell.className = `cell ${base} ${hcls} ${selcls}`.trim();
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
    pe.className = `piece ${p.color}${isSel?' selp':''}`;
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
  document.getElementById('tdot').style.cssText = `background:${CCSS[c]};box-shadow:0 0 8px ${CCSS[c]};`;
  document.getElementById('tban').style.borderColor = CCSS[c]+'44';
  document.getElementById('tban').style.boxShadow = `0 0 14px ${CGLOW[c]}`;
  const t = document.getElementById('ttxt');
  t.textContent = `Tour de ${CNAME[c]}${pl.human?' (Vous)':''}`;
  t.style.color = CCSS[c];
  const phases = {
    'place-corpse': '💀 Placez la dépouille sur une case libre',
    'place-dipl':   `<img src="coccinelle_512.png" alt="Coccinelle" style="width:1em;height:1em;vertical-align:middle;margin-right:.3em;"> Déposez la pièce sur une case vide`,
    'place-necro':  `<img src="scarabee_512.png" alt="Scarabée" style="width:1em;height:1em;vertical-align:middle;margin-right:.3em;"> Déposez la dépouille sur une case libre`,
    'reporter-choose': `<img src="mouche_512.png" alt="Mouche" style="width:1em;height:1em;vertical-align:middle;margin-right:.3em;"> Choisissez : ortho 🔴 ou diag 🟠`,
  };
  const msg = phases[G.phase] || '';
  const pm = document.getElementById('phase-msg');
  if (pm) { pm.innerHTML = msg; pm.classList.toggle('visible', !!msg); }
}

function updatePieceInfo(piece) {
  const displayImg = piece.type === 'chef' ? 'reine_guepe_512.png' : SYM[piece.type];

  // Showcase : image + nom complet + description
  const showcase     = document.getElementById('piece-showcase');
  const showcaseImg  = document.getElementById('piece-showcase-img');
  const showcaseName = document.getElementById('piece-showcase-name');
  const showcaseDesc = document.getElementById('piece-showcase-desc');
  if (showcaseImg) { showcaseImg.src = displayImg; showcaseImg.alt = PNAME[piece.type]; }
  if (showcaseName) { showcaseName.textContent = PFULL[piece.type] || PNAME[piece.type]; showcaseName.style.color = CCSS[piece.color]; }
  if (showcaseDesc) { showcaseDesc.innerHTML = PDESC[piece.type]; }
  if (showcase) showcase.classList.add('active');

  // Barre du bas : juste le nom de la pièce (couleur colonie) + hint si aucune pièce sélectionnée
  const piName = document.getElementById('pi-name');
  const piHint = document.getElementById('pi-hint');
  const pi = document.getElementById('pi');
  if (piName) { piName.textContent = PNAME[piece.type]; piName.style.color = CCSS[piece.color]; }
  if (piHint) piHint.style.display = 'none';
  if (pi) { pi.style.borderColor = CCSS[piece.color]+'44'; pi.style.boxShadow = `0 0 10px ${CGLOW[piece.color]}`; }
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
        if (type==='assassin' && nr===LAB.r && nc===LAB.c) break;
        moves.push({r:nr,c:nc});
      } else if (t.dead) { break; }
      else {
        if (t.color !== color) kills.push({r:nr,c:nc,p:t});
        break;
      }
      nr+=dr; nc+=dc;
    }
  }
  return { moves: moves.filter(m => !(m.r===LAB.r&&m.c===LAB.c&&type!=='chef')), kills, diplT:[], necroT:[] };
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
        if (nr===LAB.r && nc===LAB.c) break;
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
      if (!t) { if (nr===LAB.r&&nc===LAB.c) break; moves.push({r:nr,c:nc}); }
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
      if (!t) { moves.push({r:nr,c:nc}); }
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
      if (!t) { moves.push({r:nr,c:nc}); }
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
    setTimeout(() => {
      sfxDefeat();
      setText('etitle','DÉFAITE');
      document.getElementById('etitle').style.cssText = 'background:linear-gradient(135deg,#6A0010,#FF3050,#6A0010);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:"Cinzel Decorative",serif;font-size:2.2rem;';
      document.getElementById('ecrown').textContent = '💀';
      setText('esub','Votre colonie a été anéantie.');
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
    if (G.labActive !== piece.color) { G.labActive = piece.color; G.labExtra = -1; sfxNid(); toast('👑 Nid Sacré !'); }
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

function checkStalemates() {
  for (const color of [...G.order]) {
    if (!G.players[color].alive) continue;
    if (isQueenTrapped(color)) { toast(`🔒 ${CNAME[color]} encerclée !`); eliminateTrapped(color, G.lastActor); }
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
      setText('ewinner','');
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
  setTimeout(()=>{
    const hw = winner&&G.players[winner]&&G.players[winner].human;
    if (hw) { sfxVictory(); launchVictoryParticles(); } else sfxDefeat();
    setText('etitle', hw?'VICTOIRE !':'DÉFAITE');
    document.getElementById('etitle').style.cssText = `background:linear-gradient(135deg,${hw?'#3010A0,#9050FF,#3010A0':'#6A0010,#FF3050,#6A0010'});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Cinzel Decorative',serif;font-size:2.2rem;`;
    document.getElementById('ecrown').textContent = hw?'🏆':'💀';
    setText('esub', hw?'Votre colonie domine toutes les colonies !':'La guerre des colonies est terminée.');
    setText('ewinner', winner?`<img src="${SYM['chef']}" alt="Reine" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:.3em;"> ${CNAME[winner]} remporte la guerre.`:'');
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
  if (!isHuman()||_animating||G.over) return;
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
    const pi=document.getElementById('pi');
    pi.innerHTML=`<div class="pii">👑</div><div style="flex:1;min-width:0;"><div class="pin" style="color:#D4A017">Nid Sacré</div><div class="pid">La Reine ici rejoue après chaque adversaire. Immunisée contre la Fourmi.</div></div>`;
    pi.style.borderColor='rgba(212,160,23,.4)'; pi.style.boxShadow='0 0 10px rgba(212,160,23,.25)';
    return;
  }

  if (clicked&&!clicked.dead&&clicked.color===G.human&&!G.sel) { selectPiece(clicked); return; }
  if (clicked&&!clicked.dead&&clicked.color===G.human&&G.sel)  { selectPiece(clicked); return; }
  if (!G.sel) return;

  const piece=G.sel, acts=getActions(piece);
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
  _animating=true;
  animMove(piece,r,c).then(()=>{
    if (piece.type==='reporter'){
      const rts=getRepAdj(piece);
      if (rts.length>0) { G.phase='reporter-choose'; G.repTargets=rts; G.sel=piece; renderBoard(); updateTurnUI(); return; }
    }
    handleNid(piece); G.sel=null; renderBoard(); finishTurn();
  });
}

function doKill(piece,victim,toR,toC){
  const fromR=piece.r, fromC=piece.c;
  _animating=true;
  animMove(piece,toR,toC).then(()=>{
    const needPlace=executeKill(piece,victim);
    if (piece.type==='assassin'){
      placeOnBoard(victim,fromR,fromC);
      handleNid(piece); G.sel=null; renderBoard(); finishTurn(); return;
    }
    if (needPlace){
      G.phase='place-corpse';
      G.afterCorpse=()=>{ handleNid(piece); G.sel=null; finishTurn(); };
      toast('💀 Placez la dépouille sur une case libre');
      renderBoard(); updateTurnUI(); return;
    }
    handleNid(piece); G.sel=null; renderBoard(); finishTurn();
  });
}

function doDipl(piece,victim,toR,toC){
  removeFromBoard(victim); _animating=true;
  animMove(piece,toR,toC).then(()=>{
    G.pendDisp=victim; G.phase='place-dipl';
    toast('🐛 Placez la pièce sur une case vide');
    renderBoard(); updateTurnUI();
  });
}

function doNecro(piece,corpse,toR,toC){
  removeFromBoard(corpse); _animating=true;
  animMove(piece,toR,toC).then(()=>{
    G.pendDisp=corpse; G.phase='place-necro';
    toast('💀 Placez la dépouille sur une case libre');
    renderBoard(); updateTurnUI();
  });
}

function execReporterNuee(reporter,isOrtho){
  const dirs=isOrtho?DIRS_ORTHO:DIRS_DIAG;
  for(const[dr,dc]of dirs){
    const nr=reporter.r+dr,nc=reporter.c+dc; if(!inB(nr,nc))continue;
    const t=G.board[nr][nc];
    if(t&&!t.dead&&t.color!==reporter.color){
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

  const justPlayed=cur();
  const twoPlayer=(G.order.length<=2);
  G.turn++;_gameTurns++;

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
    const acts=getActions(p);
    for(const m of acts.moves)  all.push({piece:p,type:'move', target:null,toR:m.r,toC:m.c});
    for(const k of acts.kills)  all.push({piece:p,type:'kill', target:k.p, toR:k.r,toC:k.c});
    for(const d of acts.diplT)  all.push({piece:p,type:'dipl', target:d.p, toR:d.r,toC:d.c});
    for(const n of acts.necroT) all.push({piece:p,type:'necro',target:n.p, toR:n.r,toC:n.c});
  }
  return all;
}

// Niveau 1 — complètement aléatoire
function aiLevel1(color){
  const all=getAllMoves(color);
  return all.length ? all[Math.floor(Math.random()*all.length)] : null;
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
function scoreAIMove(mv,color){
  let s=0;
  if(mv.type==='kill'){
    if(mv.target.type==='chef')s+=1000;
    else s+=60;
  }
  if(mv.type==='move'){
    if(mv.piece.type==='chef'&&mv.toR===LAB.r&&mv.toC===LAB.c)s+=200;
    s+=(4-Math.max(Math.abs(mv.toR-4),Math.abs(mv.toC-4)))*3;
  }
  if(mv.type==='necro')s+=20;
  if(mv.type==='dipl'&&mv.target.type==='chef')s+=80;
  s+=Math.random()*15;
  return s;
}

// Score défensif — conscience du danger de la Reine (niveaux 2+)
function scoreAIMoveDefensive(mv,color,queenThreatened){
  let s=scoreAIMove(mv,color);
  const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color);
  if(chef){
    // Malus si la Reine reste exposée après le coup
    const threatsAfter=countThreatsTo(chef.r,chef.c,color);
    if(threatsAfter>0)s-=threatsAfter*120;
    // Bonus pour fuir vers une case sûre
    if(queenThreatened&&mv.piece.type==='chef'){
      const threatsOnDest=countThreatsTo(mv.toR,mv.toC,color);
      if(threatsOnDest===0)s+=400;
      else s-=200;
    }
    // Bonus pour interposer une pièce devant la Reine menacée
    if(queenThreatened&&mv.piece.type!=='chef'&&mv.type==='move'){
      const distBefore=Math.max(Math.abs(mv.piece.r-chef.r),Math.abs(mv.piece.c-chef.c));
      const distAfter=Math.max(Math.abs(mv.toR-chef.r),Math.abs(mv.toC-chef.c));
      if(distAfter<distBefore)s+=60;
    }
  }
  return s;
}

// Niveau 2 (Tactique) — même logique que l'ancien Expert : instinct de survie + personnalité
function aiLevel2(color){
  const all=getAllMoves(color);if(!all.length)return null;
  // Priorité 1 : tuer la Reine ennemie immédiatement
  const queenKill=all.find(mv=>mv.type==='kill'&&mv.target.type==='chef');
  if(queenKill)return queenKill;
  // Priorité 2 : sauver sa propre Reine si menacée
  const queenThreatened=isQueenThreatened(color);
  if(queenThreatened){
    const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color);
    if(chef){
      const escapes=all.filter(mv=>mv.piece.type==='chef'&&mv.type==='move'&&countThreatsTo(mv.toR,mv.toC,color)===0);
      if(escapes.length){
        const nidEscape=escapes.find(mv=>mv.toR===LAB.r&&mv.toC===LAB.c);
        if(nidEscape)return nidEscape;
        escapes.sort((a,b)=>{
          const da=Math.max(Math.abs(a.toR-chef.r),Math.abs(a.toC-chef.c));
          const db=Math.max(Math.abs(b.toR-chef.r),Math.abs(b.toC-chef.c));
          return db-da;
        });
        return escapes[0];
      }
    }
  }
  const pers=_aiPersonalities[color]||'opportunist';
  const scored=all.map(mv=>{
    let s=scoreAIMoveDefensive(mv,color,queenThreatened)*1.4;
    if(pers==='aggressive'&&mv.type==='kill')s+=40;
    if(pers==='defensive'&&mv.piece.type==='chef'&&mv.toR===LAB.r&&mv.toC===LAB.c)s+=150;
    if(pers==='manipulator'&&(mv.type==='dipl'||mv.type==='necro'))s+=50;
    return{mv,s};
  });
  scored.sort((a,b)=>b.s-a.s);
  return scored[0].mv;
}

// ── Niveau 3 (Expert) ── lookahead + stratégies impitoyables
// Évalue la position depuis le point de vue de `color`
function evaluatePosition(color){
  let score=0;
  const enemies=G.order.filter(c=>c!==color&&G.players[c]&&G.players[c].alive);
  // Pièces vivantes : chaque pièce vaut des points selon son type
  const pieceVal={chef:0,assassin:80,reporter:70,necromobile:90,diplomate:65,militant:40};
  for(const c of G.order){
    if(!G.players[c]||!G.players[c].alive)continue;
    const sign=c===color?1:-1;
    for(const p of G.players[c].pieces){
      if(!p.dead)score+=sign*(pieceVal[p.type]||40);
    }
  }
  // Bonus : Reine ennemie menacée
  for(const ec of enemies){
    if(isQueenThreatened(ec))score+=160;
  }
  // Malus : notre Reine menacée
  if(isQueenThreatened(color))score-=200;
  // Bonus : nombre de coups disponibles (mobilité)
  score+=getAllMoves(color).length*2;
  // Bonus : dépouilles bien placées (proches de la Reine ennemie)
  for(const ec of enemies){
    const echef=G.players[ec].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===ec);
    if(echef){
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){
        const cell=G.board[r][c];
        if(cell&&cell.dead){
          const dist=Math.max(Math.abs(r-echef.r),Math.abs(c-echef.c));
          if(dist<=2)score+=15;
        }
      }
    }
  }
  return score;
}

// Simule un coup et retourne le delta de score (sans modifier G de façon permanente)
function simulateMoveScore(mv,color){
  // Snapshot léger des états nécessaires
  const p=mv.piece;
  const origR=p.r,origC=p.c,origDead=p.dead;
  const boardOrig=G.board[mv.toR][mv.toC];
  let targetOrig=null,targetDead=null,targetR=null,targetC=null,targetColor=null;
  if(mv.target){
    targetOrig=mv.target;
    targetDead=mv.target.dead;
    targetR=mv.target.r; targetC=mv.target.c;
    targetColor=mv.target.color;
  }

  // Applique le coup
  G.board[origR][origC]=null;
  p.r=mv.toR; p.c=mv.toC;
  G.board[mv.toR][mv.toC]=p;
  if(mv.type==='kill'&&mv.target){mv.target.dead=true; G.board[mv.toR][mv.toC]=p;}

  const s=evaluatePosition(color);

  // Annule le coup
  G.board[mv.toR][mv.toC]=boardOrig;
  G.board[origR][origC]=p;
  p.r=origR; p.c=origC; p.dead=origDead;
  if(mv.target){mv.target.dead=targetDead;mv.target.r=targetR;mv.target.c=targetC;}

  return s;
}

function aiLevel3(color){
  const all=getAllMoves(color);if(!all.length)return null;

  // Priorité absolue 1 : tuer la Reine ennemie
  const queenKill=all.find(mv=>mv.type==='kill'&&mv.target.type==='chef');
  if(queenKill)return queenKill;

  // Priorité absolue 2 : sauver notre Reine si en danger immédiat
  const queenThreatened=isQueenThreatened(color);
  if(queenThreatened){
    const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color);
    if(chef){
      const escapes=all.filter(mv=>mv.piece.type==='chef'&&mv.type==='move'&&countThreatsTo(mv.toR,mv.toC,color)===0);
      if(escapes.length){
        // Fuit vers le Nid si possible, sinon case la plus éloignée des menaces
        const nidEscape=escapes.find(mv=>mv.toR===LAB.r&&mv.toC===LAB.c);
        if(nidEscape)return nidEscape;
        escapes.sort((a,b)=>simulateMoveScore(b,color)-simulateMoveScore(a,color));
        return escapes[0];
      }
    }
  }

  // Priorité 3 : éliminer une pièce clé ennemie (Nécromobile ou Reine exposée)
  const keyKill=all.find(mv=>mv.type==='kill'&&(mv.target.type==='necromobile'||mv.target.type==='assassin'));
  if(keyKill&&!queenThreatened)return keyKill;

  // Priorité 4 : encercler la Reine ennemie avec dépouilles via Nécromobile
  const necroMoves=all.filter(mv=>mv.type==='necro');
  if(necroMoves.length){
    const enemies=G.order.filter(c=>c!==color&&G.players[c]&&G.players[c].alive);
    let bestNecro=null, bestNecroScore=-Infinity;
    for(const nm of necroMoves){
      let s=simulateMoveScore(nm,color);
      // Bonus extra si on place une dépouille adjacente à la Reine ennemie
      for(const ec of enemies){
        const echef=G.players[ec].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===ec);
        if(echef){
          const dist=Math.max(Math.abs(nm.toR-echef.r),Math.abs(nm.toC-echef.c));
          if(dist<=1)s+=120;
          else if(dist<=2)s+=50;
        }
      }
      if(s>bestNecroScore){bestNecroScore=s;bestNecro=nm;}
    }
    // N'utilise le nécro que si c'est vraiment utile
    if(bestNecroScore>evaluatePosition(color)+30&&bestNecro)return bestNecro;
  }

  // Scoring lookahead sur tous les coups restants
  const pers=_aiPersonalities[color]||'opportunist';
  const scored=all.map(mv=>{
    let s=simulateMoveScore(mv,color)*1.6;
    // Bonus personnalité
    if(pers==='aggressive'&&mv.type==='kill')s+=60;
    if(pers==='defensive'&&mv.piece.type==='chef'&&mv.toR===LAB.r&&mv.toC===LAB.c)s+=200;
    if(pers==='manipulator'&&(mv.type==='dipl'||mv.type==='necro'))s+=80;
    // Bonus : ne pas exposer sa Reine après le coup
    const chef=G.players[color].pieces.find(p=>p.type==='chef'&&!p.dead&&p.color===color);
    if(chef&&countThreatsTo(chef.r,chef.c,color)>0)s-=180;
    // Petit bruit pour éviter les répétitions
    s+=Math.random()*8;
    return{mv,s};
  });
  scored.sort((a,b)=>b.s-a.s);
  return scored[0].mv;
}

// Choisit une case libre pour placer une dépouille (IA)
function pickFreeCell(forbidNid=true){
  const free=[];
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(G.board[r][c])continue;
    if(forbidNid&&r===LAB.r&&c===LAB.c)continue;
    free.push({r,c});
  }
  return free.length?free[Math.floor(Math.random()*free.length)]:null;
}

function execAIMove(mv,color,onDone){
  const{piece,type,target,toR,toC}=mv;
  _animating=true;
  if(type==='move'){
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
    const fromR=piece.r,fromC=piece.c;
    animMove(piece,toR,toC).then(()=>{
      const needPlace=executeKill(piece,target);
      if(piece.type==='assassin'){
        placeOnBoard(target,fromR,fromC);
        handleNid(piece);renderBoard();onDone();return;
      }
      if(needPlace){
        const cell=pickFreeCell(true);
        if(cell)placeOnBoard(target,cell.r,cell.c);
        G.pendCorpse=null;G.phase='select';
      }
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='dipl'){
    removeFromBoard(target);
    animMove(piece,toR,toC).then(()=>{
      const cell=pickFreeCell(false);
      if(cell)placeOnBoard(target,cell.r,cell.c);
      handleNid(piece);renderBoard();onDone();
    });
  } else if(type==='necro'){
    removeFromBoard(target);
    animMove(piece,toR,toC).then(()=>{
      const cell=pickFreeCell(true);
      if(cell)placeOnBoard(target,cell.r,cell.c);
      handleNid(piece);renderBoard();onDone();
    });
  }
}

function execReporterNueeAI(reporter,isOrtho,color,onDone){
  const dirs=isOrtho?DIRS_ORTHO:DIRS_DIAG;
  for(const[dr,dc]of dirs){
    const nr=reporter.r+dr,nc=reporter.c+dc;if(!inB(nr,nc))continue;
    const t=G.board[nr][nc];
    if(t&&!t.dead&&t.color!==reporter.color){
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

  // La barre de chargement se remplit, mais l'entrée se fait via le bouton
  // Le bouton est activé quand la barre est presque remplie (~2s)
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
}
