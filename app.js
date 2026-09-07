const STORAGE_KEYS = {
  incidents: "itOps.incidents.v1",
  memos: "itOps.memos.v1",
  inventory: "itOps.inventory.v1",
  passwords: "itIncidentDesk.passwords.v1",
  session: "itIncidentDesk.activeUser",
  backendUrl: "itOps.googleAppsScriptUrl.v1"
};

const LEGACY_INCIDENT_KEYS = ["itIncidentTickets.v2", "itIncidentTickets.v1"];
const DEFAULT_BACKEND_URL = "https://script.google.com/macros/s/AKfycbxmnsg4tF8l4Ios7fBxc5r_69cXVfhWtMmF72C5nH2CKLLjfejJg0NRlwaK9EJYpJQo/exec";
const LOCAL_MODE_VALUE = "__LOCAL_MODE__";

// Frontend-only demo login. These can be changed from Settings and are stored in this browser.
const DEFAULT_PASSWORDS = {
  Julius: "julius123",
  David: "david123"
};

const TECHNICIANS = Object.keys(DEFAULT_PASSWORDS);
const INCIDENT_CATEGORIES = [
  "Internet / Network",
  "Computer Component",
  "Call Center Phone",
  "Software / Application",
  "Printer / Scanner",
  "Other"
];

const STATUS_COLORS = {
  Pending: "#f5a524",
  "In Progress": "#5348f5",
  Resolved: "#21b574"
};

// Login elements
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const loginTechnician = document.getElementById("loginTechnician");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginLoader = document.getElementById("loginLoader");
const loginError = document.getElementById("loginError");
const activeUserName = document.getElementById("activeUserName");
const topbarTitle = document.querySelector(".topbar h1");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");

// Top actions
const newIncidentBtn = document.getElementById("newIncidentBtn");
const newMemoBtn = document.getElementById("newMemoBtn");
const backupDataBtn = document.getElementById("backupDataBtn");

// Dashboard elements
const openIncidentCount = document.getElementById("openIncidentCount");
const resolvedCount = document.getElementById("resolvedCount");
const memoCount = document.getElementById("memoCount");
const inventoryCount = document.getElementById("inventoryCount");
const lowStockCount = document.getElementById("lowStockCount");
const stockValue = document.getElementById("stockValue");
const recentIncidents = document.getElementById("recentIncidents");
const lowStockPanel = document.getElementById("lowStockPanel");
const categoryChart = document.getElementById("categoryChart");
const statusDonut = document.getElementById("statusDonut");
const donutValue = document.getElementById("donutValue");
const statusLegend = document.getElementById("statusLegend");
const techLoad = document.getElementById("techLoad");
const quickIncidentCards = document.querySelectorAll("[data-quick-incident]");
const quickMemoButton = document.querySelector("[data-quick-memo]");

// Incident elements
const incidentForm = document.getElementById("incidentForm");
const incidentIdInput = document.getElementById("incidentId");
const incidentBadge = document.getElementById("incidentBadge");
const saveIncidentBtn = document.getElementById("saveIncidentBtn");
const resetIncidentBtn = document.getElementById("resetIncidentBtn");
const deleteIncidentBtn = document.getElementById("deleteIncidentBtn");
const incidentSearchInput = document.getElementById("incidentSearchInput");
const incidentStatusFilter = document.getElementById("incidentStatusFilter");
const incidentList = document.getElementById("incidentList");
const incidentSampleBtn = document.getElementById("incidentSampleBtn");

// Memo elements
const memoForm = document.getElementById("memoForm");
const memoIdInput = document.getElementById("memoId");
const memoBadge = document.getElementById("memoBadge");
const memoTo = document.getElementById("memoTo");
const memoFrom = document.getElementById("memoFrom");
const memoDate = document.getElementById("memoDate");
const memoSubject = document.getElementById("memoSubject");
const memoPurpose = document.getElementById("memoPurpose");
const memoItemsBody = document.getElementById("memoItemsBody");
const memoFormTotal = document.getElementById("memoFormTotal");
const addMemoItemBtn = document.getElementById("addMemoItemBtn");
const clearMemoBtn = document.getElementById("clearMemoBtn");
const deleteMemoBtn = document.getElementById("deleteMemoBtn");
const printMemoBtn = document.getElementById("printMemoBtn");
const memoPreview = document.getElementById("memoPreview");
const sampleMemoBtn = document.getElementById("sampleMemoBtn");
const memoSearchInput = document.getElementById("memoSearchInput");
const memoList = document.getElementById("memoList");

// Inventory elements
const inventoryForm = document.getElementById("inventoryForm");
const inventoryBadge = document.getElementById("inventoryBadge");
const inventoryIdInput = document.getElementById("inventoryId");
const saveInventoryBtn = document.getElementById("saveInventoryBtn");
const resetInventoryBtn = document.getElementById("resetInventoryBtn");
const deleteInventoryBtn = document.getElementById("deleteInventoryBtn");
const stockMovementForm = document.getElementById("stockMovementForm");
const stockItem = document.getElementById("stockItem");
const stockAction = document.getElementById("stockAction");
const stockQuantity = document.getElementById("stockQuantity");
const stockReason = document.getElementById("stockReason");
const inventorySearchInput = document.getElementById("inventorySearchInput");
const inventoryTableBody = document.getElementById("inventoryTableBody");
const inventorySampleBtn = document.getElementById("inventorySampleBtn");

// Backend/settings elements
const backendForm = document.getElementById("backendForm");
const backendUrlInput = document.getElementById("backendUrlInput");
const backendStatusBadge = document.getElementById("backendStatusBadge");
const backendHelp = document.getElementById("backendHelp");
const syncNowBtn = document.getElementById("syncNowBtn");
const useLocalModeBtn = document.getElementById("useLocalModeBtn");

// Settings elements
const passwordForm = document.getElementById("passwordForm");
const passwordUser = document.getElementById("passwordUser");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const resetPasswordsBtn = document.getElementById("resetPasswordsBtn");
const toast = document.getElementById("toast");

