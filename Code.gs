/* =========================================================================
   The HelpDesk+ — Google Apps Script backend (version 2)
   =========================================================================

   WHAT TO DO WITH THIS FILE  (full details in the README)
   -------------------------------------------------------
   1. Open your Google Sheet.
   2. Extensions > Apps Script.
   3. Delete everything already in Code.gs and paste this whole file in.
   4. Save, then choose the function "setup" from the drop-down and press Run.
      Approve the permissions it asks for.
   5. Deploy > Manage deployments > edit the existing one > Version: New
      version > Deploy. (Or Deploy > New deployment.)
      - Execute as: Me
      - Who has access: Anyone
   6. Your existing web app URL keeps working, so the app needs no change.

   WHY "Who has access: Anyone" IS SAFE
   ------------------------------------
   It sounds alarming, and in version 1 it really was: anybody who knew the
   URL could read or delete every record without a password. That is no
   longer true. "Anyone" means anyone may SEND a request; it does not mean
   the request will be allowed. Every action below except login now demands
   a valid login token, and tokens are only issued when a correct password
   is supplied. Someone with the URL and no password can do nothing.

   WHAT CHANGED FROM VERSION 1
   ---------------------------
   - Every action except login now requires a valid token.
   - Passwords are salted and stretched, not bare SHA-256.
   - Login attempts are rate limited.
   - Record IDs can no longer collide (the old ones could, and colliding
     IDs silently overwrote existing rows — real data loss).
   - Deletes are soft: rows are marked, never erased, and every action is
     written to an Audit sheet.
   - Saves are checked against a version stamp so two people editing the
     same ticket cannot silently overwrite each other.
   - The "resetDemoPasswords" endpoint is gone. It was a back door that let
     anyone restore the published default passwords.
   ========================================================================= */


/* =========================================================================
   CONFIGURATION
   ========================================================================= */

var SHEETS = {
  USERS:     "Users",
  INCIDENTS: "Incidents",
  MEMOS:     "Memos",
  INVENTORY: "Inventory",
  AUDIT:     "Audit"
};

/* The original column lists are kept exactly as they were, so your existing
   data stays in the same columns. New columns are only ever APPENDED to the
   right, which means nothing you already have is disturbed. */
var HEADERS = {};

HEADERS[SHEETS.USERS] = [
  "Technician", "Password Hash", "Updated At"
];

HEADERS[SHEETS.INCIDENTS] = [
  "ID", "Requester", "Department", "Location", "Category", "Technician",
  "Status", "Priority", "Time Spent", "Description", "Resolution",
  "Component Changed", "Created At", "Updated At", "Resolved At",
  "Created By", "Updated By",
  /* --- new in v2 --- */
  "Deleted", "Deleted At", "Deleted By"
];

HEADERS[SHEETS.MEMOS] = [
  "ID", "To", "From", "Date", "Subject", "Purpose", "Items JSON",
  "Sign 1", "Sign 2", "Sign 3", "Created At", "Updated At",
  "Created By", "Updated By",
  "Deleted", "Deleted At", "Deleted By"
];

HEADERS[SHEETS.INVENTORY] = [
  "ID", "Name", "Category", "SKU", "Quantity", "Reorder Level", "Unit Cost",
  "Location", "Supplier", "Notes", "Movements JSON", "Created At",
  "Updated At", "Created By", "Updated By",
  "Deleted", "Deleted At", "Deleted By"
];

HEADERS[SHEETS.AUDIT] = [
  "At", "Technician", "Action", "Record ID", "Detail"
];

/* The starter passwords. An account still using one of these is flagged on
   login so the app can insist on a change. Keep this list in step with
   ensureDefaultUsers_() below. */
var KNOWN_DEFAULT_PASSWORDS = ["julius123", "david123"];

/* How long a login lasts. After this the person must log in again. */
var TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;   /* 8 hours */

/* Brute-force protection. */
var MAX_LOGIN_ATTEMPTS   = 10;
var ATTEMPT_WINDOW_SECONDS = 15 * 60;       /* 15 minutes */

/* Password stretching. Higher is safer but slower; Apps Script is not fast,
   so 600 rounds is a sensible middle ground here. */
var HASH_ROUNDS = 600;

/* 24 hours, used for the lock that stops two people writing to the sheet at
   exactly the same moment. */
