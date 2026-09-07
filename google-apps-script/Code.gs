/*
  Google Apps Script backend for the IT Operations System.

  How to use:
  1. Create a Google Sheet.
  2. Open Extensions > Apps Script.
  3. Paste this whole file into Code.gs.
  4. Save, run setup(), and authorize.
  5. Deploy as a Web App:
     - Execute as: Me
     - Who has access: Anyone
  6. Copy the /exec Web App URL into the frontend.
*/

var SHEET_NAMES = {
  USERS: "Users",
  INCIDENTS: "Incidents",
  MEMOS: "Memos",
  INVENTORY: "Inventory"
};

var HEADERS = {};
HEADERS[SHEET_NAMES.USERS] = [
  "Technician",
  "Password Hash",
  "Updated At"
];
HEADERS[SHEET_NAMES.INCIDENTS] = [
  "ID",
  "Requester",
  "Department",
  "Location",
  "Category",
  "Technician",
  "Status",
  "Priority",
  "Time Spent",
  "Description",
  "Resolution",
  "Component Changed",
  "Created At",
  "Updated At",
  "Resolved At",
  "Created By",
  "Updated By"
];
HEADERS[SHEET_NAMES.MEMOS] = [
  "ID",
  "To",
  "From",
  "Date",
  "Subject",
  "Purpose",
  "Items JSON",
  "Sign 1",
  "Sign 2",
  "Sign 3",
  "Created At",
  "Updated At",
  "Created By",
  "Updated By"
];
HEADERS[SHEET_NAMES.INVENTORY] = [
  "ID",
  "Name",
  "Category",
  "SKU",
  "Quantity",
  "Reorder Level",
  "Unit Cost",
  "Location",
  "Supplier",
  "Notes",
  "Movements JSON",
  "Created At",
  "Updated At",
  "Created By",
  "Updated By"
];

var DEFAULT_USERS = {
  Julius: "julius123",
  David: "david123"
};

function setup() {
  ensureSheets_();
  return json_({ ok: true, message: "Google Sheets backend setup complete." });
}

function doGet(e) {
  ensureSheets_();
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : "health";

  if (action === "health") {
    return json_({ ok: true, message: "IT Operations backend is running." });
  }

  if (action === "setup") {
    return setup();
  }

  if (action === "getAll") {
    return json_(getAll_());
  }

  return json_({ ok: false, error: "Unknown GET action: " + action });
}

function doPost(e) {
  try {
    ensureSheets_();

    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    var action = body.action;
    var payload = body.payload || {};

    switch (action) {
      case "login":
        return json_(login_(payload));
      case "changePassword":
        return json_(changePassword_(payload));
      case "resetDemoPasswords":
        return json_(resetDemoPasswords_());
      case "getAll":
        return json_(getAll_());
      case "saveIncident":
        return json_(saveIncident_(payload));
      case "deleteIncident":
        return json_(deleteById_(SHEET_NAMES.INCIDENTS, payload.id));
      case "saveMemo":
        return json_(saveMemo_(payload));
      case "deleteMemo":
        return json_(deleteById_(SHEET_NAMES.MEMOS, payload.id));
      case "saveInventory":
        return json_(saveInventory_(payload));
      case "deleteInventory":
        return json_(deleteById_(SHEET_NAMES.INVENTORY, payload.id));
      case "stockMovement":
        return json_(stockMovement_(payload));
      default:
        return json_({ ok: false, error: "Unknown action: " + action });
    }
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NAMES.USERS, HEADERS[SHEET_NAMES.USERS]);
  ensureSheet_(ss, SHEET_NAMES.INCIDENTS, HEADERS[SHEET_NAMES.INCIDENTS]);
  ensureSheet_(ss, SHEET_NAMES.MEMOS, HEADERS[SHEET_NAMES.MEMOS]);
  ensureSheet_(ss, SHEET_NAMES.INVENTORY, HEADERS[SHEET_NAMES.INVENTORY]);
  ensureDefaultUsers_();
}

function ensureSheet_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    var needsHeader = currentHeaders[0] !== headers[0];
    if (needsHeader) {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#eef2ff");
  sheet.autoResizeColumns(1, headers.length);
}

function ensureDefaultUsers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  var existingUsers = getUsers_();
  var now = isoNow_();

  Object.keys(DEFAULT_USERS).forEach(function (name) {
    if (!existingUsers[name]) {
      sheet.appendRow([name, hashPassword_(DEFAULT_USERS[name]), now]);
    }
  });
}

