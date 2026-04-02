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
  installedByIde: Record<string, string[]>; // ideLabel → array of dirNames
  mcpServers: McpServerInfo[];
  configuredMcpKeys: string[];
  detectedIde: string;
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
let _activeIde = "Claude Code";

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function show(id: string): void {
  el(id).classList.remove("hidden");
}

function hide(id: string): void {
  el(id).classList.add("hidden");
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

// ── IDE pill ──────────────────────────────────────────────────────────────────

function movePill(btn: HTMLElement): void {
  const pill = el<HTMLElement>("hs-ai-ide-pill");
  if (!pill) { return; }
  pill.style.left = btn.offsetLeft + "px";
  pill.style.width = btn.offsetWidth + "px";
}

function initPill(): void {
  const activeBtn = document.querySelector<HTMLElement>(".hs-ai-ide-btn.active");
  if (activeBtn) { movePill(activeBtn); }
}

// ── Checklist rendering ───────────────────────────────────────────────────────

function renderSkillRows(
  skills: SkillInfo[],
  installedDirNames: string[]
): void {
  const list = el("hs-ai-skills-list");
  if (!list) { return; }
  const installedSet = new Set(installedDirNames);
  list.innerHTML = skills
    .map((s) => {
      const isInstalled = installedSet.has(s.dirName);
      const statusClass = isInstalled ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isInstalled ? "installed" : "—";
      return `<label class="hs-ai-item">
        <input type="checkbox" class="hs-ai-cb" data-skill="${s.dirName}" ${isInstalled ? "" : "checked"}>
        <span class="hs-ai-item-name" title="${s.description}">${s.name}</span>
        <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
      </label>`;
    })
    .join("");
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
        <input type="checkbox" class="hs-ai-cb" data-mcp="${s.key}" ${isConfigured ? "" : "checked"}>
        <span class="hs-ai-item-name" title="${s.description}">${s.label}</span>
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
  const anyChecked = [...document.querySelectorAll<HTMLInputElement>(".hs-ai-cb")]
    .some((c) => c.checked && !c.disabled);
  applyBtn.disabled = !anyChecked;
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

  if (_isOpen) {
    // Re-position pill after layout settles (accordion may have just opened)
    panel.addEventListener("transitionend", () => {
      initPill();
    }, { once: true });
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function handleApply(): void {
  if (!_cachedData) { return; }

  const skillCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-skill]");
  const mcpCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-mcp]");

  const selectedSkills = [...skillCheckboxes]
    .filter((c) => c.checked)
    .map((c) => c.dataset.skill!);

  const selectedMcpKeys = [...mcpCheckboxes]
    .filter((c) => c.checked)
    .map((c) => c.dataset.mcp!);

  // Switch to applying visual: disable checkboxes and apply button
  document.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((c) => { c.disabled = true; });
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applying…";
  }

  getVSCode()?.postMessage({
    command: "installAiTools",
    skills: selectedSkills,
    ideTarget: _activeIde,
    mcpServers: selectedMcpKeys,
  });
}

// ── Message handling ──────────────────────────────────────────────────────────

function handleAiToolsData(msg: AiToolsDataMessage): void {
  if (msg.error) {
    el("hs-ai-error-msg").textContent = msg.error;
    showPanelState("error");
    return;
  }

  _cachedData = {
    skills: msg.skills,
    installedByIde: msg.installedByIde,
    mcpServers: msg.mcpServers,
    configuredMcpKeys: msg.configuredMcpKeys,
    detectedIde: msg.detectedIde,
  };

  // Set active IDE to detected editor
  _activeIde = msg.detectedIde;
  document.querySelectorAll<HTMLElement>(".hs-ai-ide-btn").forEach((btn) => {
    const isActive = btn.dataset.ide === _activeIde;
    btn.classList.toggle("active", isActive);
  });

  renderSkillRows(msg.skills, msg.installedByIde[_activeIde] ?? []);
  renderMcpRows(msg.mcpServers, msg.configuredMcpKeys);

  showPanelState("ready");
  updateApplyButton();

  requestAnimationFrame(() => { initPill(); });
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

  // Accordion toggle
  el("hs-btn-ai-tools").addEventListener("click", toggleAccordion);

  // IDE selector buttons
  document.querySelectorAll<HTMLElement>(".hs-ai-ide-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!_cachedData) { return; }
      document.querySelectorAll<HTMLElement>(".hs-ai-ide-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      movePill(btn);
      _activeIde = btn.dataset.ide ?? "Claude Code";
      renderSkillRows(_cachedData.skills, _cachedData.installedByIde[_activeIde] ?? []);
      updateApplyButton();
    });
  });

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
