/* =====================================================================
   IT JOB LOG - BACKEND (Code.gs)
   =====================================================================
   This file runs on Google's servers, inside your Google Sheet.
   It does NOT serve the web page. The page lives on GitHub Pages
   (index.html, style.css, script.js) and talks to this file over the
   internet: each request is a small JSON message handled by doPost() below.

   TABS IN THE SHEET (created by setup())
     Jobs       one row per job
     Staff      people who ask for help (fills itself as you log jobs)
     Devices    equipment (fills itself too, optional)
     History    every change to a job: who, when, old value, new value
     Config     allowed categories and statuses
     Users      who may sign in (passwords are stored scrambled, never as text)
     Error Log  anything that went wrong, so problems can be traced

   HOW LOGIN WORKS
     - The web app runs as YOU (the owner). Nobody else needs access to the Sheet.
     - The web app address is public (it sits in the page's code), so ALL
       protection comes from the sign-in below. Keep passwords strong.
     - Only the names in ALLOWED_USERS (below) can sign up. Each person opens
       the link, taps "Sign up", types their name and chooses their own password.
       No one else ever sees or sets their password.
     - Once a name has signed up, sign-up for it is closed. When both have
       signed up, sign-up is closed completely.
     - After that people sign in with their name and password. A wrong password
       5 times locks that name for 15 minutes.
     - A successful sign-in gives the page a session token, valid for 6 hours of
       activity. Every server function checks it.

   NAMING: functions ending in _ are private. The page cannot call them.
   ===================================================================== */


/* =====================================================================
   1. SETTINGS YOU MAY WANT TO CHANGE
   ===================================================================== */

const TZ = 'Africa/Accra';          // time zone for all dates and times

// WHO IS ALLOWED TO SIGN UP. Only these names can create an account, and each
// name can be claimed once. To allow another person later, add their name here
// and run setup() again.
const ALLOWED_USERS = ['El Jefe', 'Nana'];

const MIN_PASSWORD = 8;             // shortest password allowed
const MAX_FAILS = 5;                // wrong passwords allowed before a lock
const LOCK_SECONDS = 900;           // lock length (900 = 15 minutes)
const SESSION_SECONDS = 21600;      // stay signed in for 6 hours of activity (the maximum Apps Script allows)

const RESOLVED = 'Resolved';        // the status that means "finished". Must match a status in Config.

const BACKUP_FOLDER = 'IT Job Log Backups';   // Drive folder for weekly backups
const BACKUPS_TO_KEEP = 8;          // older backups are moved to the Drive bin

// Used the first time setup() runs. After that, edit them in the Config tab.
const DEFAULT_CATEGORIES = ['Internet / Network', 'Hardware', 'Software', 'Printer', 'Account / Email', 'Other'];
const DEFAULT_STATUSES = ['Open', 'In progress', 'Resolved'];


/* =====================================================================
   2. TAB LAYOUTS
   If you add a column, add it here AND update the code that reads and
   writes that tab (search for the header name).
   ===================================================================== */

const JOB_HEADERS = ['Job ID', 'Created', 'Updated', 'Requester', 'Category', 'Issue', 'Action taken',
  'Status', 'Device', 'Minutes', 'Resolved at', 'Logged by', 'Deleted'];
const STAFF_HEADERS = ['Name', 'Department', 'Phone or extension', 'Notes', 'Active'];
const DEVICE_HEADERS = ['Name or tag', 'Type', 'Assigned to', 'Location', 'Notes', 'Active'];
const HISTORY_HEADERS = ['Job ID', 'Time', 'Who', 'Field changed', 'Old value', 'New value'];
const CONFIG_HEADERS = ['Categories', 'Statuses'];
const USER_HEADERS = ['Name', 'Salt', 'Password hash', 'Active', 'Last login'];
const ERROR_HEADERS = ['Time', 'Function', 'Message', 'User'];

