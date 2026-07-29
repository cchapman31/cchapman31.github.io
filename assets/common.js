/* Shared: Google sign-in, API calls, and the engraved rosette used as a seal. */

const CFG = window.CIA_CONFIG;
const TOKEN_KEY = 'cia_bucks_token';

/* ------------------------------------------------------------------- api */

async function api(action, payload = {}) {
  const idToken = sessionStorage.getItem(TOKEN_KEY);
  if (!idToken) throw new Error('Sign in to continue.');

  const res = await fetch(CFG.API_URL, {
    method: 'POST',
    // text/plain keeps the browser from sending a CORS preflight,
    // which Apps Script web apps cannot answer.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, idToken, ...payload }),
    redirect: 'follow'
  });

  const data = await res.json().catch(() => { throw new Error('The server sent back something unreadable.'); });
  if (!data.ok) {
    if (/expired|sign in/i.test(data.error || '')) signOut();
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}

/* ---------------------------------------------------------------- sign-in */

function signOut() {
  sessionStorage.removeItem(TOKEN_KEY);
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
}

/**
 * Renders the Google button into #gsi-button and calls onToken(jwt) on success.
 * Safe to call more than once — it only initializes Google Sign-In the first time.
 */
let signInMounted = false;
function mountSignIn(onToken) {
  if (signInMounted) return;
  signInMounted = true;

  const ready = setInterval(() => {
    if (!window.google?.accounts?.id) return;
    clearInterval(ready);

    google.accounts.id.initialize({
      client_id: CFG.GOOGLE_CLIENT_ID,
      hd: CFG.ALLOWED_DOMAIN,          // hints Google to show work accounts first
      auto_select: false,              // never sign in silently on load
      callback: (r) => {
        sessionStorage.setItem(TOKEN_KEY, r.credential);
        onToken(r.credential);
      }
    });

    google.accounts.id.renderButton(document.getElementById('gsi-button'), {
      theme: 'filled_black', size: 'large', shape: 'rectangular',
      text: 'signin_with', width: 280
    });
  }, 60);
}

function hasToken() { return !!sessionStorage.getItem(TOKEN_KEY); }

/* ------------------------------------------------------------ engravings */

/** Hypotrochoid path — the guilloche rosette printed on real banknotes. */
function rosettePath(cx, cy, R, r, d, turns = 24, step = 0.06) {
  const pts = [];
  for (let t = 0; t <= Math.PI * 2 * turns; t += step) {
    const k = (R - r) / r;
    pts.push([
      (cx + (R - r) * Math.cos(t) + d * Math.cos(k * t)).toFixed(2),
      (cy + (R - r) * Math.sin(t) - d * Math.sin(k * t)).toFixed(2)
    ]);
  }
  return 'M' + pts.map(p => p.join(',')).join('L');
}

function rosetteSVG(size, stroke, opacity = 0.55) {
  return `<svg class="rosette" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">
    <path d="${rosettePath(100, 100, 84, 31, 46)}" fill="none" stroke="${stroke}" stroke-width=".55" opacity="${opacity}"/>
    <path d="${rosettePath(100, 100, 62, 17, 30)}" fill="none" stroke="${stroke}" stroke-width=".45" opacity="${opacity * 0.8}"/>
    <circle cx="100" cy="100" r="92" fill="none" stroke="${stroke}" stroke-width="1" opacity="${opacity * 0.7}"/>
  </svg>`;
}

/** The Cherchenko Insurance Agency badge, used for the masthead, sign-in gate, and wheel hub. */
// Whichever of these loads first is used everywhere. This makes the logo work
// whether the committed file is assets/logo.png or the original upload name.
const LOGO_CANDIDATES = ['assets/logo.png', 'assets/CIA_Logo_White.png'];
let LOGO_URL = LOGO_CANDIDATES[0];

/** Probe the candidates and settle LOGO_URL on the first that actually loads. */
function resolveLogo() {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= LOGO_CANDIDATES.length) return resolve(LOGO_URL);
      const url = LOGO_CANDIDATES[i++];
      const img = new Image();
      img.onload = () => { LOGO_URL = url; resolve(url); };
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}

