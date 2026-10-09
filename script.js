/* =====================================================================
   IT JOB LOG - BEHAVIOUR (script.js)
   =====================================================================
   All the JavaScript lives here.

   FIRST: paste your Apps Script web app address into API_URL below.

   How data moves:
     Sign up      -> signUp() in Code.gs       -> a session token comes back
     Sign in      -> login() in Code.gs        -> a session token comes back
     Every action -> a function in Code.gs     -> the token is sent along with it
     Page opens   -> getInit() in Code.gs      -> all jobs, staff, devices, settings

   The page keeps a copy of all the data in memory (the variable S) so that
   searching, filtering and the summary are instant.
   ===================================================================== */

// ---------------------------------------------------------------------
// THE ONE SETTING THAT CONNECTS THE PAGE TO THE BACKEND
// This is the web app address from Apps Script (Deploy > Manage deployments).
// Only change it if you create a brand-new deployment, which gives a new address.
// ---------------------------------------------------------------------
var API_URL = 'https://script.google.com/macros/s/AKfycbxxNf4moghcGrSa1u6f0t9J1UeF8gXHorE2gp6tWnjHQwgYKFMEqvHpDpKKfoX5Y2tS/exec';

// How long to wait for the server before giving up (milliseconds).
// The first request after a quiet spell can take a few seconds.
var TIMEOUT_MS = 45000;

/* =====================================================================
   1. SETTINGS AND STATE
   ===================================================================== */

// The status that means "finished". Must match the name in the Config tab
// and RESOLVED in Code.gs.
var RESOLVED = 'Resolved';

// Colour for each status (colours are defined in style.css). Any other
// status name you add in Config shows in grey.
var COLORS = {
  'Open': 'var(--open)',
  'In progress': 'var(--prog)',
  'Resolved': 'var(--done)'
};

// How many jobs the History tab shows at first (and each time you press "Show more")
var PAGE_SIZE = 50;

// Minimum password length (the server checks this too)
var MIN_PASSWORD = 8;

// S holds the data loaded from the Sheet
var S = { user: null, cats: [], statuses: [], staff: [], devices: [], jobs: [], today: '' };

var token = '';               // session token from the last sign-in
var staffMap = {};            // staff by lower-case name, for quick department lookups
var cat = '';                 // category currently selected in the form
var status = '';              // status currently selected in the form
var histLimit = PAGE_SIZE;    // how many history rows are currently shown


/* =====================================================================
   2. SMALL HELPERS
   ===================================================================== */

// Shortcut: $('save') means document.getElementById('save')
function $(id) {
  return document.getElementById(id);
}

// Makes text safe to put inside HTML (so a "<" typed in an issue cannot break the page)
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Remember small things on this device (the session token and last name).
// store('key') reads, store('key', 'value') saves.
// If this device is shared by several people, change localStorage to sessionStorage
// below: you then sign in again each time the tab is closed.
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { /* storage not available: ignore */ }
  return null;
}

// Shows the small pop-up message at the bottom. Pass true as 2nd value for a red error.
function toast(msg, isErr) {
  var t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.className = 'toast'; }, isErr ? 5000 : 2200);
}

// Plain-English text from a server error.
function errText(e) {
  return (e && e.message) ? e.message.replace(/^Error:\s*/, '') : 'Something went wrong. Try again.';
}

function fail(e) {
  toast(errText(e), true);
}

// Date and time parts of a job. The server sends "2026-10-07 09:14".
function jDate(j) { return j.created.slice(0, 10); }
function jTime(j) { return j.created.slice(11); }

// Colour for a status
function statusColor(s) {
  return COLORS[s] || 'var(--muted)';
}

// Department of a person (from the Staff tab), or ''
function deptOf(name) {
  var s = staffMap[String(name).toLowerCase()];
  return s ? s.dept : '';
}

function buildMaps() {
  staffMap = {};
  S.staff.forEach(function (s) { staffMap[s.name.toLowerCase()] = s; });
}


/* =====================================================================
   3. TALKING TO THE SERVER
   ===================================================================== */

