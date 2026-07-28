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
  colors: ['#c9a227', '#e8c65a', '#2e7d5b', '#4bb185', '#a53a2e', '#efe9d8'],

  ensure() {
    if (this.canvas) return;
    let c = document.getElementById('confetti-canvas');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'confetti-canvas';
      c.setAttribute('aria-hidden', 'true');
      document.body.appendChild(c);
    }
    this.canvas = c; this.ctx = c.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  launch(intensity = 60, scale = 1) {
    intensity = Math.max(0, Math.min(100, Number(intensity) || 0));
    if (intensity <= 0) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) intensity = Math.min(intensity, 15);

    this.ensure();
    const count = Math.round((intensity / 100) * 260 * scale);   // up to excessive at 100
    const W = this.canvas.width;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5 + (intensity / 100) * 4,
        g: 0.08 + Math.random() * 0.06,
        size: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: this.colors[(Math.random() * this.colors.length) | 0],
        life: 0, max: 130 + Math.random() * 90
      });
    }
    if (this.particles.length > 5000) this.particles.length = 5000;   // hard safety cap
    if (!this.running) { this.running = true; requestAnimationFrame(() => this.tick()); }
  },

  tick() {
    const ctx = this.ctx, cv = this.canvas, H = cv.height;
    ctx.clearRect(0, 0, cv.width, H);
    this.particles = this.particles.filter(p => {
      p.life++; p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > H + 20 || p.life > p.max) return false;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
      return true;
    });
    if (this.particles.length) requestAnimationFrame(() => this.tick());
    else { ctx.clearRect(0, 0, cv.width, H); this.running = false; }
  }
};
