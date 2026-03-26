const $ = (selector) => document.querySelector(selector);

const THEME_KEY = "psolutions_tablero_theme";
const PANEL_STATE_PREFIX = "psolutions_panel_state_";

const clientForm = $("#client-form");
const clientName = $("#client-name");
const clientsAdminBody = $("#clients-admin-body");
const personForm = $("#person-form");
const personName = $("#person-name");
const personSalary = $("#person-salary");
const peopleAdminBody = $("#people-admin-body");
const rateClient = $("#rate-client");
const refreshMetricsBtn = $("#refresh-metrics");
const totals = $("#totals");
const exchangeNote = $("#exchange-note");
const employeesBody = $("#employees-body");
const employeesHead = $("#employees-head");
const utilizationChart = $("#utilization-chart");
const salaryChartCurrency = $("#salary-chart-currency");
const fromDate = $("#from-date");
const toDate = $("#to-date");
const currencyToggle = $("#currency-toggle");
const currencyLabel = $("#currency-label");
const themeToggle = $("#themeToggle");
const brandLogo = $("#brandLogo");
const rateEditModal = $("#rate-edit-modal");
const rateEditForm = $("#rate-edit-form");
const rateEditValue = $("#rate-edit-value");
const rateEditCancel = $("#rate-edit-cancel");
const rateDeleteModal = $("#rate-delete-modal");
const rateDeleteCancel = $("#rate-delete-cancel");
const rateDeleteConfirm = $("#rate-delete-confirm");
const actionConfirmModal = $("#action-confirm-modal");
const actionConfirmTitle = $("#action-confirm-title");
const actionConfirmText = $("#action-confirm-text");
const actionConfirmCancel = $("#action-confirm-cancel");
const actionConfirmConfirm = $("#action-confirm-confirm");
const ruleEditModal = $("#rule-edit-modal");
const ruleEditForm = $("#rule-edit-form");
const ruleEditValue = $("#rule-edit-value");
const ruleEditCancel = $("#rule-edit-cancel");
const clientEditModal = $("#client-edit-modal");
const clientEditForm = $("#client-edit-form");
const clientEditName = $("#client-edit-name");
const clientEditCancel = $("#client-edit-cancel");
const personEditModal = $("#person-edit-modal");
const personEditForm = $("#person-edit-form");
const personEditName = $("#person-edit-name");
const personEditSalary = $("#person-edit-salary");
const personEditCancel = $("#person-edit-cancel");
const infoModal = $("#info-modal");
const infoModalTitle = $("#info-modal-title");
const infoModalText = $("#info-modal-text");
const infoModalClose = $("#info-modal-close");

const billingCategoryForm = $("#billing-category-form");
const billingCategoryName = $("#billing-category-name");
const clientCategoriesList = $("#client-categories-list");
const rateRuleForm = $("#rate-rule-form");
const ruleCategory = $("#rule-category");
const rulePerson = $("#rule-person");
const ruleCurrency = $("#currency");
const ruleHourlyRate = $("#hourly-rate");
const ruleEffectiveFrom = $("#effective-from");
const clientRulesHead = $("#client-rules-head");
const clientRateRulesBody = $("#client-rate-rules-body");

const timeEntryForm = $("#time-entry-form");
const timePerson = $("#time-person");
const timeClient = $("#time-client");
const timeCategory = $("#time-category");
const timeWorkDate = $("#time-work-date");
const timeHours = $("#time-hours");

let clientsCache = [];
let peopleCache = [];
let clientRulesCache = [];
const categoriesByClientId = new Map();

let editingRateId = null;
let deletingRateId = null;
let editingClientRuleId = null;
let editingClientId = null;
let editingPersonId = null;
let latestMetricsData = null;
let displayCurrency = "ARS";
let tableSort = { key: "salary", direction: "desc" };
let clientRulesSort = { key: "effectiveFrom", direction: "desc" };
let actionConfirmResolver = null;
let ruleEditResolver = null;

const today = new Date();
const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const todayIso = today.toISOString().slice(0, 10);

fromDate.value = currentMonthStart;
toDate.value = todayIso;
$("#effective-from").value = todayIso;
if (ruleEffectiveFrom) ruleEffectiveFrom.value = todayIso;
if (timeWorkDate) timeWorkDate.value = todayIso;

function normalizeSalaryNumber(rawValue) {
  if (rawValue === null || rawValue === undefined) return 0;

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? Math.round(rawValue) : 0;
  }

  const text = String(rawValue).trim();
  if (!text) return 0;

  // Caso típico de backend: "1500000.00" o "1500000,00".
  if (/^\d+[.,]\d{1,2}$/.test(text)) {
    const numeric = Number(text.replace(",", "."));
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
  }

  const digits = text.replace(/\D+/g, "");
  return digits ? Number(digits) : 0;
}

function formatSalaryInputValue(rawValue) {
  const amount = normalizeSalaryNumber(rawValue);
  if (!amount) return "";
  return amount.toLocaleString("es-AR", {
    maximumFractionDigits: 0
  });
}

function parseSalaryInputValue(rawValue) {
  return normalizeSalaryNumber(rawValue);
}

function bindSalaryInputMask(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener("input", () => {
    inputEl.value = formatSalaryInputValue(inputEl.value);
  });
  inputEl.addEventListener("blur", () => {
    inputEl.value = formatSalaryInputValue(inputEl.value);
  });
}

bindSalaryInputMask(personSalary);
bindSalaryInputMask(personEditSalary);

