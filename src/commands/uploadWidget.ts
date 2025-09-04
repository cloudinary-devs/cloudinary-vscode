import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { v2 as cloudinary } from "cloudinary";

/**
 * Represents an upload preset from Cloudinary with its configuration.
 */
interface UploadPreset {
  name: string;
  signed: boolean;
  settings?: Record<string, any>;
}

/**
 * Configuration for the Cloudinary Upload Widget.
 */
interface WidgetConfig {
  cloudName: string;
  uploadPreset: string;
  sources: string[];
  multiple: boolean;
  showAdvancedOptions: boolean;
  resourceType: string;
  inlineContainer: string;
  folder?: string;
  asset_folder?: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
}

/**
 * Registers commands for the Cloudinary upload widget.
 * - cloudinary.openUploadWidget: Opens the upload widget in the root folder
 * - cloudinary.uploadToFolder: Opens the upload widget in a specific folder
 */
function registerUpload(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  // Register command to open upload widget in root
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openUploadWidget", async () => {
      try {
        await provider.fetchUploadPresets();
        const uploadPreset = provider.getCurrentUploadPreset();

        if (!uploadPreset) {
          vscode.window.showErrorMessage("No upload presets available. Please create one in your Cloudinary account.");
          return;
        }

        const panel = createUploadPanel(
          "Upload to Cloudinary",
          provider.cloudName!,
          uploadPreset,
          "",
          provider,
          context
        );

        setupMessageHandlers(panel);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open upload widget: ${err.message}`);
      }
    })
  );

  // Register command to open upload widget in a specific folder
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.uploadToFolder",
      async (folderItem: { label: string; data: { path?: string } }) => {
        try {
          await provider.fetchUploadPresets();
          const uploadPreset = provider.getCurrentUploadPreset();

          if (!uploadPreset) {
            vscode.window.showErrorMessage("No upload presets available. Please create one in your Cloudinary account.");
            return;
          }

          const folderPath = folderItem.data.path || "";
          const folderParam = provider.dynamicFolders
            ? `asset_folder: "${folderPath}"`
            : `folder: "${folderPath}"`;

          const panel = createUploadPanel(
            `Upload to ${folderItem.label}`,
            provider.cloudName!,
            uploadPreset,
            folderParam,
            provider,
            context
          );

          setupMessageHandlers(panel, folderItem.label);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to open upload widget: ${err.message}`);
        }
      }
    )
  );
}

/**
 * Sets up message handlers for the upload panel.
 * Handles upload completion and error messages.
 */
function setupMessageHandlers(panel: vscode.WebviewPanel, folderName?: string) {
  panel.webview.onDidReceiveMessage((message: { command: string }) => {
    if (message.command === "uploadComplete") {
      const message = folderName
        ? `✅ Upload complete to "${folderName}"`
        : "✅ Upload complete.";
      vscode.window.showInformationMessage(message);
      vscode.commands.executeCommand("cloudinary.refresh");
    }
  });
}

/**
 * Creates a webview panel containing the Cloudinary Upload Widget.
 * The widget supports both signed and unsigned uploads, and can be configured
 * to upload to specific folders.
 */