let activeUser = sessionStorage.getItem(STORAGE_KEYS.session) || "";
const storedBackendUrl = localStorage.getItem(STORAGE_KEYS.backendUrl);
let backendUrl = storedBackendUrl === LOCAL_MODE_VALUE ? "" : storedBackendUrl || DEFAULT_BACKEND_URL;
let userPasswords = loadUserPasswords();
let incidents = loadIncidents();
let memos = readStorage(STORAGE_KEYS.memos, []).map(normalizeMemo);
let inventory = readStorage(STORAGE_KEYS.inventory, []).map(normalizeInventoryItem);
let editingIncidentId = "";
let editingMemoId = "";
let editingInventoryId = "";

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Could not read ${key}`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadUserPasswords() {
  const saved = readStorage(STORAGE_KEYS.passwords, {});
  return { ...DEFAULT_PASSWORDS, ...saved };
}

function saveUserPasswords() {
  writeStorage(STORAGE_KEYS.passwords, userPasswords);
}

function resetUserPasswords() {
  userPasswords = { ...DEFAULT_PASSWORDS };
  saveUserPasswords();
}

function loadIncidents() {
  const current = readStorage(STORAGE_KEYS.incidents, []);
  if (current.length) return current.map(normalizeIncident);

  for (const key of LEGACY_INCIDENT_KEYS) {
    const legacy = readStorage(key, []);
    if (legacy.length) {
      const migrated = legacy.map(normalizeIncident);
      writeStorage(STORAGE_KEYS.incidents, migrated);
      return migrated;
    }
  }

  return [];
}

function saveIncidents() {
  writeStorage(STORAGE_KEYS.incidents, incidents);
}

function saveMemos() {
  writeStorage(STORAGE_KEYS.memos, memos);
}

function saveInventory() {
  writeStorage(STORAGE_KEYS.inventory, inventory);
}

function normalizeIncident(ticket) {
  const createdAt = ticket.createdAt || new Date().toISOString();
  const status = normalizeStatus(ticket.status);
  const technician = TECHNICIANS.includes(ticket.technician)
    ? ticket.technician
    : TECHNICIANS.includes(ticket.assignedTo)
      ? ticket.assignedTo
      : TECHNICIANS.includes(ticket.resolvedBy)
        ? ticket.resolvedBy
        : "";

  return {
    id: ticket.id || `INC-${Date.now()}`,
    requester: ticket.requester || "",
    department: ticket.department || "",
    location: ticket.location || "",
    category: normalizeIncidentCategory(ticket.category),
    technician,
    status,
    priority: ticket.priority || "Medium",
    timeSpent: ticket.timeSpent || "",
    description: ticket.description || ticket.summary || "",
    resolution: ticket.resolution || ticket.resolutionNotes || "",
    componentChanged: ticket.componentChanged || "",
    createdAt,
    updatedAt: ticket.updatedAt || createdAt,
    resolvedAt: status === "Resolved" ? ticket.resolvedAt || ticket.updatedAt || createdAt : "",
    createdBy: ticket.createdBy || technician || "",
    updatedBy: ticket.updatedBy || technician || ""
  };
}

function normalizeMemo(memo) {
  const createdAt = memo.createdAt || new Date().toISOString();
  return {
    id: memo.id || `MEMO-${Date.now()}`,
    to: memo.to || "",
    from: memo.from || "",
    date: normalizeDateValue(memo.date),
    subject: memo.subject || "PC COMPONENTS PURCHASE",
    purpose: memo.purpose || "",
    items: Array.isArray(memo.items) ? memo.items.map(normalizeMemoItem) : [],
    sign1: memo.sign1 || "Prepared By",
    sign2: memo.sign2 || "Checked By",
    sign3: memo.sign3 || "Approved By",
    createdAt,
    updatedAt: memo.updatedAt || createdAt,
    createdBy: memo.createdBy || "",
    updatedBy: memo.updatedBy || ""
  };
}

function normalizeMemoItem(item) {
  const quantity = Number(item.quantity) || 0;
  const unitCost = Number(item.unitCost) || 0;
  return {
    name: item.name || item.item || "",
    quantity,
    unitCost
  };
}

function normalizeInventoryItem(item) {
  const createdAt = item.createdAt || new Date().toISOString();
  return {
    id: item.id || `INV-${Date.now()}`,
    name: item.name || "",
    category: item.category || "Other",
    sku: item.sku || "",
    quantity: Number(item.quantity) || 0,
    reorderLevel: Number(item.reorderLevel) || 0,
    unitCost: Number(item.unitCost) || 0,
    location: item.location || "",
    supplier: item.supplier || "",
    notes: item.notes || "",
    movements: Array.isArray(item.movements) ? item.movements : [],
    createdAt,
    updatedAt: item.updatedAt || createdAt,
    createdBy: item.createdBy || "",
    updatedBy: item.updatedBy || ""
  };
}

function normalizeStatus(status) {
  if (status === "Resolved" || status === "Closed") return "Resolved";
  if (status === "In Progress") return "In Progress";
  return "Pending";
}

function normalizeIncidentCategory(category) {
  const categoryMap = {
    "Computer Hardware": "Computer Component",
    "Call Center Phones": "Call Center Phone"
  };
  return categoryMap[category] || category || "Other";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateValue(value) {
  if (!value) return todayISO();
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function generateId(prefix, collection) {
  const today = new Date();
  const datePart = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("");
  const count = collection.filter((item) => String(item.id || "").includes(datePart)).length + 1;
  return `${prefix}-${datePart}-${String(count).padStart(3, "0")}`;
}

function fieldValue(id) {
  return document.getElementById(id).value.trim();
}

function numberValue(id) {
  return Number(document.getElementById(id).value) || 0;
}

function setField(id, value) {
  document.getElementById(id).value = value ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function className(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "-";
  const dateValue = normalizeDateValue(value);
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(new Date(`${dateValue}T00:00:00`));
}

function ordinal(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatMemoDate(value) {
  if (!value) return "";
  const dateValue = normalizeDateValue(value);
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const month = date.toLocaleString("en", { month: "long" }).toUpperCase();
  const day = date.getDate();
  return `${month} ${day}${ordinal(day)}, ${date.getFullYear()}`;
}

function moneyNumber(value) {
  return Number(value || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function currency(value) {
  return `GH₵${moneyNumber(value)}`;
}

function shortText(text, limit) {
  if (!text) return "No description entered.";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function setLoginLoading(isLoading) {
  if (loginLoader) loginLoader.hidden = !isLoading;
  if (loginButton) loginButton.disabled = isLoading;
  if (loginTechnician) loginTechnician.disabled = isLoading;
  if (loginPassword) loginPassword.disabled = isLoading;
}

function closeMobileMenu() {
  sidebar?.classList.remove("menu-open");
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open menu");
}

function toggleMobileMenu() {
  const isOpen = sidebar?.classList.toggle("menu-open");
  menuToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  menuToggle?.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

function pageForElement(id) {
  if (["dashboard", "analytics"].includes(id)) return "dashboard";
  if (id === "incidentsSection") return "incidents";
  if (id === "memoSection") return "memos";
  if (id === "inventorySection") return "inventory";
  if (id === "settingsCard") return "settings";
  return "dashboard";
}

function scrollToElement(id) {
  const targetPage = pageForElement(id);
  showPage(targetPage, false);
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 30);
}

function showPage(page = "dashboard", shouldScroll = true) {
  const pageMap = {
    dashboard: ["dashboard", "dashboardQuick", "analytics"],
    incidents: ["incidentsSection"],
    memos: ["memoSection"],
    inventory: ["inventorySection"],
    settings: ["settingsCard"]
  };

  const pageText = {
    dashboard: ["The HelpDesk+ Dashboard", `Welcome, ${activeUser}. View the full IT operations summary.`],
    incidents: ["Incident Management", "Create, edit, assign, and resolve IT support tickets."],
    memos: ["Memo Generator", "Create editable purchase request memos directly in the app."],
    inventory: ["Inventory & Stock", "Track stock levels, item value, and receive or issue IT items."],
    settings: ["Settings", "Manage passwords and advanced backend connection options."]
  };

  Object.values(pageMap).flat().forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
  });

  (pageMap[page] || pageMap.dashboard).forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.hidden = false;
  });

  document.querySelectorAll(".side-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === page);
  });

  if (topbarTitle && pageText[page]) {
    topbarTitle.textContent = pageText[page][0];
  }

  if (welcomeText && pageText[page]) {
    welcomeText.textContent = pageText[page][1];
  }

  const firstElement = document.getElementById((pageMap[page] || pageMap.dashboard)[0]);
  closeMobileMenu();

  if (shouldScroll && firstElement) {
    firstElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function backendEnabled() {
  return Boolean(backendUrl);
}

function setBackendUrl(url) {
  backendUrl = String(url || "").trim();
  if (backendUrl) {
    localStorage.setItem(STORAGE_KEYS.backendUrl, backendUrl);
  } else if (DEFAULT_BACKEND_URL) {
    localStorage.setItem(STORAGE_KEYS.backendUrl, LOCAL_MODE_VALUE);
  } else {
    localStorage.removeItem(STORAGE_KEYS.backendUrl);
  }
  updateBackendStatus();
}

function updateBackendStatus() {
  if (backendUrlInput) backendUrlInput.value = backendUrl;

  if (!backendStatusBadge || !backendHelp) return;

  if (backendEnabled()) {
    backendStatusBadge.textContent = "Google Connected";
    backendHelp.textContent = "Google Sheets backend is enabled. Records and password updates will be saved through Apps Script.";
  } else {
    backendStatusBadge.textContent = "Local Mode";
    backendHelp.textContent = "No backend URL is saved. The app is using this browser's LocalStorage only.";
  }
}

async function apiRequest(action, payload = {}) {
  if (!backendEnabled()) {
    throw new Error("No Google Apps Script backend URL has been saved.");
  }

  const response = await fetch(backendUrl, {
    method: "POST",
    body: JSON.stringify({ action, payload })
  });

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error("Backend did not return valid JSON. Check your Apps Script deployment URL.");
  }

  if (!result.ok) {
    throw new Error(result.error || "Google backend request failed.");
  }

  return result;
}

function applyBackendData(data = {}) {
  incidents = (data.incidents || []).map(normalizeIncident);
  memos = (data.memos || []).map(normalizeMemo);
  inventory = (data.inventory || []).map(normalizeInventoryItem);
  saveIncidents();
  saveMemos();
  saveInventory();
}

async function syncFromBackend(showMessage = true) {
  const result = await apiRequest("getAll");
  applyBackendData(result.data || {});
  renderAll();
  if (showMessage) showToast("Synced with Google Sheets.");
}

function upsertRecord(collection, item) {
  const index = collection.findIndex((record) => record.id === item.id);
  if (index >= 0) {
    collection[index] = item;
  } else {
    collection.unshift(item);
  }
}

// Authentication
function showLogin() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
  loginError.textContent = "";
  loginPassword.value = "";
  setLoginLoading(false);
  updateBackendStatus();
}

function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  activeUserName.textContent = activeUser;
  passwordUser.value = activeUser;
  welcomeText.textContent = `Welcome, ${activeUser}. Manage incidents, memos, and IT stock.`;
  updateBackendStatus();
  clearIncidentForm();
  clearMemoForm();
  clearInventoryForm();
  renderAll();
  showPage("dashboard", false);
}

function checkAuth() {
  if (TECHNICIANS.includes(activeUser)) {
    showApp();
  } else {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const technician = loginTechnician.value;
  const password = loginPassword.value;
  loginError.textContent = "";
  setLoginLoading(true);

  if (backendEnabled()) {
    try {
      const result = await apiRequest("login", { technician, password });
      activeUser = result.user || technician;
      sessionStorage.setItem(STORAGE_KEYS.session, activeUser);
      applyBackendData(result.data || {});
      showApp();
      showToast(`Welcome, ${activeUser}.`);
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      setLoginLoading(false);
    }
    return;
  }

  window.setTimeout(() => {
    if (!userPasswords[technician] || userPasswords[technician] !== password) {
      loginError.textContent = "Invalid login. Please check technician and password.";
      setLoginLoading(false);
      return;
    }

    activeUser = technician;
    sessionStorage.setItem(STORAGE_KEYS.session, activeUser);
    showApp();
    showToast(`Welcome, ${activeUser}.`);
    setLoginLoading(false);
  }, 450);
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(STORAGE_KEYS.session);
  activeUser = "";
  editingIncidentId = "";
  editingMemoId = "";
  editingInventoryId = "";
  showLogin();
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeUser) {
    showLogin();
    return;
  }

  if (newPassword.value.length < 4) {
    showToast("New password must be at least 4 characters.");
    newPassword.focus();
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    showToast("New passwords do not match.");
    confirmPassword.focus();
    return;
  }

  if (backendEnabled()) {
    try {
      await apiRequest("changePassword", {
        technician: activeUser,
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      });
      userPasswords[activeUser] = newPassword.value;
      saveUserPasswords();
      passwordForm.reset();
      passwordUser.value = activeUser;
      showToast("Password updated in Google Sheets.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  if (currentPassword.value !== userPasswords[activeUser]) {
    showToast("Current password is incorrect.");
    currentPassword.focus();
    return;
  }

  userPasswords[activeUser] = newPassword.value;
  saveUserPasswords();
  passwordForm.reset();
  passwordUser.value = activeUser;
  showToast("Password updated locally. Use the new password next time you log in.");
});

resetPasswordsBtn.addEventListener("click", async () => {
  if (!confirm("Reset Julius and David passwords back to the default demo passwords?")) return;

  if (backendEnabled()) {
    try {
      await apiRequest("resetDemoPasswords");
      resetUserPasswords();
      passwordForm.reset();
      passwordUser.value = activeUser;
      showToast("Demo passwords restored in Google Sheets.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  resetUserPasswords();
  passwordForm.reset();
  passwordUser.value = activeUser;
  showToast("Demo passwords restored locally.");
});

backendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBackendUrl(backendUrlInput.value);

  if (!backendEnabled()) {
    showToast("Backend URL cleared. Local mode is active.");
    return;
  }

  try {
    await syncFromBackend(false);
    showToast("Google backend connected and synced.");
  } catch (error) {
    showToast(error.message);
  }
});

syncNowBtn.addEventListener("click", async () => {
  if (!backendEnabled()) {
    showToast("Paste and save your Google Apps Script URL first.");
    return;
  }

  try {
    await syncFromBackend(true);
  } catch (error) {
    showToast(error.message);
  }
});

useLocalModeBtn.addEventListener("click", () => {
  setBackendUrl("");
  showToast("Local mode is active. Data will be saved in this browser.");
});

// Dashboard
function renderStats() {
  const openIncidents = incidents.filter((incident) => incident.status !== "Resolved").length;
  const resolved = incidents.filter((incident) => incident.status === "Resolved").length;
  const lowStock = inventory.filter(isLowStock).length;
  const totalValue = inventory.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  openIncidentCount.textContent = openIncidents;
  resolvedCount.textContent = resolved;
  memoCount.textContent = memos.length;
  inventoryCount.textContent = inventory.length;
  lowStockCount.textContent = lowStock;
  stockValue.textContent = currency(totalValue);
}

function countBy(collection, field, values) {
  return values.reduce((summary, value) => {
    summary[value] = collection.filter((item) => item[field] === value).length;
    return summary;
  }, {});
}

function renderRecentIncidents() {
  const recent = [...incidents]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  if (!recent.length) {
    recentIncidents.innerHTML = `<p class="empty">No incidents yet.</p>`;
    return;
  }

  recentIncidents.innerHTML = recent.map((incident) => `
    <div class="mini-item">
      <strong>${escapeHtml(incident.id)} — ${escapeHtml(incident.category)}</strong>
      <small>${escapeHtml(incident.requester)} • ${escapeHtml(incident.status)} • ${formatDate(incident.updatedAt)}</small>
    </div>
  `).join("");
}

function renderLowStockPanel() {
  const low = inventory.filter(isLowStock).slice(0, 5);

  if (!low.length) {
    lowStockPanel.innerHTML = `<p class="empty">No low-stock items.</p>`;
    return;
  }

  lowStockPanel.innerHTML = low.map((item) => `
    <div class="mini-item">
      <strong>${escapeHtml(item.name)}</strong>
      <small>Qty: ${item.quantity} • Reorder: ${item.reorderLevel}</small>
      <button class="open-btn" type="button" data-request-inventory="${item.id}">Request in Memo</button>
    </div>
  `).join("");
}

function renderCategoryChart() {
  const counts = countBy(incidents, "category", INCIDENT_CATEGORIES);
  const max = Math.max(1, ...Object.values(counts));

  categoryChart.innerHTML = INCIDENT_CATEGORIES.map((category) => {
    const count = counts[category] || 0;
    const width = Math.max(count ? 8 : 0, (count / max) * 100);
    return `
      <div class="bar-row">
        <span class="bar-label" title="${escapeHtml(category)}">${escapeHtml(category)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
        <span class="bar-count">${count}</span>
      </div>
    `;
  }).join("");
}

function renderStatusDonut() {
  const pending = incidents.filter((incident) => incident.status === "Pending").length;
  const progress = incidents.filter((incident) => incident.status === "In Progress").length;
  const resolved = incidents.filter((incident) => incident.status === "Resolved").length;
  const total = Math.max(1, incidents.length);

  const pendingDeg = (pending / total) * 360;
  const progressDeg = (progress / total) * 360;
  const resolvedDeg = (resolved / total) * 360;
  const p1 = pendingDeg;
  const p2 = pendingDeg + progressDeg;
  const p3 = pendingDeg + progressDeg + resolvedDeg;

  statusDonut.style.background = incidents.length
    ? `conic-gradient(${STATUS_COLORS.Pending} 0deg ${p1}deg, ${STATUS_COLORS["In Progress"]} ${p1}deg ${p2}deg, ${STATUS_COLORS.Resolved} ${p2}deg ${p3}deg, #edf1f7 ${p3}deg 360deg)`
    : "conic-gradient(#edf1f7 0deg 360deg)";

  donutValue.textContent = incidents.length;

  statusLegend.innerHTML = [
    ["Pending", pending],
    ["In Progress", progress],
    ["Resolved", resolved]
  ].map(([label, count]) => `
    <div class="legend-row">
      <span class="dot" style="background:${STATUS_COLORS[label]}"></span>
      <span>${label}</span>
      <strong>${count}</strong>
    </div>
  `).join("");
}

function renderTechLoad() {
  const counts = countBy(incidents, "technician", TECHNICIANS);
  const max = Math.max(1, ...Object.values(counts));

  techLoad.innerHTML = TECHNICIANS.map((name) => {
    const count = counts[name] || 0;
    const width = Math.max(count ? 8 : 0, (count / max) * 100);
    return `
      <div class="tech-row">
        <strong>${name}</strong>
        <span class="tech-track"><span class="tech-fill" style="width:${width}%"></span></span>
        <span>${count}</span>
      </div>
    `;
  }).join("");
}

function renderAnalytics() {
  renderRecentIncidents();
  renderLowStockPanel();
  renderCategoryChart();
  renderStatusDonut();
  renderTechLoad();
}

// Incidents
function clearIncidentForm() {
  editingIncidentId = "";
  incidentForm.reset();
  setField("technician", activeUser || "");
  setField("status", "Pending");
  setField("priority", "Medium");
  incidentIdInput.value = "";
  incidentBadge.textContent = "New Incident";
  saveIncidentBtn.textContent = "Save Incident";
  deleteIncidentBtn.hidden = true;
}

function loadIncidentIntoForm(incidentId) {
  const incident = incidents.find((item) => item.id === incidentId);
  if (!incident) return;

  editingIncidentId = incident.id;
  incidentIdInput.value = incident.id;
  incidentBadge.textContent = `Editing ${incident.id}`;
  saveIncidentBtn.textContent = "Save Changes";
  deleteIncidentBtn.hidden = false;

  setField("requester", incident.requester);
  setField("department", incident.department);
  setField("location", incident.location);
  setField("category", incident.category);
  setField("technician", incident.technician);
  setField("status", incident.status);
  setField("priority", incident.priority);
  setField("timeSpent", incident.timeSpent);
  setField("description", incident.description);
  setField("resolution", incident.resolution);
  setField("componentChanged", incident.componentChanged);
  scrollToElement("incidentsSection");
}

function buildIncidentFromForm(existing = null) {
  const now = new Date().toISOString();
  const status = fieldValue("status") || "Pending";

  return {
    id: existing?.id || generateId("INC", incidents),
    requester: fieldValue("requester"),
    department: fieldValue("department"),
    location: fieldValue("location"),
    category: fieldValue("category"),
    technician: fieldValue("technician"),
    status,
    priority: fieldValue("priority"),
    timeSpent: fieldValue("timeSpent"),
    description: fieldValue("description"),
    resolution: fieldValue("resolution"),
    componentChanged: fieldValue("componentChanged"),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    resolvedAt: status === "Resolved" ? existing?.resolvedAt || now : "",
    createdBy: existing?.createdBy || activeUser,
    updatedBy: activeUser
  };
}

function getFilteredIncidents() {
  const search = incidentSearchInput.value.toLowerCase().trim();
  const status = incidentStatusFilter.value;

  return [...incidents]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .filter((incident) => {
      const matchesStatus = status === "All" || incident.status === status;
      const searchable = [
        incident.id,
        incident.requester,
        incident.department,
        incident.location,
        incident.category,
        incident.technician,
        incident.priority,
        incident.status,
        incident.description,
        incident.resolution,
        incident.componentChanged,
        incident.createdBy,
        incident.updatedBy
      ].join(" ").toLowerCase();
      return matchesStatus && (!search || searchable.includes(search));
    });
}

function renderIncidents() {
  const filtered = getFilteredIncidents();

  if (!filtered.length) {
    incidentList.innerHTML = `<p class="empty">No incidents found.</p>`;
    return;
  }

  incidentList.innerHTML = filtered.map((incident) => `
    <article class="ticket-row">
      <div class="ticket-main">
        <div>
          <p class="ticket-title">${escapeHtml(incident.id)} — ${escapeHtml(incident.category)}</p>
          <div class="ticket-meta">
            <span>${escapeHtml(incident.requester)}</span>
            <span>•</span>
            <span>${escapeHtml(incident.department)}</span>
            <span>•</span>
            <span>${escapeHtml(incident.location)}</span>
          </div>
        </div>
        <div class="badges">
          <span class="badge status-${className(incident.status)}">${escapeHtml(incident.status)}</span>
          <span class="badge priority-${className(incident.priority)}">${escapeHtml(incident.priority)}</span>
        </div>
      </div>
      <p class="ticket-note">${escapeHtml(shortText(incident.description, 130))}</p>
      <div class="ticket-meta">
        <span>Technician: ${escapeHtml(incident.technician || "Not assigned")}</span>
        <span>•</span>
        <span>Updated: ${formatDate(incident.updatedAt)}</span>
        <span>•</span>
        <span>By: ${escapeHtml(incident.updatedBy || "-")}</span>
      </div>
      <div class="row-actions">
        <button class="open-btn" type="button" data-edit-incident="${incident.id}">Edit Incident</button>
      </div>
    </article>
  `).join("");
}

incidentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (fieldValue("status") === "Resolved" && !fieldValue("resolution")) {
    showToast("Enter resolution/work done before marking as resolved.");
    document.getElementById("resolution").focus();
    return;
  }

  const existingIndex = incidents.findIndex((incident) => incident.id === editingIncidentId);
  const existing = existingIndex >= 0 ? incidents[existingIndex] : null;
  let incident = buildIncidentFromForm(existing);

  try {
    if (backendEnabled()) {
      const result = await apiRequest("saveIncident", incident);
      incident = normalizeIncident(result.item || incident);
    }

    upsertRecord(incidents, incident);
    saveIncidents();
    renderAll();
    loadIncidentIntoForm(incident.id);
    showToast(existing ? `${incident.id} updated.` : `${incident.id} created as Pending.`);
  } catch (error) {
    showToast(error.message);
  }
});

