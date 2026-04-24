/**
 * Homescreen WebviewView provider.
 * Renders the minimal dashboard in the Cloudinary sidebar.
 */

import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { createWebviewDocument, getScriptUri, getStyleUri } from "./webviewUtils";
import { loadEnvironments } from "../config/configUtils";
import skillsConfig from "../utils/skills-config.json";
import {
  PlatformEntry,
  Scope,
  SkillInfo,
  MCP_SERVERS,
  detectEditor,
  getMcpRootKey,
  getEditorDisplayName,
  getMcpFilePath,
  fetchSkillList,
  fetchSkillContent,
  readInstalledSkillDirNames,
  readConfiguredMcpServerKeys,
  installSkill,
  installMcpServers,
  detectEditorPlatform,
  getPlatformEntry,
  getPlatformCovers,
} from "../aiToolsService";

export class HomescreenViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cloudinaryHomescreen";

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: CloudinaryTreeDataProvider
  ) {}

  private _webviewView: vscode.WebviewView | undefined;
  private _cachedSkills: SkillInfo[] | undefined;
  private _currentPlatform: string = "claude-code";
  private _currentScope: Scope = "project";

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._webviewView = webviewView;

    webviewView.onDidDispose(() => {
      this._webviewView = undefined;
    });

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    const scriptUri = getScriptUri(
      webviewView.webview,
      this._extensionUri,
      "homescreen.js"
    );
    const homescreenCssUri = getStyleUri(
      webviewView.webview,
      this._extensionUri,
      "homescreen.css"
    );

    webviewView.webview.html = createWebviewDocument({
      title: "Cloudinary",
      webview: webviewView.webview,
      extensionUri: this._extensionUri,
      bodyContent: this._getBodyContent(),
      additionalStyles: [homescreenCssUri],
      additionalScripts: [scriptUri],
    });

    webviewView.webview.onDidReceiveMessage(
      async (message: {
        command: string;
        data?: string;
        skills?: string[];
        platform?: string;
        scope?: Scope;
        mcpServers?: string[];
      }) => {
        switch (message.command) {
          case "ready":
            await this._sendHomescreenData();
            break;
          case "openGlobalConfig":
            vscode.commands.executeCommand("cloudinary.openGlobalConfig");
            break;
          case "showLibrary":
            vscode.commands.executeCommand("cloudinary.showLibrary");
            break;
          case "openUploadWidget":
            vscode.commands.executeCommand("cloudinary.openUploadWidget");
            break;
          case "openWelcomeScreen":
            vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
            break;
          case "searchAssets":
            if (message.data?.trim()) {
              this._provider.refresh({ searchQuery: message.data.trim() });
              vscode.commands.executeCommand("cloudinary.showLibrary");
            }
            break;
          case "clearSearch":
            this._provider.refresh({ searchQuery: null });
            break;
          case "switchEnvironment":
            vscode.commands.executeCommand("cloudinary.switchEnvironment");
            break;
          case "aiToolsExpanded":
            this._currentPlatform = detectEditorPlatform();
            this._currentScope = "project";
            await this._handleAiToolsExpanded();
            break;
          case "changePlatform":
            if (message.platform) {
              this._currentPlatform = message.platform;
              await this._handleAiToolsExpanded();
            }
            break;
          case "changeScope":
            if (message.scope) {
              this._currentScope = message.scope;
              await this._handleAiToolsExpanded();
            }
            break;
          case "installAiTools":
            await this._handleInstallAiTools(
              message.skills ?? [],
              message.platform ?? this._currentPlatform,
              message.scope ?? this._currentScope,
              message.mcpServers ?? []
            );
            break;
        }
      }
    );
  }

  /**
   * Switches to the homescreen view and moves keyboard focus to the search input.
   */
  focusSearch(): void {
    // Set context first so the homescreen view's `when` condition becomes true
    vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");
    // Then bring the sidebar into focus (mirrors what showLibrary does)
    vscode.commands.executeCommand("workbench.view.extension.cloudinary");
    // Post focusSearch after the view has had time to become visible
    setTimeout(() => {
      this._webviewView?.webview.postMessage({ command: "focusSearch" });
    }, 250);
  }

  async refresh(): Promise<void> {
    await this._sendHomescreenData();
  }

  private async _sendHomescreenData(): Promise<void> {
    const view = this._webviewView;
    if (!view) { return; }

    const hasConfig = !!(this._provider.cloudName && this._provider.apiKey);
    const cloudName = this._provider.cloudName || "";
    const folderMode = this._provider.dynamicFolders ? "Dynamic folders" : "Fixed folders";

    let envCount = hasConfig ? 1 : 0;
    try {
      const envs = await loadEnvironments();
      envCount = Object.keys(envs).length;
    } catch { /* use default */ }

    view.webview.postMessage({ command: "homescreenData", hasConfig, cloudName, folderMode, envCount });
  }

  private _getBodyContent(): string {
    return `

      <div class="hs-root">
        <div class="hs-header">
          <div class="hs-brand">
            <div class="hs-brand-left">
              <svg class="hs-brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M19.5 9.5a6.5 6.5 0 0 0-12.47-2A5 5 0 0 0 7 17.5h12a4.5 4.5 0 0 0 .5-8.97z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
              </svg>
              <span class="hs-brand-name">Cloudinary</span>
            </div>
            <span class="hs-status-pill">
              <span id="hs-status-dot" class="hs-status-dot"></span>
              <span id="hs-status-text"></span>
            </span>
          </div>
          <div class="hs-cloud-row">
            <div class="hs-cloud-col">
              <span id="hs-cloud-name" class="hs-cloud-name"></span>
              <span id="hs-folder-mode" class="hs-folder-mode hidden"></span>
            </div>
            <button id="hs-btn-header-configure" class="hs-configure-btn" title="Open configuration file" aria-label="Open configuration file">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/></svg>
            </button>
          </div>
        </div>

        <div id="hs-setup-banner" class="hs-setup-banner hidden">
          <span class="hs-setup-banner-icon">⚠</span>
          <span class="hs-setup-banner-text">Add your API credentials to connect</span>
          <button id="hs-btn-configure" class="hs-setup-banner-btn" data-command="openGlobalConfig">Configure</button>
        </div>

        <div id="hs-search" class="hs-search hidden" role="search" aria-label="Search media library">
          <div class="hs-search-wrap">
            <svg class="hs-search-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
            </svg>
            <input
              id="hs-search-input"
              class="hs-search-input"
              type="text"
              placeholder="Search library…"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search media library"
            />
            <button id="hs-search-clear" class="hs-search-clear hidden" title="Clear search" aria-label="Clear search">✕</button>
          </div>
        </div>

        <div class="hs-actions">
          <button id="hs-btn-library" class="hs-action" data-command="showLibrary">
            <span class="hs-action-icon hs-action-icon--blue" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Browse Library</span>
              <span class="hs-action-desc">Explore your media assets</span>
            </span>
            <svg class="hs-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <button id="hs-btn-upload" class="hs-action" data-command="openUploadWidget">
            <span class="hs-action-icon hs-action-icon--green" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3zM1.5 14.5a.5.5 0 0 1 0-1h13a.5.5 0 0 1 0 1h-13z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Upload</span>
              <span class="hs-action-desc">Add files to your library</span>
            </span>
            <svg class="hs-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <button id="hs-btn-switch-env" class="hs-action hidden" data-command="switchEnvironment">
            <span class="hs-action-icon hs-action-icon--amber" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5m14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Switch Environment</span>
              <span class="hs-action-desc"><span id="hs-env-count">0</span> environments available</span>
            </span>
            <svg class="hs-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <div class="hs-section-divider" role="separator"></div>

          <button id="hs-btn-ai-tools" class="hs-action" aria-expanded="false" aria-controls="hs-ai-panel">
            <span class="hs-action-icon hs-action-icon--violet" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Configure AI Tools</span>
              <span class="hs-action-desc">MCP servers &amp; agent skills</span>
            </span>
            <svg class="hs-chevron" id="hs-ai-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <!-- AI Tools accordion panel -->
          <div class="hs-ai-panel" id="hs-ai-panel" role="region" aria-label="Configure AI Tools">

            <!-- Loading state -->
            <div class="hs-ai-panel-inner" id="hs-ai-state-loading">
              <div class="hs-ai-loading">
                <div class="hs-skeleton hs-skeleton--label"></div>
                <div class="hs-skeleton hs-skeleton--short"></div>
                <div style="height:6px"></div>
                <div class="hs-skeleton hs-skeleton--label"></div>
                <div class="hs-skeleton"></div>
                <div class="hs-skeleton"></div>
                <div class="hs-skeleton hs-skeleton--short"></div>
                <div style="height:6px"></div>
                <div class="hs-skeleton hs-skeleton--label"></div>
                <div class="hs-skeleton"></div>
                <div class="hs-skeleton"></div>
              </div>
            </div>

            <!-- Ready / applying state -->
            <div class="hs-ai-panel-inner hidden" id="hs-ai-state-ready">

              <!-- Control bar: platform dropdown + scope toggle -->
              <div class="hs-ai-controls">
                <div class="hs-ai-control-row">
                  <span class="hs-ai-control-label">Platform</span>
                  <select id="hs-ai-platform-select" class="hs-ai-platform-select" aria-label="Select platform"></select>
                </div>
                <div class="hs-ai-platform-covers hidden" id="hs-ai-platform-covers"></div>
                <div class="hs-ai-control-row">
                  <span class="hs-ai-control-label">Scope</span>
                  <div class="hs-ai-scope-toggle" role="group" aria-label="Installation scope">
                    <button class="hs-ai-scope-btn active" data-scope="project">Project</button>
                    <button class="hs-ai-scope-btn" data-scope="global">Global</button>
                  </div>
                </div>
              </div>

              <!-- Skills -->
              <div class="hs-ai-section-head">Skills</div>
              <div id="hs-ai-skills-list"></div>
              <div class="hs-ai-hint">Re-select installed skills to update them. Delete files to uninstall.</div>

              <!-- MCP Servers -->
              <div class="hs-ai-section-head" style="margin-top:8px">MCP Servers</div>
              <div id="hs-ai-mcp-editor-note" class="hs-ai-mcp-editor-note hidden"></div>
              <div id="hs-ai-mcp-list"></div>
              <div class="hs-ai-hint">Delete config entries to remove.</div>

              <button class="hs-ai-apply" id="hs-ai-apply" disabled>Apply</button>
            </div>

            <!-- Error state -->
            <div class="hs-ai-panel-inner hidden" id="hs-ai-state-error">
              <div class="hs-ai-error" id="hs-ai-error-msg"></div>
            </div>

          </div><!-- /hs-ai-panel -->
        </div>

        <div class="hs-footer">
          <button id="hs-link-welcome" class="hs-footer-link" data-command="openWelcomeScreen">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>
            Welcome Guide
          </button>
        </div>
      </div>
    `;
  }

  private async _handleAiToolsExpanded(): Promise<void> {
    const view = this._webviewView;
    if (!view) { return; }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      view.webview.postMessage({ command: "aiToolsData", error: "Please open a workspace folder first." });
      return;
    }
    const rootUri = workspaceFolders[0].uri;

    try {
      if (!this._cachedSkills) {
        this._cachedSkills = await fetchSkillList();
      }
      const skills = this._cachedSkills;

      const platform = getPlatformEntry(this._currentPlatform);
      if (!platform) {
        view.webview.postMessage({ command: "aiToolsData", error: `Unknown platform: ${this._currentPlatform}` });
        return;
      }

      const covers = getPlatformCovers(platform, this._currentScope);

      const editor = detectEditor();
      const mcpFilePath = getMcpFilePath(editor);

      const [{ project, global: globalSet }, configuredMcpSet] = await Promise.all([
        readInstalledSkillDirNames(rootUri, platform, skills),
        readConfiguredMcpServerKeys(rootUri, mcpFilePath, getMcpRootKey(editor)),
      ]);
      const inScope = this._currentScope === "project" ? project   : globalSet;
      const inOther = this._currentScope === "project" ? globalSet : project;

      const mcpEditorLabel = getEditorDisplayName(editor);

      view.webview.postMessage({
        command: "aiToolsData",
        platform: this._currentPlatform,
        scope: this._currentScope,
        platformLabel: platform.name,
        platformCovers: covers,
        allPlatforms: (skillsConfig.platforms as PlatformEntry[]).map((p) => ({ id: p.id, name: p.name })),
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
          dirName: s.dirName,
          installedInScope: inScope.has(s.dirName),
          installedInOtherScope: inOther.has(s.dirName),
        })),
        mcpServers: MCP_SERVERS.map((s) => ({
          key: s.key,
          label: s.label,
          description: s.description,
          configured: configuredMcpSet.has(s.key),
        })),
        mcpEditorLabel,
      });
    } catch (err: any) {
      view.webview.postMessage({ command: "aiToolsData", error: err.message ?? String(err) });
    }
  }

  private async _handleInstallAiTools(
    skills: string[],
    platformId: string,
    scope: Scope,
    mcpServers: string[]
  ): Promise<void> {
    const view = this._webviewView;
    if (!view) { return; }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      view.webview.postMessage({ command: "aiToolsResult", errors: ["No workspace folder open."] });
      return;
    }
    const rootUri = workspaceFolders[0].uri;
    const errors: string[] = [];
    const cachedSkills = this._cachedSkills ?? [];
    const platform = getPlatformEntry(platformId);

    if (!platform) {
      view.webview.postMessage({ command: "aiToolsResult", errors: [`Unknown platform: ${platformId}`] });
      return;
    }

    for (const dirName of skills) {
      const skillInfo = cachedSkills.find((s) => s.dirName === dirName);
      if (!skillInfo) { continue; }

      let content: string;
      try {
        content = await fetchSkillContent(dirName);
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "error" });
        continue;
      }

      const createdFiles: string[] = [];
      const errsBefore = errors.length;
      try {
        await installSkill(rootUri, platform, scope, dirName, content, createdFiles, errors);
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
      }
      view.webview.postMessage({
        command: "aiToolsProgress",
        item: dirName,
        status: errors.length > errsBefore ? "error" : "done",
      });
    }

    if (mcpServers.length > 0) {
      const editor = detectEditor();
      const createdFiles: string[] = [];
      try {
        await installMcpServers(rootUri, editor, mcpServers, createdFiles);
        for (const key of mcpServers) {
          view.webview.postMessage({ command: "aiToolsProgress", item: key, status: "done" });
        }
      } catch (err: any) {
        errors.push(`MCP: ${err.message}`);
        for (const key of mcpServers) {
          view.webview.postMessage({ command: "aiToolsProgress", item: key, status: "error" });
        }
      }
    }

    view.webview.postMessage({ command: "aiToolsResult", errors });
  }
}

