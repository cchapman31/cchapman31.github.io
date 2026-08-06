/* CIA Bucks — admin */

const $ = (id) => document.getElementById(id);
const OWNER = 'cody@insurancesaleslab.com';
const LABELS = { spin: 'Wheel spin', credit: 'Manual credit', debit: 'Manual debit',
                 'role-set': 'Role assigned', 'role-remove': 'Role removed', config: 'Setting changed',
                 stats: 'Stats logged', 'stats-reset': 'Stat lock cleared',
                 'baseball-add': 'Baseball added', 'baseball-remove': 'Baseball removed',
                 'mvp-add': 'MVP added', 'mvp-remove': 'MVP removed',
                 'points-add': 'Points awarded', 'points-remove': 'Points removed',
                 'stats-assign': 'Transfers assigned' };

let state = { users: [], roles: [], config: {}, today: '' };

const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- render */

function renderOverview(d) {
  state.users = d.users; state.roles = d.roles; state.config = d.config; state.today = d.today || '';
  const roleOf = {};
  d.roles.forEach(r => { roleOf[r.email] = r.role; });

  $('t-issued').textContent  = money(d.totals.issued);
  $('t-members').textContent = d.totals.members;
  $('t-spins').textContent   = d.totals.spinsUsed;
  $('t-out').textContent     = d.totals.spinsOut;
  $('t-baseballs').textContent = d.totals.baseballs;
  $('t-mvp').textContent = d.totals.mvps;

  // members table
  $('members-empty').classList.toggle('hidden', d.users.length > 0);
  $('members-body').innerHTML = d.users.map(u => `
    <tr>
      <td>${esc(u.name)}${roleTag(roleOf[u.email])}</td>
      <td class="muted">${esc(u.email)}</td>
      <td class="num">${u.transfers}</td>
      <td class="num">${u.occs}</td>
      <td class="num" style="color:var(--stamp)">${u.baseballs}</td>
      <td class="num" style="color:var(--gold-lit)">${u.mvps}</td>
      <td class="num" style="color:var(--gold-lit)">${u.spinsAvailable}</td>
      <td class="num muted">${u.spinsUsed}</td>
      <td class="num" style="color:var(--gold-lit);font-weight:600">${money(u.balance)}</td>
      <td class="num">${u.lastStatDate === state.today
        ? `<button class="btn btn-sm" data-relog="${esc(u.email)}" title="Let this member log stats again today">Re-log</button>`
        : ''}</td>
    </tr>`).join('');

  // member pickers for adjustments (bucks + baseballs)
  const options = d.users.map(u =>
    `<option value="${esc(u.email)}">${esc(u.name)} — ${esc(u.email)} (${money(u.balance)}, ${u.baseballs}⚾, ${u.mvps}🏆)</option>`).join('');
  ['adj-email', 'ball-email', 'mvp-email'].forEach(id => {
    const picker = $(id);
    if (!picker) return;
    const keep = picker.value;
    picker.innerHTML = options;
    if (keep) picker.value = keep;
  });

  // role chips
  $('role-chips').innerHTML = d.roles.map(r => {
    const locked = r.email === OWNER;
    const label = ROLE_LABEL[r.role] || r.role;
    return `<span class="chip ${locked ? 'locked' : ''}"><b style="font-weight:600;color:${ROLE_COLOR[r.role] || 'inherit'}">${label}</b> · ${esc(r.email)}${
      locked ? '' : `<button data-remove="${esc(r.email)}" title="Remove role" aria-label="Remove role for ${esc(r.email)}">&times;</button>`}</span>`;
  }).join('');

  // settings
  $('cfg-spinsAllowed').value      = String(d.config.spinsAllowed);
  $('cfg-transferThreshold').value = d.config.transferThreshold;
  $('cfg-occSpins').value          = d.config.occSpins;
  $('cfg-allowedDomain').value     = d.config.allowedDomain;
  $('cfg-confettiIntensity').value = d.config.confettiIntensity;
  $('cfg-weight5').value  = d.config.weight5;
  $('cfg-weight10').value = d.config.weight10;
  $('cfg-weight20').value = d.config.weight20;
  updateOdds();
}

function renderStats(entries) {
  $('stats-empty').classList.toggle('hidden', entries.length > 0);
  $('stats-body').innerHTML = entries.map(e => `
    <tr>
      <td class="muted">${when(e.at)}</td>
      <td>${esc(e.date)}</td>
      <td>${esc(e.email)}</td>
      <td class="num">${e.transfers}</td>
      <td class="num">${e.occs}</td>
      <td class="num" style="color:var(--gold-lit)">${e.earned}</td>
    </tr>`).join('');
}

function updateOdds() {
  const w = [+$('cfg-weight5').value || 0, +$('cfg-weight10').value || 0, +$('cfg-weight20').value || 0];
  const total = w[0] + w[1] + w[2];
  if (!total) { $('odds-preview').textContent = 'Set at least one weight above zero.'; return; }
  const pct = w.map(x => Math.round(x / total * 1000) / 10);
  const ev = (5 * w[0] + 10 * w[1] + 20 * w[2]) / total;
  $('odds-preview').textContent =
    `$5 lands ${pct[0]}% of the time, $10 lands ${pct[1]}%, $20 lands ${pct[2]}%. Average payout ${money(ev.toFixed(2))} per spin.`;
}