function getUsers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  var values = getDataRows_(sheet);
  var users = {};

  values.forEach(function (row) {
    if (row[0]) {
      users[row[0]] = {
        technician: row[0],
        passwordHash: row[1],
        updatedAt: row[2]
      };
    }
  });

  return users;
}

function login_(payload) {
  var technician = String(payload.technician || "").trim();
  var password = String(payload.password || "");
  var users = getUsers_();

  if (!users[technician] || users[technician].passwordHash !== hashPassword_(password)) {
    return { ok: false, error: "Invalid login details." };
  }

  return {
    ok: true,
    user: technician,
    data: getAll_().data
  };
}

function changePassword_(payload) {
  var technician = String(payload.technician || "").trim();
  var currentPassword = String(payload.currentPassword || "");
  var newPassword = String(payload.newPassword || "");

  if (!technician || !newPassword) {
    return { ok: false, error: "Technician and new password are required." };
  }

  if (newPassword.length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  var rowNumber = findRowByFirstColumn_(sheet, technician);

  if (rowNumber < 2) {
    return { ok: false, error: "Technician not found." };
  }

  var currentHash = sheet.getRange(rowNumber, 2).getValue();
  if (currentHash !== hashPassword_(currentPassword)) {
    return { ok: false, error: "Current password is incorrect." };
  }

  sheet.getRange(rowNumber, 2, 1, 2).setValues([[hashPassword_(newPassword), isoNow_()]]);
  return { ok: true, message: "Password updated." };
}

function resetDemoPasswords_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.USERS);
  var now = isoNow_();

  Object.keys(DEFAULT_USERS).forEach(function (name) {
    var rowNumber = findRowByFirstColumn_(sheet, name);
    var row = [name, hashPassword_(DEFAULT_USERS[name]), now];
    if (rowNumber >= 2) {
      sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  });

  return { ok: true, message: "Demo passwords restored." };
}

function getAll_() {
  return {
    ok: true,
    data: {
      incidents: getIncidents_(),
      memos: getMemos_(),
      inventory: getInventory_()
    }
  };
}

function getIncidents_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INCIDENTS);
  return getDataRows_(sheet).map(function (row) {
    return parseIncidentRow_(row);
  }).filter(function (item) {
    return item.id;
  });
}

function parseIncidentRow_(row) {
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
    updatedBy: row[16] || ""
  };
}

function saveIncident_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INCIDENTS);
  var now = isoNow_();
  var id = payload.id || newId_("INC", SHEET_NAMES.INCIDENTS);
  var rowNumber = findRowByFirstColumn_(sheet, id);
  var existing = rowNumber >= 2 ? parseIncidentRow_(sheet.getRange(rowNumber, 1, 1, HEADERS[SHEET_NAMES.INCIDENTS].length).getValues()[0]) : null;
  var status = payload.status || "Pending";

  var row = [
    id,
    payload.requester || "",
    payload.department || "",
    payload.location || "",
    payload.category || "",
    payload.technician || "",
    status,
    payload.priority || "Medium",
    payload.timeSpent || "",
    payload.description || "",
    payload.resolution || "",
    payload.componentChanged || "",
    payload.createdAt || (existing && existing.createdAt) || now,
    now,
    status === "Resolved" ? (payload.resolvedAt || (existing && existing.resolvedAt) || now) : "",
    payload.createdBy || (existing && existing.createdBy) || payload.updatedBy || "",
    payload.updatedBy || ""
  ];

  if (rowNumber >= 2) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { ok: true, item: parseIncidentRow_(row) };
}

function getMemos_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.MEMOS);
  return getDataRows_(sheet).map(function (row) {
    return parseMemoRow_(row);
  }).filter(function (item) {
    return item.id;
  });
}

function parseMemoRow_(row) {
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
    updatedBy: row[13] || ""
  };
}

