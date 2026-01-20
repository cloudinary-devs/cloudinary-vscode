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
        padding: 1rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }

      /* Card container */
      .card {
        background-color: var(--vscode-editorWidget-background);
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        max-width: 800px;
        width: 100%;
      }

      .card h2 {
        margin: 0 0 0.75rem 0;
        font-size: 1.1rem;
      }

      /* Upload area wrapper */
      .upload-wrapper {
        border: 1px dashed var(--vscode-editorWidget-border);
        border-radius: 8px;
        background-color: var(--vscode-editor-background);
        overflow: hidden;
        /* Larger wrapper to fit more scaled content */
        height: 370px;
      }

      /* Scale down the widget to 60% */
      #upload-area {
        transform: scale(0.6);
        transform-origin: top left;
        width: 166.67%;
        height: 166.67%;
      }

      /* Preset selector */
      .preset-selector {
        margin-bottom: 0.75rem;
        background-color: var(--vscode-editor-background);
        border-radius: 6px;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--vscode-editorWidget-border);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .preset-label {
        font-size: 0.8rem;
        font-weight: 600;
        margin: 0;
        white-space: nowrap;
      }

      .preset-selector select {
        background-color: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        padding: 0.35rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        flex: 1;
        min-width: 150px;
        max-width: 300px;
      }

      /* Preset details */
      .preset-details {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background-color: var(--vscode-editorWidget-background);
        border-radius: 4px;
        font-size: 0.75rem;
        white-space: pre-wrap;
        max-height: 120px;
        overflow-y: auto;
        border: 1px solid var(--vscode-editorWidget-border);
        display: none;
        width: 100%;
      }

      .preset-details.visible {
        display: block;
      }

      /* Upload info */
      .upload-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.8rem;
      }

      .upload-info p {
        margin: 0;
      }

      .upload-info code {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 0.15rem 0.35rem;
        border-radius: 3px;
        font-size: 0.75rem;
      }

      /* Buttons and controls */
      .preset-details-toggle {
        background: none;
        border: none;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        padding: 0;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.2rem;
        white-space: nowrap;
      }

      .preset-details-toggle::before {
        content: '▶';
        font-size: 0.6rem;
        transition: transform 0.2s;
      }

      .preset-details-toggle.expanded::before {
        transform: rotate(90deg);
      }


      /* Uploaded assets section */
      #uploaded-assets {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--vscode-editorWidget-border);
      }

      #uploaded-assets h3 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
      }

      #asset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 1rem;
      }

      .asset-card {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 0.5rem;
        text-align: center;
        transition: border-color 0.2s;
      }

      .asset-card:hover {
        border-color: var(--vscode-focusBorder);
      }

      .asset-card .thumbnail {
        width: 120px;
        height: 120px;
        object-fit: cover;
        border-radius: 4px;
        background: var(--vscode-editorWidget-background);
      }

      .asset-card .file-icon {
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--vscode-editorWidget-background);
        border-radius: 4px;
        font-size: 2rem;
      }

      .asset-card .public-id {
        font-size: 0.7rem;
        color: var(--vscode-descriptionForeground);
        margin: 0.5rem 0;
        word-break: break-all;
        max-height: 2.4em;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .asset-card .actions {
        display: flex;
        gap: 0.25rem;
        justify-content: center;
        flex-wrap: wrap;
      }

      .asset-card .actions button {
        font-size: 0.7rem;
        padding: 0.25rem 0.5rem;
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 3px;
        cursor: pointer;
      }

      .asset-card .actions button:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }

      .asset-card .actions button.copied {
        background-color: var(--vscode-testing-iconPassed, #4caf50);
        color: white;
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
      <div class="upload-wrapper">
        <div id="upload-area"></div>
      </div>
      <div id="uploaded-assets" style="display: none;">
        <h3>✅ Uploaded Assets</h3>
        <div id="asset-grid"></div>
      </div>
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
          inlineContainer: "#upload-area",
          language: "en",
          text: {
            "en": {
              "local": {
                "dd_title_single": "Click Browse to select a file",
                "dd_title_multi": "Click Browse to select files",
                "drop_title_single": "Or drop a file here",
                "drop_title_multi": "Or drop files here"
              },
              "url": {
                "inner_title": "Enter a URL below (use Paste button above if Ctrl+V doesn't work)"
              }
            }
          }
        };

        // Add folder configuration if specified
        ${folderParam ? (() => {
      const key = folderParam.includes('asset_folder') ? 'asset_folder' : 'folder';
      const pathValue = folderParam.split(':')[1]?.trim().replace(/"/g, '') || '';
      return `baseConfig.${key} = "${pathValue}";`;
    })() : ''}

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
              // Render the uploaded asset thumbnail
              renderUploadedAsset(result.info);
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
       * Generates a thumbnail URL for the uploaded asset
       */
      function getThumbnailUrl(asset) {
        const cloudName = "${cloudName}";
        const publicId = asset.public_id;
        const resourceType = asset.resource_type;
        
        if (resourceType === 'image') {
          // Use transformation for image thumbnails
          return \`https://res.cloudinary.com/\${cloudName}/image/upload/w_120,h_120,c_fill,g_auto,f_auto,q_auto/\${publicId}\`;
        } else if (resourceType === 'video') {
          // Use video thumbnail with start offset
          return \`https://res.cloudinary.com/\${cloudName}/video/upload/w_120,h_120,c_fill,so_auto,f_jpg/\${publicId}.jpg\`;
        }
        return null; // Raw files don't have thumbnails
      }

      /**
       * Gets file extension icon for raw files
       */
      function getFileIcon(format) {
        const icons = {
          'pdf': '📄',
          'doc': '📝',
          'docx': '📝',
          'xls': '📊',
          'xlsx': '📊',
          'zip': '📦',
          'rar': '📦',
          'json': '📋',
          'xml': '📋',
          'txt': '📃'
        };
        return icons[format?.toLowerCase()] || '📁';
      }

      /**
       * Renders an uploaded asset card in the gallery
       */
      function renderUploadedAsset(asset) {
        const container = document.getElementById('uploaded-assets');
        const grid = document.getElementById('asset-grid');
        
        // Show the uploaded assets section
        container.style.display = 'block';
        
        const thumbnailUrl = getThumbnailUrl(asset);
        const isRaw = asset.resource_type === 'raw';
        
        const card = document.createElement('div');
        card.className = 'asset-card';
        
        // Create thumbnail or file icon
        let mediaHtml;
        if (thumbnailUrl) {
          mediaHtml = \`<img class="thumbnail" src="\${thumbnailUrl}" alt="Thumbnail" onerror="this.parentElement.innerHTML='<div class=\\\\'file-icon\\\\'>\${getFileIcon(asset.format)}</div>'" />\`;
        } else {
          mediaHtml = \`<div class="file-icon">\${getFileIcon(asset.format)}</div>\`;
        }
        
        // Truncate public_id for display
        const displayId = asset.public_id.length > 30 
          ? '...' + asset.public_id.slice(-27) 
          : asset.public_id;
        
        card.innerHTML = \`
          \${mediaHtml}
          <div class="public-id" title="\${asset.public_id}">\${displayId}</div>
          <div class="actions">
            <button onclick="copyToClipboard(this, '\${asset.secure_url}')">Copy URL</button>
            <button onclick="copyToClipboard(this, '\${asset.public_id}')">Copy ID</button>
          </div>
        \`;
        
        // Add to the beginning of the grid
        grid.insertBefore(card, grid.firstChild);
      }

      /**
       * Copies text to clipboard and shows feedback
       */
      function copyToClipboard(button, text) {
        navigator.clipboard.writeText(text).then(() => {
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
          }, 1500);
        }).catch(() => {
          // Fallback: request clipboard write from extension
          vscode.postMessage({ command: 'copyToClipboard', text: text });
        });
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