async function api(url, options = {}) {
  const response = await fetch(`/api${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Error de API");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json().catch(() => null);
}

function updateLogoByTheme(theme) {
  if (!brandLogo) return;
  const lightLogo = brandLogo.dataset.logoLight;
  const darkLogo = brandLogo.dataset.logoDark;
  brandLogo.src = theme === "light" ? lightLogo : darkLogo;
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("theme-light", isLight);
  document.body.classList.toggle("theme-dark", !isLight);

  if (themeToggle) {
    themeToggle.setAttribute("aria-label", isLight ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
    themeToggle.setAttribute("title", isLight ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
  }

  updateLogoByTheme(theme);
}

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function applyPanelCollapsedState(panel, toggleButton, isCollapsed) {
  panel.classList.toggle("is-collapsed", isCollapsed);
  toggleButton.classList.toggle("is-collapsed", isCollapsed);
  toggleButton.setAttribute("title", isCollapsed ? "Expandir sección" : "Colapsar sección");
  toggleButton.setAttribute("aria-label", isCollapsed ? "Expandir sección" : "Colapsar sección");
  toggleButton.setAttribute("aria-expanded", String(!isCollapsed));
}

function setupPanelCollapse() {
  const panels = document.querySelectorAll(".panel[id]");
  for (const panel of panels) {
    const panelTitle = panel.querySelector(":scope > .panel-title");
    if (!panelTitle) continue;

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "panel-toggle-btn";
    toggleButton.innerHTML = `
      <svg class="panel-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    const storageKey = `${PANEL_STATE_PREFIX}${panel.id}`;
    const isCollapsed = localStorage.getItem(storageKey) === "collapsed";
    applyPanelCollapsedState(panel, toggleButton, isCollapsed);

    toggleButton.addEventListener("click", () => {
      const nextCollapsed = !panel.classList.contains("is-collapsed");
      applyPanelCollapsedState(panel, toggleButton, nextCollapsed);
      localStorage.setItem(storageKey, nextCollapsed ? "collapsed" : "expanded");
    });

    panelTitle.append(toggleButton);
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatAmountByCurrency(value, currency) {
  const useNoDecimals = currency === "ARS";
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: useNoDecimals ? 0 : 2,
    maximumFractionDigits: useNoDecimals ? 0 : 2
  });
}

function formatMoney(value, currency) {
  return `${currency} ${formatAmountByCurrency(value, currency)}`;
}

function convertAmount(value, fromCurrency, toCurrency, usdArsRate) {
  const amount = Number(value || 0);
  if (fromCurrency === toCurrency) return amount;
  if (!usdArsRate || usdArsRate <= 0) return null;

  if (fromCurrency === "USD" && toCurrency === "ARS") return amount * usdArsRate;
  if (fromCurrency === "ARS" && toCurrency === "USD") return amount / usdArsRate;
  return null;
}

function setSelectOptions(selectEl, items, config = {}) {
  if (!selectEl) return;

  const {
    valueKey = "id",
    includeEmpty = false,
    emptyLabel = "Seleccionar",
    labelFn = (item) => String(item.name ?? item.label ?? item[valueKey])
  } = config;

  const previous = selectEl.value;
  selectEl.innerHTML = "";

  if (includeEmpty) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    selectEl.append(empty);
  }

  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(item[valueKey]);
    option.textContent = labelFn(item);
    selectEl.append(option);
  }

  const hasPrevious = Array.from(selectEl.options).some((opt) => opt.value === previous);
  if (hasPrevious) {
    selectEl.value = previous;
  } else if (!includeEmpty && selectEl.options.length) {
    selectEl.selectedIndex = 0;
  } else if (includeEmpty) {
    selectEl.value = "";
  }
}

const pencilIcon = `
<svg class="tiny-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 20h9"></path>
  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
</svg>`;

const trashIcon = `
<svg class="tiny-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
  <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>`;

function openRateEditModal(rateId, currentValue) {
  editingRateId = Number(rateId);
  rateEditValue.value = Number(currentValue).toFixed(2);
  rateEditModal.classList.remove("hidden");
  rateEditModal.setAttribute("aria-hidden", "false");
  setTimeout(() => rateEditValue.focus(), 0);
}

function closeRateEditModal() {
  editingRateId = null;
  rateEditModal.classList.add("hidden");
  rateEditModal.setAttribute("aria-hidden", "true");
  rateEditForm.reset();
}

function openRateDeleteModal(rateId) {
  deletingRateId = Number(rateId);
  rateDeleteModal.classList.remove("hidden");
  rateDeleteModal.setAttribute("aria-hidden", "false");
}

function closeRateDeleteModal() {
  deletingRateId = null;
  rateDeleteModal.classList.add("hidden");
  rateDeleteModal.setAttribute("aria-hidden", "true");
}

function openActionConfirmModal({
  title = "Confirmar acción",
  message = "¿Querés continuar?",
  confirmLabel = "Confirmar"
} = {}) {
  if (!actionConfirmModal) return;
  actionConfirmTitle.textContent = title;
  actionConfirmText.textContent = message;
  actionConfirmConfirm.textContent = confirmLabel;
  actionConfirmModal.classList.remove("hidden");
  actionConfirmModal.setAttribute("aria-hidden", "false");
}

function closeActionConfirmModal(confirmed = false) {
  if (!actionConfirmModal) return;
  actionConfirmModal.classList.add("hidden");
  actionConfirmModal.setAttribute("aria-hidden", "true");

  if (actionConfirmResolver) {
    const resolver = actionConfirmResolver;
    actionConfirmResolver = null;
    resolver(confirmed);
  }
}

function askConfirmation(options) {
  return new Promise((resolve) => {
    if (!actionConfirmModal) {
      resolve(window.confirm(options?.message || "¿Querés continuar?"));
      return;
    }
    actionConfirmResolver = resolve;
    openActionConfirmModal(options);
  });
}

function openRuleEditModal(ruleId, currentValue) {
  if (!ruleEditModal || !ruleEditValue) return;
  editingClientRuleId = Number(ruleId);
  ruleEditValue.value = Number(currentValue).toFixed(2);
  ruleEditModal.classList.remove("hidden");
  ruleEditModal.setAttribute("aria-hidden", "false");
  setTimeout(() => ruleEditValue.focus(), 0);
}

function closeRuleEditModal(value = null) {
  if (!ruleEditModal) return;
  editingClientRuleId = null;
  ruleEditModal.classList.add("hidden");
  ruleEditModal.setAttribute("aria-hidden", "true");
  if (ruleEditForm) ruleEditForm.reset();

  if (ruleEditResolver) {
    const resolver = ruleEditResolver;
    ruleEditResolver = null;
    resolver(value);
  }
}

function askRuleHourlyRate(ruleId, currentValue) {
  return new Promise((resolve) => {
    if (!ruleEditModal || !ruleEditValue) {
      resolve(null);
      return;
    }
    ruleEditResolver = resolve;
    openRuleEditModal(ruleId, currentValue);
  });
}

function openClientEditModal(clientId, currentName) {
  if (!clientEditModal || !clientEditName) return;
  editingClientId = Number(clientId);
  clientEditName.value = String(currentName || "");
  clientEditModal.classList.remove("hidden");
  clientEditModal.setAttribute("aria-hidden", "false");
  setTimeout(() => clientEditName.focus(), 0);
}

