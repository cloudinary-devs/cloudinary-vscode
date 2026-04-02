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

interface AiToolsDataMessage {
  command: "aiToolsData";
  skills: SkillInfo[];
  installedByPlatform: Record<string, string[]>; // platformId → array of dirNames
  activePlatforms: string[];
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

function getCheckedPlatforms(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>(".hs-ai-platform-cb")]
    .filter((c) => c.checked)
    .map((c) => c.dataset.platform!);
}

function computeSkillStatus(
  dirName: string,
  installedByPlatform: Record<string, string[]>,
  checkedPlatforms: string[]
): "installed" | "partial" | "none" {
  if (checkedPlatforms.length === 0) { return "none"; }
  const installedCount = checkedPlatforms.filter(
    (pid) => (installedByPlatform[pid] ?? []).includes(dirName)
  ).length;
  if (installedCount === checkedPlatforms.length) { return "installed"; }
  if (installedCount > 0) { return "partial"; }
  return "none";
}

// ── Platform definitions and rendering ───────────────────────────────────────

const PLATFORM_DEFS = [
  { id: "universal",      label: "Universal",        sublabel: "Cursor, Codex, Amp, Warp + more" },
  { id: "claude-code",    label: "Claude Code" },
  { id: "vscode-copilot", label: "VS Code (Copilot)" },
  { id: "windsurf",       label: "Windsurf" },
];

function renderPlatformRows(activePlatforms: string[]): void {
  const list = el("hs-ai-platform-list");
  if (!list) { return; }
  const activeSet = new Set(activePlatforms);
  list.innerHTML = PLATFORM_DEFS.map((p) => {
    const checked = activeSet.has(p.id) ? "checked" : "";
    const sublabel = p.sublabel
      ? `<span class="hs-ai-platform-sub">${escapeHtml(p.sublabel)}</span>`
      : "";
    return `<label class="hs-ai-item hs-ai-platform-row">
      <input type="checkbox" class="hs-ai-cb hs-ai-platform-cb" data-platform="${escapeHtml(p.id)}" ${checked}>
      <span class="hs-ai-item-name">${escapeHtml(p.label)}${sublabel}</span>
    </label>`;
  }).join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-platform-cb").forEach((cb) => {
    cb.addEventListener("change", onPlatformChange);
  });
}

function onPlatformChange(): void {
  if (!_cachedData) { return; }
  const checkedPlatforms = getCheckedPlatforms();
  renderSkillRows(_cachedData.skills, _cachedData.installedByPlatform, checkedPlatforms);
  updateApplyButton();
}

// ── Checklist rendering ───────────────────────────────────────────────────────

function renderSkillRows(
  skills: SkillInfo[],
  installedByPlatform: Record<string, string[]>,
  checkedPlatforms: string[]
): void {
  const list = el("hs-ai-skills-list");
  if (!list) { return; }
  list.innerHTML = skills.map((s) => {
    const status = computeSkillStatus(s.dirName, installedByPlatform, checkedPlatforms);
    const statusClass = status === "installed" ? "hs-ai-item-status--ok"
                      : status === "partial"   ? "hs-ai-item-status--partial"
                      : "hs-ai-item-status--none";
    const statusText = status === "installed" ? "installed"
                     : status === "partial"   ? "partial"
                     : "—";
    const checked = status !== "installed" ? "checked" : "";
    return `<label class="hs-ai-item">
      <input type="checkbox" class="hs-ai-cb" data-skill="${escapeHtml(s.dirName)}" ${checked}>
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
        <input type="checkbox" class="hs-ai-cb" data-mcp="${escapeHtml(s.key)}" ${isConfigured ? "" : "checked"}>
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
  const anyItemChecked = [...document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-skill], .hs-ai-cb[data-mcp]")]
    .some((c) => c.checked && !c.disabled);
  const anyPlatformChecked = getCheckedPlatforms().length > 0;
  applyBtn.disabled = !(anyItemChecked && anyPlatformChecked);
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

  const selectedSkills = [...skillCheckboxes].filter((c) => c.checked).map((c) => c.dataset.skill!);
  const selectedMcpKeys = [...mcpCheckboxes].filter((c) => c.checked).map((c) => c.dataset.mcp!);
  const selectedPlatforms = getCheckedPlatforms();

  document.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((c) => { c.disabled = true; });
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applying…";
  }

  getVSCode()?.postMessage({
    command: "installAiTools",
    skills: selectedSkills,
    platforms: selectedPlatforms,
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
    installedByPlatform: msg.installedByPlatform,
    activePlatforms: msg.activePlatforms,
    mcpServers: msg.mcpServers,
    configuredMcpKeys: msg.configuredMcpKeys,
  };

  const checkedPlatforms = msg.activePlatforms;
  renderPlatformRows(checkedPlatforms);
  renderSkillRows(msg.skills, msg.installedByPlatform, checkedPlatforms);
  renderMcpRows(msg.mcpServers, msg.configuredMcpKeys);
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

function handleAiToolsResult(msg: AiToolsResultMessage): void {
  // Force a re-fetch next time the panel opens so installed state is fresh
  _dataFetched = false;
  _cachedData = null;

  // Build done state: collect rows with ticks and show them
  const doneSkillsDiv = el("hs-ai-done-skills-list");
  const doneMcpDiv = el("hs-ai-done-mcp-list");

  if (doneSkillsDiv) {
    const rows = document.querySelectorAll<HTMLElement>("#hs-ai-skills-list .hs-ai-item");
    doneSkillsDiv.innerHTML = "";
    rows.forEach((row) => {
      const tick = row.querySelector(".hs-ai-item-tick");
      if (!tick) { return; }
      const name = row.querySelector(".hs-ai-item-name")?.textContent ?? "";
      const isOk = tick.classList.contains("hs-ai-item-tick--ok");
      const statusClass = isOk ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isOk ? "installed" : "error";
      doneSkillsDiv.insertAdjacentHTML(
        "beforeend",
        `<div class="hs-ai-item">
          <span class="hs-ai-item-tick hs-ai-item-tick--${isOk ? "ok" : "err"}">${isOk ? "✓" : "✕"}</span>
          <span class="hs-ai-item-name">${name}</span>
          <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
        </div>`
      );
    });
  }

  if (doneMcpDiv) {
    const rows = document.querySelectorAll<HTMLElement>("#hs-ai-mcp-list .hs-ai-item");
    doneMcpDiv.innerHTML = "";
    rows.forEach((row) => {
      const tick = row.querySelector(".hs-ai-item-tick");
      if (!tick) { return; }
      const name = row.querySelector(".hs-ai-item-name")?.textContent ?? "";
      const isOk = tick.classList.contains("hs-ai-item-tick--ok");
      const statusClass = isOk ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isOk ? "configured" : "error";
      doneMcpDiv.insertAdjacentHTML(
        "beforeend",
        `<div class="hs-ai-item">
          <span class="hs-ai-item-tick hs-ai-item-tick--${isOk ? "ok" : "err"}">${isOk ? "✓" : "✕"}</span>
          <span class="hs-ai-item-name">${name}</span>
          <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
        </div>`
      );
    });
  }

  showPanelState("done");
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

  // Apply again button (done state)
  el<HTMLButtonElement>("hs-ai-apply-again")?.addEventListener("click", () => {
    // Re-open: reset state and re-fetch
    _isOpen = false;
    toggleAccordion();
  });

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