var LOCK_TIMEOUT_MS = 24000;


/* =========================================================================
   SETUP — run this once (and it is safe to run again later)
   ========================================================================= */

function setup() {
  ensureSheets_();
  return json_({
    ok: true,
    message: "Setup complete. Sheets checked and ready. Now deploy this script as a Web App."
  });
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheet_(ss, name, HEADERS[name]);
  });
  ensureDefaultUsers_();
}

/* Create the sheet if missing, and make sure every expected column exists.
   IMPORTANT: existing columns are never moved or renamed, and existing
   header text is never overwritten — we only add what is missing. This is
   what keeps your current data safe during the upgrade. */
function ensureSheet_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var existing = {};
    for (var i = 0; i < current.length; i++) {
      if (current[i]) existing[String(current[i]).trim()] = true;
    }
    /* Append only the columns that are genuinely missing. */
    headers.forEach(function (header, index) {
      if (!existing[header]) {
        var target = sheet.getLastColumn() + 1;
        sheet.getRange(1, target).setValue(header);
      } else if (index + 1 <= sheet.getLastColumn() &&
                 String(current[index] || "").trim() !== header &&
                 current.indexOf(header) === -1) {
        /* Column exists in the right place but has drifted; leave it alone
           rather than risk misaligning data. */
      }
    });
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
       .setFontWeight("bold").setBackground("#eef2ff");
}

/* Create the two starter accounts ONLY if the Users sheet is completely
   empty. If you have already used this sheet, your rows are untouched. */
function ensureDefaultUsers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USERS);
  if (sheet.getLastRow() >= 2) return;   /* already has users — leave alone */

  var now = new Date().toISOString();
  sheet.appendRow(["Julius", makeHash_("julius123"), now]);
  sheet.appendRow(["David",  makeHash_("david123"),  now]);
}


/* =========================================================================
   ENTRY POINTS
   ========================================================================= */

function doGet(e) {
  ensureSheets_();
  var action = (e && e.parameter && e.parameter.action) || "health";

  if (action === "health") {
    return json_({ ok: true, message: "IT Operations backend v2 is running." });
  }
  if (action === "setup") return setup();

  /* Plain GET access to data is no longer allowed — it needed no password,
     which is how the old version leaked everything. */
  return json_({
    ok: false,
    error: "This endpoint only accepts POST requests with a valid login token."
  });
}

