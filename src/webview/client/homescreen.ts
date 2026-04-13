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
  error?: string;
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

type InboundMessage = AiToolsDataMessage | AiToolsProgressMessage | AiToolsResultMessage;

// ── Module state ──────────────────────────────────────────────────────────────

let _isOpen = false;
let _dataFetched = false;
let _cachedData: Omit<AiToolsDataMessage, "command"> | null = null;


// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
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

// ── State rendering ───────────────────────────────────────────────────────────

function showPanelState(state: "loading" | "ready" | "done" | "error"): void {
  for (const s of ["loading", "ready", "done", "error"] as const) {
    const elem = el(`hs-ai-state-${s}`);
    if (elem) {
      elem.classList.toggle("hidden", s !== state);
    }
  }
}

// ── Helper functions ──────────────────────────────────────────────────────────

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

  if (_isOpen && !_dataFetched) {
    _dataFetched = true;
    showPanelState("loading");
    getVSCode()?.postMessage({ command: "aiToolsExpanded" });
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function handleApply(): void {
  if (!_cachedData) { return; }

  const skillCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-skill]");
  const mcpCheckboxes   = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-mcp]");

  const selectedSkills  = [...skillCheckboxes].filter((c) => c.checked && !c.disabled).map((c) => c.dataset.skill!);
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
    scope:    _cachedData.scope,
    skills:   selectedSkills,
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
  // Find the row by data-skill or data-mcp attribute
  const cb = document.querySelector<HTMLInputElement>(
    `[data-skill="${msg.item}"], [data-mcp="${msg.item}"]`
  );
  if (!cb) { return; }

  const row = cb.closest(".hs-ai-item");
  if (!row) { return; }

  // Remove existing tick if any
  row.querySelector(".hs-ai-item-tick")?.remove();

  const tick = document.createElement("span");
  tick.className = `hs-ai-item-tick hs-ai-item-tick--${msg.status === "done" ? "ok" : "err"}`;
  tick.textContent = msg.status === "done" ? "✓" : "✕";
  row.appendChild(tick);
}

function handleAiToolsResult(_msg: AiToolsResultMessage): void {
  _dataFetched = false;
  _cachedData = null;
  showPanelState("loading");
  getVSCode()?.postMessage({ command: "aiToolsExpanded" });
}

// ── Platform dropdown ─────────────────────────────────────────────────────────

function initPlatformDropdown(): void {
  const select = el<HTMLSelectElement>("hs-ai-platform-select");
  if (!select) { return; }
  select.addEventListener("change", () => {
    // Clear pending checkbox selections on platform switch
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

  // Show/hide clear button based on input value
  input.addEventListener("input", () => {
    if (clearBtn) {
      clearBtn.classList.toggle("hidden", input.value.trim() === "");
    }
  });

  // Submit search on Enter
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

  // Clear search
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.add("hidden");
    input.focus();
    getVSCode()?.postMessage({ command: "clearSearch" });
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
  initPlatformDropdown();
  initScopeToggle();

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
