/* CIA Bucks — member floor */

const SEGMENTS = [5, 10, 5, 20, 5, 10, 5, 10];   // visual layout only; the server picks the prize
const SEG = 360 / SEGMENTS.length;

const $ = (id) => document.getElementById(id);
let angle = 0;          // current absolute rotation in degrees
let rafId = null;
let spinning = false;
let cooldownTimer = null;

/* ------------------------------------------------------------ the wheel */

function buildWheel() {
  const C = 200, R = 186;
  const pt = (deg, r) => [
    (C + r * Math.sin(deg * Math.PI / 180)).toFixed(2),
    (C - r * Math.cos(deg * Math.PI / 180)).toFixed(2)
  ];

  const sectors = SEGMENTS.map((value, i) => {
    const a1 = i * SEG, a2 = (i + 1) * SEG, mid = a1 + SEG / 2;
    const [x1, y1] = pt(a1, R), [x2, y2] = pt(a2, R);
    const fill = value === 20 ? '#c9a227' : (i % 2 ? '#2e7d5b' : '#16283e');
    const text = value === 20 ? '#16283e' : '#efe9d8';
    const [tx, ty] = pt(mid, R * 0.66);
    return `
      <path d="M${C},${C} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z"
            fill="${fill}" stroke="#081321" stroke-width="1.5"/>
      <text x="${tx}" y="${ty}" transform="rotate(${mid} ${tx} ${ty})"
            text-anchor="middle" dominant-baseline="central"
            font-family="'Bodoni Moda', Georgia, serif" font-weight="900"
            font-size="${value === 20 ? 42 : 36}" fill="${text}">$${value}</text>`;
  }).join('');

  const ticks = SEGMENTS.map((_, i) => {
    const [x1, y1] = pt(i * SEG, R), [x2, y2] = pt(i * SEG, R - 13);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e8c65a" stroke-width="2"/>`;
  }).join('');

  $('wheel-host').innerHTML = `
    <svg class="wheel" viewBox="0 0 400 400" role="img" aria-label="Prize wheel with five, ten and twenty dollar segments">
      <circle cx="200" cy="200" r="196" fill="#081321" stroke="#c9a227" stroke-width="2.5"/>
      <g id="wheel-rotor">
        ${sectors}${ticks}
        <circle cx="200" cy="200" r="58" fill="#081321" stroke="#c9a227" stroke-width="2"/>
        <g transform="translate(200 200) scale(.30) translate(-100 -100)">
          <path d="${rosettePath(100, 100, 84, 31, 46)}" fill="none" stroke="#c9a227" stroke-width="1.6" opacity=".85"/>
        </g>
        <text x="200" y="203" text-anchor="middle" dominant-baseline="central"
              font-family="'IBM Plex Mono', monospace" font-size="13"
              letter-spacing="3" fill="#e8c65a">CIA</text>
      </g>
    </svg>`;
}

/** Start spinning immediately — no waiting on the network. */
function startSpin() {
  cancelAnimationFrame(rafId);
  const rotor = $('wheel-rotor');
  rotor.style.transition = 'none';
  const velocity = 24;                       // degrees per frame while cruising
  const loop = () => {
    angle += velocity;
    rotor.style.transform = `rotate(${angle}deg)`;
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

/** Ease the spinning wheel to rest on a segment worth `prize`. */
function settleSpin(prize) {
  cancelAnimationFrame(rafId);
  const rotor = $('wheel-rotor');

  const matches = SEGMENTS.map((v, i) => (v === prize ? i : -1)).filter(i => i >= 0);
  const target = matches[Math.floor(Math.random() * matches.length)];
  const center = target * SEG + SEG / 2;
  const jitter = (Math.random() - 0.5) * (SEG - 16);
  const restMod = ((360 - center - jitter) % 360 + 360) % 360;

  // land at least two full turns ahead of where we are now
  const from = angle;
  const finalAngle = Math.ceil((from + 720 - restMod) / 360) * 360 + restMod;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 350 : 2600;
  const distance = finalAngle - from;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const t0 = performance.now();

  return new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      angle = from + distance * easeOut(t);
      rotor.style.transform = `rotate(${angle}deg)`;
      if (t < 1) rafId = requestAnimationFrame(step);
      else resolve();
    };
    rafId = requestAnimationFrame(step);
  });
}

function stopSpin() {
  cancelAnimationFrame(rafId);
}

/* ------------------------------------------------------------- the note */

const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve',
  'thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

function spell(n) {
  n = Math.floor(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + spell(n % 100) : '');
  return spell(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + spell(n % 1000) : '');
}

function setBalance(value, animate = false) {
  const el = $('balance');
  const words = spell(value);
  $('balance-words').textContent =
    words.charAt(0).toUpperCase() + words.slice(1) + ' bucks and no cents';

  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = value.toLocaleString('en-US');
    return;
  }
  const from = Number(el.textContent.replace(/,/g, '')) || 0;
  const start = performance.now(), dur = 850;
  (function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (value - from) * eased).toLocaleString('en-US');
    if (t < 1) requestAnimationFrame(step);
  })(performance.now());
}