function logoImg(size, cls = 'seal') {
  const alt = LOGO_CANDIDATES[1];
  return `<img class="${cls}" src="${LOGO_CANDIDATES[0]}" alt="Cherchenko Insurance Agency"
    width="${size}" height="${size}"
    style="width:${size}px;height:${size}px;object-fit:contain"
    onerror="this.onerror=null;this.src='${alt}'">`;
}

/** Trophy outline icon for MVP awards. `earned` fills it gold; otherwise a faint ghost slot. */
function trophySVG(earned, size = 18) {
  const stroke = earned ? '#c9a227' : 'rgba(22,40,62,.26)';
  const fill   = earned ? 'rgba(201,162,39,.14)' : 'transparent';
  return `<svg class="bball" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <path d="M7 4 h10 v3.2 a5 5 0 0 1 -10 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M7 4.8 H4.4 v1.7 a3 3 0 0 0 3 2.6" fill="none" stroke="${stroke}" stroke-width="1.3"/>
    <path d="M17 4.8 H19.6 v1.7 a3 3 0 0 1 -3 2.6" fill="none" stroke="${stroke}" stroke-width="1.3"/>
    <path d="M12 12.2 V15" fill="none" stroke="${stroke}" stroke-width="1.4"/>
    <path d="M8.8 19.4 h6.4 l-.7 -2.2 a1 1 0 0 0 -1 -.7 h-3 a1 1 0 0 0 -1 .7 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>
  </svg>`;
}

/** Baseball outline icon. `earned` fills it in the stamp red; otherwise a faint ghost slot. */
function baseballSVG(earned, size = 18) {
  const stroke = earned ? '#a53a2e' : 'rgba(22,40,62,.26)';
  const fill   = earned ? 'rgba(165,58,46,.10)' : 'transparent';
  return `<svg class="bball" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
    <path d="M6.4 5.4 Q10 12 6.4 18.6" fill="none" stroke="${stroke}" stroke-width="1" stroke-linecap="round"/>
    <path d="M17.6 5.4 Q14 12 17.6 18.6" fill="none" stroke="${stroke}" stroke-width="1" stroke-linecap="round"/>
  </svg>`;
}

/* ---------------------------------------------------------------- format */

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Deterministic serial number so a person's note always looks like their note. */
function serialFor(email) {
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 'TFA ' + String(h % 10000).padStart(4, '0') + ' ' + String((h >> 13) % 1000).padStart(3, '0');
}

function say(el, message, kind = '') {
  if (!el) return;
  el.textContent = message || '';
  el.className = 'notice' + (kind ? ' ' + kind : '');
}

/* --------------------------------------------------- sound (Web Audio, no files) */

const Sound = {
  ctx: null,
  muted: (typeof localStorage !== 'undefined' && localStorage.getItem('cia_muted') === '1'),

  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('cia_muted', m ? '1' : '0'); } catch (e) {}
    if (m && this.ctx) { /* leave context; just stop scheduling */ }
  },

  blip(freq, at, dur, type = 'square', gain = 0.06) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(at); o.stop(at + dur);
  },

  // decelerating ticks, like a wheel coasting to rest
  spinStart(durationMs = 2600) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const secs = durationMs / 1000;
    let t = 0, gap = 0.045;
    while (t < secs) {
      this.blip(760, t0 + t, 0.028, 'square', 0.045);
      t += gap;
      gap *= 1.055;
    }
  },

  // rising arpeggio; bigger wins reach higher and sparkle
  win(magnitude = 1) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    const reach = Math.min(notes.length, 2 + Math.round(Math.min(magnitude, 12) / 3));
    for (let i = 0; i < reach; i++) {
      this.blip(notes[i], t0 + i * 0.09, 0.30, 'triangle', 0.09);
    }
    if (magnitude >= 5) this.blip(1318.5, t0 + reach * 0.09, 0.45, 'triangle', 0.08);
  }
};

/* --------------------------------------------------- confetti (canvas, no libs) */