// call('functionName', [arguments], onSuccess, onFailure)
// Sends a request to Code.gs over the internet and gives the answer to onSuccess.
// If the session has run out, sends the person back to sign in.
//
// Note: the request is sent as plain text (not application/json) on purpose.
// That is what lets a page on GitHub talk to Apps Script without being blocked.
var notConnected = API_URL.indexOf('PASTE_') !== -1;

function call(name, args, ok, bad) {
  var failure = function (message) {
    if (message.indexOf('SESSION_EXPIRED') !== -1) { showLogin('Your session expired. Sign in again.'); return; }
    var err = { message: message };
    if (bad) bad(err); else fail(err);
  };

  if (notConnected) { failure('This page is not connected yet. Paste your web app address into API_URL at the top of script.js.'); return; }

  var controller = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT_MS);

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: name, args: args }),
    signal: controller ? controller.signal : undefined
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) ok(res.data);
      else failure((res && res.error) || 'Something went wrong. Try again.');
    }, function () {
      clearTimeout(timer);
      failure('Could not reach the server. Check your internet connection and try again.');
    });
}

// Same as call(), but sends the session token as the first argument.
function authCall(name, args, ok, bad) {
  call(name, [token].concat(args), ok, bad);
}


/* =====================================================================
   4. SCREENS: SIGN IN, NEW PASSWORD, APP
   ===================================================================== */

// Shows one screen ('boot', 'login' or 'app') and hides the others.
function showScreen(name) {
  ['boot', 'login-view', 'app-view'].forEach(function (id) {
    $(id).hidden = (id !== (name === 'boot' ? 'boot' : name + '-view'));
  });
}

function showLogin(msg) {
  token = '';
  store('itlog.token', '');
  S = { user: null, cats: [], statuses: [], staff: [], devices: [], jobs: [], today: '' };
  $('lg-msg').textContent = msg || '';
  $('lg-pass').value = '';
  $('lg-user').value = store('itlog.user') || '';
  $('signin-form').hidden = false;       // always open on the sign-in form
  $('signup-form').hidden = true;
  showScreen('login');
  ($('lg-user').value ? $('lg-pass') : $('lg-user')).focus();

  // Show the "Sign up" link only while someone still has not signed up
  $('go-signup').hidden = true;
  call('signUpOpen', [], function (open) { $('go-signup').hidden = !open; }, function () {});
}

// When the page opens: if a token is saved on this device, try to use it.
token = store('itlog.token') || '';
if (notConnected) {
  showLogin('This page is not connected yet. Paste your web app address into API_URL at the top of script.js.');
  $('lg-btn').disabled = true;
} else if (token) {
  loadData();
} else {
  showLogin('');
}

// Sign in
function doLogin() {
  var username = $('lg-user').value.trim();
  var password = $('lg-pass').value;
  if (!username || !password) { $('lg-msg').textContent = 'Enter your name and password.'; return; }
  var btn = $('lg-btn');
  btn.disabled = true;
  $('lg-msg').textContent = '';
  call('login', [username, password], function (r) {
    btn.disabled = false;
    token = r.token;
    store('itlog.token', token);
    store('itlog.user', username);
    $('lg-pass').value = '';
    loadData();
  }, function (e) {
    btn.disabled = false;
    $('lg-msg').textContent = errText(e);
    $('lg-pass').value = '';
  });
}
$('lg-btn').onclick = doLogin;
$('lg-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
$('lg-user').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('lg-pass').focus(); });

// Ask the server for everything, then build the app.
function loadData() {
  showScreen('boot');
  authCall('getInit', [], function (d) {
    S.user = d.user; S.cats = d.categories; S.statuses = d.statuses;
    S.staff = d.staff; S.devices = d.devices; S.jobs = d.jobs; S.today = d.today;
    startApp();
  }, function (e) {
    showLogin('Could not load the data. ' + errText(e));
  });
}

// Builds all the buttons and lists once the data is here.
function startApp() {
  buildMaps();
  buildChips();
  buildStatus();
  buildSelects();
  refreshLists();
  $('who').textContent = S.user.name;
  $('acctName').textContent = 'Signed in as ' + S.user.name;
  cat = '';
  showScreen('app');
  showTab('log');
}

