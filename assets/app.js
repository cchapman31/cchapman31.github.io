/* CIA Bucks — member floor */

const SEGMENTS = [5, 10, 5, 20, 5, 10, 5, 10];   // visual layout only; the server picks the prize
const SEG = 360 / SEGMENTS.length;

const $ = (id) => document.getElementById(id);
let angle = 0;          // current absolute rotation in degrees
let rafId = null;
let spinning = false;

let spinsReady = 0;
let spinsAllowed = true;
let submittedToday = false;
let confettiIntensity = 60;
let RULES = { transferThreshold: 20, occSpins: 1 };

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
            font-family="'Montserrat', sans-serif" font-weight="900"
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
              font-family="'Montserrat', sans-serif" font-size="13"
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
  const bucksTypes = ['spin', 'credit', 'debit'];
  const rows = entries.filter(e => bucksTypes.includes(e.type) && e.amount !== 0);
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

function earnedFrom(transfers, occs) {
  const t = Math.max(0, Math.floor(Number(transfers) || 0));
  const o = Math.max(0, Math.floor(Number(occs) || 0));
  const fromT = t >= RULES.transferThreshold ? (t - RULES.transferThreshold + 1) : 0;
  return fromT + o * RULES.occSpins;
}

function renderBaseballs(count) {
  count = Math.max(0, Math.floor(count || 0));
  const wrap = $('note-awards'), host = $('awards-icons');
  const countEl = $('awards-count'), cap = $('awards-cap');
  if (!host || !cap) return;

  const set = (slots) => {
    const full = slots.every(Boolean);
    return `<span class="awards-set${full ? ' full' : ''}">${slots.map(f => baseballSVG(f)).join('')}</span>`;
  };

  if (count === 0) {
    if (wrap) wrap.classList.add('empty');
    if (countEl) countEl.textContent = 'None yet';
    host.innerHTML = set([false, false, false]);
    cap.textContent = 'Earn 3 for a $2,500 experience';
    return;
  }

  if (wrap) wrap.classList.remove('empty');
  if (countEl) countEl.textContent = `${count} ⚾`;

  const MAX = 12;
  const shown = Math.min(count, MAX);
  let html = '';
  for (let i = 0; i < shown; i += 3) {
    html += set([0, 1, 2].map(j => i + j < shown));
  }
  if (count > MAX) html += `<span class="awards-more">+${count - MAX}</span>`;
  host.innerHTML = html;

  const unlocked = Math.floor(count / 3) * 2500;
  const rem = count % 3;
  const toNext = rem === 0 ? 3 : 3 - rem;
  cap.textContent = unlocked > 0
    ? `${money(unlocked)} unlocked · ${toNext} more for the next $2,500`
    : `${toNext} more baseball${toNext === 1 ? '' : 's'} for a $2,500 experience`;
}

function updateSpinButton() {
  const btn = $('spin'), status = $('spin-status'), all = $('spin-all');
  $('spins-count').textContent = spinsReady;

  const showAll = spinsAllowed && spinsReady > 10 && !spinning;
  if (all) {
    all.classList.toggle('hidden', !showAll);
    all.textContent = `Spin all ${spinsReady}`;
    all.disabled = false;
  }

  if (!spinsAllowed) { btn.disabled = true; status.textContent = 'Spins are paused'; return; }
  if (spinsReady > 0) {
    btn.disabled = false;
    status.textContent = `${spinsReady} spin${spinsReady === 1 ? '' : 's'} ready`;
  } else {
    btn.disabled = true;
    status.textContent = submittedToday
      ? 'Out of spins — log stats again tomorrow'
      : "Log today's stats to earn spins";
  }
}

function updateEarnPreview() {
  const t = Number($('in-transfers').value) || 0;
  const o = Number($('in-occs').value) || 0;
  const n = earnedFrom(t, o);
  $('earn-preview').textContent = (t || o)
    ? `That's ${n} spin${n === 1 ? '' : 's'}.`
    : '';
}

function renderStats(data) {
  const entry = $('stats-entry'), done = $('stats-done');
  $('rules-note').textContent =
    `${RULES.transferThreshold} transfers = 1 spin, then +1 per transfer after. ` +
    `Each OCC = ${RULES.occSpins} spin${RULES.occSpins === 1 ? '' : 's'}. Log once a day.`;

  if (data.submittedToday && data.statsToday) {
    entry.classList.add('hidden');
    done.classList.remove('hidden');
    $('done-transfers').textContent = data.statsToday.transfers;
    $('done-occs').textContent = data.statsToday.occs;
    $('done-earned').textContent = data.statsToday.earned;
  } else {
    done.classList.add('hidden');
    entry.classList.remove('hidden');
    $('in-transfers').value = '';
    $('in-occs').value = '';
    updateEarnPreview();
  }
}