const Confetti = {
  canvas: null, ctx: null, particles: [], running: false,
  colors: ['#c9a227', '#e8c65a', '#2e7d5b', '#4bb185', '#a53a2e', '#efe9d8', '#ffffff'],

  ensure() {
    if (this.canvas) return;
    let c = document.getElementById('confetti-canvas');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'confetti-canvas';
      c.setAttribute('aria-hidden', 'true');
      document.body.appendChild(c);
    }
    // Set positioning inline so the canvas can never affect page layout,
    // even if an older cached stylesheet is missing the #confetti-canvas rule.
    c.style.position = 'fixed';
    c.style.inset = '0';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '60';
    this.canvas = c; this.ctx = c.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  push(p) {
    if (this.particles.length >= 6000) return;   // hard safety cap
    p.life = 0;
    p.max = p.max || (150 + Math.random() * 120);
    p.g = p.g != null ? p.g : (0.10 + Math.random() * 0.08);
    p.vr = (Math.random() - 0.5) * 0.4;
    p.rot = Math.random() * Math.PI * 2;
    p.size = p.size || (5 + Math.random() * 8);
    p.streamer = Math.random() < 0.25;
    p.color = p.color || this.colors[(Math.random() * this.colors.length) | 0];
    this.particles.push(p);
  },

  // rain falling from above, spread across the whole width
  rain(n, I) {
    const W = this.canvas.width;
    for (let i = 0; i < n; i++) {
      this.push({
        x: Math.random() * W, y: -20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 5,
        vy: 3 + Math.random() * 6 + I * 4
      });
    }
  },

  // a popper firing up-and-inward from a bottom corner
  cannon(side, n, power) {
    const W = this.canvas.width, H = this.canvas.height;
    const x = side < 0 ? -10 : W + 10;
    const base = side < 0 ? -Math.PI / 3.1 : (-Math.PI + Math.PI / 3.1);
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * 0.7;
      const speed = power * (0.6 + Math.random() * 0.8);
      this.push({
        x, y: H * (0.72 + Math.random() * 0.2),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        g: 0.16 + Math.random() * 0.08,
        max: 180 + Math.random() * 120
      });
    }
  },

  launch(intensity = 60, scale = 1) {
    intensity = Math.max(0, Math.min(100, Number(intensity) || 0));
    if (intensity <= 0) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) intensity = Math.min(intensity, 18);

    this.ensure();
    const I = intensity / 100;
    scale = Math.min(scale, 4);

    // counts ramp hard with intensity so 100 is genuinely over the top
    const perWave = Math.min(340, Math.max(10, Math.round(I * 150 * scale)));
    const waves   = Math.min(26, Math.max(1, Math.round(1 + I * I * 16 * scale)));
    const power   = 15 + I * 12;

    // opening double-cannon blast
    if (I >= 0.35) {
      this.cannon(-1, Math.round(perWave * 0.9), power);
      this.cannon(1,  Math.round(perWave * 0.9), power);
    }
    this.rain(perWave, I);
    this.run();

    // sustained downpour + repeat cannons over the next ~2 seconds
    for (let w = 1; w < waves; w++) {
      setTimeout(() => {
        this.rain(perWave, I);
        if (I >= 0.6 && w % 2 === 0) {
          this.cannon(-1, Math.round(perWave * 0.55), power);
          this.cannon(1,  Math.round(perWave * 0.55), power);
        }
        this.run();
      }, w * 85);
    }
  },

  run() {
    if (!this.running) { this.running = true; requestAnimationFrame(() => this.tick()); }
  },

  tick() {
    const ctx = this.ctx, cv = this.canvas, H = cv.height, W = cv.width;
    ctx.clearRect(0, 0, W, H);
    this.particles = this.particles.filter(p => {
      p.life++; p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > H + 30 || p.x < -50 || p.x > W + 50 || p.life > p.max) return false;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      if (p.streamer) ctx.fillRect(-p.size * 0.18, -p.size * 1.1, p.size * 0.36, p.size * 2.2);
      else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
      return true;
    });
    if (this.particles.length) requestAnimationFrame(() => this.tick());
    else { ctx.clearRect(0, 0, W, H); this.running = false; }
  }
};