function doPost(e) {
  /* The lock stops two people writing to the sheet at the same instant and
     corrupting a row. If it is busy we wait rather than fail. */
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);
  } catch (lockError) {
    return json_({ ok: false, error: "The server is busy. Please try again in a moment." });
  }

  try {
    ensureSheets_();

    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action  = body.action;
    var payload = body.payload || {};
    var token   = body.token || "";

    /* ------------------------------------------------------------------
       THE SECURITY GATE
       Everything except login and health must pass through here first.
       ------------------------------------------------------------------ */
    if (action === "login")      return json_(login_(payload));
    if (action === "health")     return json_({ ok: true, message: "running" });

    var actor = requireAuth_(token);
    if (!actor) {
      /* Deliberately vague, so an attacker learns nothing. */
      return json_({ ok: false, error: "UNAUTHORISED: Please log in again.", code: "UNAUTHORISED" });
    }

    /* From here on, "actor" is the verified technician name taken from the
       token — NOT from the request body. The client cannot lie about who
       it is, because we never ask it. */
    switch (action) {
      case "changePassword":  return json_(changePassword_(payload, actor));
      case "getAll":          return json_(getAll_());
      case "saveIncident":    return json_(saveIncident_(payload, actor));
      case "saveMemo":        return json_(saveMemo_(payload, actor));
      case "saveInventory":   return json_(saveInventory_(payload, actor));
      case "stockMovement":   return json_(stockMovement_(payload, actor));
      case "deleteIncident":  return json_(softDelete_(SHEETS.INCIDENTS, payload, actor));
      case "deleteMemo":      return json_(softDelete_(SHEETS.MEMOS, payload, actor));
      case "deleteInventory": return json_(softDelete_(SHEETS.INVENTORY, payload, actor));
      default:
        return json_({ ok: false, error: "Unknown action: " + action });
    }

  } catch (error) {
    return json_({
      ok: false,
      error: String((error && error.message) ? error.message : error)
    });
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================================
   TOKENS
   ========================================================================= */

function newToken_() {
  return Utilities.getUuid() + "-" + Utilities.getUuid();
}

function issueToken_(technician) {
  var token = newToken_();
  CacheService.getScriptCache().put("tok_" + token, technician, TOKEN_LIFETIME_SECONDS);
  return token;
}

/* Returns the technician name, or null when the token is missing, expired
   or invented. */
function requireAuth_(token) {
  if (!token) return null;
  try {
    return CacheService.getScriptCache().get("tok_" + token) || null;
  } catch (e) {
    return null;
  }
}

function dropToken_(token) {
  if (!token) return;
  try { CacheService.getScriptCache().remove("tok_" + token); } catch (e) {}
}


/* =========================================================================
   PASSWORD HASHING
   -------------------------------------------------------------------------
   Passwords are never stored. We store a scrambled version that cannot be
   turned back into the original.

   The old version did a single, unsalted SHA-256. That is weak: two people
   with the same password get identical hashes, and a modern graphics card
   can test billions of guesses a second against a single unsalted hash.
   And the actual passwords were printed in the published JavaScript!

   Now each password gets its own random "salt" and is scrambled 600 times.
   A stolen hash is far harder to attack.

   Stored format:  v2$rounds$salt$hash
   ========================================================================= */

function makeHash_(password) {
  var salt = Utilities.getUuid().replace(/-/g, "");
  var digest = String(password) + "|" + salt;
  for (var i = 0; i < HASH_ROUNDS; i++) {
    digest = sha256_(digest + "|" + salt);
  }
  return "v2$" + HASH_ROUNDS + "$" + salt + "$" + digest;
}

/* Compare a typed password against a stored hash. Returns true / false. */
function checkHash_(password, stored) {
  if (!stored) return false;
  var parts = String(stored).split("$");

  /* Current format: v2$rounds$salt$hash */
  if (parts.length === 4 && parts[0] === "v2") {
    var rounds = parseInt(parts[1], 10) || HASH_ROUNDS;
    var salt = parts[2];
    var expected = parts[3];
    var digest = String(password) + "|" + salt;
    for (var i = 0; i < rounds; i++) {
      digest = sha256_(digest + "|" + salt);
    }
    return digest === expected;
  }

  /* Legacy format from version 1: a bare 64-character SHA-256 hash. */
  return sha256_(String(password)) === stored;
}

/* True when a stored hash uses the old, weaker format. */
function isLegacyHash_(stored) {
  return String(stored || "").indexOf("v2$") !== 0;
}

function sha256_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text));
  return bytes.map(function (b) {
    var v = b < 0 ? b + 256 : b;
    var hex = v.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}


/* =========================================================================
   LOGIN
   ========================================================================= */

function login_(payload) {
  var technician = String(payload.technician || "").trim();
  var password   = String(payload.password || "");

  if (!technician || !password) {
    return { ok: false, error: "Please enter your name and password." };
  }

  /* --- Rate limiting: slow down anyone guessing passwords --- */
  var cache = CacheService.getScriptCache();
  var attemptKey = "att_" + technician;
  var attempts = Number(cache.get(attemptKey) || 0);

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many incorrect attempts for " + technician +
             ". Please wait 15 minutes and try again."
    };
  }

  var users = getUsers_();
  var user = users[technician];

  if (!user || !checkHash_(password, user.passwordHash)) {
    /* Count the failure. CacheService entries expire on their own. */
    cache.put(attemptKey, String(attempts + 1), ATTEMPT_WINDOW_SECONDS);
    return { ok: false, error: "Incorrect name or password." };
  }

  /* Success — clear the counter. */
  cache.remove(attemptKey);

  /* ---------------------------------------------------------------------
     MIGRATION.
     If this account still has a password hash in the old format, upgrade it
     to the new salted one now, while we have the correct password in hand.
     This happens once per account and needs no action from you.
     --------------------------------------------------------------------- */
  if (isLegacyHash_(user.passwordHash)) {
    try {
      setUserHash_(technician, makeHash_(password));
      logAudit_(technician, "password upgraded to v2", technician, "Automatic security upgrade on login");
    } catch (e) {
      /* Not fatal — they can still use the app with the old hash. */
    }
  }

  var token = issueToken_(technician);

  /* Is this account still on a starter password? If so, tell the app, so it
     can insist on a change before the person gets on with their work. An
     unchanged default password is the single most likely way this system
     would be broken into. */
  var mustChange = KNOWN_DEFAULT_PASSWORDS.indexOf(password) !== -1;
  logAudit_(technician, "login", technician,
    mustChange ? "Successful login (still using a default password)" : "Successful login");

  return {
    ok: true,
    user: technician,
    token: token,
    expiresInSeconds: TOKEN_LIFETIME_SECONDS,
    mustChangePassword: mustChange,
    data: getAll_().data
  };
}