/* ----------------------------------------------------------- the ledger */

const LABELS = { spin: 'Wheel spin', credit: 'Manual credit', debit: 'Manual debit', 'admin-add': 'Made admin', 'admin-remove': 'Admin removed' };

function renderLedger(entries) {
  const rows = entries.filter(e => e.amount !== 0);
  $('ledger-empty').classList.toggle('hidden', rows.length > 0);
  $('ledger-body').innerHTML = rows.map(e => `
    <tr>
      <td class="muted">${when(e.at)}</td>
      <td>${LABELS[e.type] || e.type}${e.note ? ` <span class="muted">· ${escapeHtml(e.note)}</span>` : ''}</td>
      <td class="num ${e.amount > 0 ? 'pos' : 'neg'}">${e.amount > 0 ? '+' : '−'}${money(Math.abs(e.amount))}</td>
      <td class="num muted">${money(e.balanceAfter)}</td>
    </tr>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------- the session */

function startCooldown(seconds) {
  clearInterval(cooldownTimer);
  const btn = $('spin'), status = $('spin-status');

  if (seconds <= 0) {
    btn.disabled = false;
    status.textContent = 'Ready when you are';
    return;
  }
  btn.disabled = true;
  let left = seconds;
  const tick = () => {
    if (left <= 0) { clearInterval(cooldownTimer); startCooldown(0); return; }
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    status.textContent = 'Next spin in ' +
      (h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`);
    left--;
  };
  tick();
  cooldownTimer = setInterval(tick, 1000);
}

function applySession(data) {
  const u = data.user;
  $('gate').classList.add('hidden');
  $('masthead').classList.remove('hidden');
  $('app').classList.remove('hidden');

  $('whoami').textContent = u.email;
  if (u.picture) { $('avatar').src = u.picture; $('avatar').hidden = false; }
  $('admin-link').classList.toggle('hidden', !u.isAdmin);

  $('serial').textContent = serialFor(u.email);
  $('spin-count').textContent = u.spins;
  setBalance(u.balance);

  const deposits = data.entries.filter(e => e.amount !== 0);
  $('last-deposit').textContent = deposits.length ? when(deposits[0].at).split(' ').slice(0, 2).join(' ') : '—';
  $('member-since').textContent = u.joinedAt
    ? new Date(u.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Today';

  renderLedger(data.entries);

  if (!data.spinsAllowed) {
    $('spin').disabled = true;
    $('spin-status').textContent = 'Spins are paused';
  } else {
    startCooldown(data.cooldownLeft);
  }
}

async function loadSession() {
  try {
    applySession(await api('session'));
  } catch (err) {
    showGate(err.message);
  }
}

function showGate(message) {
  mountSignIn(() => loadSession());     // set up Google Sign-In only when we actually need it
  $('gate').classList.remove('hidden');
  $('masthead').classList.add('hidden');
  $('app').classList.add('hidden');
  say($('gate-error'), message, message ? 'bad' : '');
}

/* -------------------------------------------------------------- wiring */

$('spin').addEventListener('click', async () => {
  if (spinning) return;
  spinning = true;
  clearInterval(cooldownTimer);
  $('spin').disabled = true;
  $('stamp').classList.remove('show');
  $('spin-status').textContent = 'Spinning…';
  say($('msg'), '');

  try {
    startSpin();                                     // wheel moves the instant you click

    // let the network call ride along with the spin; keep a floor so a fast
    // response doesn't make the wheel jerk to a halt
    const [result] = await Promise.all([
      api('spin'),
      new Promise((r) => setTimeout(r, 900))
    ]);

    await settleSpin(result.prize);

    setBalance(result.balance, true);
    $('spin-count').textContent = result.spins;
    $('last-deposit').textContent = when(new Date().toISOString()).split(' ').slice(0, 2).join(' ');
    $('stamp').classList.add('show');
    say($('msg'), `${money(result.prize)} in CIA Bucks landed in your bank.`, 'good');

    const fresh = await api('ledger');
    renderLedger(fresh.entries);
    startCooldown(result.cooldownLeft);
  } catch (err) {
    stopSpin();
    say($('msg'), err.message, 'bad');
    $('spin-status').textContent = '';
    $('spin').disabled = false;
    if (/unlocks in/i.test(err.message)) loadSession();
  } finally {
    spinning = false;
  }
});

$('sign-out').addEventListener('click', () => { signOut(); location.reload(); });

/* ---------------------------------------------------------------- boot */

document.getElementById('gate-seal').innerHTML = rosetteSVG(132, '#c9a227', .6);
document.getElementById('mast-seal').innerHTML = rosetteSVG(38, '#c9a227', .85).replace('class="rosette"', 'class="seal"');
$('domain-label').textContent = '@' + CFG.ALLOWED_DOMAIN;
buildWheel();

// If we already hold a token, load straight in without touching Google's login UI.
// showGate() will set up sign-in only if that token turns out to be missing or expired.
if (hasToken()) loadSession(); else showGate('');
