/**
 * CIA Bucks — backend
 * Bound to the spreadsheet that acts as the database.
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Then set Script Property GOOGLE_CLIENT_ID to your OAuth client ID.
 */

var DEFAULT_ADMIN   = 'cody@insurancesaleslab.com';
var DEFAULT_DOMAIN  = 'topfarmersagent.com';
var PRIZES          = [5, 10, 20];

var SHEETS = {
  users:  { name: 'Users',   headers: ['Email', 'Name', 'Balance', 'Spins', 'LastSpin', 'JoinedAt'] },
  admins: { name: 'Admins',  headers: ['Email', 'AddedBy', 'AddedAt'] },
  ledger: { name: 'Ledger',  headers: ['Timestamp', 'Email', 'Type', 'Amount', 'BalanceAfter', 'ActedBy', 'Note'] },
  config: { name: 'Config',  headers: ['Key', 'Value'] }
};

var CONFIG_DEFAULTS = {
  allowedDomain:   DEFAULT_DOMAIN,
  cooldownSeconds: '86400',   // one spin per day
  spinsAllowed:    'true',
  weight5:         '60',
  weight10:        '30',
  weight20:        '10'
};

/* ---------------------------------------------------------------- routing */

function doGet(e) {
  return json({ ok: true, service: 'CIA Bucks', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var user = verifyToken(body.idToken);
    authorize(user);
    var actor = touchUser(user);

    switch (body.action) {
      case 'session':       return json(sessionPayload(actor));
      case 'spin':          return json(doSpin(actor));
      case 'ledger':        return json({ ok: true, entries: ledgerFor(actor.email, 25) });

      // admin only
      case 'adminOverview': return json(requireAdmin(actor) && adminOverview());
      case 'adminLedger':   return json(requireAdmin(actor) && { ok: true, entries: ledgerFor(null, 100) });
      case 'addAdmin':      return json(requireAdmin(actor) && addAdmin(actor, body.email));
      case 'removeAdmin':   return json(requireAdmin(actor) && removeAdmin(actor, body.email));
      case 'adjust':        return json(requireAdmin(actor) && adjust(actor, body.email, body.amount, body.note));
      case 'setConfig':     return json(requireAdmin(actor) && setConfig(actor, body.key, body.value));

      default: return json({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------- auth */

function verifyToken(idToken) {
  if (!idToken) throw new Error('Sign in to continue.');
  var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('Server is missing GOOGLE_CLIENT_ID. Set it in Project Settings.');

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error('Your session expired. Sign in again.');

  var p = JSON.parse(res.getContentText());
  if (p.aud !== clientId) throw new Error('This login was issued for a different app.');
  if (String(p.email_verified) !== 'true') throw new Error('That Google account is not verified.');
  if (Number(p.exp) * 1000 < Date.now()) throw new Error('Your session expired. Sign in again.');

  return {
    email:   String(p.email).toLowerCase(),
    name:    p.name || p.email,
    picture: p.picture || '',
    hd:      String(p.hd || '').toLowerCase()
  };
}

function authorize(user) {
  var domain = getConfig().allowedDomain;
  var domainOk = user.hd === domain || user.email.slice(-(domain.length + 1)) === '@' + domain;
  if (domainOk || isAdmin(user.email)) return;
  throw new Error('CIA Bucks is open to @' + domain + ' accounts. Sign in with your work account.');
}

function isAdmin(email) {
  email = String(email).toLowerCase();
  if (email === DEFAULT_ADMIN) return true;
  return adminEmails().indexOf(email) !== -1;
}

function adminEmails() {
  var rows = readRows(SHEETS.admins);
  var list = rows.map(function (r) { return String(r[0]).toLowerCase(); }).filter(String);
  if (list.indexOf(DEFAULT_ADMIN) === -1) list.push(DEFAULT_ADMIN);
  return list;
}

function requireAdmin(actor) {
  if (!actor.isAdmin) throw new Error('That area is for admins only.');
  return true;
}

/* ----------------------------------------------------------------- sheets */

function sheetFor(def) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRows(def) {
  var sh = sheetFor(def);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, def.headers.length).getValues();
}

function getConfig() {
  var cfg = {};
  Object.keys(CONFIG_DEFAULTS).forEach(function (k) { cfg[k] = CONFIG_DEFAULTS[k]; });
  readRows(SHEETS.config).forEach(function (r) {
    if (r[0]) cfg[String(r[0])] = String(r[1]);
  });
  cfg.cooldownSeconds = Number(cfg.cooldownSeconds) || 0;
  return cfg;
}

function setConfig(actor, key, value) {
  if (!CONFIG_DEFAULTS.hasOwnProperty(key)) throw new Error('Unknown setting: ' + key);
  var sh = sheetFor(SHEETS.config);
  var rows = readRows(SHEETS.config);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === key) {
      sh.getRange(i + 2, 2).setValue(String(value));
      logEntry(actor.email, 'config', 0, 0, actor.email, key + ' = ' + value);
      return { ok: true, config: getConfig() };
    }
  }
  sh.appendRow([key, String(value)]);
  logEntry(actor.email, 'config', 0, 0, actor.email, key + ' = ' + value);
  return { ok: true, config: getConfig() };
}

function findUserRow(email) {
  var rows = readRows(SHEETS.users);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email) return i + 2;
  }
  return 0;
}

function touchUser(user) {
  var sh = sheetFor(SHEETS.users);
  var row = findUserRow(user.email);
  if (!row) {
    sh.appendRow([user.email, user.name, 0, 0, '', new Date().toISOString()]);
    row = sh.getLastRow();
  } else {
    sh.getRange(row, 2).setValue(user.name);
  }
  var vals = sh.getRange(row, 1, 1, SHEETS.users.headers.length).getValues()[0];
  return {
    email:    user.email,
    name:     user.name,
    picture:  user.picture,
    row:      row,
    balance:  Number(vals[2]) || 0,
    spins:    Number(vals[3]) || 0,
    lastSpin: vals[4] ? String(vals[4]) : '',
    joinedAt: vals[5] ? String(vals[5]) : '',
    isAdmin:  isAdmin(user.email)
  };
}

function logEntry(email, type, amount, balanceAfter, actedBy, note) {
  sheetFor(SHEETS.ledger).appendRow([
    new Date().toISOString(), email, type, amount, balanceAfter, actedBy || email, note || ''
  ]);
}

function ledgerFor(email, limit) {
  var rows = readRows(SHEETS.ledger);
  var out = [];
  for (var i = rows.length - 1; i >= 0 && out.length < limit; i--) {
    if (email && String(rows[i][1]).toLowerCase() !== email) continue;
    out.push({
      at: String(rows[i][0]), email: String(rows[i][1]), type: String(rows[i][2]),
      amount: Number(rows[i][3]) || 0, balanceAfter: Number(rows[i][4]) || 0,
      actedBy: String(rows[i][5]), note: String(rows[i][6])
    });
  }
  return out;
}

/* ------------------------------------------------------------------ spins */

function cooldownLeft(actor, cfg) {
  if (!actor.lastSpin || !cfg.cooldownSeconds) return 0;
  var elapsed = (Date.now() - new Date(actor.lastSpin).getTime()) / 1000;
  return Math.max(0, Math.ceil(cfg.cooldownSeconds - elapsed));
}

function sessionPayload(actor) {
  var cfg = getConfig();
  return {
    ok: true,
    user: {
      email: actor.email, name: actor.name, picture: actor.picture,
      balance: actor.balance, spins: actor.spins,
      joinedAt: actor.joinedAt, isAdmin: actor.isAdmin
    },
    spinsAllowed: cfg.spinsAllowed === 'true',
    cooldownLeft: cooldownLeft(actor, cfg),
    entries: ledgerFor(actor.email, 12)
  };
}

function pickPrize(cfg) {
  var weights = [Number(cfg.weight5) || 0, Number(cfg.weight10) || 0, Number(cfg.weight20) || 0];
  var total = weights[0] + weights[1] + weights[2];
  if (total <= 0) return 5;
  var roll = Math.random() * total;
  for (var i = 0; i < weights.length; i++) {
    if (roll < weights[i]) return PRIZES[i];
    roll -= weights[i];
  }
  return PRIZES[PRIZES.length - 1];
}

function doSpin(actor) {
  var cfg = getConfig();
  if (cfg.spinsAllowed !== 'true') throw new Error('Spins are paused right now. Check back soon.');

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheetFor(SHEETS.users);
    var vals = sh.getRange(actor.row, 1, 1, SHEETS.users.headers.length).getValues()[0];
    var fresh = { lastSpin: vals[4] ? String(vals[4]) : '' };
    var left = cooldownLeft(fresh, cfg);
    if (left > 0) throw new Error('Next spin unlocks in ' + formatWait(left) + '.');

    var prize    = pickPrize(cfg);
    var balance  = (Number(vals[2]) || 0) + prize;
    var spins    = (Number(vals[3]) || 0) + 1;
    var now      = new Date().toISOString();

    sh.getRange(actor.row, 3, 1, 3).setValues([[balance, spins, now]]);
    logEntry(actor.email, 'spin', prize, balance, actor.email, '');

    return { ok: true, prize: prize, balance: balance, spins: spins, cooldownLeft: cfg.cooldownSeconds };
  } finally {
    lock.releaseLock();
  }
}

