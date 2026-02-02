import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import {
  createWebviewDocument,
  getScriptUri,
} from "../webview/webviewUtils";
import { escapeHtml } from "../webview/utils/helpers";

/**
 * Registers the welcome screen command.
 */
function registerWelcomeScreen(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openWelcomeScreen", () => {
      createWelcomePanel(context, provider);
    })
  );
}

/**
 * Creates the welcome screen webview panel.
 */
function createWelcomePanel(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryWelcome",
    "Welcome to Cloudinary",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media"),
      ],
    }
  );

  panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "cloudinary_icon_blue.png"
  );

  const welcomeScriptUri = getScriptUri(
    panel.webview,
    context.extensionUri,
    "welcome.js"
  );

  panel.webview.html = createWebviewDocument({
    title: "Welcome to Cloudinary",
    webview: panel.webview,
    extensionUri: context.extensionUri,
    bodyContent: getWelcomeContent(provider),
    additionalScripts: [welcomeScriptUri],
  });

  panel.webview.onDidReceiveMessage((message: { command: string; data?: any }) => {
    switch (message.command) {
      case "openGlobalConfig":
        vscode.commands.executeCommand("cloudinary.openGlobalConfig");
        break;
      case "openUploadWidget":
        vscode.commands.executeCommand("cloudinary.openUploadWidget");
        break;
      case "switchEnvironment":
        vscode.commands.executeCommand("cloudinary.switchEnvironment");
        break;
      case "copyToClipboard":
        if (message.data) {
          vscode.env.clipboard.writeText(message.data);
          vscode.window.showInformationMessage("Copied to clipboard!");
        }
        break;
      case "openExternal":
        if (message.data) {
          vscode.env.openExternal(vscode.Uri.parse(message.data));
        }
        break;
      case "focusTreeView":
        vscode.commands.executeCommand("workbench.view.extension.cloudinary");
        break;
    }
  });

  return panel;
}

/**
 * Generates the welcome screen body content.
 */