// Staff and Devices share the same code. This table describes each one:
//   key    = the column that holds the unique name
//   fields = short name used by the page -> column header in the Sheet
//   refs   = other tabs that store this name and must be updated on a rename
const ENTITIES = {
  staff: {
    sheet: 'Staff', headers: STAFF_HEADERS, key: 'Name',
    fields: { name: 'Name', dept: 'Department', phone: 'Phone or extension', notes: 'Notes', active: 'Active' },
    refs: [
      { sheet: 'Jobs', headers: JOB_HEADERS, col: 'Requester', history: true },
      { sheet: 'Devices', headers: DEVICE_HEADERS, col: 'Assigned to', history: false }
    ]
  },
  device: {
    sheet: 'Devices', headers: DEVICE_HEADERS, key: 'Name or tag',
    fields: { name: 'Name or tag', type: 'Type', assignedTo: 'Assigned to', location: 'Location', notes: 'Notes', active: 'Active' },
    refs: [
      { sheet: 'Jobs', headers: JOB_HEADERS, col: 'Device', history: true }
    ]
  }
};


/* =====================================================================
   3. API ENTRY POINTS (how the GitHub page talks to this file)
   ===================================================================== */

// The ONLY functions the page is allowed to call. Anything not listed here
// (setup, weeklyBackup, helpers ending in _) cannot be reached from outside.
const API = {
  signUpOpen: signUpOpen, signUp: signUp, login: login, logout: logout, changePassword: changePassword,
  getInit: getInit, listJobs: listJobs,
  createJob: createJob, updateJob: updateJob, deleteJob: deleteJob, restoreJob: restoreJob,
  createStaff: createStaff, updateStaff: updateStaff, deactivateStaff: deactivateStaff,
  createDevice: createDevice, updateDevice: updateDevice, deactivateDevice: deactivateDevice
};

// Every request from the page arrives here as a POST with a JSON body:
//   { "fn": "createJob", "args": [ token, { ...job } ] }
// and the reply is { ok: true, data: ... } or { ok: false, error: "message" }.
function doPost(e) {
  let out;
  try {
    let req;
    try {
      req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseError) {
      throw new Error('Bad request.');
    }
    if (typeof req.fn !== 'string' || !Object.prototype.hasOwnProperty.call(API, req.fn)) throw new Error('Unknown request.');
    const args = Array.isArray(req.args) ? req.args : [];
    out = { ok: true, data: API[req.fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Opening the web app address in a browser shows this. Use it to check the deployment is live.
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: { service: 'IT Job Log API', status: 'running' } }))
    .setMimeType(ContentService.MimeType.JSON);
}


/* =====================================================================
   4. SETUP (run once from the editor; safe to run again, never deletes data)
   ===================================================================== */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  // Jobs: real date-time format on the three date columns
  const jobs = tab_('Jobs', JOB_HEADERS);
  ['Created', 'Updated', 'Resolved at'].forEach(function (h) {
    jobs.getRange(2, JOB_HEADERS.indexOf(h) + 1, jobs.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  });

  // Staff: phone numbers as text so leading zeros are kept
  const staff = tab_('Staff', STAFF_HEADERS);
  staff.getRange(2, 3, staff.getMaxRows() - 1, 1).setNumberFormat('@');

  tab_('Devices', DEVICE_HEADERS);
  tab_('History', HISTORY_HEADERS);
  tab_('Error Log', ERROR_HEADERS);

  // Config: categories in column A, statuses in column B
  const cfg = tab_('Config', CONFIG_HEADERS);
  if (cfg.getLastRow() < 2) {
    const n = Math.max(DEFAULT_CATEGORIES.length, DEFAULT_STATUSES.length);
    const rows = [];
    for (let i = 0; i < n; i++) rows.push([DEFAULT_CATEGORIES[i] || '', DEFAULT_STATUSES[i] || '']);
    cfg.getRange(2, 1, n, 2).setValues(rows);
  }

  // Users: one row per allowed name. The password stays empty until that
  // person signs up. Existing rows are left alone.
  tab_('Users', USER_HEADERS);
  ALLOWED_USERS.forEach(function (name) {
    if (!findUser_(name)) appendRows_('Users', [[cleanName_(name), '', '', 'Yes', '']]);
  });

  // Remove the empty default tab
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  installBackupTrigger_();
}

