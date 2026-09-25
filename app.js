/* ==============================================================================
   THE HELPDESK+  —  application code
   ==============================================================================

   This is ONE of three code files:

       index.html      the page structure (what is on the screen)
       styles.css      the styling (what it looks like)
       app.js          this file — the behaviour (what it does)

   Nothing here needs compiling or installing. Edit a value, save,
   reload the page.

   ==============================================================================
   CONTENTS
   ==============================================================================
   This file is divided into 13 named sections. Use Ctrl+F
   (Cmd+F on Mac) and search for "SECTION" to jump between them.

      SECTION 1 of 13  ................. line 49    SETTINGS  <-- EDIT HERE
      SECTION 2 of 13  ................. line 140    HELPERS
      SECTION 3 of 13  ................. line 325    STORAGE
      SECTION 4 of 13  ................. line 585    NETWORK
      SECTION 5 of 13  ................. line 793    LOGIN
      SECTION 6 of 13  ................. line 963    SCREEN
      SECTION 7 of 13  ................. line 1265    DASHBOARD
      SECTION 8 of 13  ................. line 1396    INCIDENTS
      SECTION 9 of 13  ................. line 1798    MEMOS
      SECTION 10 of 13  ................ line 2232   INVENTORY
      SECTION 11 of 13  ................ line 2655   REPORTS
      SECTION 12 of 13  ................ line 2956   SETTINGS PAGE
      SECTION 13 of 13  ................ line 3131   STARTUP

   Line numbers are correct as of the moment this file was built. If you
   edit the file they will drift, so searching for "SECTION 1 of 13" is
   always the safer way to get there.

   ==============================================================================
   THE ONE THING YOU MIGHT WANT TO CHANGE
   ==============================================================================
   Your technician names and the category drop-down lists live in
   SECTION 1 of 13. Search for it.

   Everything else is safe to leave alone.
   ============================================================================== */


/* ==============================================================================
   SECTION 1 of 13  —  SETTINGS — the only section you should need to edit
   (previously the separate file js/00-config.js)
   ============================================================================== */

/* ==========================================================================
   00-config.js — Settings and constants
   --------------------------------------------------------------------------
   This is the only file you need to edit to point the app at a different
   backend. Everything else in the app reads values from App.config.
   ========================================================================== */

window.App = window.App || {};

App.config = {

  /* ------------------------------------------------------------------
     BACKEND URL
     Leave this as "" to run the app entirely on this device (no Google
     Sheet). To connect a Google Sheet, paste your Apps Script Web App URL
     between the quotes, e.g.
         backendUrl: "https://script.google.com/macros/s/AKfy.../exec",
     You can also set it later from Settings inside the app.

     IMPORTANT — is it safe to have this URL in the code?
     Yes, and here is why. This is a static website: anyone can view its
     source, so this URL is public no matter what we do. That is fine
     BECAUSE the backend no longer trusts the caller. Safekeeping is done
     on the server: every request must carry a login token that only that
     technician's password can produce. Knowing the URL alone gets you
     nothing. This is the key difference from the old version, where the
     URL alone let anyone read and delete every record.
     ------------------------------------------------------------------ */
  backendUrl: "",

  /* The version shown at the bottom of every page. This is the number the
     app actually displays - the copy written in index.html is replaced by
     this one as soon as the page loads. If you bump the cache version in
     service-worker.js, bump this too so the footer tells you which copy a
     visitor is looking at. */
  version: "3.1.0",

  /* How long to wait for the server before giving up (milliseconds). */
  requestTimeoutMs: 12000,

  /* Minimum password length enforced on the server too. */
  minPasswordLength: 10,

  /* How often to retry sending queued offline changes (milliseconds). */
  outboxRetryMs: 20000,

  /* Storage keys. The prefix keeps our data separate from anything else
     that might use localStorage on the same domain. */
  keys: {
    backendUrl: "hd.backendUrl.v1",
    session:    "hd.session.v1",
    outbox:     "hd.outbox.v1",
    draft:      "hd.draft.v1"
  },

  /* Drop-down choices. The values must match the Google Sheet values. */
  categories: [
    "Internet / Network",
    "Computer Component",
    "Call Center Phone",
    "Software / Application",
    "Printer / Scanner",
    "Other"
  ],
  itemCategories: [
    "Storage", "Memory", "Battery", "Networking",
    "Peripheral", "Phone Accessory", "Printer Supply", "Other"
  ],
  statuses:  ["Pending", "In Progress", "Resolved"],
  priorities: ["Low", "Medium", "High", "Critical"],

  /* Titles shown in the header bar for each page. One place to change them. */
  pages: {
    dashboard: ["Office IT Operations", "Dashboard",         "Everything happening across the IT desk right now."],
    incidents: ["Module 01",            "Incident Management","Log, assign, update and resolve IT support tickets."],
    memos:     ["Module 02",            "Memo Generator",     "Build a purchase request memo and print it."],
    inventory: ["Module 03",            "Inventory & Stock",  "Track IT assets, quantities, stock value and low-stock items."],
    reports:   ["Module 04",            "System Reports",     "Load records for a week, month, custom range or all time."],
    settings:  ["Settings",             "Settings",           "Your password, your connection, and your saved changes."]
  },

  /* The technicians who can be assigned work. The server decides who can
     actually log in — this list only fills the drop-downs. */
  technicians: ["Julius", "David"]
};

/* ==============================================================================
   SECTION 2 of 13  —  HELPERS — dates, money, IDs, safe text
   (previously the separate file js/01-util.js)
   ============================================================================== */

/* ==========================================================================
   01-util.js — Small helper functions used everywhere
   --------------------------------------------------------------------------
   Nothing here talks to the network or the screen. These are just shortcuts
   for jobs that would otherwise be repeated dozens of times.
   ========================================================================== */

window.App = window.App || {};