function closeClientEditModal() {
  if (!clientEditModal) return;
  editingClientId = null;
  clientEditModal.classList.add("hidden");
  clientEditModal.setAttribute("aria-hidden", "true");
  if (clientEditForm) clientEditForm.reset();
}

function openPersonEditModal(personId, currentName, currentSalary) {
  if (!personEditModal || !personEditName || !personEditSalary) return;
  editingPersonId = Number(personId);
  personEditName.value = String(currentName || "");
  personEditSalary.value = formatSalaryInputValue(currentSalary || 0);
  personEditModal.classList.remove("hidden");
  personEditModal.setAttribute("aria-hidden", "false");
  setTimeout(() => personEditName.focus(), 0);
}

function closePersonEditModal() {
  if (!personEditModal) return;
  editingPersonId = null;
  personEditModal.classList.add("hidden");
  personEditModal.setAttribute("aria-hidden", "true");
  if (personEditForm) personEditForm.reset();
}

function openInfoModal(title, message) {
  if (!infoModal || !infoModalTitle || !infoModalText) return;
  infoModalTitle.textContent = title || "Aviso";
  infoModalText.textContent = message || "";
  infoModal.classList.remove("hidden");
  infoModal.setAttribute("aria-hidden", "false");
}

function closeInfoModal() {
  if (!infoModal) return;
  infoModal.classList.add("hidden");
  infoModal.setAttribute("aria-hidden", "true");
}

function renderPeopleAdminTable() {
  if (!peopleAdminBody) return;
  peopleAdminBody.innerHTML = "";

  if (!peopleCache.length) {
    peopleAdminBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="3">No hay personas cargadas.</td>
      </tr>
    `;
    return;
  }

  const sorted = [...peopleCache].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), "es")
  );

  for (const person of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${person.full_name}</td>
      <td>${formatMoney(person.monthly_salary || 0, person.salary_currency || "ARS")}</td>
      <td>
        <div class="rule-actions">
          <button
            class="tiny-btn"
            type="button"
            data-edit-person-id="${person.id}"
            aria-label="Editar persona"
            title="Editar persona"
          >
            ${pencilIcon}
          </button>
          <button
            class="tiny-btn tiny-btn-danger"
            type="button"
            data-delete-person-id="${person.id}"
            aria-label="Eliminar persona"
            title="Eliminar persona"
          >
            ${trashIcon}
          </button>
        </div>
      </td>
    `;
    peopleAdminBody.append(tr);
  }
}

function renderClientsAdminTable() {
  if (!clientsAdminBody) return;
  clientsAdminBody.innerHTML = "";

  if (!clientsCache.length) {
    clientsAdminBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="2">No hay clientes cargados.</td>
      </tr>
    `;
    return;
  }

  const sorted = [...clientsCache].sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));

  for (const client of sorted) {
    const hasTimeEntries =
      client.has_time_entries === true || String(client.has_time_entries).toLowerCase() === "true";
    const deleteButton = hasTimeEntries
      ? ""
      : `
          <button
            class="tiny-btn tiny-btn-danger"
            type="button"
            data-delete-client-id="${client.id}"
            aria-label="Eliminar cliente"
            title="Eliminar cliente"
          >
            ${trashIcon}
          </button>
        `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${client.name}</td>
      <td>
        <div class="rule-actions">
          <button
            class="tiny-btn"
            type="button"
            data-edit-client-id="${client.id}"
            aria-label="Editar cliente"
            title="Editar cliente"
          >
            ${pencilIcon}
          </button>
          ${deleteButton}
        </div>
      </td>
    `;
    clientsAdminBody.append(tr);
  }
}

async function loadClients() {
  const clients = await api("/clients");
  clientsCache = clients;

  setSelectOptions(rateClient, clients, {
    labelFn: (client) => client.name
  });
  setSelectOptions(timeClient, clients, {
    labelFn: (client) => client.name
  });

  renderClientsAdminTable();
  await refreshClientRulesView();
  await refreshTimeCategorySelect();
}

function buildClientRateRows(client) {
  if (!client) return [];

  const currentEffectiveFrom = client.effective_from ? String(client.effective_from).slice(0, 10) : null;
  const currentRateValue =
    client.hourly_rate !== null && client.hourly_rate !== undefined ? Number(client.hourly_rate) : null;

  const historyRaw = Array.isArray(client.rates_history) ? client.rates_history : [];
  const history = historyRaw.filter((item) => {
    if (!currentEffectiveFrom) return true;
    const itemDate = String(item.effective_from).slice(0, 10);
    if (itemDate !== currentEffectiveFrom) return true;

    if (currentRateValue === null) return true;

    const sameCurrency = item.currency === client.currency;
    const sameRate = Number(item.hourly_rate) === currentRateValue;
    return !(sameCurrency && sameRate);
  });

  const rows = [];
  if (currentEffectiveFrom && currentRateValue !== null && client.currency) {
    rows.push({
      id: client.rate_id,
      row_type: "client_rate",
      effective_from: currentEffectiveFrom,
      hourly_rate: currentRateValue,
      currency: client.currency,
      person_name: null,
      billing_category_name: null
    });
  }

  for (const item of history) {
    rows.push({
      id: item.id,
      row_type: "client_rate",
      effective_from: String(item.effective_from).slice(0, 10),
      hourly_rate: Number(item.hourly_rate),
      currency: item.currency,
      person_name: null,
      billing_category_name: null
    });
  }

  return rows;
}

function getSelectedClientId() {
  if (!rateClient) return 0;
  return Number(rateClient.value || 0);
}

function getSelectedClient() {
  if (!clientsCache.length) return;
  const selectedClientId = getSelectedClientId();
  const selectedClient = clientsCache.find((client) => Number(client.id) === selectedClientId);
  return selectedClient || clientsCache[0];
}

async function loadPeople() {
  peopleCache = await api("/people");
  renderPeopleAdminTable();

  setSelectOptions(rulePerson, peopleCache, {
    includeEmpty: true,
    emptyLabel: "Sin persona",
    labelFn: (person) => person.full_name
  });

  setSelectOptions(timePerson, peopleCache, {
    labelFn: (person) => person.full_name
  });
}