// Creates a tab with a bold header row if it does not exist yet.
function tab_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Weekly backup: every Sunday around 2am.
function installBackupTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'weeklyBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
}

// Copies the whole Sheet into the backup folder in Drive and keeps the newest few.
// You can also run this by hand from the editor at any time.
function weeklyBackup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const folders = DriveApp.getFoldersByName(BACKUP_FOLDER);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER);
    const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    DriveApp.getFileById(ss.getId()).makeCopy('IT Job Log backup ' + stamp, folder);

    // Keep only the newest BACKUPS_TO_KEEP files in that folder
    const files = [];
    const it = folder.getFiles();
    while (it.hasNext()) files.push(it.next());
    files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
    files.slice(BACKUPS_TO_KEEP).forEach(function (f) { f.setTrashed(true); });
  } catch (e) {
    logError_('weeklyBackup', e.message, 'system');
  }
}


/* =====================================================================
   5. SMALL HELPERS
   ===================================================================== */

function sheet_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// Text typed in a form: trimmed and capped in length.
function clean_(v) {
  return String(v == null ? '' : v).trim().slice(0, 2000);
}

// Names: also squeeze repeated spaces ("Ama   Boateng" -> "Ama Boateng").
function cleanName_(v) {
  return clean_(v).replace(/\s+/g, ' ').slice(0, 120);
}

// Name used for comparing: ignores capital letters and extra spaces.
function nameKey_(v) {
  return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Date -> '2026-10-07 09:14' (the page cannot receive real Date objects).
function fmtDT_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v == null ? '' : v);
}

// Adds rows at the bottom of a tab.
function appendRows_(name, rows) {
  if (!rows.length) return;
  const sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// Runs a function while holding a lock, so two people saving at the same
// moment cannot overwrite each other.
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// Writes rows to the History tab.
// Each row: [jobId, time, who, fieldChanged, oldValue, newValue]
function logHistory_(rows) {
  appendRows_('History', rows);
}

// Writes a problem to the Error Log tab. Never throws.
function logError_(fn, message, user) {
  try { appendRows_('Error Log', [[new Date(), fn, String(message).slice(0, 500), user || '']]); } catch (e) { /* ignore */ }
}

// Allowed categories and statuses from the Config tab.
function config_() {
  const sh = sheet_('Config');
  const rows = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const cats = rows.map(function (r) { return clean_(r[0]); }).filter(String);
  const stats = rows.map(function (r) { return clean_(r[1]); }).filter(String);
  return {
    categories: cats.length ? cats : DEFAULT_CATEGORIES,
    statuses: stats.length ? stats : DEFAULT_STATUSES
  };
}

// Row number (1-based) where column 'col' (1-based) equals value, or 0.
function findRow_(sh, col, value) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return 0;
}


/* =====================================================================
   6. SIGN UP, SIGN IN AND SESSIONS
   Passwords are never stored. Only a salted, repeatedly scrambled (hashed)
   version is kept in the Users tab.
   To let someone sign up again (forgotten password): in the Users tab, delete
   that person's Salt and Password hash cells. Their name becomes unclaimed.
   ===================================================================== */

function newSalt_() {
  return Utilities.getUuid();
}

function hash_(salt, password) {
  let h = salt + ':' + password;
  for (let i = 0; i < 300; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

// Finds a user by name, ignoring capitals and extra spaces.
// Returns { row, v } where v is the row's values, or null.
// Columns: 0 Name, 1 Salt, 2 Password hash, 3 Active, 4 Last login
function findUser_(name) {
  const sh = sheet_('Users');
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, USER_HEADERS.length).getValues();
  const want = nameKey_(name);
  for (let i = 0; i < rows.length; i++) {
    if (nameKey_(rows[i][0]) === want) return { row: i + 2, v: rows[i] };
  }
  return null;
}

// An account is "unclaimed" while its password hash is empty.
function isUnclaimed_(found) {
  return found && String(found.v[2]) === '' && String(found.v[3]) === 'Yes';
}

// Saves a new password (salt + hash) on a Users row.
function setPassword_(row, password) {
  const salt = newSalt_();
  sheet_('Users').getRange(row, 2, 1, 2).setValues([[salt, hash_(salt, password)]]);
}

function failKey_(name) {
  return 'fail:' + nameKey_(name).slice(0, 60);
}

// Counts a wrong attempt for a name.
function noteFail_(name) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(failKey_(name)) || 0) + 1;
  cache.put(failKey_(name), String(n), LOCK_SECONDS);
}