// --- Sign up (first time only) ---
// Switches between the sign-in form and the sign-up form.
function showSignup(on) {
  $('signin-form').hidden = on;
  $('signup-form').hidden = !on;
  $('su-msg').textContent = '';
  $('lg-msg').textContent = '';
  (on ? $('su-user') : $('lg-user')).focus();
}
$('go-signup').onclick = function () { showSignup(true); };
$('go-signin').onclick = function () { showSignup(false); };

// Sends the sign-up form to signUp() in Code.gs. On success the person is signed in.
function doSignup() {
  var name = $('su-user').value.trim(), p1 = $('su-pass').value, p2 = $('su-pass2').value;
  var msg = $('su-msg'), btn = $('su-btn');
  msg.textContent = '';
  if (!name || !p1) { msg.textContent = 'Fill in all the boxes.'; return; }
  if (p1.length < MIN_PASSWORD) { msg.textContent = 'The password must be at least ' + MIN_PASSWORD + ' characters.'; return; }
  if (p1 !== p2) { msg.textContent = 'The two passwords do not match.'; return; }
  btn.disabled = true;
  call('signUp', [name, p1], function (r) {
    btn.disabled = false;
    ['su-user', 'su-pass', 'su-pass2'].forEach(function (id) { $(id).value = ''; });
    token = r.token;
    store('itlog.token', token);
    store('itlog.user', r.name);
    loadData();
  }, function (e) {
    btn.disabled = false;
    msg.textContent = errText(e);
  });
}
$('su-btn').onclick = doSignup;
$('su-pass2').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSignup(); });

// --- Change password (Account tab) ---
function submitPassword() {
  var old = $('ac-old').value, n1 = $('ac-new').value, n2 = $('ac-new2').value;
  var msg = $('ac-msg'), btn = $('ac-btn');
  msg.textContent = '';
  if (!old || !n1) { msg.textContent = 'Fill in all the boxes.'; return; }
  if (n1.length < MIN_PASSWORD) { msg.textContent = 'The new password must be at least ' + MIN_PASSWORD + ' characters.'; return; }
  if (n1 !== n2) { msg.textContent = 'The two new passwords do not match.'; return; }
  btn.disabled = true;
  authCall('changePassword', [old, n1], function () {
    btn.disabled = false;
    ['ac-old', 'ac-new', 'ac-new2'].forEach(function (id) { $(id).value = ''; });
    toast('Password changed.');
  }, function (e) {
    btn.disabled = false;
    msg.textContent = errText(e);
  });
}
$('ac-btn').onclick = submitPassword;

// Sign out
$('logout').onclick = function () {
  var done = function () { showLogin(''); };
  call('logout', [token], done, done);
};


/* =====================================================================
   5. BUILDING THE FORM CONTROLS
   ===================================================================== */

// Category buttons (from the Config tab)
function buildChips() {
  var html = '';
  S.cats.forEach(function (c) {
    html += '<button type="button" class="chip" aria-pressed="false" data-c="' + esc(c) + '">' + esc(c) + '</button>';
  });
  $('cats').innerHTML = html;

  // Clicking a chip selects it; clicking it again un-selects it
  $('cats').onclick = function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    cat = (cat === b.dataset.c) ? '' : b.dataset.c;
    Array.prototype.forEach.call($('cats').children, function (x) {
      x.setAttribute('aria-pressed', x.dataset.c === cat);
    });
  };
}

// Status buttons (from the Config tab). "Resolved" is pre-selected because most
// jobs are quick fixes logged after the fact.
function buildStatus() {
  status = S.statuses.indexOf(RESOLVED) > -1 ? RESOLVED : S.statuses[0];
  var html = '';
  S.statuses.forEach(function (s) {
    html += '<button type="button" data-s="' + esc(s) + '" aria-pressed="' + (s === status) + '">' +
            '<i class="dot" style="--c:' + statusColor(s) + '"></i>' + esc(s) + '</button>';
  });
  $('statusSeg').innerHTML = html;

  $('statusSeg').onclick = function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    status = b.dataset.s;
    Array.prototype.forEach.call($('statusSeg').children, function (x) {
      x.setAttribute('aria-pressed', x.dataset.s === status);
    });
  };
}