async function fetchClientCategories(clientId) {
  if (!clientId) return [];
  const categories = await api(`/clients/${clientId}/billing-categories`);
  categoriesByClientId.set(Number(clientId), categories);
  return categories;
}

function renderCategoryTags(categories) {
  if (!clientCategoriesList) return;

  if (!categories.length) {
    clientCategoriesList.innerHTML = `<span class="muted">No hay categorías cargadas para este cliente.</span>`;
    return;
  }

  clientCategoriesList.innerHTML = categories
    .map(
      (category) => `
        <span class="tag-chip">
          <span>${category.name}</span>
          <button
            class="tag-chip-remove"
            type="button"
            data-remove-category-id="${category.id}"
            aria-label="Eliminar categoría"
            title="Eliminar categoría"
          >
            ×
          </button>
        </span>
      `
    )
    .join("");
}

function getRuleScope(rule) {
  if (rule.row_type === "client_rate") return "";
  if (rule.person_name && rule.billing_category_name) {
    return `${rule.person_name} + ${rule.billing_category_name}`;
  }
  if (rule.person_name) return rule.person_name;
  if (rule.billing_category_name) return rule.billing_category_name;
  return "Cliente (general)";
}

function sortClientRules(rules) {
  const direction = clientRulesSort.direction === "asc" ? 1 : -1;
  const key = clientRulesSort.key;

  return [...rules].sort((a, b) => {
    if (key === "scope") {
      return getRuleScope(a).localeCompare(getRuleScope(b), "es") * direction;
    }

    if (key === "currency") {
      return String(a.currency || "").localeCompare(String(b.currency || ""), "es") * direction;
    }

    if (key === "hourlyRate") {
      return (Number(a.hourly_rate || 0) - Number(b.hourly_rate || 0)) * direction;
    }

    const dateA = new Date(a.effective_from).getTime() || 0;
    const dateB = new Date(b.effective_from).getTime() || 0;
    if (dateA === dateB) {
      return (Number(a.id || 0) - Number(b.id || 0)) * direction;
    }
    return (dateA - dateB) * direction;
  });
}

function updateClientRuleSortIndicators() {
  if (!clientRulesHead) return;

  const headers = clientRulesHead.querySelectorAll("th.sortable[data-rule-sort-key]");
  for (const header of headers) {
    const key = header.dataset.ruleSortKey;
    const baseLabel = header.dataset.baseLabel || header.textContent.replace(/[ ▲▼]$/g, "").trim();
    header.dataset.baseLabel = baseLabel;

    if (key === clientRulesSort.key) {
      header.textContent = `${baseLabel} ${clientRulesSort.direction === "asc" ? "▲" : "▼"}`;
      header.setAttribute("aria-sort", clientRulesSort.direction === "asc" ? "ascending" : "descending");
    } else {
      header.textContent = baseLabel;
      header.removeAttribute("aria-sort");
    }
  }
}