function isLocked_(name) {
  return Number(CacheService.getScriptCache().get(failKey_(name)) || 0) >= MAX_FAILS;
}

// Creates a session for a user and returns what the page needs: { token, name }.
function startSession_(found) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const name = String(found.v[0]);
  CacheService.getScriptCache().put('sess:' + token, JSON.stringify({ n: name }), SESSION_SECONDS);
  sheet_('Users').getRange(found.row, 5).setValue(new Date());
  return { token: token, name: name };
}

// Called by the sign-in page: true while at least one allowed name has not signed up yet.
// (It reveals no names. The "Sign up" link is hidden once everyone is registered.)
function signUpOpen() {
  const sh = sheet_('Users');
  if (!sh || sh.getLastRow() < 2) return false;
  return sh.getRange(2, 1, sh.getLastRow() - 1, USER_HEADERS.length).getValues()
    .some(function (r) { return String(r[0]) !== '' && String(r[2]) === '' && String(r[3]) === 'Yes'; });
}

// Sign up: only for an allowed name that has not been claimed yet.
// The person chooses their own password and is signed in straight away.
function signUp(name, password) {
  name = cleanName_(name);
  password = String(password == null ? '' : password);
  // One shared counter for all sign-up guesses, so the allowed names cannot be guessed freely
  if (isLocked_('__signup__')) throw new Error('Too many attempts. Wait 15 minutes and try again.');

  const notAvailable = 'Sign-up is not available for that name.';
  const first = findUser_(name);
  if (!isUnclaimed_(first)) { noteFail_('__signup__'); throw new Error(notAvailable); }
  if (password.length < MIN_PASSWORD) throw new Error('The password must be at least ' + MIN_PASSWORD + ' characters.');
  if (nameKey_(password) === nameKey_(name)) throw new Error('The password cannot be your name.');

  return withLock_(function () {
    const found = findUser_(name);                    // check again inside the lock:
    if (!isUnclaimed_(found)) throw new Error(notAvailable);   // someone may have just claimed it
    setPassword_(found.row, password);
    return startSession_(found);
  });
}

// Called by the sign-in form. Returns { token, name }.
function login(name, password) {
  name = cleanName_(name);
  password = String(password == null ? '' : password);
  if (isLocked_(name)) throw new Error('Too many wrong attempts. Wait 15 minutes and try again.');

  const found = findUser_(name);
  const ok = found && String(found.v[3]) === 'Yes' && String(found.v[2]) !== '' &&
    hash_(String(found.v[1]), password) === String(found.v[2]);
  if (!ok) {
    noteFail_(name);
    throw new Error('Wrong name or password.');
  }
  CacheService.getScriptCache().remove(failKey_(name));
  return startSession_(found);
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('sess:' + token);
  return true;
}

// Checks a token. Returns the user, or throws SESSION_EXPIRED. Each use extends the session.
function session_(token) {
  const cache = CacheService.getScriptCache();
  const raw = token ? cache.get('sess:' + token) : null;
  if (!raw) throw new Error('SESSION_EXPIRED');
  cache.put('sess:' + token, raw, SESSION_SECONDS);
  const s = JSON.parse(raw);
  return { username: s.n, name: s.n, token: token };
}

// Wraps every function the page can call:
//   1. checks the session  2. logs any failure to the Error Log
function run_(name, token, fn) {
  let user = null;
  try {
    user = session_(token);
    return fn(user);
  } catch (e) {
    if (e.message !== 'SESSION_EXPIRED') logError_(name, e.message, user ? user.name : '');
    throw e;
  }
}