// The two History filter dropdowns
function buildSelects() {
  $('fCat').innerHTML = '<option value="">All categories</option>' +
    S.cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('fStatus').innerHTML = '<option value="">All statuses</option>' +
    S.statuses.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  fillLists();
}

// Name, department and device suggestions for the form (only active records)
function fillLists() {
  $('staffList').innerHTML = S.staff.filter(function (s) { return s.active !== 'No'; })
    .map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join('');

  $('deviceList').innerHTML = S.devices.filter(function (d) { return d.active !== 'No'; })
    .map(function (d) { return '<option value="' + esc(d.name) + '">'; }).join('');

  var depts = {};
  S.staff.forEach(function (s) { if (s.dept) depts[s.dept] = 1; });
  $('deptList').innerHTML = Object.keys(depts).sort()
    .map(function (d) { return '<option value="' + esc(d) + '">'; }).join('');
}


/* =====================================================================
   6. TABS
   ===================================================================== */

// Shows one tab ('log', 'today', 'open', 'history', 'summary' or 'account').
function showTab(name) {
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.setAttribute('aria-selected', t.dataset.tab === name);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
    v.classList.toggle('on', v.id === 'v-' + name);
  });
  if (name === 'summary') renderSummary();
  window.scrollTo(0, 0);
}

document.querySelector('.tabs').onclick = function (e) {
  var t = e.target.closest('.tab');
  if (t) showTab(t.dataset.tab);
};


/* =====================================================================
   7. LOG A JOB (the form)
   ===================================================================== */

// While typing a name: auto-fill the department and show their job history.
$('requester').addEventListener('input', function () {
  hideSimilar();
  var typed = this.value.trim();
  var match = staffMap[typed.toLowerCase()];

  // Fill in the department if we know it and the box is empty
  if (match && !$('dept').value) $('dept').value = match.dept;

  if (!typed) { $('hint').textContent = ''; return; }

  // This person's earlier jobs (S.jobs is newest first; deleted ones are ignored)
  var mine = S.jobs.filter(function (j) {
    return !j.deleted && j.requester.toLowerCase() === typed.toLowerCase();
  });

  if (!mine.length) {
    $('hint').textContent = match ? 'No jobs logged for them yet.' : 'New name, they will be added to the staff list.';
    return;
  }
  $('hint').textContent = mine.length + ' earlier job' + (mine.length > 1 ? 's' : '') +
    '. Last: ' + mine[0].category + ' on ' + jDate(mine[0]) + '.';
});

// --- "Did you mean...?" panel (shown when a new name looks like an existing one) ---
function hideSimilar() {
  $('similar').hidden = true;
  $('similar').innerHTML = '';
}

function showSimilar(names) {
  var typed = $('requester').value.trim();
  var html = '<p>This name looks like someone already on the list. Did you mean:</p><div class="chips">';
  names.forEach(function (n) {
    html += '<button type="button" class="chip" data-use="' + esc(n) + '">' + esc(n) + '</button>';
  });
  html += '<button type="button" class="chip" data-new="1">No, add "' + esc(typed) + '" as new</button></div>';
  $('similar').innerHTML = html;
  $('similar').hidden = false;
}

$('similar').onclick = function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.use) { $('requester').value = b.dataset.use; hideSimilar(); submitJob(false); }
  if (b.dataset.new) { hideSimilar(); submitJob(true); }
};

// "Save job" button
$('save').onclick = function () { submitJob(false); };

// Sends the form to createJob() in Code.gs. confirmNew = true means "yes, this is a new person".
function submitJob(confirmNew) {
  var requester = $('requester').value.trim();
  var issue = $('issue').value.trim();

  // Only two things are compulsory: who asked, and what the issue was
  if (!requester) { toast('Add who asked for the job.', true); $('requester').focus(); return; }
  if (!issue) { toast('Describe the issue.', true); $('issue').focus(); return; }

  var btn = $('save');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  var job = {
    requester: requester,
    dept: $('dept').value,
    category: cat,                 // blank = the server uses "Other"
    issue: issue,
    action: $('action').value,
    status: status,
    minutes: $('minutes').value,
    device: $('device').value,
    confirmNew: !!confirmNew
  };

  authCall('createJob', [job], function (r) {
    btn.disabled = false;
    btn.textContent = 'Save job';

    if (r.needsConfirm) { showSimilar(r.similar); return; }   // ask "did you mean...?"

    applyResult(r);

    // Clear the form for the next job (category and status stay as they were)
    ['requester', 'dept', 'issue', 'action', 'minutes', 'device'].forEach(function (id) { $(id).value = ''; });
    $('hint').textContent = '';
    toast('Job saved (' + r.job.id + ').');
    $('requester').focus();
  }, function (e) {
    btn.disabled = false;
    btn.textContent = 'Save job';
    fail(e);
  });
}