resetIncidentBtn.addEventListener("click", clearIncidentForm);

newIncidentBtn.addEventListener("click", () => {
  clearIncidentForm();
  scrollToElement("incidentsSection");
});

quickIncidentCards.forEach((card) => {
  card.addEventListener("click", () => {
    clearIncidentForm();
    setField("category", card.dataset.quickIncident);
    scrollToElement("incidentsSection");
  });
});

incidentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-incident]");
  if (!button) return;
  loadIncidentIntoForm(button.dataset.editIncident);
});

incidentSearchInput.addEventListener("input", renderIncidents);
incidentStatusFilter.addEventListener("change", renderIncidents);

deleteIncidentBtn.addEventListener("click", async () => {
  if (!editingIncidentId) return;
  if (!confirm(`Delete incident ${editingIncidentId}?`)) return;

  try {
    if (backendEnabled()) {
      await apiRequest("deleteIncident", { id: editingIncidentId });
    }
    incidents = incidents.filter((incident) => incident.id !== editingIncidentId);
    saveIncidents();
    clearIncidentForm();
    renderAll();
    showToast("Incident deleted.");
  } catch (error) {
    showToast(error.message);
  }
});

incidentSampleBtn.addEventListener("click", async () => {
  if (incidents.length && !confirm("Add sample incidents to the current list?")) return;

  const now = Date.now();
  const samples = [
    {
      requester: "Ama Mensah",
      department: "Call Center",
      location: "Desk CC-12",
      category: "Call Center Phone",
      technician: "Julius",
      status: "Pending",
      priority: "High",
      timeSpent: "",
      description: "Call center phone rings once and disconnects during customer calls.",
      resolution: "",
      componentChanged: ""
    },
    {
      requester: "Kojo Appiah",
      department: "Finance",
      location: "2nd Floor",
      category: "Internet / Network",
      technician: "David",
      status: "In Progress",
      priority: "Critical",
      timeSpent: "15 minutes",
      description: "Finance workstation has no internet access while nearby computers are working.",
      resolution: "Checked LAN port and confirmed the network cable is faulty. Replacement in progress.",
      componentChanged: "Network cable"
    },
    {
      requester: "Efua Boateng",
      department: "HR",
      location: "HR Office",
      category: "Computer Component",
      technician: "Julius",
      status: "Resolved",
      priority: "Medium",
      timeSpent: "45 minutes",
      description: "Desktop beeps and does not boot.",
      resolution: "Opened the system unit, tested RAM slots, replaced faulty RAM, and confirmed successful boot.",
      componentChanged: "4GB DDR4 RAM"
    }
  ];

  try {
    for (const [index, sample] of samples.entries()) {
      const createdAt = new Date(now - (index + 1) * 1000 * 60 * 45).toISOString();
      const updatedAt = new Date(now - index * 1000 * 60 * 20).toISOString();
      let incident = {
        id: generateId("INC", incidents),
        ...sample,
        createdAt,
        updatedAt,
        resolvedAt: sample.status === "Resolved" ? updatedAt : "",
        createdBy: sample.technician,
        updatedBy: sample.technician
      };

      if (backendEnabled()) {
        const result = await apiRequest("saveIncident", incident);
        incident = normalizeIncident(result.item || incident);
      }
      upsertRecord(incidents, incident);
    }

    saveIncidents();
    renderAll();
    showToast("Sample incidents added.");
  } catch (error) {
    showToast(error.message);
  }
});