// Change your own password (Account tab).
function changePassword(token, oldPassword, newPassword) {
  return run_('changePassword', token, function (user) {
    oldPassword = String(oldPassword == null ? '' : oldPassword);
    newPassword = String(newPassword == null ? '' : newPassword);
    if (isLocked_(user.username)) throw new Error('Too many wrong attempts. Wait 15 minutes and try again.');

    const found = findUser_(user.username);
    if (!found || String(found.v[2]) === '' || hash_(String(found.v[1]), oldPassword) !== String(found.v[2])) {
      noteFail_(user.username);
      throw new Error('Your current password is wrong.');
    }
    if (newPassword.length < MIN_PASSWORD) throw new Error('The new password must be at least ' + MIN_PASSWORD + ' characters.');
    if (newPassword === oldPassword) throw new Error('Choose a password different from the current one.');
    if (nameKey_(newPassword) === nameKey_(user.username)) throw new Error('The password cannot be your name.');

    setPassword_(found.row, newPassword);
    return true;
  });
}


/* =====================================================================
   7. STAFF AND DEVICES (shared code)
   ===================================================================== */

// Turns a row of a Staff/Devices tab into an object for the page, e.g. { name, dept, phone, notes, active }.
function entityObj_(E, values) {
  const o = {};
  Object.keys(E.fields).forEach(function (f) {
    const v = values[E.headers.indexOf(E.fields[f])];
    o[f] = v == null ? '' : String(v);
  });
  return o;
}

function listEntity_(kind) {
  const E = ENTITIES[kind];
  const sh = sheet_(E.sheet);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, E.headers.length).getValues()
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) { return entityObj_(E, r); });
}

// Finds one by name (ignoring capitals). Returns { row, values } or null.
function findEntity_(kind, name) {
  const E = ENTITIES[kind];
  const sh = sheet_(E.sheet);
  if (sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, E.headers.length).getValues();
  const k = E.headers.indexOf(E.key);
  const want = nameKey_(name);
  for (let i = 0; i < rows.length; i++) {
    if (nameKey_(rows[i][k]) === want) return { row: i + 2, values: rows[i] };
  }
  return null;
}

// Finds the name, or creates it if it is new. Returns the name as stored.
// 'extra' (e.g. { dept: 'Accounts' }) fills in blank details on an existing record.
// A deactivated record is switched back on when it is used again.
function ensureEntity_(kind, name, extra) {
  const E = ENTITIES[kind];
  name = cleanName_(name);
  extra = extra || {};
  const found = findEntity_(kind, name);
  const sh = sheet_(E.sheet);
  const activeCol = E.headers.indexOf('Active');

  if (found) {
    Object.keys(extra).forEach(function (f) {
      const c = E.headers.indexOf(E.fields[f]);
      if (c >= 0 && !String(found.values[c]).trim() && clean_(extra[f])) {
        sh.getRange(found.row, c + 1).setValue(clean_(extra[f]));
      }
    });
    if (String(found.values[activeCol]) === 'No') sh.getRange(found.row, activeCol + 1).setValue('Yes');
    return String(found.values[E.headers.indexOf(E.key)]);
  }

  const row = E.headers.map(function () { return ''; });
  Object.keys(extra).forEach(function (f) {
    const c = E.headers.indexOf(E.fields[f]);
    if (c >= 0) row[c] = clean_(extra[f]);
  });
  row[E.headers.indexOf(E.key)] = name;
  row[activeCol] = 'Yes';
  appendRows_(E.sheet, [row]);
  return name;
}

// The record as an object for the page, or null.
function entityByName_(kind, name) {
  if (!name) return null;
  const f = findEntity_(kind, name);
  return f ? entityObj_(ENTITIES[kind], f.values) : null;
}