function formatWait(sec) {
  var h = Math.floor(sec / 3600), m = Math.ceil((sec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

/* ------------------------------------------------------------------ admin */

function adminOverview() {
  var users = readRows(SHEETS.users).map(function (r) {
    return {
      email: String(r[0]).toLowerCase(), name: String(r[1]),
      balance: Number(r[2]) || 0, spins: Number(r[3]) || 0,
      lastSpin: r[4] ? String(r[4]) : '', joinedAt: r[5] ? String(r[5]) : ''
    };
  }).sort(function (a, b) { return b.balance - a.balance; });

  var issued = users.reduce(function (s, u) { return s + u.balance; }, 0);
  return {
    ok: true, users: users, admins: adminEmails(), config: getConfig(),
    totals: { issued: issued, members: users.length,
              spins: users.reduce(function (s, u) { return s + u.spins; }, 0) }
  };
}

function addAdmin(actor, email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That does not look like an email address.');
  if (isAdmin(email)) throw new Error(email + ' is already an admin.');
  sheetFor(SHEETS.admins).appendRow([email, actor.email, new Date().toISOString()]);
  logEntry(email, 'admin-add', 0, 0, actor.email, '');
  return { ok: true, admins: adminEmails() };
}

function removeAdmin(actor, email) {
  email = String(email || '').trim().toLowerCase();
  if (email === DEFAULT_ADMIN) throw new Error('The owner account cannot be removed.');
  if (email === actor.email) throw new Error('You cannot remove your own admin access.');
  var sh = sheetFor(SHEETS.admins);
  var rows = readRows(SHEETS.admins);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]).toLowerCase() === email) sh.deleteRow(i + 2);
  }
  logEntry(email, 'admin-remove', 0, 0, actor.email, '');
  return { ok: true, admins: adminEmails() };
}

