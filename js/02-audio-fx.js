/* ===============================================================
   IN-SECT — AUDIO and FX — Moteur WebAudio, particules ambiantes, explosions
   Module 02-audio-fx.js — fait partie de : 01-core, 02-audio-fx, 03-nav-menu,
   04-board, 05-rules, 06-ai, 07-powers, 08-boot (charges dans cet ordre,
   scripts classiques a portee globale partagee, pas de bundler requis)
   =============================================================== */

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

function sfxGhostResurrect() {
  // Réveil solennel : montée douce triangle, puis carillon final
  [220, 330, 440, 660, 880].forEach((f,i) =>
    setTimeout(() => tone(f, 'triangle', .09, .28, .015), i * 120)
  );
  setTimeout(() => {
    tone(1047, 'sine', .12, .5, .02);
    setTimeout(() => tone(1319, 'sine', .1, .4, .02), 80);
    setTimeout(() => tone(1568, 'sine', .08, .6, .02), 180);
  }, 620);
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