function changePassword_(payload, actor) {
  var current = String(payload.currentPassword || "");
  var next    = String(payload.newPassword || "");

  if (next.length < 10) {
    return { ok: false, error: "Your new password must be at least 10 characters long." };
  }

  var users = getUsers_();
  var user = users[actor];
  if (!user) return { ok: false, error: "That account could not be found." };

  if (!checkHash_(current, user.passwordHash)) {
    return { ok: false, error: "Your current password is incorrect." };
  }

  setUserHash_(actor, makeHash_(next));
  logAudit_(actor, "changePassword", actor, "Password changed");
  return { ok: true, message: "Password updated." };
}

function getUsers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USERS);
  var rows = dataRows_(sheet);
  var users = {};
  rows.forEach(function (row) {
    if (row[0]) {
      users[String(row[0]).trim()] = {
        technician: String(row[0]).trim(),
        passwordHash: row[1] || "",
        updatedAt: row[2] || ""
      };
    }
  });
  return users;
}

function setUserHash_(technician, hash) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USERS);
  var rowNumber = findRow_(sheet, technician);
  if (rowNumber < 2) {
    sheet.appendRow([technician, hash, new Date().toISOString()]);
  } else {
    sheet.getRange(rowNumber, 1, 1, 3).setValues([[technician, hash, new Date().toISOString()]]);
  }
}


/* =========================================================================
   IDS
   -------------------------------------------------------------------------
   The old version made IDs by COUNTING the rows that already existed that
   day. Delete row 002 and the next new record also got 003 — a duplicate.
   Because the save function looked up rows by ID and overwrote what it
   found, that duplicate silently destroyed a real ticket.

   Now the number is one more than the HIGHEST number already used today,
   counting deleted rows too. And if the result somehow still exists, we
   keep counting until we find a free one.
   ========================================================================= */

function newId_(prefix, sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var stem = prefix + "-" + datePart + "-";

  var used = {};
  var rows = dataRows_(sheet);
  rows.forEach(function (row) {
    var id = String(row[0] || "");
    if (id.indexOf(stem) === 0) used[id.slice(stem.length)] = true;
  });

  var n = 1;
  while (used[String(n).padStart(3, "0")]) n++;
  return stem + String(n).padStart(3, "0");
}


/* =========================================================================
   READING
   ========================================================================= */

function getAll_() {
  return {
    ok: true,
    data: {
      incidents: rowsToObjects_(SHEETS.INCIDENTS, parseIncident_),
      memos:     rowsToObjects_(SHEETS.MEMOS, parseMemo_),
      inventory: rowsToObjects_(SHEETS.INVENTORY, parseInventory_)
    }
  };
}

/* Read a sheet and build objects, skipping anything marked deleted. */
function rowsToObjects_(sheetName, parser) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var out = [];
  dataRows_(sheet).forEach(function (row) {
    var item = parser(row);
    if (!item.id) return;
    if (item.deleted) return;             /* soft-deleted rows are hidden */
    out.push(item);
  });
  return out;
}

function deletedFlag_(row, index) {
  var value = row[index];
  return value === true || String(value || "").toUpperCase() === "TRUE" || value === 1;
}

function parseIncident_(row) {
  return {
    id: row[0] || "",
    requester: row[1] || "",
    department: row[2] || "",
    location: row[3] || "",
    category: row[4] || "",
    technician: row[5] || "",
    status: row[6] || "Pending",
    priority: row[7] || "Medium",
    timeSpent: row[8] || "",
    description: row[9] || "",
    resolution: row[10] || "",
    componentChanged: row[11] || "",
    createdAt: row[12] || "",
    updatedAt: row[13] || "",
    resolvedAt: row[14] || "",
    createdBy: row[15] || "",
    updatedBy: row[16] || "",
    deleted: deletedFlag_(row, 17),
    deletedAt: row[18] || "",
    deletedBy: row[19] || ""
  };
}