// Memo generator
function defaultMemoPurpose() {
  return "Purchase of PC components and IT items to support maintenance at the Accra office and repairs/upgrades, ensuring smooth and efficient operation of company computers.";
}

function clearMemoForm() {
  editingMemoId = "";
  memoForm.reset();
  memoIdInput.value = "";
  memoBadge.textContent = "New Memo";
  document.getElementById("saveMemoBtn").textContent = "Save Memo";
  deleteMemoBtn.hidden = true;
  memoDate.value = todayISO();
  memoSubject.value = "PC COMPONENTS PURCHASE";
  memoPurpose.value = defaultMemoPurpose();
  setField("memoSign1", "Prepared By");
  setField("memoSign2", "Checked By");
  setField("memoSign3", "Approved By");
  memoItemsBody.innerHTML = "";
  addMemoItemRow();
  updateMemoPreview();
}

function addMemoItemRow(item = {}) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input class="memo-item-name" type="text" placeholder="Item name" value="${escapeHtml(item.name || "")}" /></td>
    <td><input class="memo-item-qty" type="number" min="1" step="1" value="${Number(item.quantity) || 1}" /></td>
    <td><input class="memo-item-cost" type="number" min="0" step="0.01" value="${Number(item.unitCost) || 0}" /></td>
    <td><button class="icon-btn danger-mini" type="button" data-remove-memo-item>×</button></td>
  `;
  memoItemsBody.appendChild(row);
  updateMemoPreview();
}

function getMemoItemsFromForm() {
  return [...memoItemsBody.querySelectorAll("tr")]
    .map((row) => ({
      name: row.querySelector(".memo-item-name")?.value.trim() || "",
      quantity: Number(row.querySelector(".memo-item-qty")?.value) || 0,
      unitCost: Number(row.querySelector(".memo-item-cost")?.value) || 0
    }))
    .filter((item) => item.name);
}

function memoTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
}

function buildMemoDraft() {
  const items = getMemoItemsFromForm();
  return {
    id: editingMemoId || memoIdInput.value || "Draft",
    to: memoTo.value.trim(),
    from: memoFrom.value.trim(),
    date: memoDate.value || todayISO(),
    subject: memoSubject.value.trim() || "PC COMPONENTS PURCHASE",
    purpose: memoPurpose.value.trim(),
    items,
    sign1: fieldValue("memoSign1") || "Prepared By",
    sign2: fieldValue("memoSign2") || "Checked By",
    sign3: fieldValue("memoSign3") || "Approved By"
  };
}

function buildMemoFromForm(existing = null) {
  const now = new Date().toISOString();
  const draft = buildMemoDraft();
  return {
    ...draft,
    id: existing?.id || generateId("MEMO", memos),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || activeUser,
    updatedBy: activeUser
  };
}

function updateMemoPreview() {
  const draft = buildMemoDraft();
  const total = memoTotal(draft.items);
  memoFormTotal.textContent = currency(total);
  memoPreview.innerHTML = renderMemoPaper(draft);
}

function renderMemoPaper(memo) {
  const items = memo.items.length ? memo.items : [{ name: "", quantity: "", unitCost: "" }];
  const rows = items.map((item) => {
    const lineTotal = Number(item.quantity || 0) * Number(item.unitCost || 0);
    return `
      <tr>
        <td>${escapeHtml(item.name || "-")}</td>
        <td class="right">${escapeHtml(item.quantity || "")}</td>
        <td class="right">${item.unitCost === "" ? "" : moneyNumber(item.unitCost)}</td>
        <td class="right">${lineTotal ? moneyNumber(lineTotal) : ""}</td>
      </tr>
    `;
  }).join("");

  return `
    <article class="memo-paper">
      <h3>MEMO</h3>
      <div class="memo-meta">
        <span>TO</span><strong>${escapeHtml(memo.to || "-")}</strong>
        <span>FROM</span><strong>${escapeHtml(memo.from || "-")}</strong>
        <span>DATE</span><strong>${escapeHtml(formatMemoDate(memo.date) || "-")}</strong>
        <span>SUBJECT</span><strong>${escapeHtml((memo.subject || "PC COMPONENTS PURCHASE").toUpperCase())}</strong>
      </div>
      <div class="memo-line"></div>
      <table class="memo-table">
        <thead>
          <tr>
            <th>ITEM</th>
            <th class="right">Quantity</th>
            <th class="right">Unit Cost (GHC)</th>
            <th class="right">Cost (GHC)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td><strong>Total</strong></td>
            <td></td>
            <td></td>
            <td class="right"><strong>${moneyNumber(memoTotal(memo.items))}</strong></td>
          </tr>
        </tbody>
      </table>
      <p class="memo-purpose"><strong>Purpose:</strong> ${escapeHtml(memo.purpose || "-")}</p>
      <div class="signature-grid">
        <div><span class="signature-mark">oooooooooo</span><span class="signature-line"></span><strong>${escapeHtml(memo.sign1)}</strong></div>
        <div><span class="signature-mark">oooooooooo</span><span class="signature-line"></span><strong>${escapeHtml(memo.sign2)}</strong></div>
        <div><span class="signature-mark">oooooooooo</span><span class="signature-line"></span><strong>${escapeHtml(memo.sign3)}</strong></div>
      </div>
    </article>
  `;
}

function loadMemoIntoForm(memoId) {
  const memo = memos.find((item) => item.id === memoId);
  if (!memo) return;

  editingMemoId = memo.id;
  memoIdInput.value = memo.id;
  memoBadge.textContent = `Editing ${memo.id}`;
  document.getElementById("saveMemoBtn").textContent = "Save Changes";
  deleteMemoBtn.hidden = false;

  memoTo.value = memo.to;
  memoFrom.value = memo.from;
  memoDate.value = normalizeDateValue(memo.date);
  memoSubject.value = memo.subject;
  memoPurpose.value = memo.purpose;
  setField("memoSign1", memo.sign1);
  setField("memoSign2", memo.sign2);
  setField("memoSign3", memo.sign3);

  memoItemsBody.innerHTML = "";
  if (memo.items.length) {
    memo.items.forEach(addMemoItemRow);
  } else {
    addMemoItemRow();
  }

  updateMemoPreview();
  scrollToElement("memoSection");
}

function getFilteredMemos() {
  const search = memoSearchInput.value.toLowerCase().trim();
  return [...memos]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .filter((memo) => {
      const searchable = [
        memo.id,
        memo.to,
        memo.from,
        memo.subject,
        memo.purpose,
        ...memo.items.map((item) => item.name)
      ].join(" ").toLowerCase();
      return !search || searchable.includes(search);
    });
}

function renderMemos() {
  const filtered = getFilteredMemos();

  if (!filtered.length) {
    memoList.innerHTML = `<p class="empty">No saved memos yet.</p>`;
    return;
  }

  memoList.innerHTML = filtered.map((memo) => `
    <article class="memo-row">
      <p class="memo-row-title">${escapeHtml(memo.id)} — ${escapeHtml(memo.subject)}</p>
      <div class="ticket-meta">
        <span>Date: ${formatShortDate(memo.date)}</span>
        <span>•</span>
        <span>Items: ${memo.items.length}</span>
        <span>•</span>
        <span>Total: ${currency(memoTotal(memo.items))}</span>
      </div>
      <p class="ticket-note">${escapeHtml(shortText(memo.purpose, 150))}</p>
      <div class="row-actions">
        <button class="open-btn" type="button" data-edit-memo="${memo.id}">Edit Memo</button>
        <button class="open-btn" type="button" data-print-memo="${memo.id}">Print</button>
      </div>
    </article>
  `).join("");
}

memoForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validItems = getMemoItemsFromForm().filter((item) => item.name && item.quantity > 0);
  if (!validItems.length) {
    showToast("Add at least one item with a quantity.");
    return;
  }

  const existingIndex = memos.findIndex((memo) => memo.id === editingMemoId);
  const existing = existingIndex >= 0 ? memos[existingIndex] : null;
  let memo = buildMemoFromForm(existing);
  memo.items = validItems;

  try {
    if (backendEnabled()) {
      const result = await apiRequest("saveMemo", memo);
      memo = normalizeMemo(result.item || memo);
    }

    upsertRecord(memos, memo);
    saveMemos();
    renderAll();
    loadMemoIntoForm(memo.id);
    showToast(existing ? `${memo.id} updated.` : `${memo.id} saved.`);
  } catch (error) {
    showToast(error.message);
  }
});

addMemoItemBtn.addEventListener("click", () => addMemoItemRow());
clearMemoBtn.addEventListener("click", clearMemoForm);
newMemoBtn.addEventListener("click", () => {
  clearMemoForm();
  scrollToElement("memoSection");
});

if (quickMemoButton) {
  quickMemoButton.addEventListener("click", () => {
    clearMemoForm();
    scrollToElement("memoSection");
  });
}

memoItemsBody.addEventListener("input", updateMemoPreview);
memoForm.addEventListener("input", updateMemoPreview);

memoItemsBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-memo-item]");
  if (!button) return;

  const rows = memoItemsBody.querySelectorAll("tr");
  if (rows.length === 1) {
    rows[0].querySelectorAll("input").forEach((input) => {
      input.value = input.classList.contains("memo-item-qty") ? "1" : "";
      if (input.classList.contains("memo-item-cost")) input.value = "0";
    });
  } else {
    button.closest("tr").remove();
  }
  updateMemoPreview();
});

memoSearchInput.addEventListener("input", renderMemos);

memoList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-memo]");
  const printButton = event.target.closest("[data-print-memo]");

  if (editButton) {
    loadMemoIntoForm(editButton.dataset.editMemo);
    return;
  }

  if (printButton) {
    loadMemoIntoForm(printButton.dataset.printMemo);
    printMemo();
  }
});

deleteMemoBtn.addEventListener("click", async () => {
  if (!editingMemoId) return;
  if (!confirm(`Delete memo ${editingMemoId}?`)) return;

  try {
    if (backendEnabled()) {
      await apiRequest("deleteMemo", { id: editingMemoId });
    }
    memos = memos.filter((memo) => memo.id !== editingMemoId);
    saveMemos();
    clearMemoForm();
    renderAll();
    showToast("Memo deleted.");
  } catch (error) {
    showToast(error.message);
  }
});

function printMemo() {
  updateMemoPreview();
  document.body.classList.add("printing-memo");
  window.print();
}

printMemoBtn.addEventListener("click", printMemo);
window.addEventListener("afterprint", () => document.body.classList.remove("printing-memo"));

sampleMemoBtn.addEventListener("click", () => {
  clearMemoForm();
  memoTo.value = "E";
  memoFrom.value = "D";
  memoDate.value = "2026-08-20";
  memoSubject.value = "PC COMPONENTS PURCHASE";
  memoPurpose.value = defaultMemoPurpose();
  memoItemsBody.innerHTML = "";
  [
    { name: "256GB SSD", quantity: 1, unitCost: 550 },
    { name: "CMOS Battery", quantity: 10, unitCost: 25 },
    { name: "DDR 4 4GB RAM", quantity: 1, unitCost: 320 },
    { name: "DDR 4 8GB RAM", quantity: 1, unitCost: 520 },
    { name: "Logitech M170", quantity: 1, unitCost: 200 },
    { name: "Delivery", quantity: 1, unitCost: 30 }
  ].forEach(addMemoItemRow);
  updateMemoPreview();
  scrollToElement("memoSection");
  showToast("Memo template loaded. You can edit it directly on the page.");
});

// Inventory
function isLowStock(item) {
  return Number(item.reorderLevel) > 0 && Number(item.quantity) <= Number(item.reorderLevel);
}

function clearInventoryForm() {
  editingInventoryId = "";
  inventoryForm.reset();
  inventoryIdInput.value = "";
  inventoryBadge.textContent = "New Item";
  saveInventoryBtn.textContent = "Save Item";
  deleteInventoryBtn.hidden = true;
  setField("itemQuantity", 0);
  setField("itemReorder", 2);
  setField("itemUnitCost", 0);
}

function buildInventoryFromForm(existing = null) {
  const now = new Date().toISOString();
  return {
    id: existing?.id || generateId("INV", inventory),
    name: fieldValue("itemName"),
    category: fieldValue("itemCategory"),
    sku: fieldValue("itemSku"),
    quantity: numberValue("itemQuantity"),
    reorderLevel: numberValue("itemReorder"),
    unitCost: numberValue("itemUnitCost"),
    location: fieldValue("itemLocation"),
    supplier: fieldValue("itemSupplier"),
    notes: fieldValue("itemNotes"),
    movements: existing?.movements || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || activeUser,
    updatedBy: activeUser
  };
}

function loadInventoryIntoForm(itemId) {
  const item = inventory.find((entry) => entry.id === itemId);
  if (!item) return;

  editingInventoryId = item.id;
  inventoryIdInput.value = item.id;
  inventoryBadge.textContent = `Editing ${item.id}`;
  saveInventoryBtn.textContent = "Save Changes";
  deleteInventoryBtn.hidden = false;

  setField("itemName", item.name);
  setField("itemCategory", item.category);
  setField("itemSku", item.sku);
  setField("itemQuantity", item.quantity);
  setField("itemReorder", item.reorderLevel);
  setField("itemUnitCost", item.unitCost);
  setField("itemLocation", item.location);
  setField("itemSupplier", item.supplier);
  setField("itemNotes", item.notes);
  scrollToElement("inventorySection");
}

function getFilteredInventory() {
  const search = inventorySearchInput.value.toLowerCase().trim();
  return [...inventory]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((item) => {
      const searchable = [
        item.id,
        item.name,
        item.category,
        item.sku,
        item.location,
        item.supplier,
        item.notes
      ].join(" ").toLowerCase();
      return !search || searchable.includes(search);
    });
}

function renderInventory() {
  const filtered = getFilteredInventory();

  if (!filtered.length) {
    inventoryTableBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No inventory items found.</td></tr>`;
  } else {
    inventoryTableBody.innerHTML = filtered.map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.name)}</strong><br>
          <small>${escapeHtml(item.sku || item.id)}</small>
        </td>
        <td>${escapeHtml(item.category)}</td>
        <td><span class="stock-number">${item.quantity}</span> ${isLowStock(item) ? `<span class="badge low-stock">Low</span>` : `<span class="badge stock-ok">OK</span>`}</td>
        <td>${item.reorderLevel}</td>
        <td>${currency(item.quantity * item.unitCost)}</td>
        <td>${escapeHtml(item.location || "-")}</td>
        <td>
          <div class="inventory-actions">
            <button class="open-btn" type="button" data-edit-inventory="${item.id}">Edit</button>
            <button class="open-btn" type="button" data-request-inventory="${item.id}">Request</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  renderStockSelect();
}

