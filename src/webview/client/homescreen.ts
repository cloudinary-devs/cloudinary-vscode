import { initCommon, getVSCode } from "./common";

// ── Types (mirrored from aiToolsService — no import possible in webview client) ──

interface SkillInfo {
  name: string;
  description: string;
  dirName: string;
}

interface McpServerInfo {
  key: string;
  label: string;
  description: string;
}

interface AdditionalPlatform {
  id: string;
  label: string;
  sublabel?: string;
  locked: boolean;
}

interface AiToolsDataMessage {
  command: "aiToolsData";
  skills: SkillInfo[];
  primaryPlatform: string;
  installedOnPrimary: string[];
  additionalPlatforms: AdditionalPlatform[];
  mcpServers: McpServerInfo[];
  configuredMcpKeys: string[];
  error?: string;
}

interface AiToolsProgressMessage {
  command: "aiToolsProgress";
  item: string;   // skill dirName or MCP key
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

const PLATFORM_LABELS: Record<string, string> = {
  "universal":      "Universal",
  "claude-code":    "Claude Code",
  "vscode-copilot": "VS Code (Copilot)",
  "windsurf":       "Windsurf",
};

function renderAdditionalPlatformRows(platforms: AdditionalPlatform[]): void {
  const list = el("hs-ai-platform-list");
  if (!list) { return; }
  list.innerHTML = platforms.map((p) => {
    const sublabel = p.sublabel
      ? `<span class="hs-ai-platform-sub">${escapeHtml(p.sublabel)}</span>`
      : "";
    return `<label class="hs-ai-item hs-ai-platform-row">
      <input type="checkbox" class="hs-ai-cb hs-ai-platform-cb" data-platform="${escapeHtml(p.id)}" ${p.locked ? "checked disabled" : ""}>
      <span class="hs-ai-item-name">${escapeHtml(p.label)}${sublabel}</span>
    </label>`;
  }).join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-platform-cb").forEach((cb) => {
    cb.addEventListener("change", updateApplyButton);
  });
}

// ── Checklist rendering ───────────────────────────────────────────────────────

function renderSkillRows(skills: SkillInfo[], installedOnPrimary: string[]): void {
  const list = el("hs-ai-skills-list");
  if (!list) { return; }
  const installedSet = new Set(installedOnPrimary);
  list.innerHTML = skills.map((s) => {
    const isInstalled = installedSet.has(s.dirName);
    const statusClass = isInstalled ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
    const statusText = isInstalled ? "installed" : "—";
    return `<label class="hs-ai-item">
      <input type="checkbox" class="hs-ai-cb" data-skill="${escapeHtml(s.dirName)}" ${isInstalled ? "checked disabled" : ""}>
      <span class="hs-ai-item-name" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}</span>
      <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
    </label>`;
  }).join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((cb) => {
    cb.addEventListener("change", updateApplyButton);
  });
}

function renderMcpRows(
  servers: McpServerInfo[],
  configuredKeys: string[]
): void {
  const list = el("hs-ai-mcp-list");
  if (!list) { return; }
  const configuredSet = new Set(configuredKeys);
  list.innerHTML = servers
    .map((s) => {
      const isConfigured = configuredSet.has(s.key);
      const statusClass = isConfigured ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isConfigured ? "configured" : "—";
      return `<label class="hs-ai-item">
        <input type="checkbox" class="hs-ai-cb" data-mcp="${escapeHtml(s.key)}" ${isConfigured ? "checked disabled" : ""}>
        <span class="hs-ai-item-name" title="${escapeHtml(s.description)}">${escapeHtml(s.label)}</span>
        <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
      </label>`;
    })
    .join("");
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
  const mcpCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-mcp]");

  const platformCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-platform]");

  const selectedSkills = [...skillCheckboxes].filter((c) => c.checked).map((c) => c.dataset.skill!);
  const selectedMcpKeys = [...mcpCheckboxes].filter((c) => c.checked).map((c) => c.dataset.mcp!);
  const additionalPlatforms = [...platformCheckboxes].filter((c) => c.checked).map((c) => c.dataset.platform!);
  const platforms = [_cachedData.primaryPlatform, ...additionalPlatforms];

  document.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((c) => { c.disabled = true; });
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applying…";
  }

  getVSCode()?.postMessage({
    command: "installAiTools",
    skills: selectedSkills,
    platforms,
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

  _cachedData = {
    skills: msg.skills,
    primaryPlatform: msg.primaryPlatform,
    installedOnPrimary: msg.installedOnPrimary,
    additionalPlatforms: msg.additionalPlatforms,
    mcpServers: msg.mcpServers,
    configuredMcpKeys: msg.configuredMcpKeys,
  };

  const platformLabel = el("hs-ai-skills-platform");
  if (platformLabel) { platformLabel.textContent = `(${PLATFORM_LABELS[msg.primaryPlatform] ?? msg.primaryPlatform})`; }

  renderAdditionalPlatformRows(msg.additionalPlatforms);
  renderSkillRows(msg.skills, msg.installedOnPrimary);
  renderMcpRows(msg.mcpServers, msg.configuredMcpKeys);
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

// ── Init ──────────────────────────────────────────────────────────────────────

function init(): void {
  initCommon();

  // Standard action buttons (non-accordion)
  document.querySelectorAll<HTMLElement>(".hs-action:not(#hs-btn-ai-tools)").forEach((btn) => {
    btn.addEventListener("click", () => {
      getVSCode()?.postMessage({ command: btn.dataset.command });
    });
  });

  // Configure credentials button (uses hs-setup-banner-btn, not hs-action)
  document.getElementById("hs-btn-configure")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "openGlobalConfig" });
  });

  // Accordion toggle
  el("hs-btn-ai-tools").addEventListener("click", toggleAccordion);

  // Apply button
  el<HTMLButtonElement>("hs-ai-apply")?.addEventListener("click", handleApply);

  // VS Code → webview messages
  window.addEventListener("message", (event: MessageEvent<InboundMessage>) => {
    const msg = event.data;
    switch (msg.command) {
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