// Adds a result from the server into the page's copy of the data and redraws everything.
// r can contain: job, staff, device
function applyResult(r) {
  var found = false;
  for (var i = 0; i < S.jobs.length; i++) {
    if (S.jobs[i].id === r.job.id) { S.jobs[i] = r.job; found = true; break; }
  }
  if (!found) S.jobs.unshift(r.job);
  upsert(S.staff, r.staff);
  upsert(S.devices, r.device);
  buildMaps();
  fillLists();
  refreshLists();
  renderSummary();
}

// Adds or replaces a staff/device record in a list (matched by name, ignoring capitals)
function upsert(list, obj) {
  if (!obj) return;
  var key = obj.name.toLowerCase();
  for (var i = 0; i < list.length; i++) {
    if (list[i].name.toLowerCase() === key) { list[i] = obj; return; }
  }
  list.push(obj);
}


/* =====================================================================
   8. JOB CARDS
   ===================================================================== */

// Number of days between two dates written as 'yyyy-mm-dd'
function daysBetween(a, b) {
  var x = a.split('-'), y = b.split('-');
  return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 86400000);
}

// Builds the HTML for ONE job card. showAge = true adds "Open for 3 days".
// To change what a card shows, edit this function (and the .job styles in style.css).
function card(j, showAge) {
  var dept = deptOf(j.requester);
  var color = j.deleted ? 'var(--muted)' : statusColor(j.status);
  var age = '';
  if (showAge && !j.deleted && j.status !== RESOLVED) {
    var d = daysBetween(jDate(j), S.today);
    age = '<span>' + (d <= 0 ? 'Opened today' : 'Open for ' + d + ' day' + (d > 1 ? 's' : '')) + '</span>';
  }

  // Status options for the edit panel, with the current one pre-selected
  var options = S.statuses.map(function (s) {
    return '<option' + (s === j.status ? ' selected' : '') + '>' + esc(s) + '</option>';
  }).join('');

  var buttons = j.deleted
    ? '<button class="link" data-act="restore">Restore</button>'
    : '<button class="link" data-act="edit">Update</button>';

  return '<article class="job' + (j.deleted ? ' gone' : '') + '" data-id="' + esc(j.id) + '" style="--led:' + color + '">' +

    // Top line: name, department, date and time
    '<div class="job-top"><strong>' + esc(j.requester) + '</strong>' +
      (dept ? '<span class="dept">' + esc(dept) + '</span>' : '') +
      '<span class="when">' + esc(jDate(j)) + ' ' + esc(jTime(j)) + '</span></div>' +

    // The issue and what was done
    '<p class="issue">' + esc(j.issue) + '</p>' +
    (j.action ? '<p class="action">Done: ' + esc(j.action) + '</p>' : '') +

    // Small details line + the Update button
    '<div class="meta">' +
      '<span class="pill"><i class="dot" style="--c:' + color + '"></i>' + (j.deleted ? 'Deleted' : esc(j.status)) + '</span>' +
      '<span>' + esc(j.category) + '</span>' +
      (j.by ? '<span>By ' + esc(j.by) + '</span>' : '') +
      (j.minutes !== '' ? '<span>' + esc(j.minutes) + ' min</span>' : '') +
      (j.device ? '<span>' + esc(j.device) + '</span>' : '') +
      age + buttons +
    '</div>' +

    // Hidden edit panel (opens when "Update" is pressed)
    '<div class="edit" hidden>' +
      '<label>Status</label><select data-f="status">' + options + '</select>' +
      '<label>What was done</label><textarea data-f="action">' + esc(j.action) + '</textarea>' +
      '<label>Minutes spent</label><input type="number" min="0" data-f="minutes" value="' + esc(j.minutes) + '">' +
      '<div class="actions">' +
        '<button class="btn" data-act="save">Save changes</button>' +
        '<button class="btn ghost" data-act="cancel">Cancel</button>' +
        '<button class="btn ghost danger" data-act="delete">Delete job</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

// One click handler for every card button (Update / Save changes / Cancel / Delete / Restore).
// Fields in the edit panel are marked data-f="status" etc. and sent to updateJob().
document.querySelector('main').addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]');
  if (!b) return;

  var article = b.closest('.job');
  var panel = article.querySelector('.edit');
  var id = article.dataset.id;

  if (b.dataset.act === 'edit') { panel.hidden = !panel.hidden; return; }   // open / close panel
  if (b.dataset.act === 'cancel') { panel.hidden = true; return; }

  if (b.dataset.act === 'save') {
    var patch = {};
    Array.prototype.forEach.call(panel.querySelectorAll('[data-f]'), function (el) {
      patch[el.dataset.f] = el.value;
    });
    b.disabled = true;
    b.textContent = 'Saving...';
    authCall('updateJob', [id, patch], function (r) {
      applyResult(r);
      toast('Changes saved.');
    }, function (err) {
      b.disabled = false;
      b.textContent = 'Save changes';
      fail(err);
    });
    return;
  }

  // Delete needs two taps, so a job is never deleted by accident
  if (b.dataset.act === 'delete') {
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = 'Tap again to delete';
      setTimeout(function () { b.dataset.armed = ''; b.textContent = 'Delete job'; }, 4000);
      return;
    }
    authCall('deleteJob', [id], function (r) {
      applyResult(r);
      toast('Job deleted. Tick "Show deleted jobs" in History to restore it.');
    });
    return;
  }

  if (b.dataset.act === 'restore') {
    authCall('restoreJob', [id], function (r) {
      applyResult(r);
      toast('Job restored.');
    });
  }
});