App.util = (function () {

  /* Shortcut for document.getElementById. */
  const $ = (id) => document.getElementById(id);

  /* ----------------------------------------------------------------------
     SAFETY: escaping text
     Any text a user types could contain < or > characters. If we put that
     straight into HTML it could break the page — or worse, run code.
     Always run user text through escapeHtml() before showing it.
     ---------------------------------------------------------------------- */
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ----------------------------------------------------------------------
     DATES AND MONEY
     ---------------------------------------------------------------------- */

  /* Today as YYYY-MM-DD, which is the format <input type="date"> expects. */
  function todayISO() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  /* Turn an ISO timestamp into something readable, e.g. "24 Sep 2026, 2:41 PM". */
  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    });
  }

  /* Just the day part, e.g. "24 Sep 2026". */
  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  /* True if an ISO timestamp falls inside a date range (dates as YYYY-MM-DD). */
  function withinRange(iso, fromDate, toDate) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (isNaN(t)) return false;
    const start = fromDate ? new Date(fromDate + "T00:00:00").getTime() : -Infinity;
    const end   = toDate   ? new Date(toDate   + "T23:59:59.999").getTime() : Infinity;
    return t >= start && t <= end;
  }

  /* Money, always with the Ghana cedi sign and two decimals. */
  function money(amount) {
    const n = Number(amount) || 0;
    return "GH\u20B5" + n.toLocaleString("en-GB", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  /* A short version for tight spaces, e.g. "GH\u20B545.2k". Used on small screens. */
  function moneyCompact(amount) {
    const n = Number(amount) || 0;
    if (Math.abs(n) < 100000) return money(n);
    return "GH\u20B5" + (n / 1000).toFixed(1) + "k";
  }

  /* ----------------------------------------------------------------------
     IDS
     ----------------------------------------------------------------------
     PROBLEM WE ARE FIXING: the old code generated IDs like
     INC-20260924-001 by counting how many records already existed today.
     Delete record 002, and the next record is ALSO given 003 — a duplicate.
     The server would then overwrite the existing record instead of adding
     a new one, silently destroying data.

     We now generate IDs from the clock plus random characters, so two
     records can never be created in the same millisecond by accident.
     ---------------------------------------------------------------------- */
  function randomId(prefix) {
    const d = new Date();
    const datePart = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("");
    const timePart = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${datePart}-${timePart}${rand}`;
  }

  /* An id used for a record created while offline. It is replaced by the
     server's id as soon as the record is successfully sent. */
  function tempId(prefix) { return "TMP-" + Math.random().toString(36).slice(2, 10).toUpperCase() + "-" + prefix; }
  function isTempId(id) { return String(id || "").indexOf("TMP-") === 0; }

  /* ----------------------------------------------------------------------
     SMALL CONVENIENCES
     ---------------------------------------------------------------------- */

  /* Make a class name out of mixed text: "In Progress" -> "in-progress". */
  function slug(text) { return String(text || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"); }

  /* Wait before running a function — used so search boxes do not re-render
     on every single keystroke. */
  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait || 200);
    };
  }

  /* Sort newest first by a timestamp field. */
  function byNewest(field) {
    return (a, b) => new Date(b[field] || 0) - new Date(a[field] || 0);
  }

  /* Clamp a number between a minimum and maximum. */
  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

  /* Read a whole number safely. */
  function toInt(value, fallback) {
    const n = parseInt(value, 10);
    return isNaN(n) ? (fallback || 0) : n;
  }
  function toFloat(value, fallback) {
    const n = parseFloat(value);
    return isNaN(n) ? (fallback || 0) : n;
  }

  /* Escape a value for use inside a CSV file. */
  function csvCell(value) {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* Trigger a file download in the browser (used for CSV and JSON backups). */
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    $, escapeHtml, todayISO, formatDateTime, formatDate, withinRange,
    money, moneyCompact, randomId, tempId, isTempId, slug, debounce,
    byNewest, clamp, toInt, toFloat, csvCell, download
  };

})();

/* ==============================================================================
   SECTION 3 of 13  —  STORAGE — where data lives, and the logout wipe
   (previously the separate file js/02-store.js)
   ============================================================================== */

/* ==========================================================================
   02-store.js — Where data lives, and how it is kept safe
   --------------------------------------------------------------------------
   Three separate things are stored here. Keep them distinct in your head:

     1. SESSION  — "who is logged in", plus their login token.
                   Lives in sessionStorage, disappears when the tab closes.
                   Expires by itself after a set time.

     2. RECORDS  — incidents, memos, inventory. Kept in MEMORY ONLY while
                   the app is open. They are never written to the disk of a
                   shared office computer, so when a technician logs out
                   there is nothing left behind for the next person to find.
                   (Exception: "local mode", see below.)

     3. OUTBOX   — changes made while the network was down, waiting to be
                   sent. This one DOES need to survive a page refresh, so it
                   is written to localStorage — but each technician's queue
                   is stored under their own name, and it is wiped when they
                   log out. Your queued work can never be sent under someone
                   else's login.
   ========================================================================== */

window.App = window.App || {};

App.store = (function () {

  const util = App.util;
  const KEY = App.config.keys;

  /* Records held in memory for the current session only. */
  const state = {
    user: "",
    token: "",
    localMode: false,
    incidents: [],
    memos: [],
    inventory: [],
    loaded: false
  };

  /* ----------------------------------------------------------------------
     A safe wrapper around localStorage.
     Some browsers block storage in private mode, which would normally make
     the whole app throw errors. These wrappers fail quietly instead.
     ---------------------------------------------------------------------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  /* ----------------------------------------------------------------------
     BACKEND URL
     ---------------------------------------------------------------------- */
  function backendUrl() {
    const saved = read(KEY.backendUrl, null);
    return saved === null ? (App.config.backendUrl || "") : (saved || "");
  }
  function setBackendUrl(url) {
    if (!url) remove(KEY.backendUrl); else write(KEY.backendUrl, url);
  }
  function isLocalMode() { return !backendUrl(); }

  /* ----------------------------------------------------------------------
     SESSION
     A session is { user, token, at }. We also store when it was created so
     we can expire it: a login left open on a shared desk should not last
     forever.
     ---------------------------------------------------------------------- */
  const SESSION_MAX_MS = 8 * 60 * 60 * 1000; /* 8 hours */

  function saveSession(user, token) {
    const session = { user: user, token: token || "", at: Date.now() };
    try { sessionStorage.setItem(KEY.session, JSON.stringify(session)); } catch (e) { /* ignore */ }
    state.user = user;
    state.token = token || "";
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(KEY.session);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.user) return null;
      if (Date.now() - (session.at || 0) > SESSION_MAX_MS) {
        clearSession();
        return null;
      }
      state.user = session.user;
      state.token = session.token || "";
      return session;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try { sessionStorage.removeItem(KEY.session); } catch (e) { /* ignore */ }
    state.user = "";
    state.token = "";
  }

  function currentUser() { return state.user; }
  function currentToken() { return state.token; }

  /* ----------------------------------------------------------------------
     RECORDS
     ---------------------------------------------------------------------- */

  /* Replace everything held in memory after a fresh load from the server. */
  function setAll(data) {
    state.incidents = (data && data.incidents) || [];
    state.memos     = (data && data.memos) || [];
    state.inventory = (data && data.inventory) || [];
    state.loaded = true;
  }

  /* For local mode only: keep records on this device between visits. */
  function localKey(user, kind) { return "hd.local." + kind + "." + user + ".v1"; }
  function saveLocalRecords() {
    if (!state.user) return;
    write(localKey(state.user, "incidents"), state.incidents);
    write(localKey(state.user, "memos"), state.memos);
    write(localKey(state.user, "inventory"), state.inventory);
  }
  function loadLocalRecords() {
    if (!state.user) return;
    state.incidents = read(localKey(state.user, "incidents"), []);
    state.memos     = read(localKey(state.user, "memos"), []);
    state.inventory = read(localKey(state.user, "inventory"), []);
    state.loaded = true;
  }
  function clearLocalRecords(user) {
    ["incidents", "memos", "inventory"].forEach(kind => remove(localKey(user || state.user, kind)));
  }

  /* Look up one record by its id. */
  function find(kind, id) { return (state[kind] || []).find(r => r.id === id) || null; }

  /* Add or replace a record in memory. */
  function upsert(kind, record) {
    const list = state[kind] || (state[kind] = []);
    const i = list.findIndex(r => r.id === record.id);
    if (i >= 0) list[i] = record; else list.unshift(record);
    return record;
  }

  /* Remove a record from memory. */
  function drop(kind, id) {
    state[kind] = (state[kind] || []).filter(r => r.id !== id);
  }

  /* ----------------------------------------------------------------------
     OUTBOX — changes waiting to reach the server
     ---------------------------------------------------------------------- */

  function outboxKey(user) { return KEY.outbox + "." + (user || state.user || "unknown"); }

  function queue(action, payload, label) {
    const user = state.user;
    if (!user) return null;
    const list = read(outboxKey(user), []);
    /* If the same record was already queued, replace it rather than
       queueing a second change — the newer version wins. */
    const id = payload && (payload.id || payload.itemId);
    const filtered = list.filter(entry => !(entry.payload && (entry.payload.id || entry.payload.itemId) === id));
    const entry = {
      key: "q" + Date.now() + Math.random().toString(36).slice(2, 6),
      action: action,
      payload: payload,
      label: label || action,
      at: new Date().toISOString(),
      tries: 0
    };
    filtered.push(entry);
    write(outboxKey(user), filtered);
    return entry;
  }

  function outbox() { return read(outboxKey(state.user), []); }

  function removeFromOutbox(key) {
    const list = outbox().filter(entry => entry.key !== key);
    write(outboxKey(state.user), list);
  }

  function markOutboxTry(key) {
    const list = outbox().map(entry => entry.key === key ? Object.assign({}, entry, { tries: (entry.tries || 0) + 1 }) : entry);
    write(outboxKey(state.user), list);
  }

  function clearOutbox() { remove(outboxKey(state.user)); }

  /* ----------------------------------------------------------------------
     DRAFTS
     If the browser closes halfway through writing a ticket, the half-typed
     ticket should still be there when they come back. Saved per user, and
     cleared on logout just like the outbox.
     ---------------------------------------------------------------------- */
  function draftKey(form, user) { return KEY.draft + "." + form + "." + (user || state.user || "unknown"); }
  function saveDraft(form, values) {
    if (!state.user) return;
    write(draftKey(form), { values: values, at: new Date().toISOString() });
  }
  function loadDraft(form) {
    if (!state.user) return null;
    return read(draftKey(form), null);
  }
  function clearDraft(form) { remove(draftKey(form)); }

  /* ----------------------------------------------------------------------
     LOGOUT WIPE
     This is the important one. Logging out must leave the device clean.
     ---------------------------------------------------------------------- */
  function wipeOnLogout() {
    const user = state.user;
    /* Disappear the data itself. */
    state.incidents = [];
    state.memos = [];
    state.inventory = [];
    state.loaded = false;
    /* Disappear anything written to disk for this person. */
    remove(outboxKey(user));
    remove(draftKey("incident", user));
    remove(draftKey("memo", user));
    remove(draftKey("item", user));
    clearLocalRecords(user);
    clearSession();
  }

  return {
    state,
    read, write, remove,
    backendUrl, setBackendUrl, isLocalMode,
    saveSession, loadSession, clearSession, currentUser, currentToken,
    setAll, find, upsert, drop,
    saveLocalRecords, loadLocalRecords, clearLocalRecords,
    queue, outbox, removeFromOutbox, markOutboxTry, clearOutbox,
    saveDraft, loadDraft, clearDraft,
    wipeOnLogout
  };

})();

/* ==============================================================================
   SECTION 4 of 13  —  NETWORK — talking to Google Sheets
   (previously the separate file js/03-api.js)
   ============================================================================== */

/* ==========================================================================
   03-api.js — Talking to the Google Sheet
   --------------------------------------------------------------------------
   Every conversation with the backend goes through this file. It is the
   most safety-critical part of the app, so it does four things the old
   version did not:

     1. SENDS A TOKEN with every request. The server checks it before doing
        anything. Without a valid token the server refuses — so knowing the
        backend URL is no longer enough to read or delete anything.

     2. TIMES OUT. If the network hangs, we give up after 12 seconds and
        tell the user honestly. Previously a request could hang forever
        while the screen said "saved" — so people closed the tab and lost
        their work.

     3. RETRIES ONCE on a network wobble, and QUEUES the change if that
        fails too. Nothing is thrown away because the connection blinked.

     4. NEVER LIES. "Saved" only appears after the server has confirmed it.
   ========================================================================== */

window.App = window.App || {};

App.api = (function () {

  const store = App.store;
  const util  = App.util;

  /* ----------------------------------------------------------------------
     The core request function.

     NOTE on the missing "Content-Type" header — this is deliberate and
     important. Google Apps Script cannot answer the browser's CORS
     "preflight" check. Sending the body without an explicit JSON content
     type keeps the request "simple", so the browser does not send a
     preflight and Apps Script answers normally. Do not add
     'Content-Type: application/json' here or every request will break.
     ---------------------------------------------------------------------- */
  async function request(action, payload, options) {
    const settings = options || {};
    const url = store.backendUrl();
    if (!url) throw new Error("NO_BACKEND");

    const token = store.currentToken();
    const body = JSON.stringify({ action: action, payload: payload || {}, token: token });

    /* AbortController lets us cancel a request that is taking too long. */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), App.config.requestTimeoutMs);

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        body: body,
        signal: controller.signal,
        redirect: "follow"
      });
    } catch (err) {
      clearTimeout(timer);
      if (err && err.name === "AbortError") {
        throw new Error("TIMEOUT");
      }
      throw new Error("OFFLINE");
    }
    clearTimeout(timer);

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      /* A common cause: the Apps Script deployment is set to "only myself"
         instead of "Anyone", so Google returns an HTML login page. */
      throw new Error("BAD_RESPONSE");
    }

    if (!result || result.ok === false) {
      const message = (result && result.error) || "The server refused the request.";

      /* An expired or invalid token on any request other than login itself
         means the person must log in again. Before this check the app kept
         showing the dashboard while every save quietly failed. */
      const tokenProblem = (result && result.code === "UNAUTHORISED") ||
        (action !== "login" && action !== "changePassword" &&
         /session|token|expired|log in again|not logged in|unauthori[sz]ed/i.test(message));
      if (tokenProblem) {
        const authError = new Error("UNAUTHORISED");
        authError.detail = "Your session has expired. Please log in again.";
        setTimeout(function () { if (App.auth && store.currentUser()) App.auth.sessionExpired(); }, 0);
        throw authError;
      }

      const error = new Error("SERVER");
      error.detail = message;
      throw error;
    }
    return result;
  }

  /* Try the request; if the connection failed (not a server-side refusal),
     try once more before giving up. */
  async function requestWithRetry(action, payload, options) {
    try {
      return await request(action, payload, options);
    } catch (err) {
      const transient = err.message === "OFFLINE" || err.message === "TIMEOUT";
      if (!transient) throw err;
      await new Promise(r => setTimeout(r, 900));
      return await request(action, payload, options);
    }
  }

  /* Turn a raw error into a sentence that makes sense to a normal person. */
  function explain(err) {
    const code = err && err.message;
    if (code === "NO_BACKEND")   return "This app is set to work on this device only. Nothing is being sent to a server.";
    if (code === "OFFLINE")      return "No connection to the server. Your change has been saved on this device and will be sent automatically.";
    if (code === "TIMEOUT")      return "The server took too long to reply. Your change is saved here and will be retried.";
    if (code === "BAD_RESPONSE") return "The server replied with something we did not understand. Check that the Apps Script is deployed with access set to \"Anyone\".";
    if (code === "UNAUTHORISED") return "Your session has expired. Please log in again.";
    if (err && err.detail)       return err.detail;
    return "Something went wrong. Please try again.";
  }

  function isTransient(err) {
    const code = err && err.message;
    return code === "OFFLINE" || code === "TIMEOUT";
  }

  /* ----------------------------------------------------------------------
     READ
     ---------------------------------------------------------------------- */
  async function getAll() {
    const result = await requestWithRetry("getAll", {});
    return result.data || { incidents: [], memos: [], inventory: [] };
  }

  /* ----------------------------------------------------------------------
     WRITE
     Every write returns { queued: true } when it could not reach the server
     but was safely stored locally instead. The UI is honest about the
     difference, so the user always knows whether their work is really in.
     ---------------------------------------------------------------------- */
  async function save(action, payload, label) {
    /* Local mode: no server at all, just keep it on this device. */
    if (store.isLocalMode()) {
      return { queued: false, local: true };
    }
    try {
      const result = await requestWithRetry(action, payload);
      return { queued: false, item: result.item || null, result: result };
    } catch (err) {
      if (isTransient(err)) {
        store.queue(action, payload, label);
        notifyQueueChanged();
        return { queued: true };
      }
      throw err;
    }
  }

  /* ----------------------------------------------------------------------
     OUTBOX SYNC
     Send everything that piled up while the network was down, oldest first.
     ---------------------------------------------------------------------- */
  let syncing = false;

  async function syncOutbox() {
    if (syncing) return { sent: 0, failed: 0, skipped: true };
    if (store.isLocalMode()) return { sent: 0, failed: 0, skipped: true };
    if (!store.currentToken()) return { sent: 0, failed: 0, skipped: true };

    const pending = store.outbox();
    if (!pending.length) return { sent: 0, failed: 0 };

    syncing = true;
    let sent = 0, failed = 0, stopped = false;

    for (const entry of pending) {
      if (stopped) break;
      try {
        await requestWithRetry(entry.action, entry.payload);
        store.removeFromOutbox(entry.key);
        sent++;
      } catch (err) {
        if (isTransient(err) || (err && err.message === "UNAUTHORISED")) {
          /* Still offline, or the session ended. Stop here and keep
             everything queued; it sends after the next login. */
          store.markOutboxTry(entry.key);
          stopped = true;
        } else {
          /* The server actively refused it (e.g. someone else edited the
             same record first). Drop it so it does not block the queue
             forever, and tell the user clearly. */
          store.removeFromOutbox(entry.key);
          failed++;
          App.ui.toast("Could not save one queued change: " + explain(err), "error");
        }
      }
    }

    syncing = false;
    notifyQueueChanged();
    return { sent: sent, failed: failed };
  }

  /* Tell the rest of the app that the queue depth changed, so the banner
     and the footer can update. */
  function notifyQueueChanged() {
    document.dispatchEvent(new CustomEvent("outbox:changed", { detail: { pending: store.outbox().length } }));
  }

  return { request, requestWithRetry, explain, isTransient, getAll, save, syncOutbox };

})();

/* ==============================================================================
   SECTION 5 of 13  —  LOGIN — authentication
   (previously the separate file js/04-auth.js)
   ============================================================================== */

/* ==========================================================================
   04-auth.js — Logging in and out
   --------------------------------------------------------------------------
   WHAT WAS WRONG BEFORE

   The old version decided whether you were logged in like this:

       if (TECHNICIANS.includes(activeUser)) { showApp(); }

   ...where activeUser came straight from browser storage. Typing one value
   into the browser console and reloading logged you in as anyone, with no
   password. Worse, the default passwords were written in plain text into
   the published JavaScript file, for the whole world to read.
   And the server accepted save and delete requests from anybody, without
   ever asking who was calling.

   HOW IT WORKS NOW

   The browser asks the server to check the password. If it matches, the
   server creates a random one-time token and hands it back. Every later
   request carries that token, and the server checks it before touching any
   data. The browser can no longer decide who is logged in, because it no
   longer has the passwords and it cannot invent a token.

   "Local mode" is the exception, and it is honest about it: if you have not
   connected a Google Sheet, there is no server to check anything against,
   so local mode asks you to pick your name and says plainly that no
   password is required. It does not pretend to be secure.
   ========================================================================== */

window.App = window.App || {};

App.auth = (function () {

  const store = App.store;
  const api   = App.api;
  const util  = App.util;

  /* ----------------------------------------------------------------------
     LOGIN
     ---------------------------------------------------------------------- */
  async function login(technician, password) {

    /* --- Local mode: nothing to verify against. Be honest about it. --- */
    if (store.isLocalMode()) {
      if (!technician) throw new Error("Please choose your name.");
      store.saveSession(technician, "local-token");
      store.loadLocalRecords();
      return { user: technician, localMode: true };
    }

    /* --- Real login --- */
    if (!technician) throw new Error("Please choose your name.");
    if (!password)   throw new Error("Please enter your password.");

    let result;
    try {
      result = await api.requestWithRetry("login", {
        technician: technician,
        password: password
      });
    } catch (err) {
      if (err.message === "OFFLINE")   throw new Error("Cannot reach the server. Check your internet connection.");
      if (err.message === "TIMEOUT")   throw new Error("The server took too long to reply. Please try again.");
      if (err.message === "BAD_RESPONSE") throw new Error("The server did not reply properly. Check that your Apps Script is deployed with access set to \"Anyone\".");
      if (err && err.detail)           throw new Error(err.detail);
      throw new Error("Could not log in. Please try again.");
    }

    /* Guard against the OLD backend, which does not know about tokens.
       Without this check the app would look logged-in but every save would
       fail — a confusing half-broken state. Better to say so clearly. */
    if (!result.token) {
      throw new Error(
        "Your Google backend is an older version that does not support secure logins. " +
        "Please update it: see Part 3 of the README (\"Connect your Google Sheet\")."
      );
    }

    store.saveSession(result.user || technician, result.token);

    /* Pass the server's flags through to the caller. mustChangePassword is
       true when the account is still on a starter password, so the app can
       insist on a change before the person gets on with their work. */
    return {
      user: result.user || technician,
      data: result.data || null,
      mustChangePassword: !!result.mustChangePassword
    };
  }

  /* ----------------------------------------------------------------------
     LOGOUT
     Clears the session AND every trace of data this person left on the
     device — memory, outbox, drafts, and any local-mode records.
     ---------------------------------------------------------------------- */
  function logout() {
    const pending = store.outbox().length;
    store.wipeOnLogout();
    return { pending: pending };
  }

  /* ----------------------------------------------------------------------
     CHANGE PASSWORD
     In backend mode the change happens on the server, where it belongs.
     ---------------------------------------------------------------------- */
  async function changePassword(current, next, confirm) {

    if (store.isLocalMode()) {
      throw new Error(
        "There is no server connected, so passwords are not used. " +
        "Connect your Google Sheet in Settings to enable real logins."
      );
    }

    if (!current) throw new Error("Please enter your current password.");
    if (!next)    throw new Error("Please enter a new password.");

    if (next.length < App.config.minPasswordLength) {
      throw new Error("Your new password must be at least " + App.config.minPasswordLength + " characters long.");
    }
    if (next !== confirm) throw new Error("The two new passwords do not match.");
    if (next === current) throw new Error("Your new password is the same as your current one.");

    try {
      await api.requestWithRetry("changePassword", {
        technician: store.currentUser(),
        currentPassword: current,
        newPassword: next
      });
    } catch (err) {
      if (err && err.detail) throw new Error(err.detail);
      throw new Error(api.explain(err));
    }
    return true;
  }

  /* ----------------------------------------------------------------------
     SESSION CHECK ON STARTUP
     ---------------------------------------------------------------------- */
  function restore() {
    const session = store.loadSession();
    if (!session) return null;

    /* A "local-token" session is only valid while the app is still in local
       mode. If a backend URL has since been added, make them log in again
       properly rather than letting a fake token through. */
    if (session.token === "local-token" && !store.isLocalMode()) {
      store.clearSession();
      return null;
    }
    return session;
  }

  /* Called when the server tells us the token is no longer good. */
  function sessionExpired() {
    /* Deliberately NOT a full wipe. An expired session is not the person
       choosing to leave, and any changes still waiting in the outbox are
       unsent work. Keep them: they are stored under this person's name and
       send automatically after they log back in. Only the session and the
       on-screen records are cleared. */
    const user = store.currentUser();
    const waiting = store.outbox().length;
    store.state.incidents = [];
    store.state.memos = [];
    store.state.inventory = [];
    store.state.loaded = false;
    store.clearSession();
    App.ui.toast(
      waiting
        ? "Your session expired. " + waiting + " unsent change(s) are kept and will send after you log in again."
        : "Your session expired. Please log in again.", "warn");
    App.ui.showLogin();
  }

  return { login, logout, changePassword, restore, sessionExpired };

})();

/* ==============================================================================
   SECTION 6 of 13  —  SCREEN — navigation, messages, charts
   (previously the separate file js/05-ui.js)
   ============================================================================== */

/* ==========================================================================
   05-ui.js — Screen controls
   --------------------------------------------------------------------------
   Everything that changes what you see: switching pages, showing messages,
   the offline banner, and the little status line in the sidebar.

   It does NOT contain business logic. If you are looking for how a ticket
   is saved, that is in 07-incidents.js.
   ========================================================================== */

window.App = window.App || {};

App.ui = (function () {

  const util  = App.util;
  const store = App.store;
  const $ = util.$;

  let currentPage = "dashboard";

  /* ======================================================================
     TOASTS — the small messages that slide in at the bottom right
     ====================================================================== */
  function toast(message, type) {
    const host = $("toasts");
    if (!host) return;
    const icons = { ok: "#i-check", warn: "#i-alert", error: "#i-alert", info: "#i-check" };
    const kind = type || "info";
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML =
      '<svg aria-hidden="true"><use href="' + (icons[kind] || icons.info) + '"/></svg>' +
      "<span>" + util.escapeHtml(message) + "</span>";
    host.appendChild(el);
    /* Errors stay a little longer, because they matter more. */
    const life = kind === "error" ? 8000 : kind === "warn" ? 6000 : 3800;
    setTimeout(() => {
      el.style.transition = "opacity 200ms ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 220);
    }, life);
  }

  /* ======================================================================
     SCREENS — login vs the app
     ====================================================================== */
  function showLogin() {
    $("loginScreen").hidden = false;
    $("appScreen").hidden = true;
    const input = $("loginPassword");
    if (input) input.value = "";
    const err = $("loginError");
    if (err) err.textContent = "";
    /* Re-check which mode we are in EVERY time the login screen appears.
       Previously this only happened at startup and on logout, so saving a
       backend URL in Settings left the password box hidden - you were asked
       for a password with nowhere to type it. */
    document.dispatchEvent(new CustomEvent("login:shown"));
    /* Put the cursor straight where it needs to be. */
    const tech = $("loginTechnician");
    if (tech) tech.focus();
  }

  function showApp() {
    $("loginScreen").hidden = true;
    $("appScreen").hidden = false;
    const who = store.currentUser();
    $("activeUserName").textContent = who || "Technician";
    $("footerUser").textContent = who || "Technician";
    $("footerVersion").textContent = "v" + App.config.version;
    renderConnection();
    refreshQueueBadge();
  }

  /* ======================================================================
     NAVIGATION
     ====================================================================== */
  function navigate(page) {
    if (!App.config.pages[page]) page = "dashboard";
    currentPage = page;

    /* Show the right panel, hide the others. */
    Object.keys(App.config.pages).forEach(name => {
      const panel = $("page-" + name);
      if (panel) panel.hidden = (name !== page);
    });

    /* Update the header text. There is exactly ONE <h1> on the page and it
       lives in the header — that is why the old duplicated headings are gone. */
    const meta = App.config.pages[page];
    $("pageEyebrow").textContent  = meta[0];
    $("pageTitle").textContent    = meta[1];
    $("pageSubtitle").textContent = meta[2];

    /* Highlight the active menu item. */
    document.querySelectorAll(".nav-link").forEach(link => {
      const on = link.getAttribute("data-page") === page;
      link.classList.toggle("is-active", on);
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    closeMenu();
    try { history.replaceState(null, "", "#" + page); } catch (e) { /* ignore */ }

    /* Ask the page module to draw itself. */
    const painters = {
      dashboard: App.dashboard && App.dashboard.render,
      incidents: App.incidents && App.incidents.render,
      memos:     App.memos && App.memos.render,
      inventory: App.inventory && App.inventory.render,
      reports:   App.reports && App.reports.render,
      settings:  App.settings && App.settings.render
    };
    if (painters[page]) painters[page]();

    /* Move focus to the main area so keyboard and screen-reader users land
       in the right place instead of staying on the menu. */
    const main = $("main");
    if (main) main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function current() { return currentPage; }

  /* ======================================================================
     MOBILE MENU
     ====================================================================== */
  function openMenu() {
    $("sidebar").classList.add("is-open");
    $("scrim").hidden = false;
    $("menuToggle").setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    $("sidebar").classList.remove("is-open");
    $("scrim").hidden = true;
    const btn = $("menuToggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function toggleMenu() {
    if ($("sidebar").classList.contains("is-open")) closeMenu(); else openMenu();
  }

  /* ======================================================================
     CONNECTION STATUS & THE OFFLINE BANNER
     ====================================================================== */
  function renderConnection() {
    const el = $("connectionState");
    if (!el) return;

    if (store.isLocalMode()) {
      el.innerHTML = '<svg aria-hidden="true"><use href="#i-offline"/></svg> This device only';
      el.classList.remove("is-offline");
      return;
    }
    if (!navigator.onLine) {
      el.innerHTML = '<svg aria-hidden="true"><use href="#i-offline"/></svg> Offline';
      el.classList.add("is-offline");
      return;
    }
    el.innerHTML = '<svg aria-hidden="true"><use href="#i-clock"/></svg> Connected to Google Sheets';
    el.classList.remove("is-offline");
  }

  function refreshQueueBadge() {
    const pending = store.outbox().length;
    const banner = $("syncBanner");
    const text   = $("syncBannerText");
    const footer = $("footerQueue");
    const offline = !navigator.onLine && !store.isLocalMode();

    if (footer) {
      footer.hidden = pending === 0;
      footer.textContent = pending
        ? "Saved on this device, not yet sent: " + pending + (pending === 1 ? " change" : " changes")
        : "";
    }

    if (!banner || !text) return;

    if (store.isLocalMode()) { banner.hidden = true; return; }

    if (offline && pending > 0) {
      banner.hidden = false;
      text.textContent = "You are offline. " + pending +
        (pending === 1 ? " change is" : " changes are") +
        " saved on this device and will send automatically when the connection returns.";
    } else if (offline) {
      banner.hidden = false;
      text.textContent = "You are offline. You can keep working \u2014 anything you save will be sent automatically.";
    } else if (pending > 0) {
      banner.hidden = false;
      text.textContent = pending + (pending === 1 ? " change is" : " changes are") +
        " waiting to be sent to the server.";
    } else {
      banner.hidden = true;
    }
    renderConnection();
  }

  /* ======================================================================
     CONFIRMATION
     Deliberately uses the browser's built-in confirm box. It cannot be
     broken by a styling mistake, it works on every device, and screen
     readers handle it correctly. Boring, but reliable.
     ====================================================================== */
  function confirmAction(message) { return window.confirm(message); }

  /* ======================================================================
     SMALL RENDER HELPERS shared by more than one page
     ====================================================================== */

  /* One of the coloured number cards at the top of the dashboard.
     Long values get the .is-long class, which renders them a little smaller
     so they always fit on one line instead of being clipped or wrapped. */
  function statCard(options) {
    const tone = options.tone ? " " + options.tone : "";
    const text = String(options.value);
    /* 8 characters is about the most a normal card can hold comfortably. */
    const sizeClass = text.length > 8 ? " is-long" : "";
    return '' +
      '<article class="stat' + tone + '">' +
        '<span class="stat-label">' + util.escapeHtml(options.label) + "</span>" +
        '<strong class="stat-value' + sizeClass + '">' + util.escapeHtml(text) + "</strong>" +
        (options.note ? '<span class="stat-note">' + util.escapeHtml(options.note) + "</span>" : "") +
      "</article>";
  }

  /* A coloured status pill, e.g. "In Progress". */
  function tag(text) {
    return '<span class="tag ' + util.slug(text) + '">' + util.escapeHtml(text) + "</span>";
  }

  /* An empty-state message, so an empty list never looks broken. */
  function empty(message) {
    return '<p class="empty">' + util.escapeHtml(message) + "</p>";
  }

  /* A horizontal bar chart. Used for "issues by type" and "assigned load". */
  function renderBars(container, rows) {
    if (!container) return;
    if (!rows.length) { container.innerHTML = empty("Nothing to show yet."); return; }
    const max = Math.max.apply(null, rows.map(r => r.value).concat([1]));
    container.innerHTML = rows.map(row => {
      const pct = Math.round((row.value / max) * 100);
      return '' +
        '<div class="bar-row">' +
          '<span class="bar-name" title="' + util.escapeHtml(row.name) + '">' + util.escapeHtml(row.name) + "</span>" +
          '<span class="bar-track"><span class="bar-fill" style="width:' + pct + "%;background:" + (row.colour || "var(--brand)") + '"></span></span>' +
          '<span class="bar-count">' + row.value + "</span>" +
        "</div>";
    }).join("");
  }

  /* A donut chart drawn with SVG. No chart library needed, so nothing extra
     to download. */
  function renderDonut(container, rows, centreLabel) {
    if (!container) return;
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    if (!total) { container.innerHTML = empty("No data yet."); return; }

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const slices = rows.filter(r => r.value > 0).map(row => {
      const fraction = row.value / total;
      const length = fraction * circumference;
      const gap = 2; /* a small gap between slices looks cleaner */
      const seg =
        '<circle r="' + radius + '" cx="70" cy="70" fill="none" stroke="' + row.colour + '"' +
        ' stroke-width="20" stroke-dasharray="' + Math.max(length - gap, 0) + " " + (circumference - Math.max(length - gap, 0)) + '"' +
        ' stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 70 70)" stroke-linecap="butt"></circle>';
      offset += length;
      return seg;
    }).join("");

    const legend = rows.map(row =>
      '<div class="legend-row">' +
        '<span class="legend-key"><span class="dot" style="background:' + row.colour + '"></span>' + util.escapeHtml(row.name) + "</span>" +
        '<span class="legend-val">' + row.value + "</span>" +
      "</div>").join("");

    container.innerHTML =
      '<svg class="donut" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="' +
        util.escapeHtml(rows.map(r => r.name + ": " + r.value).join(", ")) + '">' +
        '<circle r="' + radius + '" cx="70" cy="70" fill="none" stroke="var(--surface-3)" stroke-width="20"></circle>' +
        slices +
        '<text class="donut-centre" x="70" y="77" text-anchor="middle">' + util.escapeHtml(centreLabel !== undefined ? centreLabel : total) + "</text>" +
      "</svg>" +
      '<div class="legend">' + legend + "</div>";
  }

  return {
    toast, showLogin, showApp, navigate, current,
    openMenu, closeMenu, toggleMenu,
    renderConnection, refreshQueueBadge, confirmAction,
    statCard, tag, empty, renderBars, renderDonut
  };

})();

/* ==============================================================================
   SECTION 7 of 13  —  DASHBOARD — the summary page
   (previously the separate file js/06-dashboard.js)
   ============================================================================== */

/* ==========================================================================
   06-dashboard.js — The summary screen
   ========================================================================== */

window.App = window.App || {};

App.dashboard = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const $ = util.$;

  /* A ticket counts as "open" when it is not finished yet. */
  function isOpen(t) { return t.status !== "Resolved"; }

  /* An item needs attention when its quantity has dropped to the reorder
     level you set for it. Note the old version treated a reorder level of
     0 as "low stock", which wrongly flagged every item that had one. */
  function isLowStock(item) {
    const level = Number(item.reorderLevel) || 0;
    if (level <= 0) return false;
    return Number(item.quantity) <= level;
  }

  function render() {
    const state = store.state;
    const incidents = state.incidents;
    const inventory = state.inventory;

    const open        = incidents.filter(isOpen).length;
    const resolved    = incidents.filter(t => t.status === "Resolved").length;
    const lowItems    = inventory.filter(isLowStock);
    const stockValue  = inventory.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

    /* ---- The six headline numbers ---- */
    const stats = $("statsRow");
    if (stats) {
      stats.innerHTML =
        ui.statCard({ label: "Open incidents",   value: open,     note: "Pending and in progress", tone: "cyan" }) +
        ui.statCard({ label: "Resolved",         value: resolved, note: "Completed tickets",       tone: "green" }) +
        ui.statCard({ label: "Memos",            value: state.memos.length, note: "Purchase requests", tone: "purple" }) +
        ui.statCard({ label: "Inventory items",  value: inventory.length,   note: "Tracked stock lines", tone: "blue" }) +
        ui.statCard({ label: "Low stock",        value: lowItems.length,    note: lowItems.length ? "Needs attention" : "All levels fine", tone: lowItems.length ? "amber" : "slate" }) +
        ui.statCard({ label: "Stock value",      value: util.money(stockValue), note: "Estimated value of all stock", tone: "slate" });
    }

    /* ---- Recent incidents ---- */
    const recent = $("recentIncidents");
    if (recent) {
      const rows = incidents.slice().sort(util.byNewest("updatedAt")).slice(0, 5);
      if (!rows.length) {
        recent.innerHTML = ui.empty("No incidents logged yet. Use the orange buttons above to add the first one.");
      } else {
        recent.innerHTML = rows.map(t => '' +
          '<div class="item">' +
            '<div class="item-top">' +
              '<div>' +
                '<p class="item-id">' + util.escapeHtml(t.id) + "</p>" +
                '<p class="item-title">' + util.escapeHtml(t.category || "Incident") + "</p>" +
                '<p class="item-meta">' + util.escapeHtml(t.requester || "—") + " &middot; " + util.escapeHtml(t.department || "—") + " &middot; " + util.formatDateTime(t.updatedAt) + "</p>" +
              "</div>" +
              '<div class="tags">' + ui.tag(t.status) + ui.tag(t.priority) + "</div>" +
            "</div>" +
          "</div>").join("");
      }
    }

    /* ---- Low stock ---- */
    const low = $("lowStockList");
    if (low) {
      if (!lowItems.length) {
        low.innerHTML = ui.empty("Nothing is running low. Every item is above its reorder level.");
      } else {
        low.innerHTML = lowItems
          .sort((a, b) => (Number(a.quantity) - Number(a.reorderLevel)) - (Number(b.quantity) - Number(b.reorderLevel)))
          .slice(0, 4)
          .map(i => '' +
            '<div class="item">' +
              '<div class="item-top">' +
                '<div>' +
                  '<p class="item-title">' + util.escapeHtml(i.name) + "</p>" +
                  '<p class="item-meta">In stock: <strong>' + (Number(i.quantity) || 0) + "</strong> &middot; reorder at " + (Number(i.reorderLevel) || 0) + " &middot; " + util.escapeHtml(i.location || "—") + "</p>" +
                "</div>" +
                '<div class="tags">' + ui.tag("Low stock") + "</div>" +
              "</div>" +
              '<div class="item-actions">' +
                '<button class="btn tiny ghost" type="button" data-request-item="' + util.escapeHtml(i.id) + '">Request in memo</button>' +
                '<button class="btn tiny ghost" type="button" data-goto="inventory">Open item</button>' +
              "</div>" +
            "</div>").join("");
      }
    }

    /* ---- Charts ---- */

    /* Issues by category */
    const counts = {};
    App.config.categories.forEach(c => { counts[c] = 0; });
    incidents.forEach(t => { if (t.category) counts[t.category] = (counts[t.category] || 0) + 1; });
    ui.renderBars($("categoryChart"),
      Object.keys(counts).map(name => ({ name: name, value: counts[name], colour: "var(--brand)" }))
        .filter(row => row.value > 0)
        .sort((a, b) => b.value - a.value)
    );

    /* Resolution split */
    ui.renderDonut($("statusDonut"), [
      { name: "Pending",     value: incidents.filter(t => t.status === "Pending").length,     colour: "#e08b00" },
      { name: "In Progress", value: incidents.filter(t => t.status === "In Progress").length, colour: "#342fc6" },
      { name: "Resolved",    value: resolved,                                                colour: "#0f9d63" }
    ], incidents.length);

    /* Assigned load */
    const load = App.config.technicians.map(name => ({
      name: name,
      value: incidents.filter(t => t.technician === name && isOpen(t)).length,
      colour: "var(--c-cyan)"
    }));
    ui.renderBars($("loadChart"), load);
  }

  return { render: render, isLowStock: isLowStock, isOpen: isOpen };

})();

/* ==============================================================================
   SECTION 8 of 13  —  INCIDENTS — support tickets
   (previously the separate file js/07-incidents.js)
   ============================================================================== */

/* ==========================================================================
   07-incidents.js — Support tickets
   --------------------------------------------------------------------------
   A note on the "version" field you will see below.

   Imagine Julius opens ticket #12 to update it, and while he is typing,
   David changes the same ticket and saves. When Julius then presses Save,
   the old version of this app would simply overwrite David's work — nobody
   would know, and his change would be gone.

   So every record carries the time it was last changed. When we send a
   save we also send that time. The server compares the two: if they differ,
   somebody else got there first, and the server refuses the save and tells
   us. We then show the user a clear message instead of quietly losing data.
   This is called "optimistic concurrency control", and it is the standard
   way to solve this problem.
   ========================================================================== */

window.App = window.App || {};

App.incidents = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const api   = App.api;
  const $ = util.$;

  let query = "";
  let statusFilter = "All";

  /* ======================================================================
     FORM <-> RECORD
     ====================================================================== */
  function readForm() {
    return {
      requester:        $("requester").value.trim(),
      department:       $("department").value.trim(),
      location:         $("location").value.trim(),
      category:         $("category").value,
      technician:       $("technician").value,
      status:           $("status").value,
      priority:         $("priority").value,
      timeSpent:        $("timeSpent").value.trim(),
      description:      $("description").value.trim(),
      resolution:       $("resolution").value.trim(),
      componentChanged: $("componentChanged").value.trim()
    };
  }

  function validate(data) {
    if (!data.requester)   return "Please enter who reported the issue.";
    if (!data.category)    return "Please choose an issue category.";
    if (!data.description) return "Please describe the issue.";
    if (data.status === "Resolved" && !data.resolution) {
      return "Please write what was done to fix it before marking this resolved.";
    }
    return null;
  }

  function fillForm(record) {
    $("incidentId").value          = record.id || "";
    $("incidentVersion").value     = record.updatedAt || "";
    $("requester").value           = record.requester || "";
    $("department").value          = record.department || "";
    $("location").value            = record.location || "";
    $("category").value            = record.category || "";
    $("technician").value          = record.technician || store.currentUser();
    $("status").value              = record.status || "Pending";
    $("priority").value            = record.priority || "Medium";
    $("timeSpent").value           = record.timeSpent || "";
    $("description").value         = record.description || "";
    $("resolution").value          = record.resolution || "";
    $("componentChanged").value    = record.componentChanged || "";

    const editing = !!record.id;
    $("incidentBadge").textContent     = editing ? "Editing " + record.id : "New Incident";
    $("incidentFormTitle").textContent = editing ? "Edit incident" : "Incident details";
    $("deleteIncidentBtn").hidden      = !editing;
    $("saveIncidentBtn").innerHTML     = editing
      ? '<svg aria-hidden="true"><use href="#i-save"/></svg> Update incident'
      : '<svg aria-hidden="true"><use href="#i-save"/></svg> Save incident';
  }

  function clearForm() {
    $("incidentForm").reset();
    $("incidentId").value      = "";
    $("incidentVersion").value = "";
    $("technician").value      = store.currentUser() || App.config.technicians[0];
    $("status").value          = "Pending";
    $("priority").value        = "Medium";
    $("incidentBadge").textContent     = "New Incident";
    $("incidentFormTitle").textContent = "Incident details";
    $("deleteIncidentBtn").hidden      = true;
    $("saveIncidentBtn").innerHTML     = '<svg aria-hidden="true"><use href="#i-save"/></svg> Save incident';
    store.clearDraft("incident");
  }

  function loadForEdit(id) {
    const record = store.find("incidents", id);
    if (!record) return;
    fillForm(record);
    ui.navigate("incidents");
    /* Scroll the form into view on small screens, where the list sits below. */
    const form = $("incidentForm");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ======================================================================
     SAVE
     ====================================================================== */
  async function save() {
    const data = readForm();
    const problem = validate(data);
    if (problem) { ui.toast(problem, "warn"); return; }

    const id = $("incidentId").value;
    const existing = id ? store.find("incidents", id) : null;
    const now = new Date().toISOString();

    const record = Object.assign({}, existing || {}, data, {
      id: id || util.randomId("INC"),
      version: (existing && existing.updatedAt) || "",
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
      resolvedAt: data.status === "Resolved" ? ((existing && existing.resolvedAt) || now) : "",
      createdBy: (existing && existing.createdBy) || store.currentUser(),
      updatedBy: store.currentUser()
    });

    const button = $("saveIncidentBtn");
    button.disabled = true;
    const original = button.innerHTML;
    button.textContent = "Saving\u2026";

    try {
      /* Local mode: nothing leaves the device. */
      if (store.isLocalMode()) {
        store.upsert("incidents", record);
        store.saveLocalRecords();
        ui.toast("Incident saved on this device.", "ok");
        clearForm();
        render();
        return;
      }

      /* Mark it as not-yet-sent so the list can label it honestly. */
      store.upsert("incidents", record);
      render();

      const result = await api.save(
        "saveIncident",
        record,
        "Incident " + record.id
      );

      if (result.queued) {
        ui.toast("Saved on this device. It will send when the connection returns.", "warn");
      } else {
        const saved = result.item || record;
        store.upsert("incidents", saved);
        ui.toast(existing ? "Incident updated." : "Incident " + saved.id + " logged.", "ok");
      }
      clearForm();
      render();
      if (App.dashboard) App.dashboard.render();

    } catch (err) {
      /* Something was actively refused — put the form back so no typing is lost. */
      store.upsert("incidents", record);
      ui.toast(api.explain(err), "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  /* ======================================================================
     DELETE
     Deletes are "soft": the record is marked as deleted rather than erased,
     so it can be recovered from the Google Sheet, and the audit log keeps a
     note of who did it. The old version called sheet.deleteRow() — one wrong
     click and the ticket was gone for good, with no record of what happened.
     ====================================================================== */
  async function remove() {
    const id = $("incidentId").value;
    if (!id) return;
    const record = store.find("incidents", id);
    if (!record) return;

    if (!ui.confirmAction("Delete incident " + id + "?\n\nIt will be removed from the lists. The record is kept in the Google Sheet and can be restored.")) return;

    try {
      if (!store.isLocalMode()) {
        await api.save("deleteIncident", { id: id, version: record.updatedAt }, "Delete " + id);
      }
      store.drop("incidents", id);
      ui.toast("Incident deleted.", "ok");
      clearForm();
      render();
      if (App.dashboard) App.dashboard.render();
    } catch (err) {
      ui.toast(api.explain(err), "error");
    }
  }

  /* ======================================================================
     RENDER THE LIST
     ====================================================================== */
  function filtered() {
    const q = query.toLowerCase();
    return store.state.incidents
      .filter(t => statusFilter === "All" || t.status === statusFilter)
      .filter(t => {
        if (!q) return true;
        return [t.id, t.requester, t.department, t.location, t.category, t.description, t.technician]
          .join(" ").toLowerCase().indexOf(q) >= 0;
      })
      .sort(util.byNewest("updatedAt"));
  }

  function render() {
    const host = $("incidentList");
    if (!host) return;
    const rows = filtered();
    const total = store.state.incidents.length;

    $("incidentListTitle").textContent = total
      ? "Incidents (" + rows.length + " of " + total + ")"
      : "Incidents";

    if (!rows.length) {
      host.innerHTML = ui.empty(total
        ? "No incidents match your search or filter."
        : "No incidents yet. Log the first one using the form, or press \"Add sample\" to see how it works.");
      return;
    }

    host.innerHTML = rows.map(t => {
      const waiting = util.isTempId(t.id);
      return '' +
        '<div class="item" data-id="' + util.escapeHtml(t.id) + '">' +
          '<div class="item-top">' +
            '<div style="min-width:0">' +
              '<p class="item-id">' + util.escapeHtml(t.id) + (waiting ? " &middot; waiting to send" : "") + "</p>" +
              '<p class="item-title">' + util.escapeHtml(t.category || "Incident") + "</p>" +
              '<p class="item-meta">' + util.escapeHtml(t.requester) +
                (t.department ? " &middot; " + util.escapeHtml(t.department) : "") +
                (t.location ? " &middot; " + util.escapeHtml(t.location) : "") + "</p>" +
              '<p class="item-meta">Technician: ' + util.escapeHtml(t.technician || "—") +
                " &middot; Updated " + util.formatDateTime(t.updatedAt) + "</p>" +
            "</div>" +
            '<div class="tags">' + ui.tag(t.status) + ui.tag(t.priority) + "</div>" +
          "</div>" +
          (t.description ? '<p class="item-desc">' + util.escapeHtml(t.description) + "</p>" : "") +
          (t.resolution ? '<p class="item-desc"><strong>Resolution:</strong> ' + util.escapeHtml(t.resolution) + "</p>" : "") +
          '<div class="item-actions">' +
            '<button class="btn tiny ghost" type="button" data-edit="' + util.escapeHtml(t.id) + '">' +
              '<svg aria-hidden="true"><use href="#i-edit"/></svg> Edit</button>' +
            (t.status !== "Resolved"
              ? '<button class="btn tiny ghost" type="button" data-resolve="' + util.escapeHtml(t.id) + '">' +
                '<svg aria-hidden="true"><use href="#i-check"/></svg> Mark resolved</button>'
              : "") +
          "</div>" +
        "</div>";
    }).join("");
  }

  /* Quick action from the list: mark a ticket resolved without opening it. */
  async function quickResolve(id) {
    const record = store.find("incidents", id);
    if (!record) return;
    if (!record.resolution) {
      ui.toast("Open the ticket and write what was done before marking it resolved.", "warn");
      loadForEdit(id);
      return;
    }
    fillForm(record);
    $("status").value = "Resolved";
    await save();
  }

  /* ======================================================================
     SAMPLE DATA
     Clearly labelled, and it now uses dates relative to today rather than
     a fixed date in the past.
     ====================================================================== */
  async function addSamples() {
    if (store.state.incidents.length &&
        !ui.confirmAction("Add 3 sample incidents to the current list?")) return;

    const samples = [
      { requester: "Ama Mensah", department: "Call Center", location: "Desk CC-12",
        category: "Call Center Phone", technician: "Julius", status: "Pending", priority: "High",
        timeSpent: "", description: "Call centre phone rings once and disconnects during customer calls.",
        resolution: "", componentChanged: "" },
      { requester: "Kojo Appiah", department: "Finance", location: "2nd Floor",
        category: "Internet / Network", technician: "David", status: "In Progress", priority: "Critical",
        timeSpent: "15 minutes",
        description: "Finance workstation has no internet access while nearby computers are working.",
        resolution: "Checked the LAN port and confirmed the network cable is faulty. Replacement in progress.",
        componentChanged: "Network cable" },
      { requester: "Efua Boateng", department: "HR", location: "HR Office",
        category: "Computer Component", technician: "Julius", status: "Resolved", priority: "Medium",
        timeSpent: "45 minutes", description: "Desktop beeps and does not start.",
        resolution: "Tested the RAM slots, replaced the faulty module and confirmed a successful start.",
        componentChanged: "DDR 4 4GB RAM" }
    ];

    const user = store.currentUser();
    for (const sample of samples) {
      const now = new Date().toISOString();
      const record = Object.assign({}, sample, {
        id: util.randomId("INC"),
        createdAt: now, updatedAt: now,
        resolvedAt: sample.status === "Resolved" ? now : "",
        createdBy: user, updatedBy: user
      });
      store.upsert("incidents", record);
      if (!store.isLocalMode()) {
        try {
          const result = await api.save("saveIncident", record, "Sample incident");
          if (result.queued) continue;
          if (result.item) store.upsert("incidents", result.item);
        } catch (err) { ui.toast(api.explain(err), "error"); }
      }
    }

    if (store.isLocalMode()) store.saveLocalRecords();
    ui.toast("3 sample incidents added.", "ok");
    render();
    if (App.dashboard) App.dashboard.render();
  }

  /* ======================================================================
     WIRING — connecting the buttons to the functions above
     ====================================================================== */
  function bind() {
    $("incidentForm").addEventListener("submit", function (e) { e.preventDefault(); save(); });
    $("resetIncidentBtn").addEventListener("click", function () { clearForm(); ui.toast("Form cleared."); });
    $("deleteIncidentBtn").addEventListener("click", remove);
    $("sampleIncidentBtn").addEventListener("click", addSamples);

    $("incidentSearch").addEventListener("input", util.debounce(function (e) {
      query = e.target.value.trim();
      render();
    }, 180));

    $("incidentStatusFilter").addEventListener("change", function (e) {
      statusFilter = e.target.value;
      render();
    });

    /* Click handling for the buttons inside each row. */
    $("incidentList").addEventListener("click", function (e) {
      const editBtn = e.target.closest("[data-edit]");
      if (editBtn) { loadForEdit(editBtn.getAttribute("data-edit")); return; }

      const resolveBtn = e.target.closest("[data-resolve]");
      if (resolveBtn) { quickResolve(resolveBtn.getAttribute("data-resolve")); return; }

      const row = e.target.closest(".item");
      if (row) loadForEdit(row.getAttribute("data-id"));
    });

    /* Keep a draft so a half-typed ticket survives an accidental refresh. */
    $("incidentForm").addEventListener("input", util.debounce(function () {
      if ($("incidentId").value) return; /* only drafts for new tickets */
      store.saveDraft("incident", readForm());
    }, 600));
  }

  function restoreDraft() {
    const draft = store.loadDraft("incident");
    if (!draft || !draft.values) return;
    const v = draft.values;
    if (!v.requester && !v.description) return;
    fillForm(Object.assign({ id: "" }, v));
    ui.toast("A partly written incident was restored from your last visit.", "info");
  }

  /* Populate the technician drop-down and set sensible defaults. */
  function init() {
    const select = $("technician");
    if (select) {
      select.innerHTML = App.config.technicians
        .map(name => '<option value="' + util.escapeHtml(name) + '">' + util.escapeHtml(name) + "</option>")
        .join("");
    }
    clearForm();
    restoreDraft();
  }

  return { init: init, bind: bind, render: render, clearForm: clearForm, fillForm: fillForm, addSamples: addSamples };

})();

/* ==============================================================================
   SECTION 9 of 13  —  MEMOS — purchase requests and printing
   (previously the separate file js/08-memos.js)
   ============================================================================== */

/* ==========================================================================
   08-memos.js — Purchase request memos
   --------------------------------------------------------------------------
   This module also owns the PRINTING behaviour.

   How printing works: we add the class "printing-memo" to the <body>, then
   call window.print(). The @media print rules at the bottom of styles.css
   hide absolutely everything on the page and then reveal only the memo
   document. So what comes out of the printer is a clean A4 memo — no menus,
   no buttons, no page background. The class is removed afterwards.
   ========================================================================== */

window.App = window.App || {};

App.memos = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const api   = App.api;
  const $ = util.$;

  let query = "";

  /* ======================================================================
     THE ITEMS TABLE
     ====================================================================== */

  /* Add one editable row to the "requested items" table. */
  function addRow(item) {
    const data = item || { name: "", quantity: 1, unitCost: 0 };
    const tbody = $("memoItemsBody");
    const tr = document.createElement("tr");
    tr.innerHTML = '' +
      '<td><label class="sr-only" for="item-name-' + Date.now() + '">Item name</label>' +
        '<input type="text" data-item="name" value="' + util.escapeHtml(data.name) + '" placeholder="Item name" /></td>' +
      '<td class="num"><label class="sr-only">Quantity</label>' +
        '<input type="number" data-item="quantity" min="0" step="1" value="' + util.toInt(data.quantity, 1) + '" style="max-width:86px;text-align:right" /></td>' +
      '<td class="num"><label class="sr-only">Unit cost</label>' +
        '<input type="number" data-item="unitCost" min="0" step="0.01" value="' + util.toFloat(data.unitCost, 0) + '" style="max-width:110px;text-align:right" /></td>' +
      '<td><button class="btn tiny danger ghost" type="button" data-remove-row aria-label="Remove this item">' +
        '<svg aria-hidden="true"><use href="#i-close"/></svg></button></td>';
    tbody.appendChild(tr);
    updateTotal();
  }

  function readItems() {
    return Array.from($("memoItemsBody").querySelectorAll("tr")).map(tr => ({
      name: tr.querySelector('[data-item="name"]').value.trim(),
      quantity: util.toInt(tr.querySelector('[data-item="quantity"]').value, 0),
      unitCost: util.toFloat(tr.querySelector('[data-item="unitCost"]').value, 0)
    })).filter(row => row.name || row.unitCost);
  }

  function itemsTotal(items) {
    return items.reduce((sum, row) => sum + (row.quantity * row.unitCost), 0);
  }

  function updateTotal() {
    const items = readItems();
    const el = $("memoTotal");
    if (el) el.textContent = util.money(itemsTotal(items));
  }

  /* ======================================================================
     FORM
     ====================================================================== */
  function readForm() {
    return {
      to:      $("memoTo").value.trim(),
      from:    $("memoFrom").value.trim(),
      date:    $("memoDate").value,
      subject: $("memoSubject").value.trim(),
      purpose: $("memoPurpose").value.trim(),
      items:   readItems(),
      sign1:   $("sign1").value.trim() || "Prepared By",
      sign2:   $("sign2").value.trim() || "Checked By",
      sign3:   $("sign3").value.trim() || "Approved By"
    };
  }

  function validate(data) {
    if (!data.to)      return "Please enter who the memo is addressed to.";
    if (!data.from)    return "Please enter who the memo is from.";
    if (!data.date)    return "Please choose a date.";
    if (!data.subject) return "Please enter a subject.";
    if (!data.purpose) return "Please explain the purpose of the request.";
    if (!data.items.length) return "Please add at least one requested item.";
    return null;
  }

  function fillForm(record) {
    $("memoId").value         = record.id || "";
    $("memoVersion").value    = record.updatedAt || "";
    $("memoTo").value         = record.to || "";
    $("memoFrom").value       = record.from || "";
    $("memoDate").value       = record.date || util.todayISO();
    $("memoSubject").value    = record.subject || "";
    $("memoPurpose").value    = record.purpose || "";
    $("sign1").value          = record.sign1 || "Prepared By";
    $("sign2").value          = record.sign2 || "Checked By";
    $("sign3").value          = record.sign3 || "Approved By";

    $("memoItemsBody").innerHTML = "";
    (record.items && record.items.length ? record.items : [{ name: "", quantity: 1, unitCost: 0 }])
      .forEach(addRow);

    const editing = !!record.id;
    $("memoBadge").textContent     = editing ? "Editing " + record.id : "New Memo";
    $("memoFormTitle").textContent = editing ? "Edit memo" : "Memo builder";
    $("deleteMemoBtn").hidden      = !editing;
    $("saveMemoBtn").innerHTML     = editing
      ? '<svg aria-hidden="true"><use href="#i-save"/></svg> Update memo'
      : '<svg aria-hidden="true"><use href="#i-save"/></svg> Save memo';

    updatePreview();
  }

  function clearForm() {
    $("memoForm").reset();
    $("memoId").value      = "";
    $("memoVersion").value = "";
    $("memoDate").value    = util.todayISO();
    $("sign1").value       = "Prepared By";
    $("sign2").value       = "Checked By";
    $("sign3").value       = "Approved By";
    $("memoBadge").textContent     = "New Memo";
    $("memoFormTitle").textContent = "Memo builder";
    $("deleteMemoBtn").hidden      = true;
    $("saveMemoBtn").innerHTML     = '<svg aria-hidden="true"><use href="#i-save"/></svg> Save memo';
    $("memoItemsBody").innerHTML   = "";
    addRow();
    updatePreview();
  }

  function loadForEdit(id) {
    const record = store.find("memos", id);
    if (!record) return;
    fillForm(record);
    document.querySelector(".preview-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ======================================================================
     LIVE PREVIEW
     ====================================================================== */
  function updatePreview() {
    const host = $("memoPreview");
    if (!host) return;
    const data = readForm();
    const total = itemsTotal(data.items);

    const rows = data.items.length
      ? data.items.map(row => '' +
          "<tr><td>" + util.escapeHtml(row.name || "—") + "</td>" +
          '<td class="num">' + row.quantity + "</td>" +
          '<td class="num">' + util.money(row.unitCost) + "</td>" +
          '<td class="num">' + util.money(row.quantity * row.unitCost) + "</td></tr>").join("")
      : '<tr><td colspan="4" style="text-align:center;color:#8a94a6">No items added yet</td></tr>';

    host.innerHTML = '' +
      '<div class="memo-paper">' +
        "<h3>MEMO</h3>" +
        '<div class="memo-meta">' +
          "<span>To</span><span>" + util.escapeHtml(data.to || "—") + "</span>" +
          "<span>From</span><span>" + util.escapeHtml(data.from || "—") + "</span>" +
          "<span>Date</span><span>" + util.escapeHtml(util.formatDate(data.date)) + "</span>" +
          "<span>Subject</span><span>" + util.escapeHtml(data.subject || "—") + "</span>" +
        "</div>" +
        '<hr class="memo-line" />' +
        '<table class="memo-table">' +
          "<thead><tr>" +
            '<th scope="col">Item</th><th scope="col" class="num">Quantity</th>' +
            '<th scope="col" class="num">Unit cost (GH&#8373;)</th><th scope="col" class="num">Cost (GH&#8373;)</th>' +
          "</tr></thead>" +
          "<tbody>" + rows + "</tbody>" +
          "<tfoot><tr>" +
            '<th colspan="3" class="num">Total</th>' +
            '<th class="num">' + util.money(total) + "</th>" +
          "</tr></tfoot>" +
        "</table>" +
        '<p class="memo-purpose"><strong>Purpose:</strong> ' + util.escapeHtml(data.purpose || "—") + "</p>" +
        '<div class="signature-grid">' +
          "<div><div class=\"signature-line\"></div><strong>" + util.escapeHtml(data.sign1) + "</strong></div>" +
          "<div><div class=\"signature-line\"></div><strong>" + util.escapeHtml(data.sign2) + "</strong></div>" +
          "<div><div class=\"signature-line\"></div><strong>" + util.escapeHtml(data.sign3) + "</strong></div>" +
        "</div>" +
      "</div>";
  }

  /* ======================================================================
     SAVE / DELETE
     ====================================================================== */
  async function save() {
    const data = readForm();
    const problem = validate(data);
    if (problem) { ui.toast(problem, "warn"); return; }

    const id = $("memoId").value;
    const existing = id ? store.find("memos", id) : null;
    const now = new Date().toISOString();

    const record = Object.assign({}, existing || {}, data, {
      id: id || util.randomId("MEMO"),
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
      createdBy: (existing && existing.createdBy) || store.currentUser(),
      updatedBy: store.currentUser()
    });

    const button = $("saveMemoBtn");
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "Saving\u2026";

    try {
      if (store.isLocalMode()) {
        store.upsert("memos", record);
        store.saveLocalRecords();
        ui.toast("Memo saved on this device.", "ok");
        clearForm();
        render();
        return;
      }

      store.upsert("memos", record);
      render();

      const result = await api.save("saveMemo", record, "Memo " + record.id);
      if (result.queued) {
        ui.toast("Saved on this device. It will send when the connection returns.", "warn");
      } else {
        store.upsert("memos", result.item || record);
        ui.toast(existing ? "Memo updated." : "Memo saved.", "ok");
      }
      clearForm();
      render();
      if (App.dashboard) App.dashboard.render();

    } catch (err) {
      store.upsert("memos", record);
      ui.toast(api.explain(err), "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  async function remove() {
    const id = $("memoId").value;
    if (!id) return;
    const record = store.find("memos", id);
    if (!record) return;
    if (!ui.confirmAction("Delete memo " + id + "?\n\nIt will be removed from the lists. The record is kept in the Google Sheet.")) return;

    try {
      if (!store.isLocalMode()) {
        await api.save("deleteMemo", { id: id, version: record.updatedAt }, "Delete " + id);
      }
      store.drop("memos", id);
      ui.toast("Memo deleted.", "ok");
      clearForm();
      render();
      if (App.dashboard) App.dashboard.render();
    } catch (err) {
      ui.toast(api.explain(err), "error");
    }
  }

  /* ======================================================================
     PRINT
     ====================================================================== */
  function print() {
    const data = readForm();
    if (!data.to || !data.items.length) {
      ui.toast("Fill in the memo before printing it.", "warn");
      return;
    }
    document.body.classList.add("printing-memo");
    /* Small pause so the browser has time to apply the print styles. */
    setTimeout(function () {
      window.print();
      setTimeout(() => document.body.classList.remove("printing-memo"), 400);
    }, 120);
  }

  /* ======================================================================
     TEMPLATE
     ----------------------------------------------------------------------
     The old version filled the template with the letters "E" and "D" and a
     hard-coded date of 2026-08-20. Anyone pressing this button got a memo
     addressed to "E". These are now real, editable values, and the date is
     always today.
     ====================================================================== */
  function loadTemplate() {
    if (!ui.confirmAction("Replace everything in the form with the template?")) return;
    clearForm();
    $("memoTo").value      = "The Finance Manager";
    $("memoFrom").value    = "IT Department";
    $("memoDate").value    = util.todayISO();
    $("memoSubject").value = "Purchase Request \u2013 PC Components and IT Consumables";
    $("memoPurpose").value = "To restock the components and items needed to keep office computers " +
      "running and to carry out routine repairs and upgrades without delay.";
    $("memoItemsBody").innerHTML = "";
    [
      { name: "256GB SSD",       quantity: 1,  unitCost: 550 },
      { name: "CMOS Battery",    quantity: 10, unitCost: 25  },
      { name: "DDR 4 4GB RAM",   quantity: 1,  unitCost: 320 },
      { name: "DDR 4 8GB RAM",   quantity: 1,  unitCost: 520 },
      { name: "Logitech M170 Mouse", quantity: 1, unitCost: 200 },
      { name: "Delivery",        quantity: 1,  unitCost: 30  }
    ].forEach(addRow);
    updatePreview();
    ui.toast("Template loaded. Edit anything you like before saving.", "ok");
  }

  /* ======================================================================
     SAVED MEMO LIST
     ====================================================================== */
  function render() {
    updatePreview();
    const host = $("memoList");
    if (!host) return;

    const q = query.toLowerCase();
    const rows = store.state.memos
      .filter(m => {
        if (!q) return true;
        const itemNames = (m.items || []).map(i => i.name).join(" ");
        return [m.id, m.to, m.from, m.subject, m.purpose, itemNames].join(" ").toLowerCase().indexOf(q) >= 0;
      })
      .sort(util.byNewest("updatedAt"));

    if (!rows.length) {
      host.innerHTML = ui.empty(store.state.memos.length
        ? "No memos match your search."
        : "No saved memos yet. Build one above, or press \"Load template\" to start from an example.");
      return;
    }

    host.innerHTML = rows.map(m => {
      const total = itemsTotal(m.items || []);
      return '' +
        '<div class="item" data-id="' + util.escapeHtml(m.id) + '">' +
          '<div class="item-top">' +
            '<div style="min-width:0">' +
              '<p class="item-id">' + util.escapeHtml(m.id) + "</p>" +
              '<p class="item-title">' + util.escapeHtml(m.subject || "Purchase request") + "</p>" +
              '<p class="item-meta">To ' + util.escapeHtml(m.to || "—") + " &middot; From " + util.escapeHtml(m.from || "—") + "</p>" +
              '<p class="item-meta">' + util.formatDate(m.date) + " &middot; " +
                (m.items || []).length + " item(s) &middot; " + util.money(total) + "</p>" +
            "</div>" +
          "</div>" +
          '<div class="item-actions">' +
            '<button class="btn tiny ghost" type="button" data-edit="' + util.escapeHtml(m.id) + '">' +
              '<svg aria-hidden="true"><use href="#i-edit"/></svg> Open</button>' +
          "</div>" +
        "</div>";
    }).join("");
  }

  /* ======================================================================
     WIRING
     ====================================================================== */
  function bind() {
    $("memoForm").addEventListener("submit", function (e) { e.preventDefault(); save(); });
    $("addItemBtn").addEventListener("click", function () { addRow(); updatePreview(); });
    $("resetMemoBtn").addEventListener("click", function () { clearForm(); ui.toast("Form cleared."); });
    $("deleteMemoBtn").addEventListener("click", remove);
    $("printMemoBtn").addEventListener("click", print);
    $("templateMemoBtn").addEventListener("click", loadTemplate);

    /* Recalculate and redraw the preview whenever any field changes. */
    const redo = util.debounce(function () { updateTotal(); updatePreview(); }, 120);
    $("memoForm").addEventListener("input", redo);
    $("memoForm").addEventListener("change", redo);

    /* Remove a row from the items table. */
    $("memoItemsBody").addEventListener("click", function (e) {
      const btn = e.target.closest("[data-remove-row]");
      if (!btn) return;
      btn.closest("tr").remove();
      if (!$("memoItemsBody").querySelector("tr")) addRow();
      updateTotal();
      updatePreview();
    });

    $("memoSearch").addEventListener("input", util.debounce(function (e) {
      query = e.target.value.trim();
      render();
    }, 180));

    $("memoList").addEventListener("click", function (e) {
      const editBtn = e.target.closest("[data-edit]");
      if (editBtn) { loadForEdit(editBtn.getAttribute("data-edit")); return; }
      const row = e.target.closest(".item");
      if (row) loadForEdit(row.getAttribute("data-id"));
    });
  }

  function init() {
    $("memoDate").value = util.todayISO();
    addRow();
    updatePreview();
  }

  /* Used by the dashboard's "Request in memo" button. */
  function requestItem(itemId) {
    const item = store.find("inventory", itemId);
    if (!item) return;
    clearForm();
    $("memoTo").value      = "The Finance Manager";
    $("memoFrom").value    = "IT Department";
    $("memoSubject").value = "Purchase Request \u2013 " + item.name;
    $("memoPurpose").value = "Stock of " + item.name + " has fallen to the reorder level and needs to be replenished.";
    $("memoItemsBody").innerHTML = "";
    addRow({
      name: item.name,
      quantity: Math.max(1, (Number(item.reorderLevel) || 1) * 2 - (Number(item.quantity) || 0)),
      unitCost: Number(item.unitCost) || 0
    });
    updatePreview();
    ui.navigate("memos");
    ui.toast("Started a memo requesting " + item.name + ".", "ok");
  }

  return { init: init, bind: bind, render: render, updatePreview: updatePreview, clearForm: clearForm, requestItem: requestItem };

})();

/* ==============================================================================
   SECTION 10 of 13  —  INVENTORY — stock and assets
   (previously the separate file js/09-inventory.js)
   ============================================================================== */

/* ==========================================================================
   09-inventory.js — Stock and assets
   ========================================================================== */

window.App = window.App || {};

App.inventory = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const api   = App.api;
  const $ = util.$;

  let query = "";
  let view = "all";

  /* ======================================================================
     FORM
     ====================================================================== */
  function readForm() {
    return {
      name:         $("itemName").value.trim(),
      category:     $("itemCategory").value,
      sku:          $("itemSku").value.trim(),
      location:     $("itemLocation").value.trim(),
      quantity:     util.toInt($("itemQuantity").value, 0),
      reorderLevel: util.toInt($("itemReorder").value, 0),
      unitCost:     util.toFloat($("itemUnitCost").value, 0),
      supplier:     $("itemSupplier").value.trim(),
      notes:        $("itemNotes").value.trim()
    };
  }

  function validate(data) {
    if (!data.name)     return "Please enter the item name.";
    if (!data.category) return "Please choose a category.";
    if (data.quantity < 0)     return "Quantity cannot be negative.";
    if (data.reorderLevel < 0) return "The reorder level cannot be negative.";
    if (data.unitCost < 0)     return "Unit cost cannot be negative.";
    return null;
  }

  function fillForm(record) {
    $("itemId").value        = record.id || "";
    $("itemVersion").value   = record.updatedAt || "";
    $("itemName").value      = record.name || "";
    $("itemCategory").value  = record.category || "";
    $("itemSku").value       = record.sku || "";
    $("itemLocation").value  = record.location || "";
    $("itemQuantity").value  = util.toInt(record.quantity, 0);
    $("itemReorder").value   = util.toInt(record.reorderLevel, 2);
    $("itemUnitCost").value  = util.toFloat(record.unitCost, 0);
    $("itemSupplier").value  = record.supplier || "";
    $("itemNotes").value     = record.notes || "";

    const editing = !!record.id;
    $("itemBadge").textContent     = editing ? "Editing " + record.id : "New Item";
    $("itemFormTitle").textContent = editing ? "Edit stock item" : "Stock item";
    $("deleteItemBtn").hidden      = !editing;
    $("saveItemBtn").innerHTML     = editing
      ? '<svg aria-hidden="true"><use href="#i-save"/></svg> Update item'
      : '<svg aria-hidden="true"><use href="#i-save"/></svg> Save item';
  }

  function clearForm() {
    $("itemForm").reset();
    $("itemId").value       = "";
    $("itemVersion").value  = "";
    $("itemQuantity").value = 0;
    $("itemReorder").value  = 2;
    $("itemUnitCost").value = 0;
    $("itemBadge").textContent     = "New Item";
    $("itemFormTitle").textContent = "Stock item";
    $("deleteItemBtn").hidden      = true;
    $("saveItemBtn").innerHTML     = '<svg aria-hidden="true"><use href="#i-save"/></svg> Save item';
  }

  function loadForEdit(id) {
    const record = store.find("inventory", id);
    if (!record) return;
    fillForm(record);
    ui.navigate("inventory");
    const form = $("itemForm");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ======================================================================
     SAVE
     ====================================================================== */
  async function save() {
    const data = readForm();
    const problem = validate(data);
    if (problem) { ui.toast(problem, "warn"); return; }

    const id = $("itemId").value;
    const existing = id ? store.find("inventory", id) : null;
    const now = new Date().toISOString();

    const record = Object.assign({}, existing || {}, data, {
      id: id || util.randomId("INV"),
      movements: (existing && existing.movements) || [],
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
      createdBy: (existing && existing.createdBy) || store.currentUser(),
      updatedBy: store.currentUser()
    });

    const button = $("saveItemBtn");
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "Saving\u2026";

    try {
      if (store.isLocalMode()) {
        store.upsert("inventory", record);
        store.saveLocalRecords();
        ui.toast("Item saved on this device.", "ok");
        clearForm();
        refreshItemSelect();
        render();
        return;
      }

      store.upsert("inventory", record);
      render();

      const result = await api.save("saveInventory", record, "Stock item " + record.id);
      if (result.queued) {
        ui.toast("Saved on this device. It will send when the connection returns.", "warn");
      } else {
        store.upsert("inventory", result.item || record);
        ui.toast(existing ? "Item updated." : "Item added to inventory.", "ok");
      }
      clearForm();
      refreshItemSelect();
      render();
      if (App.dashboard) App.dashboard.render();

    } catch (err) {
      store.upsert("inventory", record);
      ui.toast(api.explain(err), "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  async function remove() {
    const id = $("itemId").value;
    if (!id) return;
    const record = store.find("inventory", id);
    if (!record) return;
    if (!ui.confirmAction("Delete " + record.name + "?\n\nIt will be removed from the lists. The record is kept in the Google Sheet.")) return;

    try {
      if (!store.isLocalMode()) {
        await api.save("deleteInventory", { id: id, version: record.updatedAt }, "Delete " + id);
      }
      store.drop("inventory", id);
      ui.toast("Item deleted.", "ok");
      clearForm();
      refreshItemSelect();
      render();
      if (App.dashboard) App.dashboard.render();
    } catch (err) {
      ui.toast(api.explain(err), "error");
    }
  }

  /* ======================================================================
     STOCK MOVEMENT — receive or issue
     ====================================================================== */
  async function moveStock() {
    const itemId = $("moveItem").value;
    const action = $("moveAction").value;
    const qty = util.toInt($("moveQty").value, 0);
    const reason = $("moveReason").value.trim();

    if (!itemId) return ui.toast("Please choose an item.", "warn");
    if (qty <= 0) return ui.toast("Quantity must be more than zero.", "warn");

    const item = store.find("inventory", itemId);
    if (!item) return ui.toast("That item could not be found.", "warn");

    const current = util.toInt(item.quantity, 0);
    if (action === "issue" && qty > current) {
      return ui.toast("You cannot issue " + qty + " when only " + current + " are in stock.", "warn");
    }

    const button = $("saveMoveBtn");
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Updating\u2026";

    try {
      if (store.isLocalMode()) {
        applyMovement(item, action, qty, reason);
        store.saveLocalRecords();
        ui.toast("Stock updated on this device.", "ok");
      } else {
        const result = await api.save("stockMovement", {
          id: itemId, action: action, quantity: qty, reason: reason,
          updatedBy: store.currentUser()
        }, "Stock " + (action === "issue" ? "out" : "in") + ": " + item.name);

        if (result.queued) {
          applyMovement(item, action, qty, reason);
          ui.toast("Saved on this device. It will send when the connection returns.", "warn");
        } else {
          store.upsert("inventory", result.item || item);
          ui.toast("Stock updated.", "ok");
        }
      }
      $("movementForm").reset();
      $("moveQty").value = 1;
      refreshItemSelect();
      render();
      if (App.dashboard) App.dashboard.render();
    } catch (err) {
      ui.toast(api.explain(err), "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  /* Apply a stock change locally, keeping a history of movements. */
  function applyMovement(item, action, qty, reason) {
    const before = util.toInt(item.quantity, 0);
    const after = action === "issue" ? before - qty : before + qty;
    const now = new Date().toISOString();
    const movement = {
      action: action, quantity: qty, before: before, after: after,
      reason: reason, at: now, by: store.currentUser()
    };
    store.upsert("inventory", Object.assign({}, item, {
      quantity: after,
      updatedAt: now,
      updatedBy: store.currentUser(),
      movements: [movement].concat(item.movements || []).slice(0, 50)
    }));
  }

  /* ======================================================================
     RENDERING
     ====================================================================== */
  function filtered() {
    const q = query.toLowerCase();
    return store.state.inventory
      .filter(item => view !== "low" || App.dashboard.isLowStock(item))
      .filter(item => {
        if (!q) return true;
        return [item.id, item.name, item.sku, item.category, item.location, item.supplier]
          .join(" ").toLowerCase().indexOf(q) >= 0;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function render() {
    refreshItemSelect();

    const host = $("itemList");
    if (!host) return;
    const rows = filtered();
    const total = store.state.inventory.length;

    $("itemListTitle").textContent = total
      ? "Inventory (" + rows.length + " of " + total + ")"
      : "Inventory";

    if (!rows.length) {
      host.innerHTML = ui.empty(total
        ? "No items match your search or filter."
        : "No inventory yet. Add your first item using the form, or press \"Add sample\".");
      return;
    }

    host.innerHTML = rows.map(item => {
      const low = App.dashboard.isLowStock(item);
      const waiting = util.isTempId(item.id);
      const value = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
      return '' +
        '<div class="item" data-id="' + util.escapeHtml(item.id) + '">' +
          '<div class="item-top">' +
            '<div style="min-width:0">' +
              '<p class="item-id">' + util.escapeHtml(item.id) + (waiting ? " &middot; waiting to send" : "") + "</p>" +
              '<p class="item-title">' + util.escapeHtml(item.name) + "</p>" +
              '<p class="item-meta">' + util.escapeHtml(item.category || "—") +
                (item.sku ? " &middot; " + util.escapeHtml(item.sku) : "") +
                (item.location ? " &middot; " + util.escapeHtml(item.location) : "") + "</p>" +
              '<p class="item-meta">In stock: <strong>' + (Number(item.quantity) || 0) + "</strong>" +
                " &middot; reorder at " + (Number(item.reorderLevel) || 0) +
                " &middot; " + util.money(item.unitCost) + " each" +
                " &middot; total " + util.money(value) + "</p>" +
            "</div>" +
            '<div class="tags">' + (low ? ui.tag("Low stock") : "") + "</div>" +
          "</div>" +
          (item.notes ? '<p class="item-desc">' + util.escapeHtml(item.notes) + "</p>" : "") +
          '<div class="item-actions">' +
            '<button class="btn tiny ghost" type="button" data-edit="' + util.escapeHtml(item.id) + '">' +
              '<svg aria-hidden="true"><use href="#i-edit"/></svg> Edit</button>' +
            (low ? '<button class="btn tiny ghost" type="button" data-request="' + util.escapeHtml(item.id) + '">Request in memo</button>' : "") +
            '<button class="btn tiny ghost" type="button" data-receive="' + util.escapeHtml(item.id) + '">Receive stock</button>' +
          "</div>" +
        "</div>";
    }).join("");
  }

  /* Fill the "which item?" drop-down in the movement form. */
  function refreshItemSelect() {
    const select = $("moveItem");
    if (!select) return;
    const chosen = select.value;
    select.innerHTML = '<option value="">Select item</option>' +
      store.state.inventory
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map(item => '<option value="' + util.escapeHtml(item.id) + '">' +
          util.escapeHtml(item.name) + " (" + (Number(item.quantity) || 0) + " in stock)</option>")
        .join("");
    if (chosen) select.value = chosen;
  }

  /* ======================================================================
     SAMPLE DATA
     ====================================================================== */
  async function addSamples() {
    if (store.state.inventory.length &&
        !ui.confirmAction("Add 7 sample stock items to the current list?")) return;

    const samples = [
      { name: "256GB SSD",               category: "Storage",         sku: "SSD-256",       quantity: 1,  reorderLevel: 2, unitCost: 550, location: "IT Store", supplier: "Local Vendor" },
      { name: "CMOS Battery",            category: "Battery",         sku: "CMOS-2032",     quantity: 10, reorderLevel: 5, unitCost: 25,  location: "IT Store", supplier: "Local Vendor" },
      { name: "DDR 4 4GB RAM",           category: "Memory",          sku: "RAM-DDR4-4",    quantity: 1,  reorderLevel: 2, unitCost: 320, location: "IT Store", supplier: "Local Vendor" },
      { name: "DDR 4 8GB RAM",           category: "Memory",          sku: "RAM-DDR4-8",    quantity: 1,  reorderLevel: 2, unitCost: 520, location: "IT Store", supplier: "Local Vendor" },
      { name: "Logitech M170 Mouse",     category: "Peripheral",      sku: "MOUSE-M170",    quantity: 1,  reorderLevel: 3, unitCost: 200, location: "IT Store", supplier: "Local Vendor" },
      { name: "Network Cable",           category: "Networking",      sku: "CAT6-CABLE",    quantity: 3,  reorderLevel: 5, unitCost: 30,  location: "IT Store", supplier: "Local Vendor" },
      { name: "Call Center Headset Cable", category: "Phone Accessory", sku: "HEADSET-CABLE", quantity: 2, reorderLevel: 4, unitCost: 45,  location: "IT Store", supplier: "Local Vendor" }
    ];

    const user = store.currentUser();
    for (const sample of samples) {
      const now = new Date().toISOString();
      const record = Object.assign({}, sample, {
        id: util.randomId("INV"),
        notes: "Sample stock item.", movements: [],
        createdAt: now, updatedAt: now, createdBy: user, updatedBy: user
      });
      store.upsert("inventory", record);
      if (!store.isLocalMode()) {
        try {
          const result = await api.save("saveInventory", record, "Sample stock item");
          if (result.queued) continue;
          if (result.item) store.upsert("inventory", result.item);
        } catch (err) { ui.toast(api.explain(err), "error"); }
      }
    }

    if (store.isLocalMode()) store.saveLocalRecords();
    ui.toast("7 sample stock items added.", "ok");
    render();
    if (App.dashboard) App.dashboard.render();
  }

  /* ======================================================================
     WIRING
     ====================================================================== */
  function bind() {
    $("itemForm").addEventListener("submit", function (e) { e.preventDefault(); save(); });
    $("resetItemBtn").addEventListener("click", function () { clearForm(); ui.toast("Form cleared."); });
    $("deleteItemBtn").addEventListener("click", remove);
    $("sampleItemBtn").addEventListener("click", addSamples);
    $("movementForm").addEventListener("submit", function (e) { e.preventDefault(); moveStock(); });

    $("itemSearch").addEventListener("input", util.debounce(function (e) {
      query = e.target.value.trim();
      render();
    }, 180));

    $("itemViewFilter").addEventListener("change", function (e) {
      view = e.target.value;
      render();
    });

    $("itemList").addEventListener("click", function (e) {
      const editBtn = e.target.closest("[data-edit]");
      if (editBtn) { loadForEdit(editBtn.getAttribute("data-edit")); return; }

      const requestBtn = e.target.closest("[data-request]");
      if (requestBtn) { App.memos.requestItem(requestBtn.getAttribute("data-request")); return; }

      const receiveBtn = e.target.closest("[data-receive]");
      if (receiveBtn) {
        $("moveItem").value = receiveBtn.getAttribute("data-receive");
        $("moveAction").value = "receive";
        $("moveQty").focus();
        $("moveQty").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const row = e.target.closest(".item");
      if (row) loadForEdit(row.getAttribute("data-id"));
    });
  }

  function init() {
    const select = $("itemCategory");
    if (select) {
      select.querySelectorAll("option:not([value=''])").forEach(() => {});
    }
    clearForm();
  }

  return { init: init, bind: bind, render: render, moveStock: moveStock, addSamples: addSamples };

})();

/* ==============================================================================
   SECTION 11 of 13  —  REPORTS — filtering, CSV export, printing
   (previously the separate file js/10-reports.js)
   ============================================================================== */

/* ==========================================================================
   10-reports.js — Filtering records into a report, exporting CSV, printing
   ========================================================================== */

window.App = window.App || {};

App.reports = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const $ = util.$;

  let lastReport = null;

  /* ======================================================================
     DATE RANGES
     ====================================================================== */
  function rangeFor(period) {
    const now = new Date();
    const startOfWeek = (d) => {
      const copy = new Date(d);
      const day = (copy.getDay() + 6) % 7; /* Monday = 0 */
      copy.setDate(copy.getDate() - day);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };
    const iso = (d) => [
      d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")
    ].join("-");

    if (period === "thisWeek") {
      const from = startOfWeek(now);
      const to = new Date(from); to.setDate(to.getDate() + 6);
      return { from: iso(from), to: iso(to), label: "This week" };
    }
    if (period === "lastWeek") {
      const from = startOfWeek(now); from.setDate(from.getDate() - 7);
      const to = new Date(from); to.setDate(to.getDate() + 6);
      return { from: iso(from), to: iso(to), label: "Last week" };
    }
    if (period === "thisMonth") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: iso(from), to: iso(to), label: "This month" };
    }
    if (period === "lastMonth") {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(from), to: iso(to), label: "Last month" };
    }
    if (period === "custom") {
      return { from: $("reportFrom").value, to: $("reportTo").value, label: "Custom range" };
    }
    return { from: "", to: "", label: "All time" };
  }

  /* Keep the two date boxes in step with the chosen period. */
  function syncDates() {
    const period = $("reportPeriod").value;
    const range = rangeFor(period);
    const from = $("reportFrom"), to = $("reportTo");
    const custom = period === "custom";
    from.disabled = !custom;
    to.disabled = !custom;
    if (!custom) { from.value = range.from || ""; to.value = range.to || ""; }
  }

  /* ======================================================================
     BUILD THE REPORT
     ====================================================================== */
  function gather() {
    const period = $("reportPeriod").value;
    const content = $("reportContent").value;
    const range = rangeFor(period);

    const keep = (record) => util.withinRange(record.createdAt || record.updatedAt, range.from, range.to);

    const report = {
      label: range.label,
      from: range.from,
      to: range.to,
      content: content,
      generatedAt: new Date().toISOString(),
      generatedBy: store.currentUser(),
      incidents: (content === "all" || content === "incidents") ? store.state.incidents.filter(keep) : [],
      memos:     (content === "all" || content === "memos")     ? store.state.memos.filter(keep)     : [],
      inventory: (content === "all" || content === "inventory") ? store.state.inventory.slice()      : []
    };

    report.totals = {
      incidents: report.incidents.length,
      resolved:  report.incidents.filter(t => t.status === "Resolved").length,
      pending:   report.incidents.filter(t => t.status === "Pending").length,
      memos:     report.memos.length,
      stockValue: report.inventory.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0)
    };
    return report;
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    /* The stat row on this page is drawn from the last loaded report. */
    const host = $("reportStats");
    if (host) {
      if (!lastReport) {
        host.innerHTML = "";
      } else {
        const t = lastReport.totals;
        host.innerHTML =
          ui.statCard({ label: "Records",   value: t.incidents + t.memos, note: lastReport.label, tone: "blue" }) +
          ui.statCard({ label: "Incidents", value: t.incidents, note: t.resolved + " resolved", tone: "cyan" }) +
          ui.statCard({ label: "Memos",     value: t.memos,     note: "Purchase requests", tone: "purple" });
      }
    }
    if (lastReport) draw(lastReport);
  }

  function load() {
    const period = $("reportPeriod").value;
    if (period === "custom") {
      const from = $("reportFrom").value, to = $("reportTo").value;
      if (!from || !to)  return ui.toast("Please choose both a start and an end date.", "warn");
      if (from > to)     return ui.toast("The start date is after the end date.", "warn");
    }
    lastReport = gather();
    render();
    const records = lastReport.totals.incidents + lastReport.totals.memos;
    ui.toast(records + " record(s) found for " + lastReport.label.toLowerCase() + ".", records ? "ok" : "warn");
  }

  function draw(report) {
    const out = $("reportOutput");
    if (!out) return;

    const parts = [];
    parts.push('<p class="report-title">IT Operations Report</p>');
    parts.push('<p class="report-period">' + util.escapeHtml(report.label) +
      (report.from ? " &middot; " + util.formatDate(report.from) + " to " + util.formatDate(report.to) : " &middot; all records") +
      ' &middot; prepared by ' + util.escapeHtml(report.generatedBy) +
      " &middot; " + util.formatDateTime(report.generatedAt) + "</p>");

    parts.push('<div class="report-summary">' +
      "<div><span>Incidents</span><strong>" + report.totals.incidents + "</strong></div>" +
      "<div><span>Resolved</span><strong>" + report.totals.resolved + "</strong></div>" +
      "<div><span>Still open</span><strong>" + report.totals.pending + "</strong></div>" +
      "<div><span>Memos</span><strong>" + report.totals.memos + "</strong></div>" +
      "<div><span>Stock value</span><strong>" + util.money(report.totals.stockValue) + "</strong></div>" +
      "</div>");

    /* --- Incidents table --- */
    if (report.content === "all" || report.content === "incidents") {
      if (!report.incidents.length) {
        parts.push('<div class="report-section"><h3>Incidents</h3>' + ui.empty("No incidents in this period.") + "</div>");
      } else {
        parts.push('<div class="report-section"><h3>Incidents (' + report.incidents.length + ")</h3>" +
          '<table class="report-table"><thead><tr>' +
            '<th scope="col">ID</th><th scope="col">Date</th><th scope="col">Requester</th>' +
            '<th scope="col">Department</th><th scope="col">Category</th><th scope="col">Technician</th>' +
            '<th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Time</th>' +
          "</tr></thead><tbody>" +
          report.incidents.slice().sort(util.byNewest("createdAt")).map(t =>
            "<tr><td>" + util.escapeHtml(t.id) + "</td>" +
            "<td>" + util.formatDate(t.createdAt) + "</td>" +
            "<td>" + util.escapeHtml(t.requester) + "</td>" +
            "<td>" + util.escapeHtml(t.department) + "</td>" +
            "<td>" + util.escapeHtml(t.category) + "</td>" +
            "<td>" + util.escapeHtml(t.technician) + "</td>" +
            "<td>" + util.escapeHtml(t.status) + "</td>" +
            "<td>" + util.escapeHtml(t.priority) + "</td>" +
            "<td>" + util.escapeHtml(t.timeSpent || "—") + "</td></tr>").join("") +
          "</tbody></table></div>");
      }
    }

    /* --- Memos table --- */
    if (report.content === "all" || report.content === "memos") {
      if (!report.memos.length) {
        parts.push('<div class="report-section"><h3>Purchase memos</h3>' + ui.empty("No memos in this period.") + "</div>");
      } else {
        parts.push('<div class="report-section"><h3>Purchase memos (' + report.memos.length + ")</h3>" +
          '<table class="report-table"><thead><tr>' +
            '<th scope="col">ID</th><th scope="col">Date</th><th scope="col">To</th>' +
            '<th scope="col">Subject</th><th scope="col" class="num">Items</th><th scope="col" class="num">Total</th>' +
          "</tr></thead><tbody>" +
          report.memos.slice().sort(util.byNewest("createdAt")).map(m => {
            const total = (m.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
            return "<tr><td>" + util.escapeHtml(m.id) + "</td>" +
              "<td>" + util.formatDate(m.date) + "</td>" +
              "<td>" + util.escapeHtml(m.to) + "</td>" +
              "<td>" + util.escapeHtml(m.subject) + "</td>" +
              '<td class="num">' + (m.items || []).length + "</td>" +
              '<td class="num">' + util.money(total) + "</td></tr>";
          }).join("") +
          "</tbody></table></div>");
      }
    }

    /* --- Inventory table (always current, not date-filtered) --- */
    if (report.content === "all" || report.content === "inventory") {
      parts.push('<div class="report-section"><h3>Inventory (' + report.inventory.length + " items, current position)</h3>" +
        '<table class="report-table"><thead><tr>' +
          '<th scope="col">Item</th><th scope="col">Category</th><th scope="col">SKU</th>' +
          '<th scope="col" class="num">Qty</th><th scope="col" class="num">Reorder</th>' +
          '<th scope="col" class="num">Unit cost</th><th scope="col" class="num">Value</th><th scope="col">Location</th>' +
        "</tr></thead><tbody>" +
        report.inventory.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map(i =>
          "<tr><td>" + util.escapeHtml(i.name) + "</td>" +
          "<td>" + util.escapeHtml(i.category) + "</td>" +
          "<td>" + util.escapeHtml(i.sku || "—") + "</td>" +
          '<td class="num">' + (Number(i.quantity) || 0) + "</td>" +
          '<td class="num">' + (Number(i.reorderLevel) || 0) + "</td>" +
          '<td class="num">' + util.money(i.unitCost) + "</td>" +
          '<td class="num">' + util.money((Number(i.quantity) || 0) * (Number(i.unitCost) || 0)) + "</td>" +
          "<td>" + util.escapeHtml(i.location || "—") + "</td></tr>").join("") +
        "</tbody></table></div>");
    }

    out.innerHTML = parts.join("");
  }

  /* ======================================================================
     EXPORT & PRINT
     ====================================================================== */
  function exportCsv() {
    if (!lastReport) return ui.toast("Load a report first.", "warn");
    const lines = [];

    lines.push("IT Operations Report");
    lines.push(["Period", lastReport.label, lastReport.from, lastReport.to].map(util.csvCell).join(","));
    lines.push(["Prepared by", lastReport.generatedBy, "Generated", lastReport.generatedAt].map(util.csvCell).join(","));
    lines.push("");

    if (lastReport.content === "all" || lastReport.content === "incidents") {
      lines.push("INCIDENTS");
      lines.push(["ID", "Created", "Requester", "Department", "Location", "Category", "Technician",
                  "Status", "Priority", "Time spent", "Description", "Resolution", "Component changed"].map(util.csvCell).join(","));
      lastReport.incidents.forEach(t => lines.push([
        t.id, t.createdAt, t.requester, t.department, t.location, t.category, t.technician,
        t.status, t.priority, t.timeSpent, t.description, t.resolution, t.componentChanged
      ].map(util.csvCell).join(",")));
      lines.push("");
    }

    if (lastReport.content === "all" || lastReport.content === "memos") {
      lines.push("MEMOS");
      lines.push(["ID", "Date", "To", "From", "Subject", "Purpose", "Items", "Total (GHS)"].map(util.csvCell).join(","));
      lastReport.memos.forEach(m => {
        const items = (m.items || []).map(i => i.quantity + " x " + i.name + " @ " + i.unitCost).join("; ");
        const total = (m.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
        lines.push([m.id, m.date, m.to, m.from, m.subject, m.purpose, items, total.toFixed(2)].map(util.csvCell).join(","));
      });
      lines.push("");
    }

    if (lastReport.content === "all" || lastReport.content === "inventory") {
      lines.push("INVENTORY");
      lines.push(["ID", "Name", "Category", "SKU", "Quantity", "Reorder level", "Unit cost", "Value", "Location", "Supplier", "Notes"].map(util.csvCell).join(","));
      lastReport.inventory.forEach(i => lines.push([
        i.id, i.name, i.category, i.sku, i.quantity, i.reorderLevel, i.unitCost,
        ((Number(i.quantity) || 0) * (Number(i.unitCost) || 0)).toFixed(2),
        i.location, i.supplier, i.notes
      ].map(util.csvCell).join(",")));
    }

    util.download("it-report-" + util.todayISO() + ".csv", lines.join("\n"), "text/csv;charset=utf-8");
    ui.toast("CSV downloaded. It opens in Excel and Google Sheets.", "ok");
  }

  function print() {
    if (!lastReport) return ui.toast("Load a report first.", "warn");
    document.body.classList.add("printing-report");
    setTimeout(function () {
      window.print();
      setTimeout(() => document.body.classList.remove("printing-report"), 400);
    }, 120);
  }

  /* ======================================================================
     WIRING
     ====================================================================== */
  function bind() {
    $("reportPeriod").addEventListener("change", syncDates);
    $("loadReportBtn").addEventListener("click", load);
    $("exportReportBtn").addEventListener("click", exportCsv);
    $("printReportBtn").addEventListener("click", print);
  }

  function init() { syncDates(); }

  return { init: init, bind: bind, render: render };

})();

/* ==============================================================================
   SECTION 12 of 13  —  SETTINGS PAGE — password and connection
   (previously the separate file js/11-settings.js)
   ============================================================================== */

/* ==========================================================================
   11-settings.js — Password, backend connection, and queued changes
   ========================================================================== */

window.App = window.App || {};

App.settings = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const api   = App.api;
  const auth  = App.auth;
  const $ = util.$;

  /* ======================================================================
     BACKEND STATUS PANEL
     ====================================================================== */
  function render() {
    const panel = $("backendPanel");
    if (!panel) return;

    const url = store.backendUrl();
    const pending = store.outbox().length;

    if (!url) {
      panel.innerHTML =
        '<div class="status-row"><span class="dot" style="background:var(--warn)"></span>' +
          "<span><strong>This device only.</strong> Records are saved in this browser and are not shared with anyone else.</span></div>" +
        '<div class="status-row"><span class="dot" style="background:var(--ink-faint)"></span>' +
          "<span>No password is used in this mode, because there is no server to check it against.</span></div>" +
        '<div class="status-row"><span class="dot" style="background:var(--ink-faint)"></span>' +
          "<span>Waiting to send: " + pending + "</span></div>";
      $("backendUrlInput").value = "";
      return;
    }

    panel.innerHTML =
      '<div class="status-row"><span class="dot" style="background:var(--ok)"></span>' +
        "<span><strong>Google Sheets connected.</strong> Records are shared with everyone using this sheet.</span></div>" +
      '<div class="status-row"><span class="dot" style="background:var(--info)"></span>' +
        "<span>Server: <code>" + util.escapeHtml(url.replace(/^https?:\/\//, "").slice(0, 46)) + "&hellip;</code></span></div>" +
      '<div class="status-row"><span class="dot" style="background:' + (pending ? "var(--warn)" : "var(--ok)") + '"></span>' +
        "<span>" + (pending
          ? "Waiting to send: <strong>" + pending + "</strong> change(s)"
          : "Everything you have saved has reached the server.") + "</span></div>";

    $("backendUrlInput").value = url;
  }

  /* ======================================================================
     TEST THE CONNECTION
     ====================================================================== */
  async function test() {
    if (store.isLocalMode()) {
      return ui.toast("This app is set to work on this device only, so there is nothing to connect to.", "warn");
    }
    const button = $("testBackendBtn");
    button.disabled = true;
    try {
      const result = await api.requestWithRetry("getAll", {});
      const count = ((result.data && result.data.incidents) || []).length;
      ui.toast("Connected. The server answered and returned " + count + " incident(s).", "ok");
    } catch (err) {
      ui.toast(api.explain(err), "error");
    } finally {
      button.disabled = false;
      render();
    }
  }

  /* ======================================================================
     SAVE A NEW BACKEND URL
     ====================================================================== */
  function saveUrl() {
    const url = $("backendUrlInput").value.trim();
    if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
      return ui.toast("That does not look like an Apps Script Web App URL. It should start with https://script.google.com/macros/s/ and end with /exec", "warn");
    }
    const s = store.state;
    const localCount = store.isLocalMode()
      ? (s.incidents.length + s.memos.length + s.inventory.length) : 0;
    if (url && localCount && !ui.confirmAction(
      "You have " + localCount + " record(s) saved on this device only.\n\n" +
      "Connecting to Google Sheets will ERASE them from this device (they are not uploaded). " +
      "Press Cancel, use the Back up button in the header first, then try again.\n\n" +
      "Continue and erase them?")) return;
    store.setBackendUrl(url);
    ui.toast(url ? "Backend URL saved. Please log in with your password." : "Switched to this device only.", "ok");
    /* Changing where data goes means the old session is no longer meaningful. */
    auth.logout();
    ui.showLogin();
  }

  /* ======================================================================
     SWITCH TO LOCAL MODE
     ====================================================================== */
  function useLocalMode() {
    if (!ui.confirmAction(
      "Switch to this-device-only mode?\n\n" +
      "Records will be saved in this browser only and will NOT be shared with the Google Sheet. " +
      "Anything already on the server stays there.")) return;
    store.setBackendUrl("");
    auth.logout();
    ui.toast("Now working on this device only.", "ok");
    ui.showLogin();
  }

  /* ======================================================================
     SYNC QUEUED CHANGES
     ====================================================================== */
  async function syncNow() {
    const pending = store.outbox().length;
    if (!pending) return ui.toast("There is nothing waiting to be sent.", "info");
    if (store.isLocalMode()) return ui.toast("Nothing to send in this-device-only mode.", "warn");

    const button = $("syncQueueBtn");
    button.disabled = true;
    try {
      const result = await api.syncOutbox();
      if (result.sent) {
        ui.toast(result.sent + " queued change(s) sent.", "ok");
        /* Pull the server's version of everything so ids and totals line up. */
        const data = await api.getAll();
        store.setAll(data);
        App.incidents.render();
        App.memos.render();
        App.inventory.render();
        if (App.dashboard) App.dashboard.render();
      } else {
        ui.toast("Still could not reach the server. Your changes remain saved here.", "warn");
      }
    } catch (err) {
      ui.toast(api.explain(err), "error");
    } finally {
      button.disabled = false;
      render();
      ui.refreshQueueBadge();
    }
  }

  /* ======================================================================
     PASSWORD FORM
     ====================================================================== */
  async function submitPassword(e) {
    e.preventDefault();
    const button = $("savePasswordBtn");
    button.disabled = true;
    try {
      await auth.changePassword(
        $("currentPassword").value,
        $("newPassword").value,
        $("confirmPassword").value
      );
      $("passwordForm").reset();
      ui.toast("Password updated. Use it the next time you log in.", "ok");
    } catch (err) {
      ui.toast(err.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  /* ======================================================================
     WIRING
     ====================================================================== */
  function bind() {
    $("passwordForm").addEventListener("submit", submitPassword);
    $("testBackendBtn").addEventListener("click", test);
    $("saveBackendBtn").addEventListener("click", saveUrl);
    $("localModeBtn").addEventListener("click", useLocalMode);
    $("syncQueueBtn").addEventListener("click", syncNow);
  }

  return { render: render, bind: bind, syncNow: syncNow };

})();

/* ==============================================================================
   SECTION 13 of 13  —  STARTUP — wires everything together (must be last)
   (previously the separate file js/99-boot.js)
   ============================================================================== */

/* ==========================================================================
   99-boot.js — Starting the app
   --------------------------------------------------------------------------
   This is the last file loaded, and it is what actually makes everything
   happen: it fills the login form, restores a previous session, connects
   every button to its function, and starts the clock that retries anything
   waiting to be sent.
   ========================================================================== */

window.App = window.App || {};

App.boot = (function () {

  const util  = App.util;
  const store = App.store;
  const ui    = App.ui;
  const auth  = App.auth;
  const api   = App.api;
  const $ = util.$;

  let retryTimer = null;

  /* ======================================================================
     LOGIN SCREEN
     ====================================================================== */

  /* Fill the "Technician" drop-down from the config list. */
  function fillTechnicianSelect() {
    const select = $("loginTechnician");
    select.innerHTML = '<option value="">Select technician</option>' +
      App.config.technicians
        .map(name => '<option value="' + util.escapeHtml(name) + '">' + util.escapeHtml(name) + "</option>")
        .join("");
  }

  /* In local mode there is no server to check a password, so rather than
     pretending, we hide the password box and say so plainly. */
  function applyModeToLoginForm() {
    const local = store.isLocalMode();
    const passwordField = $("loginPassword").closest(".field");
    const button = $("loginButton");
    const hint = document.querySelector(".login-hint");

    if (local) {
      passwordField.hidden = true;
      $("loginPassword").required = false;
      button.textContent = "Continue";
      hint.innerHTML = "This app is set to work on <strong>this device only</strong>, so no password is needed. " +
        "Connect your Google Sheet in Settings to turn on secure logins.";
    } else {
      passwordField.hidden = false;
      $("loginPassword").required = true;
      button.textContent = "Log in";
      hint.innerHTML = "Signed in on a shared computer? Use <strong>Log out</strong> when you finish " +
        "&mdash; it clears this device completely.";
    }
  }

  /* Adds a "Show" button beside every password box. Most "my password does
     not work" cases are a typo you cannot see, or a stray space added by a
     phone keyboard. Being able to look at what you typed removes both. */
  function bindPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.dataset.toggleReady) return;
      input.dataset.toggleReady = "1";
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("spellcheck", "false");

      const wrap = document.createElement("div");
      wrap.className = "pw-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pw-toggle";
      btn.textContent = "Show";
      btn.setAttribute("aria-label", "Show password");
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        btn.setAttribute("aria-pressed", show ? "true" : "false");
      });
      wrap.appendChild(btn);
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    const technician = $("loginTechnician").value;
    const password = $("loginPassword").value;
    const errorBox = $("loginError");
    const button = $("loginButton");

    errorBox.textContent = "";
    button.disabled = true;
    button.textContent = "Checking\u2026";

    try {
      const result = await auth.login(technician, password);

      /* Pull the data down (unless we are in local mode, which already
         loaded its records from this device). */
      if (!result.localMode) {
        const data = result.data || await api.getAll();
        store.setAll(data);
      }

      ui.showApp();

      /* If the server says this account is still on a starter password, send
         them straight to Settings and say so plainly. An unchanged default
         password is the most likely way this system would ever be broken
         into, so it is worth the small interruption. */
      if (result.mustChangePassword) {
        ui.navigate("settings");
        ui.toast("Your account is still using a starter password. Please change it now \u2014 anyone who has seen the code knows it.", "error");
        const next = document.getElementById("currentPassword");
        if (next) next.focus();
      } else {
        ui.navigate("dashboard");
        ui.toast("Welcome back, " + (result.user || technician) + ".", "ok");
      }

    } catch (err) {
      errorBox.textContent = err.message;
      /* Put the message somewhere the user is definitely looking. */
      errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally {
      button.disabled = false;
      /* Re-apply the correct button label for the current mode. */
      button.textContent = store.isLocalMode() ? "Continue" : "Log in";
    }
  }

  /* ======================================================================
     LOGOUT
     ====================================================================== */
  function handleLogout() {
    const pending = store.outbox().length;

    if (pending && !ui.confirmAction(
      "You have " + pending + " change(s) that have not reached the server yet.\n\n" +
      "If you log out now, those changes will be DELETED from this device and will not be saved anywhere.\n\n" +
      "Log out anyway?")) return;

    auth.logout();
    stopRetryTimer();
    applyModeToLoginForm();
    ui.showLogin();
    ui.toast("You are logged out. Nothing is left on this device.", "ok");
  }

  /* ======================================================================
     LOADING DATA
     ====================================================================== */
  async function refreshFromServer(silent) {
    if (store.isLocalMode()) { store.loadLocalRecords(); return; }
    try {
      const data = await api.getAll();
      store.setAll(data);
      App.incidents.render();
      App.memos.render();
      App.inventory.render();
      if (App.dashboard) App.dashboard.render();
      if (App.settings) App.settings.render();
    } catch (err) {
      if (!silent) ui.toast(api.explain(err), "warn");
    }
  }

  /* ======================================================================
     THE RETRY CLOCK
     Anything queued while offline is retried in the background, so the user
     never has to remember to come back and press a button.
     ====================================================================== */
  function startRetryTimer() {
    stopRetryTimer();
    retryTimer = setInterval(async () => {
      if (store.isLocalMode()) return;
      if (!store.currentUser()) return;
      if (!navigator.onLine) return;
      if (!store.outbox().length) return;

      const result = await api.syncOutbox();
      if (result.sent) {
        ui.toast(result.sent + " saved change(s) reached the server.", "ok");
        await refreshFromServer(true);
      }
    }, App.config.outboxRetryMs);
  }

  function stopRetryTimer() {
    if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  }

  /* ======================================================================
     GLOBAL BUTTONS
     ====================================================================== */
  function bindGlobal() {

    /* -- Navigation -- */
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        ui.navigate(link.getAttribute("data-page"));
      });
    });

    /* Any element with data-goto="page" jumps to that page. Used by the
       "View all" buttons on the dashboard. */
    document.addEventListener("click", function (e) {
      const goto = e.target.closest("[data-goto]");
      if (goto) { ui.navigate(goto.getAttribute("data-goto")); return; }

      const requestBtn = e.target.closest("[data-request-item]");
      if (requestBtn) { App.memos.requestItem(requestBtn.getAttribute("data-request-item")); }

      /* If a menu link is clicked while the mobile menu is open, close it. */
      if (!e.target.closest("#sidebar") && !e.target.closest("#menuToggle")) ui.closeMenu();
    });

    /* -- Header -- */
    $("menuToggle").addEventListener("click", ui.toggleMenu);
    $("scrim").addEventListener("click", ui.closeMenu);

    $("quickIncidentBtn").addEventListener("click", () => {
      ui.navigate("incidents");
      App.incidents.clearForm();
      $("requester").focus();
    });

    $("quickMemoBtn").addEventListener("click", () => {
      ui.navigate("memos");
      App.memos.clearForm();
      $("memoTo").focus();
    });

    $("backupBtn").addEventListener("click", () => {
      const backup = {
        exportedAt: new Date().toISOString(),
        exportedBy: store.currentUser(),
        appVersion: App.config.version,
        incidents: store.state.incidents,
        memos: store.state.memos,
        inventory: store.state.inventory
      };
      util.download("helpdesk-backup-" + util.todayISO() + ".json",
        JSON.stringify(backup, null, 2), "application/json");
      ui.toast("Backup downloaded.", "ok");
    });

    $("logoutBtn").addEventListener("click", handleLogout);

    /* -- Dashboard quick-action tiles -- */
    document.querySelectorAll("[data-action]").forEach(tile => {
      tile.addEventListener("click", function () {
        const action = tile.getAttribute("data-action");
        const category = tile.getAttribute("data-category");

        if (action === "incident") {
          ui.navigate("incidents");
          App.incidents.clearForm();
          if (category) $("category").value = category;
          $("requester").focus();
        } else if (action === "memo") {
          ui.navigate("memos");
          $("memoTo").focus();
        } else if (action === "stock") {
          ui.navigate("inventory");
          $("moveQty").focus();
        } else if (action === "report") {
          ui.navigate("reports");
          $("reportPeriod").value = "thisWeek";
          App.reports.render();
          $("loadReportBtn").focus();
        }
      });
    });

    /* -- Offline / online -- */
    window.addEventListener("online", function () {
      ui.refreshQueueBadge();
      ui.toast("Back online. Sending anything that was waiting.", "info");
      api.syncOutbox().then(result => {
        if (result.sent) refreshFromServer(true);
        ui.refreshQueueBadge();
      });
    });

    window.addEventListener("offline", function () {
      ui.refreshQueueBadge();
      ui.toast("You are offline. You can keep working \u2014 changes are saved on this device.", "warn");
    });

    document.addEventListener("outbox:changed", ui.refreshQueueBadge);
    $("syncNowBtn").addEventListener("click", () => App.settings.syncNow());

    /* -- Warn before closing with unsent work -- */
    window.addEventListener("beforeunload", function (e) {
      if (store.outbox().length) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  /* ======================================================================
     START
     ====================================================================== */
  async function start() {

    /* Bind every module's buttons first, so nothing is ever dead. */
    App.incidents.bind();
    App.memos.bind();
    App.inventory.bind();
    App.reports.bind();
    App.settings.bind();
    bindGlobal();

    App.incidents.init();
    App.memos.init();
    App.inventory.init();
    App.reports.init();

    fillTechnicianSelect();
    applyModeToLoginForm();
    document.addEventListener("login:shown", applyModeToLoginForm);
    $("loginForm").addEventListener("submit", handleLogin);
    bindPasswordToggles();

    /* Were they already logged in? sessionStorage survives a page refresh
       inside the same tab, so a reload should not throw them out. */
    const session = auth.restore();

    if (!session) {
      ui.showLogin();
      registerServiceWorker();
      return;
    }

    ui.showApp();

    if (store.isLocalMode()) {
      store.loadLocalRecords();
      App.incidents.render();
      App.memos.render();
      App.inventory.render();
      App.dashboard.render();
      App.settings.render();
    } else {
      /* Show the shell immediately, then fill it. The app feels instant
         instead of blank-then-populated. */
      App.dashboard.render();
      await refreshFromServer();
    }

    /* Deep links like index.html#inventory */
    const wanted = (location.hash || "").replace("#", "");
    ui.navigate(App.config.pages[wanted] ? wanted : "dashboard");

    startRetryTimer();
    registerServiceWorker();
  }

  /* ======================================================================
     SERVICE WORKER — makes the app work offline and installable
     ====================================================================== */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    /* start() awaits the network before it gets here, so the page's "load"
       event has often ALREADY fired - and a listener added after that never
       runs, which meant offline support silently never installed. */
    const whenLoaded = function (fn) {
      if (document.readyState === "complete") fn();
      else window.addEventListener("load", fn);
    };
    whenLoaded(function () {
      /* service-worker.js is an OPTIONAL file. Without this check, not
         uploading it makes the browser log a 404 error in the console.
         That looks alarming and means nothing, so we look for the file
         first and stay completely silent when it is absent. Leaving an
         optional file out should never look like a fault. */
      fetch("service-worker.js", { method: "HEAD" })
        .then(function (response) {
          if (!response.ok) return;   /* not uploaded — that is fine */
          return navigator.serviceWorker.register("service-worker.js");
        })
        .catch(function () { /* missing or offline. Either way, fine. */ });
    });
  }

  return { start: start };

})();

/* Go. */
document.addEventListener("DOMContentLoaded", function () {
  App.boot.start().catch(function (err) {
    console.error("Startup failed:", err);
    const box = document.getElementById("loginError");
    if (box) box.textContent = "The app failed to start: " + err.message;
  });
});
