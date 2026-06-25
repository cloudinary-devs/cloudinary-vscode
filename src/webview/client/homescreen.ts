import { initCommon, getVSCode } from "./common";

// ── Types (mirrored from aiToolsService — no import possible in webview client) ──

interface SkillStatusInfo {
  name: string;
  description: string;
  dirName: string;
  installedInScope: boolean;
  installedInOtherScope: boolean;
}

interface McpServerInfo {
  key: string;
  label: string;
  description: string;
  configured: boolean;
}

interface AiToolsDataMessage {
  command: "aiToolsData";
  platform: string;
  scope: "project" | "global";
  platformLabel: string;
  platformCovers?: string;
  allPlatforms: { id: string; name: string }[];
  skills: SkillStatusInfo[];
  mcpServers: McpServerInfo[];
  mcpEditorLabel?: string;
  error?: string;
}

interface HomescreenDataMessage {
  command: "homescreenData";
  status: "connected" | "setupNeeded" | "checking";
  cloudName: string;
  folderMode: string;
  envCount: number;
}

interface DocsAiRecentConversation {
  id: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
}

interface DocsAiRecentConversationsMessage {
  command: "docsAiRecentConversations";
  conversations: DocsAiRecentConversation[];
}

interface AiToolsProgressMessage {
  command: "aiToolsProgress";
  item: string;
  status: "done" | "error";
}

interface AiToolsResultMessage {
  command: "aiToolsResult";
  errors: string[];
}

type InboundMessage = AiToolsDataMessage | AiToolsProgressMessage | AiToolsResultMessage | DocsAiRecentConversationsMessage;

// ── Module state ──────────────────────────────────────────────────────────────

let _isOpen = false;
let _cachedData: Omit<AiToolsDataMessage, "command"> | null = null;
let _docsAiRecentSource: "none" | "host" | "local" = "none";
let _docsAiConversations: DocsAiRecentConversation[] = [];
let _docsAiHistoryExpanded = false;


// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function showClearChatsConfirmation(onConfirm: () => void | Promise<void>): void {
  document.querySelector(".docs-ai-confirm-overlay")?.remove();

  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const overlay = document.createElement("div");
  overlay.className = "docs-ai-confirm-overlay";
  overlay.setAttribute("role", "presentation");
  overlay.innerHTML = `
    <div class="docs-ai-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="docs-ai-confirm-title" aria-describedby="docs-ai-confirm-message">
      <h2 id="docs-ai-confirm-title" class="docs-ai-confirm-title">Delete all conversations?</h2>
      <p id="docs-ai-confirm-message" class="docs-ai-confirm-message">This will permanently remove all chat history.</p>
      <div class="docs-ai-confirm-actions">
        <button class="docs-ai-confirm-btn docs-ai-confirm-cancel" type="button">Cancel</button>
        <button class="docs-ai-confirm-btn docs-ai-confirm-delete" type="button">Delete All</button>
      </div>
    </div>
  `;

  const cancelButton = overlay.querySelector<HTMLButtonElement>(".docs-ai-confirm-cancel");
  const deleteButton = overlay.querySelector<HTMLButtonElement>(".docs-ai-confirm-delete");
  if (!cancelButton || !deleteButton) { return; }

  function close(): void {
    document.removeEventListener("keydown", handleKeydown);
    overlay.remove();
    previouslyFocused?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      close();
    }
  }

  cancelButton.addEventListener("click", close);
  deleteButton.addEventListener("click", () => {
    close();
    void onConfirm();
  });
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  document.body.appendChild(overlay);
  document.addEventListener("keydown", handleKeydown);
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  cancelButton.focus();
}

function show(id: string): void {
  el(id)?.classList.remove("hidden");
}