// Levenshtein distance: how many single-letter edits turn a into b.
function lev_(a, b) {
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Existing names that look like the one typed (e.g. "Kofi" vs "Kofi Mensah", "Amma" vs "Ama").
function similarNames_(kind, name) {
  const E = ENTITIES[kind];
  const a = nameKey_(name);
  const out = [];
  listEntity_(kind).forEach(function (o) {
    const b = nameKey_(o.name);
    if (b === a) return;
    const contains = a.length >= 3 && b.length >= 3 && (a.indexOf(b) > -1 || b.indexOf(a) > -1);
    const close = Math.min(a.length, b.length) >= 4 && lev_(a, b) <= 2;
    if (contains || close) out.push(o.name);
  });
  return out.slice(0, 3);
}

// Changes every cell in 'colName' of a tab that holds oldName so it holds newName.
// For the Jobs tab it also writes a History row per job.
function renameInColumn_(sheetName, headers, colName, oldName, newName, user, withHistory) {
  const sh = sheet_(sheetName);
  const last = sh.getLastRow();
  if (last < 2) return;
  const c = headers.indexOf(colName) + 1;
  const range = sh.getRange(2, c, last - 1, 1);
  const vals = range.getValues();
  const ids = withHistory ? sh.getRange(2, 1, last - 1, 1).getValues() : null;
  const hist = [];
  let changed = false;
  const now = new Date();
  for (let i = 0; i < vals.length; i++) {
    if (nameKey_(vals[i][0]) === nameKey_(oldName)) {
      vals[i][0] = newName;
      changed = true;
      if (withHistory) hist.push([ids[i][0], now, user.name, colName, oldName, newName]);
    }
  }
  if (changed) range.setValues(vals);
  logHistory_(hist);
}

function createEntity_(kind, p, user) {
  return withLock_(function () {
    const E = ENTITIES[kind];
    const name = cleanName_(p.name);
    if (!name) throw new Error('A name is required.');
    if (findEntity_(kind, name)) throw new Error('"' + name + '" already exists.');
    const row = E.headers.map(function () { return ''; });
    Object.keys(E.fields).forEach(function (f) {
      if (p[f] !== undefined) row[E.headers.indexOf(E.fields[f])] = clean_(p[f]);
    });
    row[E.headers.indexOf(E.key)] = name;
    row[E.headers.indexOf('Active')] = 'Yes';
    appendRows_(E.sheet, [row]);
    return entityObj_(E, row);
  });
}

// patch can contain any field of the entity. Renaming also updates linked jobs/devices.
function updateEntity_(kind, key, patch, user) {
  return withLock_(function () {
    const E = ENTITIES[kind];
    const found = findEntity_(kind, key);
    if (!found) throw new Error('Not found: ' + key);
    const vals = found.values.slice();
    const k = E.headers.indexOf(E.key);
    const oldName = String(vals[k]);
    let newName = oldName;

    if (patch.name !== undefined) {
      newName = cleanName_(patch.name);
      if (!newName) throw new Error('A name is required.');
      const other = findEntity_(kind, newName);
      if (other && other.row !== found.row) throw new Error('"' + newName + '" already exists.');
    }
    Object.keys(E.fields).forEach(function (f) {
      if (f === 'name' || patch[f] === undefined) return;
      let v = clean_(patch[f]);
      if (f === 'active') v = /^(no|false|0)$/i.test(v) ? 'No' : 'Yes';
      vals[E.headers.indexOf(E.fields[f])] = v;
    });
    vals[k] = newName;
    sheet_(E.sheet).getRange(found.row, 1, 1, E.headers.length).setValues([vals]);

    if (newName !== oldName) {
      E.refs.forEach(function (r) { renameInColumn_(r.sheet, r.headers, r.col, oldName, newName, user, r.history); });
    }
    return entityObj_(E, vals);
  });
}


/* =====================================================================
   8. JOBS
   ===================================================================== */

// Turns a row of the Jobs tab into an object for the page.
function jobFromRow_(r) {
  return {
    id: String(r[0]), created: fmtDT_(r[1]), updated: fmtDT_(r[2]),
    requester: String(r[3]), category: String(r[4]), issue: String(r[5]), action: String(r[6]),
    status: String(r[7]), device: String(r[8]),
    minutes: r[9] === '' || r[9] == null ? '' : Number(r[9]),
    resolved: fmtDT_(r[10]), by: String(r[11]),
    deleted: String(r[12]).toLowerCase() === 'yes'
  };
}

// All jobs, newest first (deleted ones are included and flagged).
function listJobs_() {
  const sh = sheet_('Jobs');
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, JOB_HEADERS.length).getValues()
    .filter(function (r) { return String(r[0]) !== ''; })
    .map(jobFromRow_)
    .reverse();
}

