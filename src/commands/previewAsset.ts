import * as vscode from "vscode";

type AssetData = {
  public_id: string,
  displayType: "image" | "video" | string,
  secure_url: string,
  optimized_url: string,
  bytes: number,
  width: number,
  height: number,
  filename: string
};

function registerPreview(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openAsset", (asset: AssetData) => {
      const panel = vscode.window.createWebviewPanel(
        "cloudinaryAssetPreview",
        asset.public_id,
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      let assetHtml = "";

      if (asset.displayType === "image") {
        assetHtml = `<img src="${asset.optimized_url}" alt="${asset.public_id}" style="max-width: 100%; border-radius: 6px; margin-bottom: 1rem;" />`;
      } else if (asset.displayType === "video") {
        assetHtml = `<video controls style="max-width: 100%; border-radius: 6px; margin-bottom: 1rem;">
                      <source src="${asset.secure_url}" type="video/mp4">
                    </video>`;
      } else {
        assetHtml = `
          <vscode-text><strong>Public ID:</strong> ${asset.public_id}</vscode-text>
          <vscode-link href="${asset.optimized_url}" target="_blank">Optimized URL</vscode-link>
        `;
      }

      panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${asset.public_id}</title>
        <style>
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
      
          .card {
            background-color: var(--vscode-editorWidget-background);
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 720px;
            width: 100%;
          }
      
          h2 {
            margin-bottom: 1rem;
            font-size: 1.4rem;
          }
      
          nav {
            display: flex;
            border-bottom: 1px solid var(--vscode-editorGroup-border);
            margin-bottom: 1rem;
          }
      
          nav button {
            flex: 1;
            padding: 0.5rem;
            background: none;
            border: none;
            font-weight: bold;
            cursor: pointer;
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid transparent;
          }
      
          nav button.active {
            border-bottom-color: var(--vscode-textLink-activeForeground);
          }
      
          .tab-content {
            display: none;
          }
      
          .tab-content.active {
            display: block;
          }
      
          p {
            margin: 0.5rem 0;
          }
      
          a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
          }
      
          a:hover {
            text-decoration: underline;
          }
      
          .copy-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85rem;
            margin-left: 0.5rem;
          }
      
          .copy-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
      
          .copy-btn:active {
            background-color: var(--vscode-button-activeBackground);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${asset.public_id}</h2>
          ${assetHtml}
      
          <nav>
            <button class="tab-btn active" data-tab="info">Info</button>
            <button class="tab-btn" data-tab="meta">Metadata</button>
            <button class="tab-btn" data-tab="urls">URLs</button>
          </nav>
      
          <div class="tab-content active" id="tab-info">
            <p><strong>Public ID:</strong> ${asset.public_id} <button class="copy-btn" data-copy="${asset.public_id}">Copy</button></p>
            <p><strong>Original filename:</strong> ${asset.filename}</p>
            <p><strong>Dimensions:</strong> ${asset.width} x ${asset.height}</p>
            <p><strong>Size:</strong> ${(asset.bytes / 1024).toFixed(2)} KB</p>
            <p><strong>Display Type:</strong> ${asset.displayType}</p>
          </div>
      
         <div class="tab-content" id="tab-meta">
          <p><strong>Tags:</strong> ${Array.isArray((asset as any).tags) && (asset as any).tags.length
          ? (asset as any).tags.join(", ")
          : "No tags"
        }</p>

          <p><strong>Context Metadata:</strong></p>
          ${(asset as any).context
          ? Object.entries((asset as any).context)
            .map(([key, value]) => `<p>${key}: ${value}</p>`)
            .join("")
          : "<p>None</p>"
        }

          <p><strong>Structured Metadata:</strong></p>
          ${(asset as any).metadata
          ? Object.entries((asset as any).metadata)
            .map(([key, value]) => `<p>${key}: ${value}</p>`)
            .join("")
          : "<p>None</p>"
        }
        </div>
      
          <div class="tab-content" id="tab-urls">
            <p><strong>Original URL:</strong> <a href="${asset.secure_url}" target="_blank">${asset.secure_url}</a> <button class="copy-btn" data-copy="${asset.secure_url}">Copy</button></p>
            <p><strong>Optimized URL:</strong> <a href="${asset.optimized_url}" target="_blank">${asset.optimized_url}</a> <button class="copy-btn" data-copy="${asset.optimized_url}">Copy</button></p>
          </div>
        </div>
      
        <script>
          const tabs = document.querySelectorAll(".tab-btn");
          const contents = document.querySelectorAll(".tab-content");
      
          tabs.forEach((btn) => {
            btn.addEventListener("click", () => {
              tabs.forEach(t => t.classList.remove("active"));
              contents.forEach(c => c.classList.remove("active"));
      
              btn.classList.add("active");
              const target = document.getElementById("tab-" + btn.dataset.tab);
              if (target) target.classList.add("active");
            });
          });
      
          // Copy button functionality
          const copyButtons = document.querySelectorAll(".copy-btn");
          copyButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
              const textToCopy = btn.getAttribute("data-copy");
              navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = btn.textContent;
                btn.textContent = "Copied!";
                setTimeout(() => {
                  btn.textContent = originalText;
                }, 2000);
              });
            });
          });
        </script>
      </body>
      </html>
      `;
    })
  );
}

export default registerPreview;