function renderClientRateRules(rules) {
  if (!clientRateRulesBody) return;

  clientRulesCache = Array.isArray(rules) ? rules : [];
  updateClientRuleSortIndicators();

  if (!clientRulesCache.length) {
    clientRateRulesBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">No hay reglas para este cliente.</td>
      </tr>
    `;
    return;
  }

  const sortedRules = sortClientRules(clientRulesCache);
  clientRateRulesBody.innerHTML = "";

  for (const rule of sortedRules) {
    const scope = getRuleScope(rule);
    const tr = document.createElement("tr");
    const scopeCell = scope ? scope : "&nbsp;";
    tr.innerHTML = `
      <td>${String(rule.effective_from).slice(0, 10)}</td>
      <td>${scopeCell}</td>
      <td>${rule.currency}</td>
      <td>${formatMoney(rule.hourly_rate, rule.currency)}</td>
      <td>
        <div class="rule-actions">
          <button
            class="tiny-btn"
            type="button"
            data-row-type="${rule.row_type || "client_rule"}"
            data-edit-rule-id="${rule.id}"
            aria-label="Editar regla"
            title="Editar regla"
          >
            ${pencilIcon}
          </button>
          <button
            class="tiny-btn tiny-btn-danger"
            type="button"
            data-row-type="${rule.row_type || "client_rule"}"
            data-delete-rule-id="${rule.id}"
            aria-label="Eliminar regla"
            title="Eliminar regla"
          >
            ${trashIcon}
          </button>
        </div>
      </td>
    `;
    clientRateRulesBody.append(tr);
  }
}

async function refreshClientRulesView() {
  const client = getSelectedClient();
  const clientId = Number(client?.id || 0);

  if (!clientId) {
    renderCategoryTags([]);
    renderClientRateRules([]);
    setSelectOptions(ruleCategory, [], { includeEmpty: true, emptyLabel: "Sin categoría" });
    return;
  }

  const [categories, rules] = await Promise.all([
    fetchClientCategories(clientId),
    api(`/clients/${clientId}/rate-rules`)
  ]);

  renderCategoryTags(categories);
  setSelectOptions(ruleCategory, categories, {
    includeEmpty: true,
    emptyLabel: "Sin categoría",
    labelFn: (category) => category.name
  });

  const clientRateRows = buildClientRateRows(client);
  const clientRuleRows = rules.map((rule) => ({ ...rule, row_type: "client_rule" }));
  renderClientRateRules([...clientRuleRows, ...clientRateRows]);

  if (Number(timeClient?.value || 0) === clientId) {
    await refreshTimeCategorySelect();
  }
}

async function refreshTimeCategorySelect() {
  const clientId = Number(timeClient?.value || 0);
  if (!clientId) {
    setSelectOptions(timeCategory, [], { includeEmpty: true, emptyLabel: "Sin categoría" });
    return;
  }

  const categories = categoriesByClientId.has(clientId)
    ? categoriesByClientId.get(clientId)
    : await fetchClientCategories(clientId);

  setSelectOptions(timeCategory, categories, {
    includeEmpty: true,
    emptyLabel: "Sin categoría",
    labelFn: (category) => category.name
  });
}

function renderTotals(data, exchange) {
  totals.innerHTML = `
    <article class="total-box">
      <span class="total-label">Horas totales</span>
      <span class="total-value">${formatNumber(data.total_hours)}</span>
    </article>
    <article class="total-box">
      <span class="total-label">Nómina mensual ARS</span>
      <span class="total-value">${formatMoney(data.payroll_ars_per_month, "ARS")}</span>
    </article>
    <article class="total-box">
      <span class="total-label">Nómina mensual USD</span>
      <span class="total-value">${formatMoney(data.payroll_usd_per_month, "USD")}</span>
    </article>
    <article class="total-box">
      <span class="total-label">Cantidad empleados</span>
      <span class="total-value">${data.people_count}</span>
    </article>
  `;

  if (exchange?.usd_ars_rate) {
    if (exchange.status === "stale") {
      exchangeNote.textContent = `No se pudo actualizar cotización externa. Se usa último valor guardado (${formatNumber(
        exchange.usd_ars_rate
      )}) de ${exchange.date}, fuente: ${exchange.source}.`;
      return;
    }

    const statusLabel = exchange.status === "fresh" ? "actualizada" : "cache local";
    exchangeNote.textContent = `Conversión USD/ARS ${statusLabel}: ${formatNumber(
      exchange.usd_ars_rate
    )} (fuente: ${exchange.source}, fecha: ${exchange.date})`;
  } else {
    exchangeNote.textContent =
      "No se pudo obtener cotización externa y no hay histórico local disponible para esa fecha.";
  }
}

function renderEmployees(rows, exchange) {
  employeesBody.innerHTML = "";

  if (!rows.length) {
    employeesBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">No hay información de empleados para el rango elegido.</td>
      </tr>
    `;
    return;
  }

  const usdArsRate = Number(exchange?.usd_ars_rate || 0);
  const mappedRows = rows.map((employee) => {
    const convertedSalary = convertAmount(
      employee.monthly_salary,
      employee.salary_currency,
      displayCurrency,
      usdArsRate
    );
    const convertedCostPerHour = convertAmount(
      employee.cost_per_hour,
      employee.salary_currency,
      displayCurrency,
      usdArsRate
    );

    const billedOwnCurrency =
      displayCurrency === "USD" ? Number(employee.billed_usd || 0) : Number(employee.billed_ars || 0);
    const billedOtherCurrencyRaw =
      displayCurrency === "USD" ? Number(employee.billed_ars || 0) : Number(employee.billed_usd || 0);
    const billedOtherCurrency = convertAmount(
      billedOtherCurrencyRaw,
      displayCurrency === "USD" ? "ARS" : "USD",
      displayCurrency,
      usdArsRate
    );
    const billedTotal = billedOtherCurrency === null ? null : billedOwnCurrency + billedOtherCurrency;
    const billedPerHour =
      billedTotal === null || Number(employee.worked_hours || 0) <= 0
        ? null
        : billedTotal / Number(employee.worked_hours);
    const coverageRatio =
      billedTotal === null || convertedSalary === null || Number(convertedSalary) <= 0
        ? null
        : billedTotal / Number(convertedSalary);

    return {
      employee,
      values: {
        name: employee.full_name || "",
        salary: convertedSalary,
        hours: Number(employee.worked_hours || 0),
        costPerHour: convertedCostPerHour,
        billing: billedTotal,
        billingPerHour: billedPerHour,
        coverage: coverageRatio
      }
    };
  });

  const sortedRows = [...mappedRows].sort((a, b) => {
    const key = tableSort.key;
    const direction = tableSort.direction === "asc" ? 1 : -1;

    if (key === "name") {
      return a.values.name.localeCompare(b.values.name, "es") * direction;
    }

    const valueA = a.values[key];
    const valueB = b.values[key];
    const safeA = valueA === null || valueA === undefined ? Number.NEGATIVE_INFINITY : Number(valueA);
    const safeB = valueB === null || valueB === undefined ? Number.NEGATIVE_INFINITY : Number(valueB);
    return (safeA - safeB) * direction;
  });

  for (const rowData of sortedRows) {
    const { employee, values } = rowData;

    const salaryText = values.salary === null ? "N/D" : formatMoney(values.salary, displayCurrency);
    const costPerHourText =
      values.costPerHour === null ? "N/D" : formatMoney(values.costPerHour, displayCurrency);
    const billedText = values.billing === null ? "N/D" : formatMoney(values.billing, displayCurrency);
    const billedPerHourText =
      values.billingPerHour === null ? "N/D" : formatMoney(values.billingPerHour, displayCurrency);
    const coverageText =
      values.coverage === null
        ? "N/D"
        : `x${Number(values.coverage.toFixed(2)).toLocaleString("es-AR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          })}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${employee.full_name}</td>
      <td>${salaryText}</td>
      <td>${formatNumber(employee.worked_hours)}</td>
      <td>${costPerHourText}</td>
      <td>${billedText}</td>
      <td>${billedPerHourText}</td>
      <td>${coverageText}</td>
    `;
    employeesBody.append(tr);
  }
}

function updateHeaderSortIndicators() {
  if (!employeesHead) return;

  const headers = employeesHead.querySelectorAll("th.sortable[data-sort-key]");
  for (const header of headers) {
    const key = header.dataset.sortKey;
    const baseLabel = header.dataset.baseLabel || header.textContent.replace(/[ ▲▼]$/g, "").trim();
    header.dataset.baseLabel = baseLabel;

    if (key === tableSort.key) {
      header.textContent = `${baseLabel} ${tableSort.direction === "asc" ? "▲" : "▼"}`;
      header.setAttribute("aria-sort", tableSort.direction === "asc" ? "ascending" : "descending");
    } else {
      header.textContent = baseLabel;
      header.removeAttribute("aria-sort");
    }
  }
}