// Next ID: J-0001, J-0002, ...
function nextJobId_() {
  const sh = sheet_('Jobs');
  let max = 0;
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      const m = /^J-(\d+)$/.exec(String(r[0]));
      if (m) max = Math.max(max, Number(m[1]));
    });
  }
  return 'J-' + ('0000' + (max + 1)).slice(-4);
}

// Checks a new job coming from the form and returns a cleaned version.
// Throws an error with a plain message if something is wrong.
function validateJob_(j, cfg) {
  const v = {
    requester: cleanName_(j.requester),
    dept: cleanName_(j.dept),
    category: clean_(j.category) || (cfg.categories.indexOf('Other') > -1 ? 'Other' : cfg.categories[0]),
    issue: clean_(j.issue),
    action: clean_(j.action),
    status: clean_(j.status) || cfg.statuses[0],
    device: cleanName_(j.device),
    minutes: ''
  };
  if (!v.requester) throw new Error('Add who asked for the job.');
  if (!v.issue) throw new Error('Describe the issue.');
  if (cfg.categories.indexOf(v.category) === -1) throw new Error('Unknown category: ' + v.category);
  if (cfg.statuses.indexOf(v.status) === -1) throw new Error('Unknown status: ' + v.status);
  if (j.minutes !== '' && j.minutes != null) {
    const m = Number(j.minutes);
    if (!isFinite(m) || m < 0) throw new Error('Minutes must be a number, 0 or more.');
    v.minutes = Math.round(m);
  }
  return v;
}

function createJob_(j, user) {
  return withLock_(function () {
    const v = validateJob_(j, config_());

    // A brand-new name that looks like an existing one: ask before adding it.
    // The page shows the choices and sends the job again with confirmNew = true.
    if (!findEntity_('staff', v.requester) && !j.confirmNew) {
      const similar = similarNames_('staff', v.requester);
      if (similar.length) return { needsConfirm: true, similar: similar };
    }

    const requester = ensureEntity_('staff', v.requester, { dept: v.dept });
    const device = v.device ? ensureEntity_('device', v.device, {}) : '';
    const now = new Date();
    const id = nextJobId_();

    // The order here must match JOB_HEADERS at the top of this file.
    const row = [id, now, now, requester, v.category, v.issue, v.action, v.status, device,
      v.minutes, v.status === RESOLVED ? now : '', user.name, ''];
    appendRows_('Jobs', [row]);
    logHistory_([[id, now, user.name, 'Job', '', 'Created']]);

    return { ok: true, job: jobFromRow_(row), staff: entityByName_('staff', requester), device: entityByName_('device', device) };
  });
}