function saveMemo_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.MEMOS);
  var now = isoNow_();
  var id = payload.id || newId_("MEMO", SHEET_NAMES.MEMOS);
  var rowNumber = findRowByFirstColumn_(sheet, id);
  var existing = rowNumber >= 2 ? parseMemoRow_(sheet.getRange(rowNumber, 1, 1, HEADERS[SHEET_NAMES.MEMOS].length).getValues()[0]) : null;

  var row = [
    id,
    payload.to || "",
    payload.from || "",
    payload.date || "",
    payload.subject || "",
    payload.purpose || "",
    JSON.stringify(payload.items || []),
    payload.sign1 || "Prepared By",
    payload.sign2 || "Checked By",
    payload.sign3 || "Approved By",
    payload.createdAt || (existing && existing.createdAt) || now,
    now,
    payload.createdBy || (existing && existing.createdBy) || payload.updatedBy || "",
    payload.updatedBy || ""
  ];

  if (rowNumber >= 2) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { ok: true, item: parseMemoRow_(row) };
}

function getInventory_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INVENTORY);
  return getDataRows_(sheet).map(function (row) {
    return parseInventoryRow_(row);
  }).filter(function (item) {
    return item.id;
  });
}

function parseInventoryRow_(row) {
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
    updatedBy: row[14] || ""
  };
}

function saveInventory_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INVENTORY);
  var now = isoNow_();
  var id = payload.id || newId_("INV", SHEET_NAMES.INVENTORY);
  var rowNumber = findRowByFirstColumn_(sheet, id);
  var existing = rowNumber >= 2 ? parseInventoryRow_(sheet.getRange(rowNumber, 1, 1, HEADERS[SHEET_NAMES.INVENTORY].length).getValues()[0]) : null;

  var row = [
    id,
    payload.name || "",
    payload.category || "",
    payload.sku || "",
    Number(payload.quantity) || 0,
    Number(payload.reorderLevel) || 0,
    Number(payload.unitCost) || 0,
    payload.location || "",
    payload.supplier || "",
    payload.notes || "",
    JSON.stringify(payload.movements || (existing && existing.movements) || []),
    payload.createdAt || (existing && existing.createdAt) || now,
    now,
    payload.createdBy || (existing && existing.createdBy) || payload.updatedBy || "",
    payload.updatedBy || ""
  ];

  if (rowNumber >= 2) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { ok: true, item: parseInventoryRow_(row) };
}

function stockMovement_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.INVENTORY);
  var id = payload.id || payload.itemId;
  var rowNumber = findRowByFirstColumn_(sheet, id);

  if (rowNumber < 2) {
    return { ok: false, error: "Inventory item not found." };
  }

  var row = sheet.getRange(rowNumber, 1, 1, HEADERS[SHEET_NAMES.INVENTORY].length).getValues()[0];
  var item = parseInventoryRow_(row);
  var qty = Number(payload.quantity) || 0;
  var action = payload.action || "receive";

  if (qty <= 0) {
    return { ok: false, error: "Quantity must be greater than zero." };
  }

  if (action === "issue" && qty > item.quantity) {
    return { ok: false, error: "Cannot issue more than available quantity." };
  }

  var oldQty = item.quantity;
  item.quantity = action === "issue" ? item.quantity - qty : item.quantity + qty;
  item.updatedAt = isoNow_();
  item.updatedBy = payload.updatedBy || payload.by || "";
  item.movements.unshift({
    action: action,
    quantity: qty,
    oldQty: oldQty,
    newQty: item.quantity,
    reason: payload.reason || "",
    date: item.updatedAt,
    by: item.updatedBy
  });

  var updated = saveInventory_(item);
  return { ok: true, item: updated.item };
}

function deleteById_(sheetName, id) {
  if (!id) {
    return { ok: false, error: "ID is required." };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var rowNumber = findRowByFirstColumn_(sheet, id);

  if (rowNumber < 2) {
    return { ok: false, error: "Record not found." };
  }

  sheet.deleteRow(rowNumber);
  return { ok: true, id: id };
}

function getDataRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();

  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
}

function findRowByFirstColumn_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) {
    return -1;
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      return i + 2;
    }
  }

  return -1;
}

function newId_(prefix, sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  var count = 0;

  if (sheet.getLastRow() >= 2) {
    var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    ids.forEach(function (row) {
      if (String(row[0] || "").indexOf(prefix + "-" + datePart) === 0) {
        count++;
      }
    });
  }

  return prefix + "-" + datePart + "-" + String(count + 1).padStart(3, "0");
}

function isoNow_() {
  return new Date().toISOString();
}

function safeJson_(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function hashPassword_(password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password));
  return bytes.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    var hex = value.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