function renderSalaryChart(rows, exchange) {
  if (!utilizationChart) return;

  utilizationChart.innerHTML = "";

  if (!rows.length) {
    utilizationChart.innerHTML = `<p class="muted">No hay datos para graficar en este rango.</p>`;
    return;
  }

  const usdArsRate = Number(exchange?.usd_ars_rate || 0);
  const chartRows = rows.map((employee) => ({
    employee,
    salary: convertAmount(employee.monthly_salary, employee.salary_currency, displayCurrency, usdArsRate)
  }));

  chartRows.sort((a, b) => {
    const aValue = a.salary === null || a.salary === undefined ? Number.NEGATIVE_INFINITY : Number(a.salary);
    const bValue = b.salary === null || b.salary === undefined ? Number.NEGATIVE_INFINITY : Number(b.salary);
    return bValue - aValue;
  });

  const validSalaries = chartRows
    .map((item) => item.salary)
    .filter((value) => value !== null && Number.isFinite(value));
  const maxSalary = Math.max(...(validSalaries.length ? validSalaries : [1]), 1);

  if (salaryChartCurrency) {
    salaryChartCurrency.textContent = displayCurrency;
  }

  for (const row of chartRows) {
    const employee = row.employee;
    const salary = row.salary;
    const numericSalary = salary === null ? 0 : Number(salary);
    const width = Math.max(4, (numericSalary / maxSalary) * 100);

    const rowElement = document.createElement("div");
    rowElement.className = "chart-row";

    const name = document.createElement("span");
    name.className = "chart-name";
    name.textContent = employee.full_name;

    const track = document.createElement("div");
    track.className = "chart-track";

    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.width = `${width}%`;
    bar.setAttribute("aria-hidden", "true");

    const value = document.createElement("span");
    value.className = "chart-value";
    value.textContent = salary === null ? "N/D" : formatMoney(salary, displayCurrency);

    track.append(bar);
    rowElement.append(name, track, value);
    utilizationChart.append(rowElement);
  }
}

async function deleteClientCategory(categoryId) {
  const clientId = getSelectedClientId();
  if (!clientId || !categoryId) return;

  const confirmed = await askConfirmation({
    title: "Eliminar categoría",
    message: "También se eliminarán las reglas vinculadas. Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar"
  });
  if (!confirmed) return;

  await api(`/clients/${clientId}/billing-categories/${categoryId}`, { method: "DELETE" });
  categoriesByClientId.delete(clientId);

  await Promise.all([refreshClientRulesView(), refreshTimeCategorySelect(), loadMetrics()]);
}

async function editClientRule(ruleId) {
  const currentRule = clientRulesCache.find(
    (rule) => Number(rule.id) === Number(ruleId) && (rule.row_type || "client_rule") === "client_rule"
  );
  if (!currentRule) return;

  const clientId = getSelectedClientId();
  if (!clientId || !ruleId) return;

  const newHourlyRate = await askRuleHourlyRate(ruleId, currentRule.hourly_rate);
  if (newHourlyRate === null) return;

  await api(`/clients/${clientId}/rate-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify({ hourlyRate: newHourlyRate })
  });

  await Promise.all([refreshClientRulesView(), loadMetrics()]);
}

async function deleteClientRule(ruleId) {
  const clientId = getSelectedClientId();
  if (!clientId || !ruleId) return;

  const confirmed = await askConfirmation({
    title: "Eliminar regla",
    message: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar"
  });
  if (!confirmed) return;

  await api(`/clients/${clientId}/rate-rules/${ruleId}`, { method: "DELETE" });
  await Promise.all([refreshClientRulesView(), loadMetrics()]);
}

async function createClient(name) {
  const created = await api("/clients", {
    method: "POST",
    body: JSON.stringify({ name })
  });

  await Promise.all([loadClients(), loadMetrics()]);
  if (rateClient && created?.id) {
    rateClient.value = String(created.id);
    await refreshClientRulesView();
  }
}

async function updateClient(clientId, name) {
  await api(`/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });

  await Promise.all([loadClients(), loadMetrics()]);
}

async function deleteClient(clientId) {
  const client = clientsCache.find((item) => Number(item.id) === Number(clientId));
  const clientNameLabel = client?.name || "este cliente";
  const confirmed = await askConfirmation({
    title: "Eliminar cliente",
    message: `Se eliminará ${clientNameLabel}. Si tiene horas cargadas, el sistema no permitirá borrarlo.`,
    confirmLabel: "Eliminar"
  });
  if (!confirmed) return;

  await api(`/clients/${clientId}`, { method: "DELETE" });
  await Promise.all([loadClients(), loadMetrics()]);
}

async function createPerson(fullName, monthlySalary) {
  await api("/people", {
    method: "POST",
    body: JSON.stringify({ fullName, monthlySalary })
  });
  await Promise.all([loadPeople(), refreshClientRulesView(), loadMetrics()]);
}

async function updatePerson(personId, fullName, monthlySalary) {
  await api(`/people/${personId}`, {
    method: "PATCH",
    body: JSON.stringify({ fullName, monthlySalary })
  });
  await Promise.all([loadPeople(), refreshClientRulesView(), loadMetrics()]);
}

async function deletePerson(personId) {
  const person = peopleCache.find((item) => Number(item.id) === Number(personId));
  const personNameLabel = person?.full_name || "esta persona";
  const confirmed = await askConfirmation({
    title: "Eliminar persona",
    message: `Se eliminará ${personNameLabel}. Si tiene horas cargadas, también se eliminarán.`,
    confirmLabel: "Eliminar"
  });
  if (!confirmed) return;

  await api(`/people/${personId}`, { method: "DELETE" });
  await Promise.all([loadPeople(), refreshClientRulesView(), loadMetrics()]);
}

async function loadMetrics() {
  const from = fromDate.value || currentMonthStart;
  const to = toDate.value || todayIso;
  latestMetricsData = await api(`/metrics/employees?from=${from}&to=${to}`);
  renderTotals(latestMetricsData.totals, latestMetricsData.exchange);
  renderEmployees(latestMetricsData.employees, latestMetricsData.exchange);
  renderSalaryChart(latestMetricsData.employees, latestMetricsData.exchange);
}

if (clientForm) {
  clientForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = String(clientName?.value || "").trim();
    if (!name) return;

    try {
      await createClient(name);
      if (clientName) clientName.value = "";
    } catch (error) {
      console.error(error);
      alert("No se pudo crear el cliente.");
    }
  });
}

if (personForm) {
  personForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = String(personName?.value || "").trim();
    const monthlySalary = parseSalaryInputValue(personSalary?.value || "");
    if (!fullName || !Number.isFinite(monthlySalary) || monthlySalary < 0) return;

    try {
      await createPerson(fullName, monthlySalary);
      if (personName) personName.value = "";
      if (personSalary) personSalary.value = "";
    } catch (error) {
      console.error(error);
      openInfoModal("No se pudo crear la persona", error?.message || "Revisa los datos cargados.");
    }
  });
}

