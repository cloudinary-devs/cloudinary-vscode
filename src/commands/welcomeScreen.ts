import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

/**
 * Registers the welcome screen command that shows onboarding and feature information.
 * @param context - Extension context provided by VS Code.
 * @param provider - Cloudinary tree data provider instance.
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
 * Creates a webview panel containing the welcome screen with multiple sections.
 */
function createWelcomePanel(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryWelcome",
    "Welcome to Cloudinary",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = getWelcomeContent(provider);

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage((message: {
    command: string;
    data?: any;
  }) => {
    switch (message.command) {
      case 'openGlobalConfig':
        vscode.commands.executeCommand('cloudinary.openGlobalConfig');
        break;
      case 'openUploadWidget':
        vscode.commands.executeCommand('cloudinary.openUploadWidget');
        break;
      case 'switchEnvironment':
        vscode.commands.executeCommand('cloudinary.switchEnvironment');
        break;
      case 'copyToClipboard':
        if (message.data) {
          vscode.env.clipboard.writeText(message.data);
          vscode.window.showInformationMessage('Copied to clipboard!');
        }
        break;
      case 'openExternal':
        if (message.data) {
          vscode.env.openExternal(vscode.Uri.parse(message.data));
        }
        break;
      case 'focusTreeView':
        vscode.commands.executeCommand('workbench.view.extension.cloudinary');
        break;
    }
  });

  return panel;
}

/**
 * Generates the HTML content for the welcome screen webview.
 */