function createUploadPanel(
  title: string,
  cloudName: string,
  uploadPreset: string,
  folderParam = "",
  provider: CloudinaryTreeDataProvider,
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryUploadWidget",
    title,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: false }
  );

  let currentPreset = uploadPreset;

  /**
   * Generates the widget configuration based on the selected preset.
   * For signed uploads, includes API key and signature generation.
   */
  async function getWidgetConfig(presetName: string): Promise<WidgetConfig> {
    const preset = provider.uploadPresets.find(p => p.name === presetName);
    if (!preset) {
      throw new Error(`Preset ${presetName} not found`);
    }

    const config: WidgetConfig = {
      cloudName,
      uploadPreset: presetName,
      sources: ["local", "url", "camera", "image_search"],
      multiple: true,
      showAdvancedOptions: true,
      resourceType: "auto",
      inlineContainer: "#upload-area"
    };

    // Add folder configuration if specified
    if (folderParam) {
      const key = folderParam.includes('asset_folder') ? 'asset_folder' : 'folder';
      const pathValue = folderParam.split(':')[1]?.trim().replace(/"/g, '') || '';
      config[key] = pathValue;
    }

    // Add signed upload configuration if needed
    if (preset.signed) {
      const apiSecret = provider.apiSecret;
      const apiKey = provider.apiKey;
      if (!apiSecret || !apiKey) {
        throw new Error('API Key and Secret are required for signed uploads');
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const params = {
        timestamp,
        upload_preset: presetName,
        ...(config.folder && { folder: config.folder }),
        ...(config.asset_folder && { asset_folder: config.asset_folder })
      };

      try {
        const signature = cloudinary.utils.api_sign_request(params, apiSecret);
        config.apiKey = apiKey;
        config.timestamp = timestamp;
        config.signature = signature;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to generate upload signature: ${err.message}`);
        throw err;
      }
    }

    return config;
  }

  // Set up the webview HTML content
  panel.webview.html = getWebviewContent(title, currentPreset, provider, folderParam, cloudName);

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(async (message: {
    command: string;
    params?: any;
    error?: string;
  }) => {
    if (message.command === 'generateSignature' && message.params) {
      try {
        const apiSecret = provider.apiSecret;
        if (!apiSecret) {
          throw new Error('API Secret is required for signed uploads');
        }

        const signature = cloudinary.utils.api_sign_request(
          { ...message.params, source: 'uw' },
          apiSecret
        );

        panel.webview.postMessage({
          command: 'signatureGenerated',
          signature
        });
      } catch (err: any) {
        panel.webview.postMessage({
          command: 'uploadError',
          error: `Failed to generate signature: ${err.message}`
        });
      }
    } else if (message.command === 'uploadError') {
      vscode.window.showErrorMessage(`Upload failed: ${message.error}`);
    }
  });

  return panel;
}

/**
 * Generates the HTML content for the upload widget webview.
 * Includes styles, widget container, and JavaScript for widget management.
 */
function getWebviewContent(
  title: string,
  currentPreset: string,
  provider: CloudinaryTreeDataProvider,
  folderParam: string,
  cloudName: string
): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://widget.cloudinary.com/v2.0/global/all.js" type="text/javascript"></script>
    <title>${title}</title>
    <style>
      /* Base styles */
      body {
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        margin: 0;
        padding: 2rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100vh;
      }

      /* Card container */
      .card {
        background-color: var(--vscode-editorWidget-background);
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 900px;
        width: 100%;
      }

      /* Upload area */
      #upload-area {
        min-height: 500px;
        border: 1px dashed var(--vscode-editorWidget-border);
        padding: 1rem;
        border-radius: 8px;
        background-color: var(--vscode-editor-background);
      }

      /* Preset selector */
      .preset-selector {
        margin-bottom: 1.5rem;
        background-color: var(--vscode-editorWidget-background);
        border-radius: 8px;
        padding: 1rem;
        border: 1px solid var(--vscode-editorWidget-border);
      }

      .preset-label {
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }

      .preset-selector select {
        background-color: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.9rem;
        width: 100%;
        max-width: 400px;
        margin-bottom: 0.75rem;
      }

      /* Preset details */
      .preset-details {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background-color: var(--vscode-editor-background);
        border-radius: 4px;
        font-size: 0.85rem;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--vscode-editorWidget-border);
        display: none;
      }

      .preset-details.visible {
        display: block;
      }

      /* Upload info */
      .upload-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding: 0.5rem;
        background-color: var(--vscode-editor-background);
        border-radius: 4px;
      }

      .upload-info code {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-size: 0.85rem;
      }

      /* Buttons and controls */
      .preset-details-toggle {
        background: none;
        border: none;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        padding: 0;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .preset-details-toggle::before {
        content: '▶';
        font-size: 0.7rem;
        transition: transform 0.2s;
      }

      .preset-details-toggle.expanded::before {
        transform: rotate(90deg);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>${title}</h2>
      <div class="preset-selector">
        <div class="preset-label">Upload Preset</div>
        <select id="presetSelect" onchange="handlePresetChange(this.value)">
          ${provider.uploadPresets.map(preset => `
            <option value="${preset.name}" ${preset.name === currentPreset ? 'selected' : ''}>
              ${preset.name} (${preset.signed ? 'Signed' : 'Unsigned'})
            </option>
          `).join('')}
        </select>
        <div class="preset-details-container">
          <button id="presetDetailsToggle" class="preset-details-toggle" onclick="togglePresetDetails()">
            Show Settings
          </button>
          <div id="presetDetails" class="preset-details"></div>
        </div>
      </div>
      <div class="upload-info">
        <p>Uploading to: <code>${folderParam.replace(/"/g, "") || "root"}</code></p>
      </div>
      <div id="upload-area"></div>
    </div>

    <script>
      // Initialize state
      let currentPreset = "${currentPreset}";
      let widget = null;
      const presets = ${JSON.stringify(provider.uploadPresets)};
      const vscode = acquireVsCodeApi();

      /**
       * Formats preset settings for display
       */
      function formatPresetDetails(settings) {
        if (!settings) return 'No specific settings';
        
        const processedSettings = Object.entries(settings).reduce((acc, [key, value]) => {
          // Convert string booleans and numbers to actual booleans
          if (value === "0" || value === 0) acc[key] = false;
          else if (value === "1" || value === 1) acc[key] = true;
          else if (value === "true") acc[key] = true;
          else if (value === "false") acc[key] = false;
          else acc[key] = value;
          return acc;
        }, {});

        return Object.entries(processedSettings)
          .map(([key, value]) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
            const formattedValue = Array.isArray(value) 
              ? value.join(', ') 
              : typeof value === 'object' 
                ? JSON.stringify(value) 
                : value;
            return \`\${formattedKey}: \${formattedValue}\`;
          })
          .join('\\n');
      }

      /**
       * Toggles the visibility of preset details
       */
      function togglePresetDetails() {
        const detailsDiv = document.getElementById('presetDetails');
        const toggleBtn = document.getElementById('presetDetailsToggle');
        const isVisible = detailsDiv.classList.toggle('visible');
        toggleBtn.classList.toggle('expanded');
        toggleBtn.textContent = isVisible ? 'Hide Settings' : 'Show Settings';
      }

      /**
       * Creates and initializes the Cloudinary Upload Widget
       */
      function createWidget(presetName) {
        const preset = presets.find(p => p.name === presetName);
        if (!preset) return;

        const baseConfig = {
          cloudName: "${cloudName}",
          uploadPreset: presetName,
          sources: ["local", "url", "camera", "image_search"],
          multiple: true,
          showAdvancedOptions: true,
          resourceType: "auto",
          inlineContainer: "#upload-area"
        };

        // Add folder configuration if specified
        ${folderParam ? `baseConfig.folder = "${folderParam.split(':')[1]?.trim().replace(/"/g, '')}";` : ''}

        // Add signed upload configuration if needed
        if (preset.signed) {
          baseConfig.apiKey = "${provider.apiKey}";
          baseConfig.uploadSignature = function(callback, params_to_sign) {
            vscode.postMessage({ 
              command: 'generateSignature',
              params: params_to_sign
            });

            window.addEventListener('message', function signatureHandler(event) {
              if (event.data.command === 'signatureGenerated') {
                window.removeEventListener('message', signatureHandler);
                callback(event.data.signature);
              }
            });
          };
        }

        // Create and open the widget
        widget = cloudinary.createUploadWidget(
          baseConfig,
          function(error, result) {
            if (!error && result && result.event === "success") {
              vscode.postMessage({ command: "uploadComplete" });
            } else if (error) {
              vscode.postMessage({ 
                command: "uploadError",
                error: error.message || 'Upload failed'
              });
            }
          }
        );

        widget.open();
      }

      /**
       * Handles preset selection changes
       */
      function handlePresetChange(presetName) {
        const preset = presets.find(p => p.name === presetName);
        if (!preset) return;

        currentPreset = presetName;
        
        // Update preset details display
        const detailsDiv = document.getElementById('presetDetails');
        const details = formatPresetDetails(preset.settings);
        detailsDiv.textContent = details;
        
        // Reset toggle state if no settings
        if (details === 'No specific settings') {
          detailsDiv.classList.remove('visible');
          const toggleBtn = document.getElementById('presetDetailsToggle');
          toggleBtn.classList.remove('expanded');
          toggleBtn.textContent = 'Show Settings';
        }

        // Recreate widget with new preset
        if (widget) {
          widget.destroy();
        }
        createWidget(presetName);
      }

      // Initialize on page load
      window.addEventListener("DOMContentLoaded", function() {
        // Show initial preset details
        const initialPreset = presets.find(p => p.name === currentPreset);
        if (initialPreset) {
          const details = formatPresetDetails(initialPreset.settings);
          document.getElementById('presetDetails').textContent = details;
        }
        
        // Create initial widget
        createWidget(currentPreset);
      });
    </script>
  </body>
  </html>
  `;
}

export default registerUpload;