if (clientsAdminBody) {
  clientsAdminBody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const editButton = target.closest("button[data-edit-client-id]");
    if (editButton) {
      const clientId = Number(editButton.dataset.editClientId);
      if (!clientId) return;
      const client = clientsCache.find((item) => Number(item.id) === clientId);
      if (!client) return;
      openClientEditModal(clientId, client.name);
      return;
    }

    const deleteButton = target.closest("button[data-delete-client-id]");
    if (!deleteButton) return;

    const clientId = Number(deleteButton.dataset.deleteClientId);
    if (!clientId) return;

    try {
      await deleteClient(clientId);
    } catch (error) {
      console.error(error);
      openInfoModal("No se pudo eliminar el cliente", error?.message || "Revisá si tiene horas cargadas.");
    }
  });
}

if (peopleAdminBody) {
  peopleAdminBody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const editButton = target.closest("button[data-edit-person-id]");
    if (editButton) {
      const personId = Number(editButton.dataset.editPersonId);
      if (!personId) return;
      const person = peopleCache.find((item) => Number(item.id) === personId);
      if (!person) return;
      openPersonEditModal(personId, person.full_name, person.monthly_salary || 0);
      return;
    }

    const deleteButton = target.closest("button[data-delete-person-id]");
    if (!deleteButton) return;

    const personId = Number(deleteButton.dataset.deletePersonId);
    if (!personId) return;

    try {
      await deletePerson(personId);
    } catch (error) {
      console.error(error);
      openInfoModal("No se pudo eliminar la persona", error?.message || "Revisa si tiene horas cargadas.");
    }
  });
}

if (billingCategoryForm) {
  billingCategoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const clientId = getSelectedClientId();
    const name = String(billingCategoryName.value || "").trim();
    if (!clientId || !name) return;

    await api(`/clients/${clientId}/billing-categories`, {
      method: "POST",
      body: JSON.stringify({ name })
    });

    billingCategoryName.value = "";
    await refreshClientRulesView();
  });
}

if (clientCategoriesList) {
  clientCategoriesList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const removeButton = target.closest("button[data-remove-category-id]");
    if (!removeButton) return;

    const categoryId = Number(removeButton.dataset.removeCategoryId);
    if (!categoryId) return;

    try {
      await deleteClientCategory(categoryId);
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar la categoría.");
    }
  });
}

  if (rateRuleForm) {
  rateRuleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const clientId = getSelectedClientId();
    const billingCategoryId = ruleCategory.value ? Number(ruleCategory.value) : null;
    const personId = rulePerson.value ? Number(rulePerson.value) : null;
    const currency = ruleCurrency.value;
    const hourlyRate = Number(ruleHourlyRate.value);
    const effectiveFrom = ruleEffectiveFrom.value;

    if (!clientId) return;

    if (!billingCategoryId && !personId) {
      await api(`/clients/${clientId}/rates`, {
        method: "POST",
        body: JSON.stringify({ currency, hourlyRate, effectiveFrom })
      });
    } else {
      await api(`/clients/${clientId}/rate-rules`, {
        method: "POST",
        body: JSON.stringify({
          billingCategoryId,
          personId,
          currency,
          hourlyRate,
          effectiveFrom
        })
      });
    }

    rateRuleForm.reset();
    ruleEffectiveFrom.value = todayIso;
    await Promise.all([loadClients(), refreshClientRulesView(), loadMetrics()]);
  });
}

if (clientRateRulesBody) {
  clientRateRulesBody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const editButton = target.closest("button[data-edit-rule-id]");
    if (editButton) {
      const ruleId = Number(editButton.dataset.editRuleId);
      const rowType = editButton.dataset.rowType || "client_rule";
      if (!ruleId) return;

      try {
        if (rowType === "client_rate") {
          const row = clientRulesCache.find(
            (item) => Number(item.id) === ruleId && (item.row_type || "client_rule") === "client_rate"
          );
          if (!row) return;
          openRateEditModal(ruleId, row.hourly_rate);
        } else {
          await editClientRule(ruleId);
        }
      } catch (error) {
        console.error(error);
        alert("No se pudo actualizar la regla.");
      }
      return;
    }

    const deleteButton = target.closest("button[data-delete-rule-id]");
    if (!deleteButton) return;

    const ruleId = Number(deleteButton.dataset.deleteRuleId);
    const rowType = deleteButton.dataset.rowType || "client_rule";
    if (!ruleId) return;

    try {
      if (rowType === "client_rate") {
        openRateDeleteModal(ruleId);
      } else {
        await deleteClientRule(ruleId);
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar la regla.");
    }
  });
}

if (timeClient) {
  timeClient.addEventListener("change", refreshTimeCategorySelect);
}

if (timeEntryForm) {
  timeEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const personId = Number(timePerson.value);
    const clientId = Number(timeClient.value);
    const billingCategoryId = timeCategory.value ? Number(timeCategory.value) : null;
    const workDate = timeWorkDate.value;
    const hours = Number(timeHours.value);

    if (!clientId) {
      openInfoModal("No se pudo registrar horas", "Selecciona un cliente.");
      return;
    }

    await api("/time-entries", {
      method: "POST",
      body: JSON.stringify({
        personId,
        clientId,
        billingCategoryId,
        workDate,
        hours
      })
    });

    timeHours.value = "";
    await loadMetrics();
  });
}

refreshMetricsBtn.addEventListener("click", loadMetrics);
rateClient.addEventListener("change", refreshClientRulesView);
rateEditCancel.addEventListener("click", closeRateEditModal);

currencyToggle.addEventListener("change", () => {
  displayCurrency = currencyToggle.checked ? "USD" : "ARS";
  currencyLabel.textContent = displayCurrency;
  if (latestMetricsData) {
    renderEmployees(latestMetricsData.employees, latestMetricsData.exchange);
    renderSalaryChart(latestMetricsData.employees, latestMetricsData.exchange);
  }
});

rateEditModal.addEventListener("click", (event) => {
  if (event.target === rateEditModal) {
    closeRateEditModal();
  }
});

