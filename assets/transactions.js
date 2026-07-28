/* CIA Bucks — admin transactions (bucks + baseballs) */

const $ = (id) => document.getElementById(id);

const TXN_TYPES = ['credit', 'debit', 'baseball-add', 'baseball-remove'];
const TXN_LABEL = {
  credit: 'Bucks added', debit: 'Bucks removed',
  'baseball-add': 'Baseball added', 'baseball-remove': 'Baseball removed'
};
const isBaseball = (type) => type === 'baseball-add' || type === 'baseball-remove';

let members = [];

const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- render */

function renderMembers(users) {
  members = users;
  const picker = $('txn-email');
  const keep = picker.value;
  picker.innerHTML = users.map(u =>
    `<option value="${esc(u.email)}">${esc(u.name)} — ${esc(u.email)}</option>`).join('');
  if (keep) picker.value = keep;
  renderHoldings();
}

function renderHoldings() {
  const email = $('txn-email').value;
  const u = members.find(m => m.email === email);
  $('holdings').textContent = u
    ? `${esc(u.name)} holds ${money(u.balance)} and ${u.baseballs} baseball${u.baseballs === 1 ? '' : 's'}.`
    : '';
}

function renderLog(entries) {
  const rows = entries.filter(e => TXN_TYPES.includes(e.type));
  $('txn-empty').classList.toggle('hidden', rows.length > 0);
  $('txn-log-body').innerHTML = rows.map(e => {
    const ball = isBaseball(e.type);
    const amount = ball
      ? `${e.amount > 0 ? '+' : '−'}${Math.abs(e.amount)} ⚾`
      : `${e.amount > 0 ? '+' : '−'}${money(Math.abs(e.amount))}`;
    const after = ball ? `${e.balanceAfter} ⚾` : money(e.balanceAfter);
    return `
      <tr>
        <td class="muted">${when(e.at)}</td>
        <td>${esc(e.email)}</td>
        <td>${TXN_LABEL[e.type] || esc(e.type)}</td>
        <td class="num ${e.amount > 0 ? 'pos' : 'neg'}">${amount}</td>
        <td class="num muted">${after}</td>
        <td class="muted">${esc(e.actedBy)}</td>
        <td class="muted">${esc(e.note)}</td>
      </tr>`;
  }).join('');
}

/* ------------------------------------------------------------------ load */

async function refresh() {
  const [overview, log] = await Promise.all([api('adminOverview'), api('adminLedger')]);
  renderMembers(overview.users);
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
  mountSignIn(() => boot());
  $('gate').classList.remove('hidden');
  $('masthead').classList.add('hidden');
  $('app').classList.add('hidden');
  say($('gate-error'), message, message ? 'bad' : '');
}

/* ---------------------------------------------------------------- wiring */

function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

on('txn-email', 'change', renderHoldings);

on('txn-go', 'click', async (e) => {
  const email = $('txn-email').value;
  const amount = Math.round(Number($('txn-amount').value));
  const kind = $('txn-kind').value;
  const note = $('txn-note').value;

  if (!email) return say($('msg'), 'Pick a member first.', 'bad');
  if (!amount) return say($('msg'), 'Enter an amount to add or remove.', 'bad');

  e.target.disabled = true;
  say($('msg'), '');
  try {
    if (kind === 'baseballs') {
      const r = await api('adjustBaseballs', { email, amount, note });
      say($('msg'), `${email} now holds ${r.baseballs} baseball${r.baseballs === 1 ? '' : 's'}.`, 'good');
    } else {
      const r = await api('adjust', { email, amount, note });
      say($('msg'), `${email} is now at ${money(r.balance)}.`, 'good');
    }
    $('txn-amount').value = '';
    $('txn-note').value = '';
    await refresh();
  } catch (err) {
    say($('msg'), err.message, 'bad');
  } finally {
    e.target.disabled = false;
  }
});

on('sign-out', 'click', () => { signOut(); location.href = 'index.html'; });

/* ------------------------------------------------------------------ boot */

$('gate-seal').innerHTML = logoImg(120, 'gate-logo');
$('mast-seal').innerHTML = logoImg(38, 'seal');

if (hasToken()) boot(); else showGate('');