function adjust(actor, email, amount, note) {
  email  = String(email || '').trim().toLowerCase();
  amount = Number(amount);
  if (!amount) throw new Error('Enter an amount to add or subtract.');

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheetFor(SHEETS.users);
    var row = findUserRow(email);
    if (!row) throw new Error(email + ' has not signed in yet, so there is no account to adjust.');
    var balance = (Number(sh.getRange(row, 3).getValue()) || 0) + amount;
    if (balance < 0) balance = 0;
    sh.getRange(row, 3).setValue(balance);
    logEntry(email, amount > 0 ? 'credit' : 'debit', amount, balance, actor.email, note || '');
    return { ok: true, email: email, balance: balance };
  } finally {
    lock.releaseLock();
  }
}

/* --------------------------------------------------- one-time setup helper */

function setupSpreadsheet() {
  Object.keys(SHEETS).forEach(function (k) { sheetFor(SHEETS[k]); });
  var sh = sheetFor(SHEETS.config);
  if (sh.getLastRow() < 2) {
    Object.keys(CONFIG_DEFAULTS).forEach(function (k) { sh.appendRow([k, CONFIG_DEFAULTS[k]]); });
  }
  var admins = sheetFor(SHEETS.admins);
  if (admins.getLastRow() < 2) admins.appendRow([DEFAULT_ADMIN, 'setup', new Date().toISOString()]);
}