function renderLog(entries) {
  $('log-body').innerHTML = entries.map(e => `
    <tr>
      <td class="muted">${when(e.at)}</td>
      <td>${esc(e.email)}</td>
      <td>${LABELS[e.type] || esc(e.type)}${e.note ? ` <span class="muted">· ${esc(e.note)}</span>` : ''}</td>
      <td class="num ${e.amount > 0 ? 'pos' : e.amount < 0 ? 'neg' : 'muted'}">${
        e.amount ? (e.amount > 0 ? '+' : '−') + money(Math.abs(e.amount)) : '—'}</td>
      <td class="num muted">${e.amount ? money(e.balanceAfter) : '—'}</td>
      <td class="muted">${esc(e.actedBy)}</td>
    </tr>`).join('');
}

/* ------------------------------------------------------------------ load */

async function refresh() {
  const [overview, log, stats] = await Promise.all([
    api('adminOverview'), api('adminLedger'), api('adminStats')
  ]);
  renderOverview(overview);
  renderLog(log.entries);
  renderStats(stats.entries);
}

async function boot() {
  try {
    const session = await api('session');
    if (!session.user.isAdmin) return showGate('That area is for admins only.');
    $('whoami').textContent = session.user.email;
    $('gate').classList.add('hidden');
    $('masthead').classList.remove('hidden');
    $('app').classList.remove('hidden');
    await refresh();
  } catch (err) {
    showGate(err.message);
  }
}

function showGate(message) {
  mountSignIn(() => boot());     // set up Google Sign-In only when we actually need it
  $('gate').classList.remove('hidden');
  $('masthead').classList.add('hidden');
  $('app').classList.add('hidden');
  say($('gate-error'), message, message ? 'bad' : '');
}

/** Run an action, show the result, keep the button from double-firing. */
async function run(btn, fn, successMessage) {
  btn.disabled = true;
  say($('msg'), '');
  try {
    const result = await fn();
    await refresh();
    say($('msg'), typeof successMessage === 'function' ? successMessage(result) : successMessage, 'good');
  } catch (err) {
    say($('msg'), err.message, 'bad');
  } finally {
    btn.disabled = false;
  }
}

/* ---------------------------------------------------------------- wiring */

// Attach a listener only if the element exists, so a stale/mismatched page
// can't halt the script before sign-in mounts.
function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

on('adj-go', 'click', (e) => {
  const email = $('adj-email').value;
  const amount = Number($('adj-amount').value);
  if (!email) return say($('msg'), 'Pick a member first.', 'bad');
  if (!amount) return say($('msg'), 'Enter an amount to add or subtract.', 'bad');
  run(e.target,
    () => api('adjust', { email, amount, note: $('adj-note').value }),
    (r) => `${email} is now at ${money(r.balance)}.`
  ).then(() => { $('adj-amount').value = ''; $('adj-note').value = ''; });
});

on('ball-go', 'click', (e) => {
  const email = $('ball-email').value;
  const amount = Math.round(Number($('ball-amount').value));
  if (!email) return say($('msg'), 'Pick a member first.', 'bad');
  if (!amount) return say($('msg'), 'Enter a number of baseballs to award or take back.', 'bad');
  run(e.target,
    () => api('adjustBaseballs', { email, amount, note: $('ball-note').value }),
    (r) => `${email} now holds ${r.baseballs} baseball${r.baseballs === 1 ? '' : 's'}.`
  ).then(() => { $('ball-amount').value = ''; $('ball-note').value = ''; });
});

on('mvp-go', 'click', (e) => {
  const email = $('mvp-email').value;
  const amount = Math.round(Number($('mvp-amount').value));
  if (!email) return say($('msg'), 'Pick a member first.', 'bad');
  if (!amount) return say($('msg'), 'Enter a number of MVP awards to award or take back.', 'bad');
  run(e.target,
    () => api('adjustMvps', { email, amount, note: $('mvp-note').value }),
    (r) => `${email} now holds ${r.mvps} MVP award${r.mvps === 1 ? '' : 's'}.`
  ).then(() => { $('mvp-amount').value = ''; $('mvp-note').value = ''; });
});

on('role-go', 'click', (e) => {
  const email = $('role-email').value.trim();
  const role = $('role-kind').value;
  if (!email) return say($('msg'), 'Enter an email address.', 'bad');
  run(e.target, () => api('addRole', { email, role }),
    `${email} is now ${ROLE_LABEL[role] || role}.`)
    .then(() => { $('role-email').value = ''; });
});

on('members-body', 'click', (e) => {
  const email = e.target.dataset?.relog;
  if (!email) return;
  if (!confirm(`Let ${email} log stats again today? Spins already earned today stay.`)) return;
  run(e.target, () => api('clearStatLock', { email }), `${email} can log stats again today.`);
});

on('role-chips', 'click', (e) => {
  const email = e.target.dataset?.remove;
  if (!email) return;
  if (!confirm(`Remove the role for ${email}?`)) return;
  run(e.target, () => api('removeRole', { email }), `${email} no longer has a role.`);
});

on('save-config', 'click', (e) => {
  const keys = ['spinsAllowed', 'transferThreshold', 'occSpins', 'allowedDomain', 'confettiIntensity', 'weight5', 'weight10', 'weight20'];
  run(e.target, async () => {
    for (const key of keys) {
      const value = $('cfg-' + key).value;
      if (String(state.config[key]) !== String(value)) await api('setConfig', { key, value });
    }
  }, 'Settings saved.');
});

['cfg-weight5', 'cfg-weight10', 'cfg-weight20'].forEach(id => on(id, 'input', updateOdds));

on('sign-out', 'click', () => { signOut(); location.href = 'index.html'; });

/* ------------------------------------------------------------------ boot */

$('gate-seal').innerHTML = logoImg(120, 'gate-logo');
$('mast-seal').innerHTML = logoImg(38, 'seal');

// If we already hold a token, load straight in without touching Google's login UI.
if (hasToken()) boot(); else showGate('');
