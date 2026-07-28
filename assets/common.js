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