function applySession(data) {
  const u = data.user;
  $('gate').classList.add('hidden');
  $('masthead').classList.remove('hidden');
  $('app').classList.remove('hidden');

  $('whoami').textContent = u.email;
  if (u.picture) { $('avatar').src = u.picture; $('avatar').hidden = false; }
  $('admin-link').classList.toggle('hidden', !u.isAdmin);
  const txnLink = $('txn-link');
  if (txnLink) txnLink.classList.toggle('hidden', !u.isAdmin);

  $('serial').textContent = serialFor(u.email);
  $('spin-count').textContent = u.spinsUsed;
  setBalance(u.balance);
  renderBaseballs(u.baseballs);

  const bucksTypes = ['spin', 'credit', 'debit'];
  const deposits = data.entries.filter(e => bucksTypes.includes(e.type));
  $('last-deposit').textContent = deposits.length ? when(deposits[0].at).split(' ').slice(0, 2).join(' ') : '—';
  $('member-since').textContent = u.joinedAt
    ? new Date(u.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Today';

  renderLedger(data.entries);

  spinsAllowed = data.spinsAllowed;
  submittedToday = data.submittedToday;
  RULES = data.rules;
  spinsReady = u.spinsAvailable;
  confettiIntensity = data.confettiIntensity ?? 60;

  renderStats(data);
  updateSpinButton();
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

// Attach a listener only if the element exists, so a missing feature element
// (e.g. a stale index.html) can never halt the script before sign-in mounts.
function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

on('spin', 'click', async () => {
  if (spinning || spinsReady <= 0) return;
  spinning = true;
  $('spin').disabled = true;
  if ($('spin-all')) $('spin-all').classList.add('hidden');
  $('stamp').classList.remove('show');
  $('spin-status').textContent = 'Spinning…';
  say($('msg'), '');
  Sound.ensure();
  Sound.spinStart(3200);

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
    $('spin-count').textContent = result.spinsUsed;
    $('last-deposit').textContent = when(new Date().toISOString()).split(' ').slice(0, 2).join(' ');
    $('stamp').classList.add('show');
    say($('msg'), `${money(result.prize)} in CIA Bucks landed in your bank.`, 'good');

    Sound.win(result.prize >= 20 ? 6 : result.prize >= 10 ? 3 : 1);
    Confetti.launch(confettiIntensity, result.prize === 20 ? 1.8 : result.prize === 10 ? 1.1 : 0.7);

    spinsReady = result.spinsAvailable;
    updateSpinButton();

    const fresh = await api('ledger');
    renderLedger(fresh.entries);
  } catch (err) {
    stopSpin();
    say($('msg'), err.message, 'bad');
    loadSession();                                   // resync spins/state from the server
  } finally {
    spinning = false;
  }
});

on('spin-all', 'click', async () => {
  if (spinning || spinsReady <= 10) return;
  spinning = true;
  $('spin').disabled = true;
  $('spin-all').disabled = true;
  $('spin-all').classList.add('hidden');
  $('stamp').classList.remove('show');
  $('spin-status').textContent = `Spinning ${spinsReady}…`;
  say($('msg'), '');
  Sound.ensure();
  Sound.spinStart(2600);

  try {
    startSpin();
    const [res] = await Promise.all([
      api('spinMany', { count: spinsReady }),
      new Promise((r) => setTimeout(r, 900))
    ]);

    const highest = res.counts[20] ? 20 : res.counts[10] ? 10 : 5;
    await settleSpin(highest);

    setBalance(res.balance, true);
    $('spin-count').textContent = res.spinsUsed;
    $('last-deposit').textContent = when(new Date().toISOString()).split(' ').slice(0, 2).join(' ');
    $('stamp').classList.add('show');

    const parts = [];
    if (res.counts[5])  parts.push(`${res.counts[5]}×$5`);
    if (res.counts[10]) parts.push(`${res.counts[10]}×$10`);
    if (res.counts[20]) parts.push(`${res.counts[20]}×$20`);
    say($('msg'), `${res.n} spins → ${money(res.total)} in CIA Bucks! (${parts.join(', ')})`, 'good');

    Sound.win(res.n);
    Confetti.launch(confettiIntensity, Math.min(3.5, 1.4 + res.n / 8));

    spinsReady = res.spinsAvailable;
    updateSpinButton();

    const fresh = await api('ledger');
    renderLedger(fresh.entries);
  } catch (err) {
    stopSpin();
    say($('msg'), err.message, 'bad');
    loadSession();
  } finally {
    spinning = false;
  }
});

function refreshMuteLabel() {
  const m = $('mute');
  if (m) m.textContent = Sound.muted ? 'Sound off' : 'Sound on';
}
on('mute', 'click', () => { Sound.setMuted(!Sound.muted); if (!Sound.muted) Sound.ensure(); refreshMuteLabel(); });
refreshMuteLabel();

on('submit-stats', 'click', async (e) => {
  const transfers = Math.floor(Number($('in-transfers').value));
  const occs = Math.floor(Number($('in-occs').value));
  if (!(transfers >= 0) || !(occs >= 0)) return say($('msg'), 'Enter whole numbers for transfers and OCCs.', 'bad');
  if (!transfers && !occs) return say($('msg'), 'Enter at least one transfer or OCC.', 'bad');

  e.target.disabled = true;
  say($('msg'), '');
  try {
    const r = await api('submitStats', { transfers, occs });
    say($('msg'), r.earned > 0
      ? `Logged. You earned ${r.earned} spin${r.earned === 1 ? '' : 's'}.`
      : 'Logged — no spins from these numbers today.', 'good');
    await loadSession();
  } catch (err) {
    say($('msg'), err.message, 'bad');
    e.target.disabled = false;
  }
});

on('in-transfers', 'input', updateEarnPreview);
on('in-occs', 'input', updateEarnPreview);

on('sign-out', 'click', () => { signOut(); location.reload(); });

/* ---------------------------------------------------------------- boot */

document.getElementById('gate-seal').innerHTML = rosetteSVG(132, '#c9a227', .6);
document.getElementById('mast-seal').innerHTML = rosetteSVG(38, '#c9a227', .85).replace('class="rosette"', 'class="seal"');
$('domain-label').textContent = '@' + CFG.ALLOWED_DOMAIN;
buildWheel();

// If we already hold a token, load straight in without touching Google's login UI.
// showGate() will set up sign-in only if that token turns out to be missing or expired.
if (hasToken()) loadSession(); else showGate('');
