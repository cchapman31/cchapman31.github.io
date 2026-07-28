/* CIA Bucks — admin */

const $ = (id) => document.getElementById(id);
const OWNER = 'cody@insurancesaleslab.com';
const LABELS = { spin: 'Wheel spin', credit: 'Manual credit', debit: 'Manual debit',
                 'admin-add': 'Made admin', 'admin-remove': 'Admin removed', config: 'Setting changed' };

let state = { users: [], admins: [], config: {} };

const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- render */

function renderOverview(d) {
  state.users = d.users; state.admins = d.admins; state.config = d.config;

  $('t-issued').textContent  = money(d.totals.issued);
  $('t-members').textContent = d.totals.members;
  $('t-spins').textContent   = d.totals.spins;
  $('t-avg').textContent     = money(d.totals.members ? Math.round(d.totals.issued / d.totals.members) : 0);

  // members table
  $('members-empty').classList.toggle('hidden', d.users.length > 0);
  $('members-body').innerHTML = d.users.map(u => `
    <tr>
      <td>${esc(u.name)}${d.admins.includes(u.email) ? ' <span class="tag" style="color:var(--gold)">admin</span>' : ''}</td>
      <td class="muted">${esc(u.email)}</td>
      <td class="num">${u.spins}</td>
      <td class="num" style="color:var(--gold-lit);font-weight:600">${money(u.balance)}</td>
      <td class="muted">${when(u.lastSpin)}</td>
    </tr>`).join('');

  // member picker
  const picker = $('adj-email');
  const keep = picker.value;
  picker.innerHTML = d.users.map(u =>
    `<option value="${esc(u.email)}">${esc(u.name)} — ${esc(u.email)} (${money(u.balance)})</option>`).join('');
  if (keep) picker.value = keep;

  // admin chips
  $('admin-chips').innerHTML = d.admins.map(email => {
    const locked = email === OWNER;
    return `<span class="chip ${locked ? 'locked' : ''}">${esc(email)}${
      locked ? '' : `<button data-remove="${esc(email)}" title="Remove admin" aria-label="Remove ${esc(email)}">&times;</button>`}</span>`;
  }).join('');

  // settings
  $('cfg-spinsAllowed').value    = String(d.config.spinsAllowed);
  $('cfg-cooldownSeconds').value = String(d.config.cooldownSeconds);
  $('cfg-allowedDomain').value   = d.config.allowedDomain;
  $('cfg-weight5').value  = d.config.weight5;
  $('cfg-weight10').value = d.config.weight10;
  $('cfg-weight20').value = d.config.weight20;
  updateOdds();
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
  const [overview, log] = await Promise.all([api('adminOverview'), api('adminLedger')]);
  renderOverview(overview);
  renderLog(log.entries);
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

$('adj-go').addEventListener('click', (e) => {
  const email = $('adj-email').value;
  const amount = Number($('adj-amount').value);
  if (!email) return say($('msg'), 'Pick a member first.', 'bad');
  if (!amount) return say($('msg'), 'Enter an amount to add or subtract.', 'bad');
  run(e.target,
    () => api('adjust', { email, amount, note: $('adj-note').value }),
    (r) => `${email} is now at ${money(r.balance)}.`
  ).then(() => { $('adj-amount').value = ''; $('adj-note').value = ''; });
});

$('add-admin').addEventListener('click', (e) => {
  const email = $('new-admin').value.trim();
  if (!email) return say($('msg'), 'Enter an email address to add.', 'bad');
  run(e.target, () => api('addAdmin', { email }), `${email} can now open the admin area.`)
    .then(() => { $('new-admin').value = ''; });
});

$('admin-chips').addEventListener('click', (e) => {
  const email = e.target.dataset?.remove;
  if (!email) return;
  if (!confirm(`Remove admin access for ${email}?`)) return;
  run(e.target, () => api('removeAdmin', { email }), `${email} no longer has admin access.`);
});

$('save-config').addEventListener('click', (e) => {
  const keys = ['spinsAllowed', 'cooldownSeconds', 'allowedDomain', 'weight5', 'weight10', 'weight20'];
  run(e.target, async () => {
    for (const key of keys) {
      const value = $('cfg-' + key).value;
      if (String(state.config[key]) !== String(value)) await api('setConfig', { key, value });
    }
  }, 'Settings saved.');
});

['cfg-weight5', 'cfg-weight10', 'cfg-weight20'].forEach(id =>
  $(id).addEventListener('input', updateOdds));

$('sign-out').addEventListener('click', () => { signOut(); location.href = 'index.html'; });

/* ------------------------------------------------------------------ boot */

$('gate-seal').innerHTML = rosetteSVG(132, '#c9a227', .6);
$('mast-seal').innerHTML = rosetteSVG(38, '#c9a227', .85).replace('class="rosette"', 'class="seal"');

// If we already hold a token, load straight in without touching Google's login UI.
if (hasToken()) boot(); else showGate('');