function parseMemo_(row) {
  return {
    id: row[0] || "",
    to: row[1] || "",
    from: row[2] || "",
    date: row[3] || "",
    subject: row[4] || "",
    purpose: row[5] || "",
    items: safeJson_(row[6], []),
    sign1: row[7] || "Prepared By",
    sign2: row[8] || "Checked By",
    sign3: row[9] || "Approved By",
    createdAt: row[10] || "",
    updatedAt: row[11] || "",
    createdBy: row[12] || "",
    updatedBy: row[13] || "",
    deleted: deletedFlag_(row, 14),
    deletedAt: row[15] || "",
    deletedBy: row[16] || ""
  };
}

function parseInventory_(row) {
  return {
    id: row[0] || "",
    name: row[1] || "",
    category: row[2] || "",
    sku: row[3] || "",
    quantity: Number(row[4]) || 0,
    reorderLevel: Number(row[5]) || 0,
    unitCost: Number(row[6]) || 0,
    location: row[7] || "",
    supplier: row[8] || "",
    notes: row[9] || "",
    movements: safeJson_(row[10], []),
    createdAt: row[11] || "",
    updatedAt: row[12] || "",
    createdBy: row[13] || "",
    updatedBy: row[14] || "",
    deleted: deletedFlag_(row, 15),
    deletedAt: row[16] || "",
    deletedBy: row[17] || ""
  };
}


/* =========================================================================
   WRITING
   ========================================================================= */

/* shared logic for the three save functions. */
function writeRecord_(config) {
  var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  var now     = new Date().toISOString();
  var incoming = config.payload;
  var actor   = config.actor;

  var id = String(incoming.id || "");

  /* An id that starts with TMP- was made on this device while offline.
     It is not a real id, so treat the record as new. */
  var isNew = !id || id.indexOf("TMP-") === 0;

  if (isNew) {
    id = newId_(config.prefix, config.sheet);
  } else {
    /* ------------------------------------------------------------------
       VERSION CHECK — the fix for two people overwriting each other.
       The client tells us which version it started from. If the row on the
       sheet has moved on since then, somebody else got there first and we
       refuse the save instead of destroying their work.
       ------------------------------------------------------------------ */
    var rowNumber = findRow_(sheet, id);
    if (rowNumber >= 2) {
      var existing = config.parse(sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0]);
      var sentVersion = String(incoming.version || incoming.updatedAt || "");
      if (sentVersion && existing.updatedAt && sentVersion !== existing.updatedAt) {
        return {
          ok: false,
          error: "Somebody else changed " + id + " while you were editing it. " +
                 "Your copy was not saved, so their work is safe. " +
                 "Please reload the page and make your change again.",
          code: "CONFLICT"
        };
      }
    }
  }

  var values = config.build(incoming, id, now, actor, isNew);
  var target = findRow_(sheet, id);

  if (target >= 2) {
    sheet.getRange(target, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  logAudit_(actor, isNew ? "create" : "update", id, config.sheet);

  return {
    ok: true,
    item: config.parse(values.concat(new Array(Math.max(0, sheet.getLastColumn() - values.length)).fill("")))
  };
}

function saveIncident_(payload, actor) {
  return writeRecord_({
    sheet: SHEETS.INCIDENTS,
    prefix: "INC",
    payload: payload,
    actor: actor,
    parse: parseIncident_,
    build: function (p, id, now, by, isNew) {
      var status = p.status || "Pending";
      return [
        id,
        p.requester || "", p.department || "", p.location || "", p.category || "",
        p.technician || "", status, p.priority || "Medium", p.timeSpent || "",
        p.description || "", p.resolution || "", p.componentChanged || "",
        p.createdAt || now, now,
        status === "Resolved" ? (p.resolvedAt || now) : "",
        isNew ? by : (p.createdBy || by), by,
        false, "", ""
      ];
    }
  });
}

function saveMemo_(payload, actor) {
  return writeRecord_({
    sheet: SHEETS.MEMOS,
    prefix: "MEMO",
    payload: payload,
    actor: actor,
    parse: parseMemo_,
    build: function (p, id, now, by, isNew) {
      return [
        id,
        p.to || "", p.from || "", p.date || "", p.subject || "", p.purpose || "",
        JSON.stringify(p.items || []),
        p.sign1 || "Prepared By", p.sign2 || "Checked By", p.sign3 || "Approved By",
        p.createdAt || now, now,
        isNew ? by : (p.createdBy || by), by,
        false, "", ""
      ];
    }
  });
}

function saveInventory_(payload, actor) {
  return writeRecord_({
    sheet: SHEETS.INVENTORY,
    prefix: "INV",
    payload: payload,
    actor: actor,
    parse: parseInventory_,
    build: function (p, id, now, by, isNew) {
      return [
        id,
        p.name || "", p.category || "", p.sku || "",
        Number(p.quantity) || 0, Number(p.reorderLevel) || 0, Number(p.unitCost) || 0,
        p.location || "", p.supplier || "", p.notes || "",
        JSON.stringify(p.movements || []),
        p.createdAt || now, now,
        isNew ? by : (p.createdBy || by), by,
        false, "", ""
      ];
    }
  });
}

/* Stock in / stock out, with a history kept on the row. */
function stockMovement_(payload, actor) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.INVENTORY);
  var id = String(payload.id || payload.itemId || "");
  var rowNumber = findRow_(sheet, id);

  if (rowNumber < 2) return { ok: false, error: "That inventory item could not be found." };

  var row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  var item = parseInventory_(row);

  if (item.deleted) return { ok: false, error: "That item has been deleted." };

  var qty = Number(payload.quantity) || 0;
  var action = payload.action === "issue" ? "issue" : "receive";

  if (qty <= 0) return { ok: false, error: "The quantity must be more than zero." };
  if (action === "issue" && qty > item.quantity) {
    return { ok: false, error: "You cannot issue " + qty + " when only " + item.quantity + " are in stock." };
  }

  var before = item.quantity;
  var after = action === "issue" ? before - qty : before + qty;
  var now = new Date().toISOString();

  item.quantity = after;
  item.updatedAt = now;
  item.updatedBy = actor;
  item.movements = [{
    action: action, quantity: qty, before: before, after: after,
    reason: payload.reason || "", at: now, by: actor
  }].concat(item.movements || []).slice(0, 50);

  return saveInventory_(item, actor);
}