function getWelcomeContent(provider: CloudinaryTreeDataProvider): string {
  const hasConfig = provider.cloudName && provider.apiKey;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Cloudinary</title>
    <style>
      :root {
        /* Official Cloudinary Brand Colors */
        --primary-color: #3448C5;        /* Cloudinary Blue (brand blue) */
        --secondary-color: #0D9AFF;      /* Sky Blue (primary) */
        --accent-color: #A15EE4;         /* Purple (secondary) */
        --success-color: #60CFB7;        /* Teal (secondary) */
        --warning-color: #FE5981;        /* Pink (secondary) */
        --info-color: #48C4D8;           /* Turquoise (secondary) */
        --muted-color: #E3E9EF;          /* Grey (primary) */
        --dark-blue: #23436A;            /* Aegean Blue (primary) */
        --darker-blue: #1B295D;          /* Cetacean Blue (primary) */
        --light-green: #D5FDA1;          /* Green (secondary) */
      }

      body {
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        margin: 0;
        padding: 0;
        line-height: 1.6;
      }

      .container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 2rem;
      }

      .header {
        text-align: center;
        margin-bottom: 3rem;
        padding: 2rem;
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        border-radius: 12px;
        color: white;
      }

      .header h1 {
        margin: 0;
        font-size: 2.5rem;
        font-weight: 700;
      }

      .header p {
        margin: 0.5rem 0 0 0;
        font-size: 1.1rem;
        opacity: 0.9;
      }

      .status-card {
        background-color: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .status-icon {
        font-size: 1.5rem;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .status-icon.success {
        background-color: var(--success-color);
      }

      .status-icon.warning {
        background-color: var(--warning-color);
      }

      .status-text {
        flex: 1;
      }

      .tabs {
        display: flex;
        border-bottom: 2px solid var(--vscode-editorGroup-border);
        margin-bottom: 2rem;
        overflow-x: auto;
      }

      .tab-button {
        padding: 1rem 1.5rem;
        background: none;
        border: none;
        color: var(--vscode-editor-foreground);
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .tab-button:hover {
        background-color: var(--vscode-editorWidget-background);
      }

      .tab-button.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }

      .tab-content {
        display: none;
        animation: fadeIn 0.3s ease-in-out;
      }

      .tab-content.active {
        display: block;
      }

      .client-config {
        display: none;
        margin-top: 16px;
      }

      .client-config.active {
        display: block;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .card {
        background-color: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }

      .card h3 {
        margin-top: 0;
        color: var(--primary-color);
        font-size: 1.25rem;
      }

      .step {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .step-number {
        background-color: var(--primary-color);
        color: white;
        border-radius: 50%;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        flex-shrink: 0;
      }

      .step-content {
        flex: 1;
      }

      .step-content h4 {
        margin: 0 0 0.5rem 0;
        color: var(--vscode-editor-foreground);
      }

      .step-content p {
        margin: 0 0 0.5rem 0;
        color: var(--muted-color);
      }

      .code-block {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
        padding: 1rem;
        margin: 1rem 0;
        font-family: var(--vscode-editor-font-family);
        font-size: 0.9rem;
        position: relative;
        overflow-x: auto;
      }

      .code-block pre {
        margin: 0;
        white-space: pre-wrap;
      }

      .copy-button {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        font-size: 0.8rem;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .copy-button:hover {
        opacity: 1;
      }

      .button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 6px;
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        transition: all 0.2s;
        margin-right: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      .button.secondary {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .button.secondary:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }

      .feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-top: 1.5rem;
      }

      .feature-item {
        background-color: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 1.5rem;
        text-align: center;
        transition: transform 0.2s;
      }

      .feature-item:hover {
        transform: translateY(-2px);
      }

      .feature-icon {
        font-size: 2rem;
        margin-bottom: 1rem;
      }

      .feature-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }

      .feature-description {
        color: var(--muted-color);
        font-size: 0.9rem;
      }

      .mcp-highlight {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
        color: white;
        padding: 2rem;
        border-radius: 12px;
        margin: 2rem 0;
        text-align: center;
      }

      .mcp-highlight h3 {
        margin: 0 0 1rem 0;
        font-size: 1.5rem;
      }

      .mcp-highlight p {
        margin: 0 0 1.5rem 0;
        opacity: 0.9;
      }

      .badge {
        display: inline-block;
        background-color: var(--accent-color);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-left: 0.5rem;
      }

      .link {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
        cursor: pointer;
      }

      .link:hover {
        text-decoration: underline;
      }

      .warning {
        background-color: rgba(161, 94, 228, 0.1);
        border: 1px solid var(--accent-color);
        border-radius: 6px;
        padding: 1rem;
        margin: 1rem 0;
      }

      .warning strong {
        color: var(--accent-color);
      }

      .info {
        background-color: rgba(72, 196, 216, 0.1);
        border: 1px solid var(--info-color);
        border-radius: 6px;
        padding: 1rem;
        margin: 1rem 0;
      }

      .info strong {
        color: var(--info-color);
      }

      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin-top: 1.5rem;
      }

      @media (max-width: 768px) {
        .grid-2 {
          grid-template-columns: 1fr;
        }
        
        .tabs {
          flex-direction: column;
        }
        
        .tab-button {
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Welcome to Cloudinary</h1>
        <p>Your Visual Studio Code extension for seamless media management</p>
      </div>

      <div class="status-card">
        <div class="status-icon ${hasConfig ? 'success' : 'warning'}">
          ${hasConfig ? '✓' : '⚠'}
        </div>
        <div class="status-text">
          <strong>${hasConfig ? 'Ready to go!' : 'Configuration needed'}</strong>
          <p>${hasConfig
      ? `Connected to ${provider.cloudName}`
      : 'Please configure your Cloudinary credentials to get started'
    }</p>
        </div>
        ${!hasConfig ? '<button class="button" onclick="openGlobalConfig()">Configure Now</button>' : ''}
      </div>

      <div class="tabs">
        <button class="tab-button active" onclick="showTab('getting-started')">Getting Started</button>
        <button class="tab-button" onclick="showTab('features')">Features</button>
        <button class="tab-button" onclick="showTab('mcp-servers')">AI & MCP Servers</button>
        <button class="tab-button" onclick="showTab('configuration')">Configuration</button>
        <button class="tab-button" onclick="showTab('resources')">Resources</button>
      </div>

      <div id="getting-started" class="tab-content active">
        <div class="card">
          <h3>🚀 Quick Start Guide</h3>
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Configure Credentials</h4>
              <p>Set up your Cloudinary API credentials to connect to your media library.</p>
              <button class="button secondary" onclick="openGlobalConfig()">Open Configuration</button>
            </div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Explore Your Media</h4>
              <p>Browse your folders and assets directly in VS Code's sidebar.</p>
              <button class="button secondary" onclick="focusTreeView()">Go to Media Library</button>
            </div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Upload & Manage</h4>
              <p>Upload new assets and manage existing ones with our intuitive tools.</p>
              <button class="button secondary" onclick="openUploadWidget()">Try Upload Widget</button>
            </div>
          </div>
        </div>

        <div class="info">
          <strong>New to Cloudinary?</strong> 
          <span class="link" onclick="openExternal('https://cloudinary.com/users/register_free')">Sign up for a free account</span> 
          to get started with powerful media management and transformation capabilities.
        </div>
      </div>

      <div id="features" class="tab-content">
        <div class="card">
          <h3>🎯 Key Features</h3>
          <div class="feature-grid">
            <div class="feature-item">
              <div class="feature-icon">🌳</div>
              <div class="feature-title">Asset Explorer</div>
              <div class="feature-description">Browse your Cloudinary folders and assets in a familiar tree view</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔍</div>
              <div class="feature-title">Search & Filter</div>
              <div class="feature-description">Quickly find assets by public ID, type, or metadata</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🖼️</div>
              <div class="feature-title">Smart Preview</div>
              <div class="feature-description">Preview images and videos with automatic optimization</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">☁️</div>
              <div class="feature-title">Upload Widget</div>
              <div class="feature-description">Drag & drop uploads directly from VS Code</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📋</div>
              <div class="feature-title">Quick Actions</div>
              <div class="feature-description">Copy URLs, public IDs, and optimized links instantly</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🌍</div>
              <div class="feature-title">Multi-Environment</div>
              <div class="feature-description">Switch between development, staging, and production</div>
            </div>
          </div>
        </div>
      </div>

      <div id="mcp-servers" class="tab-content">
        <div class="mcp-highlight">
          <h3>🤖 Cloudinary AI & MCP Servers <span class="badge">NEW</span></h3>
          <p>Harness the power of AI-driven media management with Cloudinary's MCP (Model Context Protocol) servers</p>
          <button class="button" onclick="openExternal('https://cloudinary.com/documentation/cloudinary_llm_mcp')">
            Learn More
          </button>
        </div>

        <div class="card">
          <h3>What are MCP Servers?</h3>
          <p>MCP servers provide AI assistants like Claude with structured access to Cloudinary's capabilities, enabling:</p>
          <ul>
            <li><strong>Intelligent Asset Management</strong> - Upload, search, and organize media through natural language</li>
            <li><strong>Smart Transformations</strong> - Apply complex image/video transformations with AI assistance</li>
            <li><strong>Automated Workflows</strong> - Build media pipelines with AI-powered decision making</li>
            <li><strong>Content Analysis</strong> - Leverage AI for tagging, moderation, and optimization</li>
          </ul>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3>🎬 Asset Management</h3>
            <p>Upload and manage images, videos, and raw files, with support for advanced search and filtering.</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard('cloudinary-asset-mgmt')">Copy Server Name</button>
              <pre>@cloudinary/asset-management</pre>
            </div>
          </div>
          
          <div class="card">
            <h3>⚙️ Environment Config</h3>
            <p>Manage product environment entities including upload presets, transformations, and streaming profiles.</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard('cloudinary-env-config')">Copy Server Name</button>
              <pre>@cloudinary/environment-config</pre>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3>📊 Structured Metadata</h3>
            <p>Define and manage structured metadata fields, values, and conditional metadata rules.</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard('cloudinary-smd')">Copy Server Name</button>
              <pre>@cloudinary/structured-metadata</pre>
            </div>
          </div>
          
          <div class="card">
            <h3>🤖 Analysis</h3>
            <p>Leverage AI-powered content analysis for automatic tagging, moderation, and object detection.</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard('cloudinary-analysis')">Copy Server Name</button>
              <pre>@cloudinary/analysis</pre>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>🔧 Installation & Setup</h3>
          <p>All MCP servers are installed automatically via NPX. No manual installation required! Just add the configuration to your AI client.</p>
          
          <div class="tabs">
            <button class="tab-button active" onclick="showClientTab('cursor')">Cursor</button>
            <button class="tab-button" onclick="showClientTab('claude')">Claude Desktop</button>
            <button class="tab-button" onclick="showClientTab('vscode')">VS Code</button>
            <button class="tab-button" onclick="showClientTab('windsurf')">Windsurf</button>
          </div>

          <div id="cursor-config" class="client-config active">
            <p><strong>Cursor:</strong> Navigate to <strong>Settings</strong> → <strong>Cursor Settings</strong> → <strong>MCP Tools</strong></p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard(getCursorConfig())">Copy</button>
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

          <div id="claude-config" class="client-config">
            <p><strong>Claude Desktop:</strong> Settings → Developer → Edit Config</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard(getClaudeConfig())">Copy</button>
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

          <div id="vscode-config" class="client-config">
            <p><strong>VS Code:</strong> Requires GitHub Copilot. Add to MCP config file.</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard(getVSCodeConfig())">Copy</button>
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

          <div id="windsurf-config" class="client-config">
            <p><strong>Windsurf:</strong> Add to MCP config file.</p>
            <div class="code-block">
              <button class="copy-button" onclick="copyToClipboard(getWindsurfConfig())">Copy</button>
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

          <div class="info">
            <strong>💡 Pro Tips:</strong>
            <ul>
              <li>Add all 4 servers for full functionality, but disable unused ones to save context</li>
              <li>Replace the package name for each server: <code>@cloudinary/environment-config</code>, <code>@cloudinary/structured-metadata</code>, <code>@cloudinary/analysis</code></li>
              <li>Find your credentials in <span class="link" onclick="openExternal('https://console.cloudinary.com/settings/api-keys')">Console Settings → API Keys</span></li>
            </ul>
          </div>
        </div>

        <div class="info">
          <strong>💡 Integration Tip:</strong> Use the same credentials from your VS Code extension configuration for seamless integration between your development environment and AI assistant.
        </div>
      </div>

      <div id="configuration" class="tab-content">
        <div class="card">
          <h3>⚙️ Configuration Guide</h3>
          <p>Your Cloudinary credentials are stored in an <code>environments.json</code> file for security and flexibility.</p>
          
          <h4>📁 Configuration Location</h4>
          <ul>
            <li><strong>Global:</strong> <code>~/.cloudinary/environments.json</code> (recommended)</li>
            <li><strong>Project:</strong> <code>.cloudinary/environments.json</code> (workspace-specific)</li>
          </ul>

          <h4>📋 Configuration Format</h4>
          <div class="code-block">
            <button class="copy-button" onclick="copyToClipboard(getConfigExample())">Copy</button>
            <pre>{
  "your-cloud-name": {
    "apiKey": "your-api-key",
    "apiSecret": "your-api-secret"
  }
}</pre>
          </div>

          <div class="info">
            <strong>💡 Note:</strong> The <strong>cloud name is the key</strong> (the property name in the JSON, e.g., <code>"your-cloud-name"</code>). 
            You can optionally add <code>"uploadPreset": "your-preset-name"</code> if you want to use a default upload preset.
          </div>

          <h4>🔑 Finding Your Credentials</h4>
          <ol>
            <li>Go to your <span class="link" onclick="openExternal('https://console.cloudinary.com')">Cloudinary Console</span></li>
            <li>Navigate to <strong>Settings</strong> → <strong>API Keys</strong></li>
            <li>Copy your Cloud Name, API Key, and API Secret</li>
            <li>(Optional) Create an upload preset in <strong>Settings</strong> → <strong>Upload</strong> if you want to use preset-based configurations</li>
          </ol>

          <button class="button" onclick="openGlobalConfig()">Open Configuration File</button>
          <button class="button secondary" onclick="switchEnvironment()">Switch Environment</button>
        </div>
      </div>

      <div id="resources" class="tab-content">
        <div class="card">
          <h3>📚 Resources & Documentation</h3>
          <div class="grid-2">
            <div>
              <h4>🎓 Getting Started</h4>
              <ul>
                <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/how_to_integrate_cloudinary')">Integration Guide</span></li>
                <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/upload_images')">Upload Documentation</span></li>
                <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/image_transformations')">Transformations Guide</span></li>
                <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/video_manipulation_and_delivery')">Video Processing</span></li>
              </ul>
            </div>
            <div>
              <h4>🤖 AI & MCP Servers (Beta)</h4>
              <ul>
                <li><span class="link" onclick="openExternal('https://cloudinary.com/documentation/cloudinary_mcp_servers')">MCP Servers Guide</span></li>
                <li><span class="link" onclick="openExternal('https://modelcontextprotocol.io')">Model Context Protocol</span></li>
                <li><span class="link" onclick="openExternal('https://support.cloudinary.com/hc/en-us/requests/new')">Beta Feedback</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>🎯 Quick Links</h3>
          <div class="feature-grid">
            <div class="feature-item">
              <div class="feature-icon">🏠</div>
              <div class="feature-title">Cloudinary Console</div>
              <div class="feature-description">
                <span class="link" onclick="openExternal('https://console.cloudinary.com')">console.cloudinary.com</span>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📖</div>
              <div class="feature-title">Documentation</div>
              <div class="feature-description">
                <span class="link" onclick="openExternal('https://cloudinary.com/documentation')">cloudinary.com/documentation</span>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🐛</div>
              <div class="feature-title">Support</div>
              <div class="feature-description">
                <span class="link" onclick="openExternal('https://support.cloudinary.com')">support.cloudinary.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();

      function showTab(tabId) {
        // Hide all tabs
        const tabs = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const buttons = document.querySelectorAll('.tab-button');
        buttons.forEach(button => button.classList.remove('active'));
        
        // Show selected tab
        document.getElementById(tabId).classList.add('active');
        event.target.classList.add('active');
      }

      function showClientTab(clientId) {
        // Hide all client configs
        const configs = document.querySelectorAll('.client-config');
        configs.forEach(config => config.classList.remove('active'));
        
        const buttons = document.querySelectorAll('.tab-button');
        buttons.forEach(button => button.classList.remove('active'));
        
        // Show selected client config
        document.getElementById(clientId + '-config').classList.add('active');
        event.target.classList.add('active');
      }

      function openGlobalConfig() {
        vscode.postMessage({ command: 'openGlobalConfig' });
      }

      function openUploadWidget() {
        vscode.postMessage({ command: 'openUploadWidget' });
      }

      function switchEnvironment() {
        vscode.postMessage({ command: 'switchEnvironment' });
      }

      function copyToClipboard(text) {
        vscode.postMessage({ command: 'copyToClipboard', data: text });
      }

      function openExternal(url) {
        vscode.postMessage({ command: 'openExternal', data: url });
      }

      function focusTreeView() {
        vscode.postMessage({ command: 'focusTreeView' });
      }

      function getCursorConfig() {
        return JSON.stringify({
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
        }, null, 2);
      }

      function getClaudeConfig() {
        return JSON.stringify({
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
        }, null, 2);
      }

      function getVSCodeConfig() {
        return JSON.stringify({
          "mcp": {
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
          }
        }, null, 2);
      }

      function getWindsurfConfig() {
        return JSON.stringify({
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
        }, null, 2);
      }

      function getConfigExample() {
        return JSON.stringify({
          "your-cloud-name": {
            "apiKey": "your-api-key",
            "apiSecret": "your-api-secret"
          }
        }, null, 2);
      }
    </script>
  </body>
  </html>
  `;
}

export default registerWelcomeScreen; 