// patch can contain: requester, category, issue, action, status, device, minutes.
// Only fields that actually changed are written, and each is recorded in History.
function updateJob_(id, patch, user) {
  return withLock_(function () {
    const sh = sheet_('Jobs');
    const row = findRow_(sh, 1, id);
    if (!row) throw new Error('Job not found.');
    const cfg = config_();
    const cur = sh.getRange(row, 1, 1, JOB_HEADERS.length).getValues()[0];
    const next = cur.slice();
    const now = new Date();
    const hist = [];

    // field -> column index (0 = column A)
    const COL = { requester: 3, category: 4, issue: 5, action: 6, status: 7, device: 8, minutes: 9 };

    Object.keys(COL).forEach(function (f) {
      if (patch[f] === undefined) return;
      const i = COL[f];
      let val;
      if (f === 'requester') {
        val = cleanName_(patch[f]);
        if (!val) throw new Error('Requester cannot be empty.');
        val = ensureEntity_('staff', val, {});
      } else if (f === 'device') {
        val = cleanName_(patch[f]);
        if (val) val = ensureEntity_('device', val, {});
      } else if (f === 'category') {
        val = clean_(patch[f]);
        if (cfg.categories.indexOf(val) === -1) throw new Error('Unknown category: ' + val);
      } else if (f === 'status') {
        val = clean_(patch[f]);
        if (cfg.statuses.indexOf(val) === -1) throw new Error('Unknown status: ' + val);
      } else if (f === 'issue') {
        val = clean_(patch[f]);
        if (!val) throw new Error('The issue cannot be empty.');
      } else if (f === 'minutes') {
        if (patch[f] === '' || patch[f] == null) val = '';
        else {
          const m = Number(patch[f]);
          if (!isFinite(m) || m < 0) throw new Error('Minutes must be a number, 0 or more.');
          val = Math.round(m);
        }
      } else {
        val = clean_(patch[f]);
      }

      if (String(cur[i]) !== String(val)) {
        hist.push([id, now, user.name, JOB_HEADERS[i], String(cur[i]), String(val)]);
        next[i] = val;
        if (f === 'status') {
          if (val === RESOLVED) next[10] = now;            // set "Resolved at"
          else if (String(cur[i]) === RESOLVED) next[10] = ''; // reopened: clear it
        }
      }
    });

    if (hist.length) {
      next[2] = now;   // Updated
      sh.getRange(row, 1, 1, JOB_HEADERS.length).setValues([next]);
      logHistory_(hist);
    }
    return { ok: true, job: jobFromRow_(next), staff: entityByName_('staff', next[3]), device: entityByName_('device', next[8]) };
  });
}

// Soft delete / restore: the row stays in the Sheet, only the Deleted flag changes.
function setDeleted_(id, deleted, user) {
  return withLock_(function () {
    const sh = sheet_('Jobs');
    const row = findRow_(sh, 1, id);
    if (!row) throw new Error('Job not found.');
    const now = new Date();
    const dCol = JOB_HEADERS.indexOf('Deleted') + 1;
    sh.getRange(row, dCol).setValue(deleted ? 'Yes' : '');
    sh.getRange(row, 3).setValue(now);   // Updated
    logHistory_([[id, now, user.name, 'Deleted', deleted ? '' : 'Yes', deleted ? 'Yes' : '']]);
    return { ok: true, job: jobFromRow_(sh.getRange(row, 1, 1, JOB_HEADERS.length).getValues()[0]) };
  });
}


/* =====================================================================
   9. FUNCTIONS THE PAGE CALLS (listed in API above)
   Each one takes the session token first and goes through run_().
   ===================================================================== */

// Everything the page needs after signing in.
function getInit(token) {
  return run_('getInit', token, function (user) {
    const cfg = config_();
    return {
      user: { name: user.name },
      categories: cfg.categories,
      statuses: cfg.statuses,
      staff: listEntity_('staff'),
      devices: listEntity_('device'),
      jobs: listJobs_(),
      today: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')
    };
  });
}

function listJobs(token) { return run_('listJobs', token, function () { return listJobs_(); }); }
function createJob(token, job) { return run_('createJob', token, function (u) { return createJob_(job, u); }); }
function updateJob(token, id, patch) { return run_('updateJob', token, function (u) { return updateJob_(id, patch, u); }); }
function deleteJob(token, id) { return run_('deleteJob', token, function (u) { return setDeleted_(id, true, u); }); }
function restoreJob(token, id) { return run_('restoreJob', token, function (u) { return setDeleted_(id, false, u); }); }

function createStaff(token, p) { return run_('createStaff', token, function (u) { return createEntity_('staff', p, u); }); }
function updateStaff(token, name, patch) { return run_('updateStaff', token, function (u) { return updateEntity_('staff', name, patch, u); }); }
function deactivateStaff(token, name) { return run_('deactivateStaff', token, function (u) { return updateEntity_('staff', name, { active: 'No' }, u); }); }

function createDevice(token, p) { return run_('createDevice', token, function (u) { return createEntity_('device', p, u); }); }
function updateDevice(token, name, patch) { return run_('updateDevice', token, function (u) { return updateEntity_('device', name, patch, u); }); }
function deactivateDevice(token, name) { return run_('deactivateDevice', token, function (u) { return updateEntity_('device', name, { active: 'No' }, u); }); }