/* =====================================================================
   9. LISTS: TODAY, OPEN, HISTORY
   ===================================================================== */

// Puts job cards into a list area, or a friendly message if there are none.
function list(el, jobs, emptyMessage, showAge) {
  el.innerHTML = jobs.length
    ? jobs.map(function (j) { return card(j, showAge); }).join('')
    : '<div class="empty">' + emptyMessage + '</div>';
}

// Redraws Today, Open and History (call this whenever the data changes).
function refreshLists() {
  var live = S.jobs.filter(function (j) { return !j.deleted; });
  var today = live.filter(function (j) { return jDate(j) === S.today; });
  var open = live.filter(function (j) { return j.status !== RESOLVED; }).reverse();   // oldest first

  // Badges on the tabs
  $('n-today').textContent = today.length;
  $('n-open').textContent = open.length;

  var resolved = today.filter(function (j) { return j.status === RESOLVED; }).length;
  $('todaySub').textContent = today.length ? today.length + ' logged, ' + resolved + ' resolved' : '';

  list($('todayList'), today, 'Nothing logged yet today. Use Log a job when the first request comes in.', true);
  list($('openList'), open, 'No open jobs. Everything logged so far is resolved.', true);
  renderHistory();
}

// History tab: applies the search box, the two filters and "Show deleted".
function renderHistory() {
  var q = $('q').value.trim().toLowerCase();
  var category = $('fCat').value;
  var statusFilter = $('fStatus').value;
  var showDeleted = $('showDeleted').checked;

  var results = S.jobs.filter(function (j) {
    if (j.deleted && !showDeleted) return false;
    if (category && j.category !== category) return false;
    if (statusFilter && j.status !== statusFilter) return false;
    // The search looks through all of these fields at once
    if (q && (j.requester + ' ' + deptOf(j.requester) + ' ' + j.issue + ' ' + j.action + ' ' + j.device + ' ' + j.by + ' ' + j.id)
        .toLowerCase().indexOf(q) === -1) return false;
    return true;
  });

  list($('histList'), results.slice(0, histLimit), 'No jobs match. Try a different search or filter.', false);

  // "Show more" button appears only when there are more results than shown
  $('more').hidden = results.length <= histLimit;
  $('more').textContent = 'Show more (' + (results.length - histLimit) + ' left)';
}