rateDeleteModal.addEventListener("click", (event) => {
  if (event.target === rateDeleteModal) {
    closeRateDeleteModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (infoModal && !infoModal.classList.contains("hidden")) {
    closeInfoModal();
    return;
  }

  if (clientEditModal && !clientEditModal.classList.contains("hidden")) {
    closeClientEditModal();
    return;
  }

  if (personEditModal && !personEditModal.classList.contains("hidden")) {
    closePersonEditModal();
    return;
  }

  if (ruleEditModal && !ruleEditModal.classList.contains("hidden")) {
    closeRuleEditModal(null);
    return;
  }

  if (actionConfirmModal && !actionConfirmModal.classList.contains("hidden")) {
    closeActionConfirmModal(false);
    return;
  }

  if (!rateEditModal.classList.contains("hidden")) {
    closeRateEditModal();
    return;
  }

  if (!rateDeleteModal.classList.contains("hidden")) {
    closeRateDeleteModal();
  }
});

rateDeleteCancel.addEventListener("click", closeRateDeleteModal);

if (actionConfirmCancel) {
  actionConfirmCancel.addEventListener("click", () => {
    closeActionConfirmModal(false);
  });
}

if (actionConfirmConfirm) {
  actionConfirmConfirm.addEventListener("click", () => {
    closeActionConfirmModal(true);
  });
}

if (actionConfirmModal) {
  actionConfirmModal.addEventListener("click", (event) => {
    if (event.target === actionConfirmModal) {
      closeActionConfirmModal(false);
    }
  });
}

if (ruleEditCancel) {
  ruleEditCancel.addEventListener("click", () => {
    closeRuleEditModal(null);
  });
}

if (ruleEditModal) {
  ruleEditModal.addEventListener("click", (event) => {
    if (event.target === ruleEditModal) {
      closeRuleEditModal(null);
    }
  });
}

if (ruleEditForm) {
  ruleEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editingClientRuleId) return;

    const newRate = Number(ruleEditValue?.value || 0);
    if (!Number.isFinite(newRate) || newRate <= 0) {
      ruleEditValue?.focus();
      return;
    }

    closeRuleEditModal(newRate);
  });
}

if (clientEditCancel) {
  clientEditCancel.addEventListener("click", closeClientEditModal);
}

if (personEditCancel) {
  personEditCancel.addEventListener("click", closePersonEditModal);
}

if (clientEditModal) {
  clientEditModal.addEventListener("click", (event) => {
    if (event.target === clientEditModal) {
      closeClientEditModal();
    }
  });
}

if (personEditModal) {
  personEditModal.addEventListener("click", (event) => {
    if (event.target === personEditModal) {
      closePersonEditModal();
    }
  });
}

if (infoModal) {
  infoModal.addEventListener("click", (event) => {
    if (event.target === infoModal) {
      closeInfoModal();
    }
  });
}

if (infoModalClose) {
  infoModalClose.addEventListener("click", closeInfoModal);
}

if (clientEditForm) {
  clientEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingClientId) return;

    const name = String(clientEditName?.value || "").trim();
    if (!name) {
      clientEditName?.focus();
      return;
    }

    try {
      await updateClient(editingClientId, name);
      closeClientEditModal();
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar el cliente.");
    }
  });
}

if (personEditForm) {
  personEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingPersonId) return;

    const fullName = String(personEditName?.value || "").trim();
    const monthlySalary = parseSalaryInputValue(personEditSalary?.value || "");
    if (!fullName || !Number.isFinite(monthlySalary) || monthlySalary < 0) {
      personEditName?.focus();
      return;
    }

    try {
      await updatePerson(editingPersonId, fullName, monthlySalary);
      closePersonEditModal();
    } catch (error) {
      console.error(error);
      openInfoModal("No se pudo actualizar la persona", error?.message || "Revisa los datos cargados.");
    }
  });
}

rateDeleteConfirm.addEventListener("click", async () => {
  if (!deletingRateId) return;

  try {
    await api(`/client-rates/${deletingRateId}`, { method: "DELETE" });
    closeRateDeleteModal();
    await Promise.all([loadClients(), refreshClientRulesView(), loadMetrics()]);
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar el valor histórico.");
  }
});

rateEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingRateId) return;

  const newRate = Number(rateEditValue.value);
  if (!newRate || newRate <= 0) {
    rateEditValue.focus();
    return;
  }

  await api(`/client-rates/${editingRateId}`, {
    method: "PATCH",
    body: JSON.stringify({ hourlyRate: newRate })
  });

  closeRateEditModal();
  await Promise.all([loadClients(), refreshClientRulesView(), loadMetrics()]);
});

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.body.classList.contains("theme-light") ? "light" : "dark";
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  });
}

if (employeesHead) {
  const headers = employeesHead.querySelectorAll("th.sortable[data-sort-key]");
  for (const header of headers) {
    header.addEventListener("click", () => {
      const nextKey = header.dataset.sortKey;
      if (!nextKey) return;

      if (tableSort.key === nextKey) {
        tableSort.direction = tableSort.direction === "asc" ? "desc" : "asc";
      } else {
        tableSort = { key: nextKey, direction: nextKey === "name" ? "asc" : "desc" };
      }

      updateHeaderSortIndicators();
      if (latestMetricsData) {
        renderEmployees(latestMetricsData.employees, latestMetricsData.exchange);
      }
    });
  }
}

if (clientRulesHead) {
  const headers = clientRulesHead.querySelectorAll("th.sortable[data-rule-sort-key]");
  for (const header of headers) {
    header.addEventListener("click", () => {
      const nextKey = header.dataset.ruleSortKey;
      if (!nextKey) return;

      if (clientRulesSort.key === nextKey) {
        clientRulesSort.direction = clientRulesSort.direction === "asc" ? "desc" : "asc";
      } else {
        clientRulesSort = {
          key: nextKey,
          direction: nextKey === "effectiveFrom" ? "desc" : "asc"
        };
      }

      updateClientRuleSortIndicators();
      renderClientRateRules(clientRulesCache);
    });
  }
}

setupPanelCollapse();
applyTheme(getInitialTheme());
updateHeaderSortIndicators();
updateClientRuleSortIndicators();

async function withRetry(taskFn, retries = 1) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await taskFn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

Promise.allSettled([
  withRetry(() => loadClients(), 1),
  withRetry(() => loadPeople(), 1),
  withRetry(() => loadMetrics(), 1)
]).then((results) => {
  const failed = results.filter((item) => item.status === "rejected");
  if (!failed.length) return;

  for (const error of failed) {
    console.error(error.reason);
  }

  const message = failed
    .map((item) => item.reason?.message || "Error desconocido")
    .join(" | ");
  alert(`Parte de la información no se pudo cargar: ${message}`);
});