function getWelcomeContent(provider: CloudinaryTreeDataProvider): string {
  const hasConfig = provider.cloudName && provider.apiKey;
  const cloudName = escapeHtml(provider.cloudName || "");

  return `
    <div class="container">
      <div class="hero">
        <h1 class="hero__title">Welcome to Cloudinary</h1>
        <p class="hero__subtitle">Your Visual Studio Code extension for seamless media management</p>
      </div>

      <div class="status-card">
        <div class="status-card__icon status-card__icon--${hasConfig ? "success" : "warning"}">
          ${hasConfig ? "✓" : "⚠"}
        </div>
        <div class="status-card__content">
          <div class="status-card__title">${hasConfig ? "Ready to go!" : "Configuration needed"}</div>
          <p class="status-card__text">${hasConfig ? `Connected to ${cloudName}` : "Please configure your Cloudinary credentials to get started"}</p>
        </div>
        ${!hasConfig ? '<button class="btn btn--primary" onclick="openGlobalConfig()">Configure Now</button>' : ""}
      </div>

      <div class="tabs" role="tablist">
        <nav class="tabs__nav">
          <button class="tabs__btn active" data-tab="getting-started" role="tab">Getting Started</button>
          <button class="tabs__btn" data-tab="features" role="tab">Features</button>
          <button class="tabs__btn" data-tab="mcp-servers" role="tab">AI & MCP Servers</button>
          <button class="tabs__btn" data-tab="configuration" role="tab">Configuration</button>
          <button class="tabs__btn" data-tab="resources" role="tab">Resources</button>
        </nav>

        <!-- Getting Started -->
        <div id="tab-getting-started" class="tabs__content active" role="tabpanel">
          <div class="card">
            <div class="card__body">
              <h3>Quick Start Guide</h3>
              <div class="step-list">
                <div class="step">
                  <div class="step__number">1</div>
                  <div class="step__content">
                    <h4 class="step__title">Configure Credentials</h4>
                    <p class="step__description">Set up your Cloudinary API credentials to connect to your media library.</p>
                    <button class="btn btn--secondary" onclick="openGlobalConfig()">Open Configuration</button>
                  </div>
                </div>
                <div class="step">
                  <div class="step__number">2</div>
                  <div class="step__content">
                    <h4 class="step__title">Explore Your Media</h4>
                    <p class="step__description">Browse your folders and assets directly in VS Code's sidebar.</p>
                    <button class="btn btn--secondary" onclick="focusTreeView()">Go to Media Library</button>
                  </div>
                </div>
                <div class="step">
                  <div class="step__number">3</div>
                  <div class="step__content">
                    <h4 class="step__title">Upload & Manage</h4>
                    <p class="step__description">Upload new assets and manage existing ones with our intuitive tools.</p>
                    <button class="btn btn--secondary" onclick="openUploadWidget()">Try Upload Widget</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="info-box">
            <strong>New to Cloudinary?</strong> 
            <span class="link" onclick="openExternal('https://cloudinary.com/users/register_free')">Sign up for a free account</span> 
            to get started with powerful media management and transformation capabilities.
          </div>
        </div>

        <!-- Features -->
        <div id="tab-features" class="tabs__content" role="tabpanel">
          <div class="card">
            <div class="card__body">
              <h3>Key Features</h3>
              <div class="feature-grid">
                <div class="feature-item">
                  <div class="feature-item__title">Asset Explorer</div>
                  <div class="feature-item__description">Browse your Cloudinary folders and assets in a familiar tree view</div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Search & Filter</div>
                  <div class="feature-item__description">Quickly find assets by public ID, type, or metadata</div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Smart Preview</div>
                  <div class="feature-item__description">Preview images and videos with automatic optimization</div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Upload Widget</div>
                  <div class="feature-item__description">Drag & drop uploads directly from VS Code</div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Quick Actions</div>
                  <div class="feature-item__description">Copy URLs, public IDs, and optimized links instantly</div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Multi-Environment</div>
                  <div class="feature-item__description">Switch between development, staging, and production</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- MCP Servers -->
        <div id="tab-mcp-servers" class="tabs__content" role="tabpanel">
          <div class="highlight-box">
            <h3 class="highlight-box__title">Cloudinary AI & MCP Servers <span class="badge badge--primary badge--pill">NEW</span></h3>
            <p class="highlight-box__text">Harness the power of AI-driven media management with Cloudinary's MCP servers</p>
            <button class="btn btn--primary" onclick="openExternal('https://cloudinary.com/documentation/cloudinary_llm_mcp')">Learn More</button>
          </div>

          <div class="card">
            <div class="card__body">
              <h3>What are MCP Servers?</h3>
              <p>MCP servers provide AI assistants like Claude with structured access to Cloudinary's capabilities, enabling:</p>
              <ul>
                <li><strong>Intelligent Asset Management</strong> - Upload, search, and organize media through natural language</li>
                <li><strong>Smart Transformations</strong> - Apply complex image/video transformations with AI assistance</li>
                <li><strong>Automated Workflows</strong> - Build media pipelines with AI-powered decision making</li>
                <li><strong>Content Analysis</strong> - Leverage AI for tagging, moderation, and optimization</li>
              </ul>
            </div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card__body">
                <h3>Asset Management</h3>
                <p>Upload and manage images, videos, and raw files.</p>
                <div class="code-block">
                  <button class="btn btn--secondary btn--sm code-block__copy" onclick="copyToClipboard('@cloudinary/asset-management')">Copy</button>
                  <pre>@cloudinary/asset-management</pre>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card__body">
                <h3>Environment Config</h3>
                <p>Manage upload presets and transformations.</p>
                <div class="code-block">
                  <button class="btn btn--secondary btn--sm code-block__copy" onclick="copyToClipboard('@cloudinary/environment-config')">Copy</button>
                  <pre>@cloudinary/environment-config</pre>
                </div>
              </div>
            </div>
          </div>

          <div class="card mt-lg">
            <div class="card__body">
              <h3>Installation & Setup</h3>
              <p>All MCP servers are installed automatically via NPX. Just add the configuration to your AI client.</p>
              
              <div class="tabs" role="tablist">
                <nav class="tabs__nav">
                  <button class="tabs__btn active" data-tab="cursor-config" role="tab">Cursor</button>
                  <button class="tabs__btn" data-tab="claude-config" role="tab">Claude Desktop</button>
                  <button class="tabs__btn" data-tab="vscode-config" role="tab">VS Code</button>
                </nav>

                <div id="tab-cursor-config" class="tabs__content active" role="tabpanel">
                  <p><strong>Cursor:</strong> Settings → Cursor Settings → MCP Tools</p>
                  <div class="code-block">
                    <button class="btn btn--secondary btn--sm code-block__copy" onclick="copyToClipboard(getCursorConfig())">Copy</button>
                    <pre>{
  "mcpServers": {
    "cloudinary-asset-mgmt": {
      "command": "npx",
      "args": ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
      "env": {
        "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
        "CLOUDINARY_API_KEY": "your-api-key",
        "CLOUDINARY_API_SECRET": "your-api-secret"
      }
    }
  }
}</pre>
                  </div>
                </div>

                <div id="tab-claude-config" class="tabs__content" role="tabpanel">
                  <p><strong>Claude Desktop:</strong> Settings → Developer → Edit Config</p>
                  <div class="code-block">
                    <button class="btn btn--secondary btn--sm code-block__copy" onclick="copyToClipboard(getClaudeConfig())">Copy</button>
                    <pre>{
  "mcpServers": {
    "cloudinary-asset-mgmt": {
      "command": "npx",
      "args": ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
      "env": {
        "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
        "CLOUDINARY_API_KEY": "your-api-key",
        "CLOUDINARY_API_SECRET": "your-api-secret"
      }
    }
  }
}</pre>
                  </div>
                </div>

                <div id="tab-vscode-config" class="tabs__content" role="tabpanel">
                  <p><strong>VS Code:</strong> Requires GitHub Copilot. Add to MCP config file.</p>
                  <div class="code-block">
                    <button class="btn btn--secondary btn--sm code-block__copy" onclick="copyToClipboard(getVSCodeConfig())">Copy</button>
                    <pre>"mcp": {
  "servers": {
    "cloudinary-asset-mgmt": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
      "env": {
        "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
        "CLOUDINARY_API_KEY": "your-api-key",
        "CLOUDINARY_API_SECRET": "your-api-secret"
      }
    }
  }
}</pre>
                  </div>
                </div>
              </div>

              <div class="info-box">
                <strong>Pro Tips:</strong>
                <ul>
                  <li>Add all 4 servers for full functionality, but disable unused ones to save context</li>
                  <li>Replace the package name for each server</li>
                  <li>Find your credentials in <span class="link" onclick="openExternal('https://console.cloudinary.com/settings/api-keys')">Console Settings → API Keys</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Configuration -->
        <div id="tab-configuration" class="tabs__content" role="tabpanel">
          <div class="card">
            <div class="card__body">
              <h3>Configuration Guide</h3>
              <p>Your Cloudinary credentials are stored in an <code>environments.json</code> file for security.</p>
              
              <h4>Configuration Location</h4>
              <ul>
                <li><strong>Global:</strong> <code>~/.cloudinary/environments.json</code> (recommended)</li>
                <li><strong>Project:</strong> <code>.cloudinary/environments.json</code> (workspace-specific)</li>
              </ul>

              <h4>Configuration Format</h4>
              <div class="code-block">
                <button class="btn btn--secondary btn--sm code-block__copy" onclick="copyToClipboard(getConfigExample())">Copy</button>
                <pre>{
  "your-cloud-name": {
    "apiKey": "your-api-key",
    "apiSecret": "your-api-secret"
  }
}</pre>
              </div>

              <div class="info-box">
                <strong>Note:</strong> The cloud name is the key (property name). You can optionally add <code>"uploadPreset"</code>.
              </div>

              <h4>Finding Your Credentials</h4>
              <ol>
                <li>Go to your <span class="link" onclick="openExternal('https://console.cloudinary.com')">Cloudinary Console</span></li>
                <li>Navigate to <strong>Settings</strong> → <strong>API Keys</strong></li>
                <li>Copy your Cloud Name, API Key, and API Secret</li>
              </ol>

              <div class="btn-group">
                <button class="btn btn--primary" onclick="openGlobalConfig()">Open Configuration File</button>
                <button class="btn btn--secondary" onclick="switchEnvironment()">Switch Environment</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Resources -->
        <div id="tab-resources" class="tabs__content" role="tabpanel">
          <div class="card">
            <div class="card__body">
              <h3>Resources & Documentation</h3>
              <div class="grid-2">
                <div>
                  <h4>Getting Started</h4>
                  <ul>
                    <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/how_to_integrate_cloudinary')">Integration Guide</span></li>
                    <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/upload_images')">Upload Documentation</span></li>
                    <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/image_transformations')">Transformations Guide</span></li>
                    <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/video_manipulation_and_delivery')">Video Processing</span></li>
                  </ul>
                </div>
                <div>
                  <h4>AI & MCP Servers</h4>
                  <ul>
                    <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/cloudinary_mcp_servers')">MCP Servers Guide</span></li>
                    <li><span class="link" onclick="openExternal('https://modelcontextprotocol.io')">Model Context Protocol</span></li>
                    <li><span class="link" onclick="openExternal('https://support.cloudinary.com/hc/en-us/requests/new')">Beta Feedback</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__body">
              <h3>Quick Links</h3>
              <div class="feature-grid">
                <div class="feature-item">
                  <div class="feature-item__title">Cloudinary Console</div>
                  <div class="feature-item__description"><span class="link" onclick="openExternal('https://console.cloudinary.com')">console.cloudinary.com</span></div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Documentation</div>
                  <div class="feature-item__description"><span class="link" onclick="openExternal('https://cloudinary.com/documentation')">cloudinary.com/documentation</span></div>
                </div>
                <div class="feature-item">
                  <div class="feature-item__title">Support</div>
                  <div class="feature-item__description"><span class="link" onclick="openExternal('https://support.cloudinary.com')">support.cloudinary.com</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default registerWelcomeScreen;