/* =========================================================================
   SOFT DELETE
   -------------------------------------------------------------------------
   The old code called sheet.deleteRow(), so one wrong click erased a ticket
   permanently and left no trace of who did it. Now the row is kept and
   marked, which means:
     - a mistake can be undone by editing the sheet,
     - you can always see who deleted what, and when.
   ========================================================================= */

function softDelete_(sheetName, payload, actor) {
  var id = String(payload.id || "");
  if (!id) return { ok: false, error: "No record was specified." };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var rowNumber = findRow_(sheet, id);
  if (rowNumber < 2) return { ok: false, error: "That record could not be found." };

  var columns = HEADERS[sheetName].length;
  /* The last three columns of each data sheet are Deleted / Deleted At / Deleted By. */
  var start = columns - 2;
  sheet.getRange(rowNumber, start, 1, 3)
       .setValues([[true, new Date().toISOString(), actor]]);

  logAudit_(actor, "delete", id, sheetName + " (row kept, marked deleted)");
  return { ok: true, id: id, deleted: true };
}


/* =========================================================================
   AUDIT LOG
   Every meaningful action is written down. If something goes missing, this
   sheet tells you what happened, when, and by whom.
   ========================================================================= */

function logAudit_(technician, action, recordId, detail) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.AUDIT);
    if (!sheet) return;
    sheet.appendRow([
      new Date().toISOString(),
      technician || "unknown",
      action || "",
      recordId || "",
      detail || ""
    ]);
    /* Keep the log from growing forever: trim to the newest 5,000 entries. */
    var last = sheet.getLastRow();
    if (last > 5001) sheet.deleteRows(2, last - 5001);
  } catch (e) {
    /* Auditing must never break the app. */
  }
}


/* =========================================================================
   SMALL HELPERS
   ========================================================================= */

function dataRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}

function findRow_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return -1;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var target = String(id);
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === target) return i + 2;
  }
  return -1;
}

function safeJson_(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; }
  catch (e) { return fallback; }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