function renderStockSelect() {
  const currentValue = stockItem.value;
  stockItem.innerHTML = `<option value="">Select item</option>` + inventory
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)} — Qty ${item.quantity}</option>`)
    .join("");

  if (inventory.some((item) => item.id === currentValue)) {
    stockItem.value = currentValue;
  }
}

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const existingIndex = inventory.findIndex((item) => item.id === editingInventoryId);
  const existing = existingIndex >= 0 ? inventory[existingIndex] : null;
  let item = buildInventoryFromForm(existing);

  try {
    if (backendEnabled()) {
      const result = await apiRequest("saveInventory", item);
      item = normalizeInventoryItem(result.item || item);
    }

    upsertRecord(inventory, item);
    saveInventory();
    renderAll();
    loadInventoryIntoForm(item.id);
    showToast(existing ? `${item.name} updated.` : `${item.name} added to inventory.`);
  } catch (error) {
    showToast(error.message);
  }
});

resetInventoryBtn.addEventListener("click", clearInventoryForm);
inventorySearchInput.addEventListener("input", renderInventory);

deleteInventoryBtn.addEventListener("click", async () => {
  if (!editingInventoryId) return;
  const item = inventory.find((entry) => entry.id === editingInventoryId);
  if (!item) return;
  if (!confirm(`Delete inventory item ${item.name}?`)) return;

  try {
    if (backendEnabled()) {
      await apiRequest("deleteInventory", { id: editingInventoryId });
    }
    inventory = inventory.filter((entry) => entry.id !== editingInventoryId);
    saveInventory();
    clearInventoryForm();
    renderAll();
    showToast("Inventory item deleted.");
  } catch (error) {
    showToast(error.message);
  }
});

inventoryTableBody.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-inventory]");
  const requestButton = event.target.closest("[data-request-inventory]");

  if (editButton) {
    loadInventoryIntoForm(editButton.dataset.editInventory);
    return;
  }

  if (requestButton) {
    createMemoFromInventoryItem(requestButton.dataset.requestInventory);
  }
});

lowStockPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-request-inventory]");
  if (!button) return;
  createMemoFromInventoryItem(button.dataset.requestInventory);
});

function createMemoFromInventoryItem(itemId) {
  const item = inventory.find((entry) => entry.id === itemId);
  if (!item) return;

  clearMemoForm();
  memoSubject.value = "IT ITEMS PURCHASE REQUEST";
  memoPurpose.value = `Purchase of ${item.name} to replenish IT inventory and support maintenance, repairs, and smooth office operations.`;
  memoItemsBody.innerHTML = "";
  const recommendedQty = Math.max((Number(item.reorderLevel) * 2) - Number(item.quantity), 1);
  addMemoItemRow({
    name: item.name,
    quantity: recommendedQty,
    unitCost: item.unitCost
  });
  updateMemoPreview();
  scrollToElement("memoSection");
  showToast(`${item.name} added to a new memo.`);
}

stockMovementForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const item = inventory.find((entry) => entry.id === stockItem.value);
  if (!item) {
    showToast("Select an inventory item.");
    return;
  }

  const qty = Number(stockQuantity.value) || 0;
  if (qty <= 0) {
    showToast("Enter a valid quantity.");
    return;
  }

  if (stockAction.value === "issue" && qty > item.quantity) {
    showToast("Cannot issue more than available quantity.");
    return;
  }

  try {
    if (backendEnabled()) {
      const result = await apiRequest("stockMovement", {
        itemId: item.id,
        action: stockAction.value,
        quantity: qty,
        reason: stockReason.value.trim(),
        updatedBy: activeUser
      });
      upsertRecord(inventory, normalizeInventoryItem(result.item));
    } else {
      const oldQty = item.quantity;
      item.quantity = stockAction.value === "receive" ? item.quantity + qty : item.quantity - qty;
      item.updatedAt = new Date().toISOString();
      item.updatedBy = activeUser;
      item.movements.unshift({
        action: stockAction.value,
        quantity: qty,
        oldQty,
        newQty: item.quantity,
        reason: stockReason.value.trim(),
        date: item.updatedAt,
        by: activeUser
      });
    }

    saveInventory();
    stockMovementForm.reset();
    stockQuantity.value = 1;
    renderAll();
    showToast(`${item.name} stock updated.`);
  } catch (error) {
    showToast(error.message);
  }
});

inventorySampleBtn.addEventListener("click", async () => {
  if (inventory.length && !confirm("Add sample inventory items to the current list?")) return;

  const samples = [
    { name: "256GB SSD", category: "Storage", sku: "SSD-256", quantity: 1, reorderLevel: 2, unitCost: 550, location: "IT Store", supplier: "Local Vendor" },
    { name: "CMOS Battery", category: "Battery", sku: "CMOS-2032", quantity: 10, reorderLevel: 5, unitCost: 25, location: "IT Store", supplier: "Local Vendor" },
    { name: "DDR 4 4GB RAM", category: "Memory", sku: "RAM-DDR4-4", quantity: 1, reorderLevel: 2, unitCost: 320, location: "IT Store", supplier: "Local Vendor" },
    { name: "DDR 4 8GB RAM", category: "Memory", sku: "RAM-DDR4-8", quantity: 1, reorderLevel: 2, unitCost: 520, location: "IT Store", supplier: "Local Vendor" },
    { name: "Logitech M170 Mouse", category: "Peripheral", sku: "MOUSE-M170", quantity: 1, reorderLevel: 3, unitCost: 200, location: "IT Store", supplier: "Local Vendor" },
    { name: "Network Cable", category: "Networking", sku: "CAT6-CABLE", quantity: 3, reorderLevel: 5, unitCost: 30, location: "IT Store", supplier: "Local Vendor" },
    { name: "Call Center Headset Cable", category: "Phone Accessory", sku: "HEADSET-CABLE", quantity: 2, reorderLevel: 4, unitCost: 45, location: "IT Store", supplier: "Local Vendor" }
  ];

  const now = new Date().toISOString();

  try {
    for (const sample of samples) {
      let item = {
        id: generateId("INV", inventory),
        ...sample,
        notes: "Sample inventory item.",
        movements: [],
        createdAt: now,
        updatedAt: now,
        createdBy: activeUser,
        updatedBy: activeUser
      };

      if (backendEnabled()) {
        const result = await apiRequest("saveInventory", item);
        item = normalizeInventoryItem(result.item || item);
      }
      upsertRecord(inventory, item);
    }

    saveInventory();
    renderAll();
    showToast("Sample inventory added.");
  } catch (error) {
    showToast(error.message);
  }
});

// Backup
backupDataBtn.addEventListener("click", () => {
  const backup = {
    exportedAt: new Date().toISOString(),
    exportedBy: activeUser,
    incidents,
    memos,
    inventory
  };
  downloadFile(
    `it-system-backup-${todayISO()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json"
  );
  showToast("Backup file downloaded.");
});

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderStats();
  renderAnalytics();
  renderIncidents();
  renderMemos();
  renderInventory();
}

// Page navigation
const navLinks = document.querySelectorAll(".side-nav a");
navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(link.dataset.page || "dashboard");
  });
});

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMobileMenu();
});

document.addEventListener("click", (event) => {
  if (!sidebar?.classList.contains("menu-open")) return;
  if (sidebar.contains(event.target)) return;
  closeMobileMenu();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 960) closeMobileMenu();
});

checkAuth();
