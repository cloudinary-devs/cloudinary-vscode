import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface Hint {
  message: string;
  type: "warning" | "info" | "error";
}

interface UrlBindingContext {
  prefix?: string;
  suffix?: string;
  cloudName?: string;
  publicId?: string;
}
interface BoundUrl {
  url: string;
  bindings: {
    prefix?: Binding;
    suffix?: Binding;
    cloudName?: Binding;
    publicId?: Binding;
  };
}

interface Binding {
  src: "cldtrc" | "annotation";
  value: string;
}

interface IPreviewHtmlContext {
  nonce: string;
  fileName: string;
  urlEscaped: string;
  bindingsHtml: string;
  imageUrlJson: string;
}

export class CldtPreviewProvider {
  private static readonly viewType = "cldt.preview";
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private currentDocument: vscode.TextDocument | undefined;
  private lastUrl: string | undefined;
  private updateTimeout: NodeJS.Timeout | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  private analyzeHints(cldHeaders: { [key: string]: string }, url: string, documentText: string): Hint[] {
    const hints: Hint[] = [];

    // Track if we've already added specific hints for errors
    let hasSpecificErrorHint = false;

    // Check URL for common issues
    if (url.includes("w_") || url.includes("h_")) {
      const widthMatch = url.match(/w_([0-9.]+)/);
      const heightMatch = url.match(/h_([0-9.]+)/);

      if (widthMatch && widthMatch[1].includes(".")) {
        const lineNumber = this.findParameterLine(documentText, `w_${widthMatch[1]}`);
        hints.push({
          message: `Line ${lineNumber}: Width parameter 'w_${widthMatch[1]}' contains a decimal point. Use an integer value instead (e.g., w_${Math.round(
            parseFloat(widthMatch[1])
          )}).`,
          type: "warning",
        });
        hasSpecificErrorHint = true;
      }

      if (heightMatch && heightMatch[1].includes(".")) {
        const lineNumber = this.findParameterLine(documentText, `h_${heightMatch[1]}`);
        hints.push({
          message: `Line ${lineNumber}: Height parameter 'h_${heightMatch[1]}' contains a decimal point. Use an integer value instead (e.g., h_${Math.round(
            parseFloat(heightMatch[1])
          )}).`,
          type: "warning",
        });
        hasSpecificErrorHint = true;
      }
    }

    // Check for x-cld-error header and extract specific error details
    const cldError = cldHeaders["x-cld-error"];
    if (cldError) {
      // Check for invalid variable assignment error: "Invalid assignment to $varName: value"
      const invalidAssignmentMatch = cldError.match(/Invalid assignment to (\$[\w]+):\s*(.+)$/);
      if (invalidAssignmentMatch) {
        const varName = invalidAssignmentMatch[1];
        const invalidValue = invalidAssignmentMatch[2].trim();
        const lineNumber = this.findParameterLine(documentText, varName);
        hints.push({
          message: `Line ${lineNumber}: Invalid assignment to variable '${varName}' with value '${invalidValue}'. Check the variable syntax and value format.`,
          type: "error",
        });
        hasSpecificErrorHint = true;
      }
      // Check for variable used before assignment: "Variable $varName is used before being assigned"
      else {
        const usedBeforeAssignmentMatch = cldError.match(/Variable (\$[\w]+) is used before being assigned/);
        if (usedBeforeAssignmentMatch) {
          const varName = usedBeforeAssignmentMatch[1];
          const lineNumber = this.findParameterLine(documentText, varName);
          hints.push({
            message: `Line ${lineNumber}: Variable '${varName}' is used before being assigned. Define the variable before using it, or check for typos in the variable name.`,
            type: "error",
          });
          hasSpecificErrorHint = true;
        }
        // Check for invalid transformation component errors
        else {
          const invalidComponentMatch = cldError.match(/Invalid transformation component - (.+?)(?:\s|$)/);
          if (invalidComponentMatch) {
            const component = invalidComponentMatch[1].trim();
            const lineNumber = this.findParameterLine(documentText, component);
            hints.push({
              message: `Line ${lineNumber}: Invalid transformation component - ${component}`,
              type: "error",
            });
            hasSpecificErrorHint = true;
          }
          // Only show generic error if we don't have specific hints
          else if (!hasSpecificErrorHint) {
            // Try to extract any component from the error message and find its line
            const lineNumber = this.findErrorLine(documentText, cldError);
            if (lineNumber > 1) {
              hints.push({
                message: `Line ${lineNumber}: ${cldError}`,
                type: "error",
              });
            } else {
              hints.push({
                message: `Cloudinary error: ${cldError}`,
                type: "error",
              });
            }
          }
        }
      }
    }

    // Check for other common issues
    if (url.includes("c_scale") && !url.includes("w_") && !url.includes("h_")) {
      const lineNumber = this.findParameterLine(documentText, "c_scale");
      hints.push({
        message: `Line ${lineNumber}: Using c_scale without width or height parameter. Consider adding w_ or h_ to specify dimensions.`,
        type: "info",
      });
    }

    return hints;
  }