function hide(id: string): void {
  el(id)?.classList.add("hidden");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function timeAgo(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "";
  }
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) { return "just now"; }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) { return `${minutes}m`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h`; }
  const days = Math.floor(hours / 24);
  if (days < 30) { return `${days}d`; }
  return new Date(timestamp).toLocaleDateString();
}

function groupDocsAiConversations(conversations: DocsAiRecentConversation[]): { label: string; items: DocsAiRecentConversation[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const today: DocsAiRecentConversation[] = [];
  const yesterday: DocsAiRecentConversation[] = [];
  const week: DocsAiRecentConversation[] = [];
  const older: DocsAiRecentConversation[] = [];

  conversations.forEach((conversation) => {
    const timestamp = conversation.updatedAt ?? conversation.createdAt ?? 0;
    if (timestamp >= todayStart) {
      today.push(conversation);
    } else if (timestamp >= yesterdayStart) {
      yesterday.push(conversation);
    } else if (timestamp >= weekStart) {
      week.push(conversation);
    } else {
      older.push(conversation);
    }
  });

  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "Previous 7 days", items: week },
    { label: "Older", items: older },
  ].filter((group) => group.items.length > 0);
}

function openDocsAiDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open("CloudinaryVSCodeChatDB", 2);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
      }
      if (!db.objectStoreNames.contains("tabState")) {
        db.createObjectStore("tabState", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadDocsAiConversations(): Promise<DocsAiRecentConversation[]> {
  const db = await openDocsAiDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("conversations", "readonly");
    const request = tx.objectStore("conversations").getAll();
    request.onsuccess = () => {
      const conversations = (request.result || []) as DocsAiRecentConversation[];
      conversations.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
      resolve(conversations);
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearDocsAiConversationStores(): Promise<void> {
  const db = await openDocsAiDb();
  const stores = ["conversations", "messages", "tabState"].filter((storeName) =>
    db.objectStoreNames.contains(storeName)
  );
  if (stores.length === 0) { return; }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    stores.forEach((storeName) => tx.objectStore(storeName).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearDocsAiRecentConversations(): Promise<void> {
  if (_docsAiConversations.length === 0) { return; }

  showClearChatsConfirmation(async () => {
    try {
      await clearDocsAiConversationStores();
      _docsAiHistoryExpanded = false;
      _docsAiRecentSource = "local";
      renderDocsAiRecentConversations([], "local");
      getVSCode()?.postMessage({ command: "clearDocsAiConversations" });
    } catch (error) {
      console.error("Failed to clear Docs AI conversations:", error);
    }
  });
}

// ── State rendering ───────────────────────────────────────────────────────────

function showPanelState(state: "loading" | "ready" | "done" | "error"): void {
  for (const s of ["loading", "ready", "done", "error"] as const) {
    const elem = el(`hs-ai-state-${s}`);
    if (elem) {
      elem.classList.toggle("hidden", s !== state);
    }
  }
}

// ── Platform rendering ────────────────────────────────────────────────────────

function renderPlatformDropdown(allPlatforms: { id: string; name: string }[], currentPlatform: string): void {
  const select = el<HTMLSelectElement>("hs-ai-platform-select");
  if (!select) { return; }
  select.innerHTML = allPlatforms
    .map((p) => `<option value="${escapeHtml(p.id)}"${p.id === currentPlatform ? " selected" : ""}>${escapeHtml(p.name)}</option>`)
    .join("");
}

// ── Checklist rendering ───────────────────────────────────────────────────────

function renderSkillRows(skills: SkillStatusInfo[], scope: "project" | "global"): void {
  const list = el("hs-ai-skills-list");
  if (!list) { return; }
  const otherScope = scope === "project" ? "global" : "project";
  list.innerHTML = skills.map((s) => {
    const isInstalled = s.installedInScope;
    const statusClass = isInstalled ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
    const statusText = isInstalled ? "installed" : "—";
    const otherHint = s.installedInOtherScope
      ? `<span class="hs-ai-item-status-other">· also ${escapeHtml(otherScope)}</span>`
      : "";
    return `<label class="hs-ai-item">
      <input type="checkbox" class="hs-ai-cb" data-skill="${escapeHtml(s.dirName)}" ${isInstalled ? "checked disabled" : ""}>
      <span class="hs-ai-item-name" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}</span>
      <span class="hs-ai-item-status ${statusClass}">${statusText}${otherHint}</span>
    </label>`;
  }).join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((cb) => {
    cb.addEventListener("change", updateApplyButton);
  });
}

function renderMcpRows(servers: McpServerInfo[]): void {
  const list = el("hs-ai-mcp-list");
  if (!list) { return; }
  list.innerHTML = servers.map((s) => {
    const isConfigured = s.configured;
    const statusClass = isConfigured ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
    const statusText = isConfigured ? "configured" : "—";
    return `<label class="hs-ai-item">
      <input type="checkbox" class="hs-ai-cb" data-mcp="${escapeHtml(s.key)}" ${isConfigured ? "checked disabled" : ""}>
      <span class="hs-ai-item-name" title="${escapeHtml(s.description)}">${escapeHtml(s.label)}</span>
      <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
    </label>`;
  }).join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((cb) => {
    cb.addEventListener("change", updateApplyButton);
  });
}

function updateApplyButton(): void {
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (!applyBtn) { return; }
  const anyActionable = [...document.querySelectorAll<HTMLInputElement>(".hs-ai-cb")]
    .some((c) => c.checked && !c.disabled);
  applyBtn.disabled = !anyActionable;
}

// ── Accordion toggle ──────────────────────────────────────────────────────────

function toggleAccordion(): void {
  _isOpen = !_isOpen;

  const panel = el("hs-ai-panel");
  const btn = el("hs-btn-ai-tools");
  const chevron = el("hs-ai-chevron");

  panel.classList.toggle("open", _isOpen);
  btn.classList.toggle("expanded", _isOpen);
  btn.setAttribute("aria-expanded", String(_isOpen));
  chevron.classList.toggle("hs-chevron--open", _isOpen);

  if (_isOpen && !_cachedData) {
    showPanelState("loading");
    getVSCode()?.postMessage({ command: "aiToolsExpanded" });
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function handleApply(): void {
  if (!_cachedData) { return; }

  const skillCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-skill]");
  const mcpCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-mcp]");

  const selectedSkills = [...skillCheckboxes].filter((c) => c.checked && !c.disabled).map((c) => c.dataset.skill!);
  const selectedMcpKeys = [...mcpCheckboxes].filter((c) => c.checked && !c.disabled).map((c) => c.dataset.mcp!);

  document.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((c) => { c.disabled = true; });
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applying…";
  }

  getVSCode()?.postMessage({
    command: "installAiTools",
    platform: _cachedData.platform,
    scope: _cachedData.scope,
    skills: selectedSkills,
    mcpServers: selectedMcpKeys,
  });
}

// ── Message handling ──────────────────────────────────────────────────────────

function handleAiToolsData(msg: AiToolsDataMessage): void {
  if (msg.error) {
    const errEl = el("hs-ai-error-msg");
    if (errEl) { errEl.textContent = msg.error; }
    showPanelState("error");
    return;
  }

  // Preserve pending skill selections across scope changes
  const previouslyChecked = new Set(
    [...document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-skill]:not(:disabled)")]
      .filter((c) => c.checked)
      .map((c) => c.dataset.skill!)
  );

  _cachedData = {
    platform: msg.platform,
    scope: msg.scope,
    platformLabel: msg.platformLabel,
    platformCovers: msg.platformCovers,
    allPlatforms: msg.allPlatforms,
    skills: msg.skills,
    mcpServers: msg.mcpServers,
    mcpEditorLabel: msg.mcpEditorLabel,
  };

  // Sync scope toggle buttons
  document.querySelectorAll<HTMLButtonElement>(".hs-ai-scope-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.scope === msg.scope);
  });

  // Update "also covers" note
  const coversEl = el("hs-ai-platform-covers");
  if (coversEl) {
    coversEl.textContent = msg.platformCovers ?? "";
    coversEl.classList.toggle("hidden", !msg.platformCovers);
  }

  renderPlatformDropdown(msg.allPlatforms, msg.platform);
  renderSkillRows(msg.skills, msg.scope);
  renderMcpRows(msg.mcpServers);

  // Update MCP editor note
  const mcpNoteEl = el("hs-ai-mcp-editor-note");
  if (mcpNoteEl) {
    mcpNoteEl.textContent = msg.mcpEditorLabel ? `· for ${msg.mcpEditorLabel}` : "";
    mcpNoteEl.classList.toggle("hidden", !msg.mcpEditorLabel);
  }

  // Re-apply pending selections that survived the re-render
  previouslyChecked.forEach((dirName) => {
    const cb = document.querySelector<HTMLInputElement>(`.hs-ai-cb[data-skill="${dirName}"]:not(:disabled)`);
    if (cb) { cb.checked = true; }
  });

  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (applyBtn) { applyBtn.textContent = "Apply"; }
  showPanelState("ready");
  updateApplyButton();
}

function handleAiToolsProgress(msg: AiToolsProgressMessage): void {
  const cb = document.querySelector<HTMLInputElement>(
    `[data-skill="${msg.item}"], [data-mcp="${msg.item}"]`
  );
  if (!cb) { return; }

  const row = cb.closest(".hs-ai-item");
  if (!row) { return; }

  row.querySelector(".hs-ai-item-tick")?.remove();

  const tick = document.createElement("span");
  tick.className = `hs-ai-item-tick hs-ai-item-tick--${msg.status === "done" ? "ok" : "err"}`;
  tick.textContent = msg.status === "done" ? "✓" : "✕";
  row.appendChild(tick);
}

function handleAiToolsResult(_msg: AiToolsResultMessage): void {
  // Reload to reflect newly-installed items, but via "aiToolsRefresh" (not
  // "aiToolsExpanded") so the user's selected platform/scope are preserved
  // instead of being reset to the auto-detected defaults.
  _cachedData = null;
  showPanelState("loading");
  getVSCode()?.postMessage({ command: "aiToolsRefresh" });
}

// ── Homescreen data ───────────────────────────────────────────────────────────

function handleHomescreenData(msg: HomescreenDataMessage): void {
  const statusDot = document.getElementById("hs-status-dot");
  const statusText = document.getElementById("hs-status-text");
  const cloudNameEl = document.getElementById("hs-cloud-name");
  const folderModeEl = document.getElementById("hs-folder-mode");
  const setupBanner = document.getElementById("hs-setup-banner");
  const searchEl = document.getElementById("hs-search");
  const switchEnvBtn = document.getElementById("hs-btn-switch-env");
  const envCountEl = document.getElementById("hs-env-count");

  const connected = msg.status === "connected";
  const setupNeeded = msg.status === "setupNeeded";
  const checking = msg.status === "checking";

  // Only "Setup needed" is an alarming (warn) state. "Checking…" is neutral.
  statusDot?.classList.toggle("hs-status-dot--warn", setupNeeded);
  if (statusText) {
    statusText.textContent = connected ? "Connected" : checking ? "Checking…" : "Setup needed";
  }
  if (cloudNameEl) {
    // Show the cloud name whenever one is configured (even while checking or if
    // rejected); only fall back to the placeholder when nothing is set up.
    const showName = !!msg.cloudName && !setupNeeded;
    cloudNameEl.textContent = showName ? msg.cloudName : "Not configured";
    cloudNameEl.classList.toggle("hs-cloud-name--placeholder", !showName);
  }
  if (folderModeEl) {
    // Folder mode is only meaningful once credentials are confirmed valid.
    folderModeEl.textContent = msg.folderMode;
    folderModeEl.classList.toggle("hidden", !connected);
  }
  // Prompt setup only when credentials are missing or rejected — not while checking.
  setupBanner?.classList.toggle("hidden", !setupNeeded);
  // Search needs working credentials; keep it hidden until connected.
  searchEl?.classList.toggle("hidden", !connected);
  switchEnvBtn?.classList.toggle("hidden", msg.envCount <= 1);
  if (envCountEl) { envCountEl.textContent = String(msg.envCount); }
}

// ── Platform dropdown ─────────────────────────────────────────────────────────

function initPlatformDropdown(): void {
  const select = el<HTMLSelectElement>("hs-ai-platform-select");
  if (!select) { return; }
  select.addEventListener("change", () => {
    document.querySelectorAll<HTMLInputElement>(".hs-ai-cb:not(:disabled)").forEach((cb) => { cb.checked = false; });
    showPanelState("loading");
    getVSCode()?.postMessage({ command: "changePlatform", platform: select.value });
  });
}

// ── Scope toggle ──────────────────────────────────────────────────────────────

function initScopeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>(".hs-ai-scope-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scope = btn.dataset.scope as "project" | "global";
      showPanelState("loading");
      getVSCode()?.postMessage({ command: "changeScope", scope });
    });
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

function initSearch(): void {
  const input = document.getElementById("hs-search-input") as HTMLInputElement | null;
  const clearBtn = document.getElementById("hs-search-clear") as HTMLButtonElement | null;

  if (!input) { return; }

  input.addEventListener("input", () => {
    if (clearBtn) {
      clearBtn.classList.toggle("hidden", input.value.trim() === "");
    }
  });

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      const query = input.value.trim();
      if (query) {
        getVSCode()?.postMessage({ command: "searchAssets", data: query });
      }
    }
    if (e.key === "Escape") {
      input.value = "";
      clearBtn?.classList.add("hidden");
      getVSCode()?.postMessage({ command: "clearSearch" });
    }
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.add("hidden");
    input.focus();
    getVSCode()?.postMessage({ command: "clearSearch" });
  });
}

// ── Docs AI launcher ──────────────────────────────────────────────────────────

function submitDocsAiQuestion(question?: string): void {
  const input = document.getElementById("hs-docs-ai-input") as HTMLTextAreaElement | null;
  const prompt = (question ?? input?.value ?? "").trim();
  if (!prompt) { return; }

  if (input) {
    input.value = "";
    input.style.height = "auto";
  }
  updateDocsAiSubmit();
  getVSCode()?.postMessage({ command: "showDocsAI", data: prompt });
}

function updateDocsAiSubmit(): void {
  const input = document.getElementById("hs-docs-ai-input") as HTMLTextAreaElement | null;
  const submit = document.getElementById("hs-docs-ai-submit") as HTMLButtonElement | null;
  if (submit) {
    submit.disabled = !input?.value.trim();
  }
}

function renderDocsAiRecentConversations(
  conversations: DocsAiRecentConversation[],
  source: "host" | "local" = "local"
): void {
  const container = document.getElementById("hs-docs-ai-recent");
  const list = document.getElementById("hs-docs-ai-recent-list");
  const historyToggle = document.getElementById("hs-docs-ai-history-toggle") as HTMLButtonElement | null;
  if (!container || !list) { return; }

  const nextConversations = conversations
    .filter((conversation) => conversation.id && conversation.title)
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));

  _docsAiConversations = nextConversations;
  _docsAiRecentSource = source;
  if (historyToggle) {
    const toggleText = _docsAiHistoryExpanded ? "Hide recent conversations" : "View recent conversations";
    const toggleLabel = historyToggle.querySelector<HTMLElement>(".hs-docs-ai-history-toggle-label");
    historyToggle.classList.toggle("hidden", _docsAiConversations.length === 0);
    historyToggle.classList.toggle("is-active", _docsAiHistoryExpanded);
    historyToggle.setAttribute("aria-expanded", String(_docsAiHistoryExpanded));
    historyToggle.title = toggleText;
    historyToggle.setAttribute("aria-label", toggleText);
    if (toggleLabel) {
      toggleLabel.textContent = toggleText;
    }
  }

  if (_docsAiConversations.length === 0) {
    _docsAiHistoryExpanded = false;
    if (historyToggle) {
      historyToggle.classList.remove("is-active");
      historyToggle.setAttribute("aria-expanded", "false");
    }
    container.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  const visibleConversations = _docsAiHistoryExpanded ? _docsAiConversations : [];

  container.classList.toggle("hidden", !_docsAiHistoryExpanded);

  const renderRow = (conversation: DocsAiRecentConversation) => {
    const timestamp = conversation.updatedAt ?? conversation.createdAt;
    return `<button class="hs-docs-ai-recent-item" type="button" data-conv-id="${escapeHtml(conversation.id)}">
      <svg class="hs-docs-ai-recent-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="hs-docs-ai-recent-title">${escapeHtml(conversation.title)}</span>
      <span class="hs-docs-ai-recent-time">${escapeHtml(timeAgo(timestamp))}</span>
    </button>`;
  };

  list.classList.toggle("hs-docs-ai-recent-list--expanded", _docsAiHistoryExpanded);
  if (_docsAiHistoryExpanded) {
    if (visibleConversations.length === 0) {
      list.innerHTML = `<div class="hs-docs-ai-history-empty">No previous chats yet</div>`;
    } else {
      list.innerHTML = groupDocsAiConversations(visibleConversations).map((group) => `
        <div class="hs-docs-ai-history-group">
          <div class="hs-docs-ai-history-group-label">${group.label}</div>
          ${group.items.map(renderRow).join("")}
        </div>
      `).join("") + `
        <div class="hs-docs-ai-history-footer">
          <button id="hs-docs-ai-clear-all" class="hs-docs-ai-clear-all" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            <span>Clear all chats</span>
          </button>
        </div>
      `;
    }
  } else {
    list.innerHTML = "";
  }

  list.querySelectorAll<HTMLButtonElement>(".hs-docs-ai-recent-item").forEach((button) => {
    button.addEventListener("click", () => {
      const conversationId = button.dataset.convId;
      if (conversationId) {
        getVSCode()?.postMessage({ command: "showDocsAIConversation", data: conversationId });
      }
    });
  });

  list.querySelector<HTMLButtonElement>("#hs-docs-ai-clear-all")?.addEventListener("click", () => {
    void clearDocsAiRecentConversations();
  });
}

async function refreshDocsAiRecentConversations(): Promise<void> {
  try {
    const conversations = await loadDocsAiConversations();
    if (conversations.length === 0 && _docsAiConversations.length > 0) {
      return;
    }
    renderDocsAiRecentConversations(conversations, "local");
  } catch {
    // The Docs AI webview also pushes a cached recent list through VS Code.
  }
}

function initDocsAiPromptScroller(): void {
  const scroller = document.querySelector<HTMLElement>(".hs-docs-ai-chips");
  if (!scroller || scroller.children.length < 2) { return; }

  scroller.addEventListener("click", (event: MouseEvent) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>(".hs-docs-ai-chip")
      : null;
    if (!target || !scroller.contains(target)) { return; }
    submitDocsAiQuestion(target.dataset.question);
  });

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { return; }

  const originalChips = Array.from(scroller.querySelectorAll<HTMLButtonElement>(".hs-docs-ai-chip"));
  originalChips.forEach((chip) => {
    const clone = chip.cloneNode(true) as HTMLButtonElement;
    clone.tabIndex = -1;
    clone.setAttribute("aria-hidden", "true");
    scroller.appendChild(clone);
  });

  let pauseUntil = 0;
  const pause = () => {
    pauseUntil = Date.now() + 8000;
  };

  ["focusin", "mouseenter", "pointerdown", "wheel"].forEach((eventName) => {
    scroller.addEventListener(eventName, pause, { passive: true });
  });

  const interval = window.setInterval(() => {
    if (!document.body.contains(scroller)) {
      window.clearInterval(interval);
      return;
    }
    if (Date.now() < pauseUntil) { return; }

    const chips = Array.from(scroller.querySelectorAll<HTMLButtonElement>(".hs-docs-ai-chip"));
    const originalCount = originalChips.length;
    if (chips.length <= originalCount) { return; }

    const chipLeft = (chip: HTMLElement) => chip.offsetLeft - scroller.offsetLeft;
    const nearestIndex = chips.reduce((nearest, chip, index) => {
      const distance = Math.abs(chipLeft(chip) - scroller.scrollLeft);
      const nearestDistance = Math.abs(chipLeft(chips[nearest]) - scroller.scrollLeft);
      return distance < nearestDistance ? index : nearest;
    }, 0);
    const normalizedIndex = nearestIndex >= originalCount ? nearestIndex - originalCount : nearestIndex;

    if (nearestIndex >= originalCount) {
      scroller.scrollTo({ left: chipLeft(chips[normalizedIndex]), behavior: "auto" });
    }

    const nextIndex = normalizedIndex + 1;
    scroller.scrollTo({ left: chipLeft(chips[nextIndex]), behavior: "smooth" });

    if (nextIndex >= originalCount) {
      window.setTimeout(() => {
        scroller.scrollTo({ left: chipLeft(chips[nextIndex - originalCount]), behavior: "auto" });
      }, 900);
    }
  }, 3200);
}

function initDocsAiHome(): void {
  const input = document.getElementById("hs-docs-ai-input") as HTMLTextAreaElement | null;
  const submit = document.getElementById("hs-docs-ai-submit") as HTMLButtonElement | null;

  input?.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
    updateDocsAiSubmit();
  });

  input?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitDocsAiQuestion();
    }
  });

  submit?.addEventListener("click", () => submitDocsAiQuestion());
  document.getElementById("hs-docs-ai-history-toggle")?.addEventListener("click", () => {
    _docsAiHistoryExpanded = !_docsAiHistoryExpanded;
    if (_docsAiHistoryExpanded) {
      getVSCode()?.postMessage({ command: "refreshDocsAiRecentConversations" });
      void refreshDocsAiRecentConversations();
    }
    renderDocsAiRecentConversations(_docsAiConversations, _docsAiRecentSource === "none" ? "local" : _docsAiRecentSource);
  });

  initDocsAiPromptScroller();
  void refreshDocsAiRecentConversations();
  window.addEventListener("focus", () => void refreshDocsAiRecentConversations());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshDocsAiRecentConversations();
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init(): void {
  initCommon();

  // Standard action buttons (non-accordion)
  document.querySelectorAll<HTMLElement>(".hs-action:not(#hs-btn-ai-tools)").forEach((btn) => {
    btn.addEventListener("click", () => {
      getVSCode()?.postMessage({ command: btn.dataset.command });
    });
  });

  // Configure credentials button (setup banner, not hs-action)
  document.getElementById("hs-btn-configure")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "openGlobalConfig" });
  });

  // Header configure button (gear icon in cloud row)
  document.getElementById("hs-btn-header-configure")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "openGlobalConfig" });
  });

  // Footer links (use data-command like hs-action but have a different class)
  document.querySelectorAll<HTMLElement>(".hs-footer-link[data-command]").forEach((btn) => {
    btn.addEventListener("click", () => {
      getVSCode()?.postMessage({ command: btn.dataset.command });
    });
  });

  // Search input
  initSearch();
  initDocsAiHome();
  initPlatformDropdown();
  initScopeToggle();

  // Signal ready so the extension host can push dynamic data immediately
  getVSCode()?.postMessage({ command: "ready" });

  // Accordion toggle
  el("hs-btn-ai-tools").addEventListener("click", toggleAccordion);

  // Apply button
  el<HTMLButtonElement>("hs-ai-apply")?.addEventListener("click", handleApply);

  // VS Code → webview messages
  window.addEventListener("message", (event: MessageEvent<InboundMessage | { command: string }>) => {
    const msg = event.data;
    switch (msg.command) {
      case "focusSearch": {
        const input = document.getElementById("hs-search-input") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
        break;
      }
      case "homescreenData":
        handleHomescreenData(msg as HomescreenDataMessage);
        break;
      case "docsAiRecentConversations":
        renderDocsAiRecentConversations((msg as DocsAiRecentConversationsMessage).conversations ?? [], "host");
        break;
      case "aiToolsData":
        handleAiToolsData(msg as AiToolsDataMessage);
        break;
      case "aiToolsProgress":
        handleAiToolsProgress(msg as AiToolsProgressMessage);
        break;
      case "aiToolsResult":
        handleAiToolsResult(msg as AiToolsResultMessage);
        break;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