// Re-run the history list whenever a filter changes
['q', 'fCat', 'fStatus', 'showDeleted'].forEach(function (id) {
  $(id).addEventListener('input', function () {
    histLimit = PAGE_SIZE;
    renderHistory();
  });
});

$('more').onclick = function () {
  histLimit += PAGE_SIZE;
  renderHistory();
};


/* =====================================================================
   10. SUMMARY TAB
   ===================================================================== */

function pad(n) { return (n < 10 ? '0' : '') + n; }

// Date -> 'yyyy-mm-dd'
function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

// First day of the chosen period, as 'yyyy-mm-dd'
function rangeStart(kind) {
  var p = S.today.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  if (kind === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); }  // weeks start on Monday
  if (kind === 'month') return S.today.slice(0, 8) + '01';
  if (kind === '30') { d.setDate(d.getDate() - 29); return fmt(d); }
  return '0000-00-00';   // all time
}

// Counts jobs per value of a field, e.g. tally(jobs, 'category') -> [['Hardware', 12], ['Printer', 5]]
function tally(jobs, key) {
  var counts = {};
  jobs.forEach(function (j) {
    var k = j[key] || 'Not set';
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.keys(counts)
    .map(function (k) { return [k, counts[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; });   // biggest first
}

// Builds one bar chart block. 'max' = how many rows to show.
function bars(title, rows, max) {
  if (!rows.length) return '';
  var top = rows[0][1];
  return '<h3>' + title + '</h3>' + rows.slice(0, max).map(function (r) {
    return '<div class="bar"><span>' + esc(r[0]) + '</span>' +
           '<span class="t"><i style="width:' + Math.round(r[1] / top * 100) + '%"></i></span>' +
           '<span class="v">' + r[1] + '</span></div>';
  }).join('');
}

// Draws the Summary tab for the chosen period (deleted jobs are left out).
function renderSummary() {
  if (!S.today) return;   // data not loaded yet

  var kind = $('range').value;
  var from = rangeStart(kind);
  var jobs = S.jobs
    .filter(function (j) { return !j.deleted && jDate(j) >= from && jDate(j) <= S.today; })
    .map(function (j) {   // add the department so it can be counted
      return Object.assign({}, j, { dept: deptOf(j.requester) });
    });

  $('rangeLabel').textContent = kind === 'all' ? 'All jobs on record' : 'From ' + from + ' to ' + S.today;

  if (!jobs.length) {
    $('sumBody').innerHTML = '<div class="empty">No jobs in this period.</div>';
    return;
  }

  var resolved = jobs.filter(function (j) { return j.status === RESOLVED; }).length;
  var minutes = jobs.reduce(function (sum, j) { return sum + (Number(j.minutes) || 0); }, 0);

  // Number of different days that had jobs (for "jobs per working day")
  var days = {};
  jobs.forEach(function (j) { days[jDate(j)] = 1; });

  $('sumBody').innerHTML =
    '<div class="stats">' +
      '<div class="stat"><b>' + jobs.length + '</b><span>Jobs logged</span></div>' +
      '<div class="stat"><b>' + resolved + '</b><span>Resolved</span></div>' +
      '<div class="stat"><b>' + (jobs.length - resolved) + '</b><span>Still open</span></div>' +
      '<div class="stat"><b>' + (jobs.length / Object.keys(days).length).toFixed(1) + '</b><span>Jobs per working day</span></div>' +
      (minutes ? '<div class="stat"><b>' + Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm</b><span>Time recorded</span></div>' : '') +
    '</div>' +
    '<div class="bars">' +
      bars('By category', tally(jobs, 'category'), 10) +
      bars('By department', tally(jobs, 'dept'), 10) +
      bars('Most frequent requesters', tally(jobs, 'requester'), 8) +
    '</div>';
}

$('range').onchange = renderSummary;
$('print').onclick = function () { window.print(); };