  private findParameterLine(documentText: string, parameter: string): number {
    const lines = documentText.split("\n");

    // If parameter is a variable (starts with $), look for both $var and $(var) syntax
    if (parameter.startsWith("$")) {
      const varName = parameter.substring(1); // Remove the $
      const searchPatterns = [
        parameter, // $varName
        `$(${varName})`, // $(varName)
        `$${varName}_`, // $varName_ (assignment)
      ];

      // First, try to find the variable being used (not in assignments or conditionals)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip assignment lines (lines with $var_value syntax at the start)
        if (line.trim().startsWith(`$${varName}_`)) {
          continue;
        }
        // Skip if_isndef/if_ndef conditional checks
        if (line.includes(`if_isndef_${parameter}`) || line.includes(`if_ndef_${parameter}`)) {
          continue;
        }

        // Check if any of the patterns exist in the line
        for (const pattern of searchPatterns) {
          if (line.includes(pattern)) {
            return i + 1; // Line numbers are 1-based
          }
        }
      }

      // If not found in usage, look for assignment or any occurrence
      for (let i = 0; i < lines.length; i++) {
        for (const pattern of searchPatterns) {
          if (lines[i].includes(pattern)) {
            return i + 1;
          }
        }
      }
    } else {
      // For non-variable parameters, use simple search
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(parameter)) {
          return i + 1; // Line numbers are 1-based
        }
      }
    }

    return 1; // Default to line 1 if not found
  }

  private findErrorLine(documentText: string, errorMessage: string): number {
    // Try to extract potential components from the error message
    // Common patterns: quoted strings, parameter names, etc.
    const lines = documentText.split("\n");

    // Try to find quoted strings in the error message
    const quotedMatch = errorMessage.match(/['"`]([^'"`]+)['"`]/);
    if (quotedMatch) {
      const searchTerm = quotedMatch[1];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchTerm)) {
          return i + 1;
        }
      }
    }

    // Try to find transformation parameters (e.g., "w_100", "c_fill")
    const paramMatch = errorMessage.match(/\b([a-z_]+_[a-z0-9_:]+)\b/i);
    if (paramMatch) {
      const searchTerm = paramMatch[1];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchTerm)) {
          return i + 1;
        }
      }
    }

    return 1; // Default to line 1 if not found
  }

  public showPreview(document: vscode.TextDocument) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn! + 1 : vscode.ViewColumn.Two;

    if (this.panel) {
      // If panel exists, reveal it and update content
      this.panel.reveal(column);
      this.currentDocument = document;
      this.updateContent(document, true);
    } else {
      // Create new panel
      this.panel = vscode.window.createWebviewPanel(CldtPreviewProvider.viewType, "CLDT Preview", column, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      });

      this.currentDocument = document;
      this.updateContent(document, true);

      // Handle panel disposal
      this.panel.onDidDispose(
        () => {
          this.dispose();
        },
        null,
        this.disposables
      );

      // Handle messages from the webview
      this.panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case "copyUrl":
              vscode.env.clipboard.writeText(message.url);
              vscode.window.showInformationMessage("URL copied to clipboard");
              break;
            case "openInBrowser":
              vscode.env.openExternal(vscode.Uri.parse(message.url));
              break;
            case "fetchHeaders":
              if (this.currentDocument) {
                await this.fetchAndSendHeaders(message.url, this.currentDocument.getText());
              }
              break;
          }
        },
        null,
        this.disposables
      );
    }
  }

  public updateContent(document: vscode.TextDocument, immediate = false) {
    if (!this.panel) {
      return;
    }

    // Clear any pending update
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // If immediate update (e.g., from save), skip debounce
    if (immediate) {
      const boundUrl = this.evaluateUrl(document);

      // Only update if the URL has changed
      if (this.lastUrl === boundUrl.url) {
        return;
      }

      this.lastUrl = boundUrl.url;
      this.panel.webview.html = this.getHtmlContent(boundUrl, document.fileName);
      return;
    }

    // Debounce updates by 300ms to prevent thrashing
    this.updateTimeout = setTimeout(() => {
      if (!this.panel) {
        return;
      }

      const boundUrl = this.evaluateUrl(document);

      // Only update if the URL has changed
      if (this.lastUrl === boundUrl.url) {
        return;
      }

      this.lastUrl = boundUrl.url;
      this.panel.webview.html = this.getHtmlContent(boundUrl, document.fileName);
    }, 5000);
  }

  private evaluateUrl(document: vscode.TextDocument): BoundUrl {
    const text = document.getText().trim();

    const annotations = this.parseAnnotations(text);
    const config = this.readConfigFile(document.uri);

    // Merge file config with annotations (annotations take precedence)

    // Fall back to original behavior: Look for Cloudinary URLs in the document
    const lines = text
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter((line) => line.trim().length > 0);
    const url = lines.join("");
    return this.bindContextIfNeeded(url, config, annotations);
  }

  private readConfigFile(documentUri: vscode.Uri): UrlBindingContext {
    try {
      // Get the directory of the current document
      const documentDir = path.dirname(documentUri.fsPath);
      const configPath = path.join(documentDir, ".cldtrc.json");

      // Check if config file exists
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configContent);

        // Return only the valid UrlBindingContext properties
        return {
          prefix: config.prefix,
          suffix: config.suffix,
          cloudName: config["cloud-name"], // Support both formats
          publicId: config["public-id"], // Support both formats
        };
      }
    } catch (error) {
      // Silently ignore errors (file not found, invalid JSON, etc.)
      console.warn("Failed to read .cldtrc.json:", error);
    }

    return {};
  }
  private bindContextIfNeeded(url: string, config: UrlBindingContext, annotations: UrlBindingContext): BoundUrl {
    const boundUrl: BoundUrl = {
      url,
      bindings: {},
    };

    if (url.startsWith("https://")) {
      return boundUrl;
    }

    const merged = { ...config, ...annotations };
    let constructedUrl = url;

    // Build URL based on which bindings are present
    if (merged.prefix) {
      constructedUrl = `${merged.prefix}${constructedUrl}`;
      boundUrl.bindings.prefix = {
        src: annotations.prefix ? "annotation" : "cldtrc",
        value: merged.prefix,
      };
    }

    if (merged.suffix) {
      constructedUrl = `${constructedUrl}${merged.suffix}`;
      boundUrl.bindings.suffix = {
        src: annotations.suffix ? "annotation" : "cldtrc",
        value: merged.suffix,
      };
    }

    if (merged.cloudName && !merged.prefix) {
      constructedUrl = `https://res.cloudinary.com/${merged.cloudName}/image/upload/${constructedUrl}`;
      boundUrl.bindings.cloudName = {
        src: annotations.cloudName ? "annotation" : "cldtrc",
        value: merged.cloudName,
      };
    }

    if (merged.publicId && !merged.suffix) {
      constructedUrl = `${constructedUrl}/v0/${merged.publicId}`;
      boundUrl.bindings.publicId = {
        src: annotations.publicId ? "annotation" : "cldtrc",
        value: merged.publicId,
      };
    }

    boundUrl.url = constructedUrl;
    return boundUrl;
  }

  private parseAnnotations(text: string): UrlBindingContext {
    const annotations: UrlBindingContext = {};

    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();

      // Parse @cld/prefix directive
      const prefixMatch = trimmed.match(/^#\s*@cld\/prefix\s+(.+)$/);
      if (prefixMatch) {
        annotations.prefix = prefixMatch[1].trim();
        continue;
      }

      // Parse @cld/suffix directive
      const suffixMatch = trimmed.match(/^#\s*@cld\/suffix\s+(.+)$/);
      if (suffixMatch) {
        annotations.suffix = suffixMatch[1].trim();
        continue;
      }

      // Parse @cld/cloud-name directive
      const cloudNameMatch = trimmed.match(/^#\s*@cld\/cloud-name\s+(.+)$/);
      if (cloudNameMatch) {
        annotations.cloudName = cloudNameMatch[1].trim();
        continue;
      }

      // Parse @cld/public-id directive
      const publicIdMatch = trimmed.match(/^#\s*@cld\/public-id\s+(.+)$/);
      if (publicIdMatch) {
        annotations.publicId = publicIdMatch[1].trim();
        continue;
      }
    }

    return annotations;
  }

  private async fetchAndSendHeaders(url: string, documentText: string) {
    if (!this.panel) {
      return;
    }

    try {
      const https = await import("https");
      const http = await import("http");

      const urlObj = new URL(url);
      const client = urlObj.protocol === "https:" ? https : http;
      const cldHeaderPatterns = [/^x-request-id$/, /^x-cld.*$/];
      return new Promise<void>((resolve) => {
        const req = client.request(url, { method: "GET", headers: { "cache-control": "no-cache" } }, (res) => {
          const cldHeaders: { [key: string]: string } = {};
          const otherHeaders: { [key: string]: string } = {};

          Object.entries(res.headers).forEach(([key, value]) => {
            const headerValue = Array.isArray(value) ? value.join(", ") : value || "";
            if (cldHeaderPatterns.some((regex) => regex.test(key))) {
              cldHeaders[key] = headerValue;
            } else {
              otherHeaders[key] = headerValue;
            }
          });

          // Analyze hints based on headers, URL, and document text
          const hints = this.analyzeHints(cldHeaders, url, documentText);

          this.panel?.webview.postMessage({
            command: "headersReceived",
            cldHeaders: cldHeaders,
            otherHeaders: otherHeaders,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            hints: hints,
          });

          resolve();
        });

        req.on("error", (error) => {
          this.panel?.webview.postMessage({
            command: "headersFailed",
            error: error.message,
          });
          resolve();
        });

        req.end();
      });
    } catch (error) {
      this.panel.webview.postMessage({
        command: "headersFailed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private getHtmlContent(boundUrl: BoundUrl | null, fileName: string): string {
    const nonce = this.getNonce();

    if (!boundUrl || !boundUrl.url) {
      return this.loadTemplate("preview-error.html");
    }

    const fileNameShort = this.escapeHtml(fileName.split("/").pop() || "");
    const urlEscaped = this.escapeHtml(boundUrl.url);
    const bindingsHtml = this.generateBindingsHtml(boundUrl.bindings);
    const imageUrlJson = JSON.stringify(boundUrl.url);
    const context: IPreviewHtmlContext = {
      nonce,
      fileName: fileNameShort,
      urlEscaped,
      bindingsHtml,
      imageUrlJson,
    };
    return this.loadTemplate("preview-main.html", context);
  }

  private loadTemplate(templateName: string, replacements?: IPreviewHtmlContext | undefined): string {
    const templatePath = path.join(__dirname, "..", "src", "templates", templateName);
    let template = fs.readFileSync(templatePath, "utf8");

    // Replace all placeholders
    for (const [key, value] of Object.entries(replacements || {})) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    return template;
  }

  private generateBindingsHtml(bindings: BoundUrl["bindings"]): string {
    const hasBindings = Object.keys(bindings).length > 0;

    if (!hasBindings) {
      return "";
    }

    const bindingLabels: { [K in keyof typeof bindings]: string } = {
      prefix: "Prefix",
      suffix: "Suffix",
      cloudName: "Cloud Name",
      publicId: "Public ID",
    };

    const bindingItems = Object.entries(bindings)
      .filter(([, binding]) => binding !== undefined)
      .map(([key, binding]) => {
        if (!binding) {
          return "";
        }
        const label = bindingLabels[key as keyof typeof bindings];
        const sourceClass = binding.src === "cldtrc" ? "cldtrc" : "annotation";
        const sourceText = binding.src === "cldtrc" ? ".cldtrc" : "@cld/*";

        return `
          <div class="binding-item">
            <span class="binding-label">${label}:</span>
            <span class="binding-value">${this.escapeHtml(binding.value)}</span>
            <span class="binding-source ${sourceClass}">${sourceText}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="bindings-info">
        ${bindingItems}
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  private getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose() {
    // Clear any pending updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    if (this.panel) {
      this.panel.dispose();
    }

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    this.panel = undefined;
    this.currentDocument = undefined;
    this.lastUrl = undefined;
  }
}
