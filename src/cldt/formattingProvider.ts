import * as vscode from "vscode";

export class CldtFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    const edits: vscode.TextEdit[] = [];
    const text = document.getText();

    // Check if this is a Cloudinary URL format
    if (this.isUrl(text)) {
      const formatted = this.formatCloudinaryTransformationFormat(this.formatRawUrl(text, options), options);

      if (formatted !== text) {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
        edits.push(vscode.TextEdit.replace(fullRange, formatted));
      }
    } else {
      // Format as regular CLDT syntax
      const formatted = this.formatCloudinaryTransformationSyntax(text, options);
      if (formatted !== text) {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
        edits.push(vscode.TextEdit.replace(fullRange, formatted));
      }
    }

    return edits;
  }

  private isUrl(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.startsWith("http://") || trimmed.startsWith("https://");
  }

  private formatRawUrl(text: string, options: vscode.FormattingOptions): string {
    const trimmed = text.trim();

    // Check if this is already a multi-line format (has newlines)
    if (trimmed.includes("\n")) {
      return this.formatCloudinaryTransformationFormat(text, options);
    }

    // Parse single-line Cloudinary URL
    // Format: [schema]://[domain]/[cloud-name]/[resource-type]/[resource-kind]/[transformations...]/[version]/[public-id]
    const urlPattern = /^(https?):\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;
    const match = urlPattern.exec(trimmed);

    if (!match) {
      return text; // Return as-is if doesn't match pattern
    }

    const schema = match[1];
    const domain = match[2];
    const cloudName = match[3];
    const resourceType = match[4];
    const resourceKind = match[5];
    const remainingPath = match[6];

    // Split the remaining path into components
    const components = remainingPath.split("/");

    // Find where transformations end and version/public-id begins
    // Version typically starts with 'v' followed by numbers (e.g., v1234567890)
    let versionIndex = -1;
    let publicIdStartIndex = -1;

    // Look for version component
    versionIndex = components.findIndex((comp) => /^v\d+$/.test(comp));
    if (versionIndex !== -1) {
      publicIdStartIndex = versionIndex + 1;
    } else {
      // If no version found, the last component (or components) are likely the public-id
      // Public-id is typically the last segment(s), often with an extension

      // Work backwards to find where public-id likely starts
      // Look for common asset patterns or just take the last component
      publicIdStartIndex = components.length - 1;

      // Check if there are nested folders in public-id (multiple segments without transformations)
      // Transformations typically contain ',' or specific Cloudinary transformation syntax
      for (let i = components.length - 1; i >= 0; i--) {
        const comp = components[i];
        // If component contains transformation syntax, it's not part of public-id
        if (this.isTransformationComponent(comp)) {
          publicIdStartIndex = i + 1;
          break;
        }
        // If we've gone back too far (first component), it's probably all public-id
        if (i === 0) {
          publicIdStartIndex = 0;
        }
      }
    }

    const transformationEndIndex = (versionIndex >= 0 ? versionIndex : publicIdStartIndex) - 1;
    const baseUrl = `${schema}://${domain}/${cloudName}/${resourceType}/${resourceKind}/`;
    const formattedLines: string[] = [baseUrl];

    // Add transformation components (one per line) with proper indentation
    // Handle if/end_if and layer (l_) / fl_layer_apply indentation
    let indentLevel = 0;
    const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";

    if (transformationEndIndex >= 0) {
      for (let i = 0; i <= transformationEndIndex; i++) {
        const component = components[i];

        // Check if this component ends the current indentation level
        if (this.endsIndentation(component)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        // Add the line with current indentation

        if (component.includes(",")) {
          component.split(",").forEach((instruction, index, array) => {
            // const multiParamExpressionRegex = /[^!]+:[^!]+.*$/;
            const delimiter = index < array.length - 1 ? "," : "/";
            const indentedLine = indent.repeat(indentLevel) + instruction + delimiter;
            formattedLines.push(indentedLine);
          });
          formattedLines.push(indent.repeat(indentLevel));
        } else {
          const indentedLine = indent.repeat(indentLevel) + component + "/";
          formattedLines.push(indentedLine);
        }

        // Check if this component starts a new indentation level
        if (this.startsIndentation(component)) {
          indentLevel++;
        }

        // Add blank line after block ends (if_end or fl_layer_apply)
        // Only add if the next component exists and is not empty
        // Don't add blank line after if_else since it's a mid-block separator
        if (this.endsIndentation(component) && component !== "if_else" && i < transformationEndIndex) {
          formattedLines.push("");
        }
      }
    }

    // Add version if exists (no indentation)
    if (versionIndex >= 0) {
      formattedLines.push(components[versionIndex] + "/");
    }

    // Add public-id (which may span multiple path segments, no indentation)
    if (publicIdStartIndex >= 0 && publicIdStartIndex < components.length) {
      const publicIdParts = components.slice(publicIdStartIndex);
      formattedLines.push(publicIdParts.join("/"));
    }

    return formattedLines.join("\n");
  }

  private formatCloudinaryTransformationFormat(text: string, options: vscode.FormattingOptions): string {
    const lines = text.split("\n");
    const formattedLines: string[] = [];
    let indentLevel = 0;
    const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    const commentAlignColumn = 30; // Column to align inline comments

    // First pass: identify which lines are transformations vs public ID
    const lineInfos: Array<{
      trimmed: string;
      isTransformation: boolean;
      isUrl: boolean;
      isComment: boolean;
      isEmpty: boolean;
      isMultiLineParam: boolean;
      isMultiLineParamStart: boolean;
    }> = [];
    let foundVersion = false;
    let inMultiLineParam = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const isEmpty = trimmedLine === "";
      const isComment = trimmedLine.startsWith("#");
      const isUrl = trimmedLine.match(/^https?:\/\//) !== null;

      // Check if this line starts a multi-line parameter (like l_text:)
      const isMultiLineParamStart = /^l_text:|^l_subtitles:/.test(trimmedLine) && !trimmedLine.endsWith(",") && !trimmedLine.endsWith("/");

      // Check if we're in a multi-line parameter continuation
      let isMultiLineParam = false;
      if (isMultiLineParamStart) {
        inMultiLineParam = true;
        isMultiLineParam = false; // Start line is not a continuation
      } else if (inMultiLineParam && !isEmpty && !isComment) {
        // Check if this line ends the multi-line parameter
        if (trimmedLine.endsWith(",") || trimmedLine.endsWith("/")) {
          isMultiLineParam = true;
          inMultiLineParam = false; // This is the last line
        } else {
          isMultiLineParam = true;
        }
      }

      let isTransformation = false;
      if (!isEmpty && !isComment && !isUrl) {
        const cleanLine = trimmedLine.replace(/[,/]+$/, "");
        // Check if this looks like a version line
        if (/^v\d+$/.test(cleanLine)) {
          foundVersion = true;
          isTransformation = true;
        } else if (this.isTransformationComponent(cleanLine) || cleanLine.startsWith("if_") || cleanLine.startsWith("$")) {
          isTransformation = true;
        }
      }

      lineInfos.push({
        trimmed: trimmedLine,
        isTransformation,
        isUrl,
        isComment,
        isEmpty,
        isMultiLineParam,
        isMultiLineParamStart,
      });
    }

    let consecutiveEmptyLines = 0;
    let multiLineParamIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lineInfos[i];
      const trimmedLine = lineInfo.trimmed;

      // Handle empty lines - limit to maximum of 2 consecutive (one blank line)
      if (lineInfo.isEmpty) {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines <= 2) {
          formattedLines.push("");
        }
        continue;
      }

      // Reset empty line counter
      consecutiveEmptyLines = 0;

      // Handle comment-only lines (preserve as-is with no indentation)
      if (lineInfo.isComment) {
        formattedLines.push(trimmedLine);
        continue;
      }

      // Separate transformation from inline comment
      let transformPart = trimmedLine;
      let commentPart = "";
      const hashIndex = trimmedLine.indexOf("#");

      if (hashIndex > 0) {
        transformPart = trimmedLine.substring(0, hashIndex).trim();
        commentPart = trimmedLine.substring(hashIndex).trim();
      }

      // Remove trailing comma or slash if present
      const cleanTransform = transformPart.replace(/[,/]+$/, "");

      // Handle multi-line parameter start (like l_text:)
      if (lineInfo.isMultiLineParamStart) {
        multiLineParamIndent = indentLevel + 1;
      }

      // Check if this line ends indentation
      if (this.endsIndentation(cleanTransform)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Build the formatted line with appropriate indentation
      let currentIndent = indentLevel;
      if (lineInfo.isMultiLineParam) {
        currentIndent = multiLineParamIndent;
      }

      let formattedLine = indent.repeat(currentIndent) + cleanTransform;

      // Add trailing character (comma or slash based on original)
      if (transformPart.endsWith("/")) {
        formattedLine += "/";
      } else if (transformPart.endsWith(",")) {
        formattedLine += ",";
      } else if (!lineInfo.isUrl && lineInfo.isTransformation && !lineInfo.isMultiLineParam && !lineInfo.isMultiLineParamStart) {
        // Only add slash to transformation lines, not public IDs or multi-line params
        formattedLine += "/";
      }

      // Align and add inline comment if present
      if (commentPart) {
        const padding = Math.max(1, commentAlignColumn - formattedLine.length);
        formattedLine += " ".repeat(padding) + commentPart;
      }

      formattedLines.push(formattedLine);

      // Check if this line starts indentation
      // But skip if it's a multi-line parameter start (handled separately)
      if (this.startsIndentation(cleanTransform) && !lineInfo.isMultiLineParamStart) {
        indentLevel++;
      }

      // Add blank line after block ends (if_end or fl_layer_apply)
      // Only add if the next line exists and is not already empty
      // Don't add blank line after if_else since it's a mid-block separator
      if (this.endsIndentation(cleanTransform) && cleanTransform !== "if_else") {
        const nextLineIndex = i + 1;
        if (nextLineIndex < lines.length && lineInfos[nextLineIndex].trimmed !== "") {
          formattedLines.push("");
        }
      }
    }

    return formattedLines.join("\n");
  }

  private startsIndentation(component: string): boolean {
    // Check if component starts a conditional block (if_)
    // But not if it's ending a conditional (if_end, end_if) or if_else
    if (component.startsWith("if_") && !component.startsWith("if_end") && !component.includes("end_if") && component !== "if_else") {
      return true;
    }
    // Check if component is if_else (acts as both end and start)
    if (component === "if_else") {
      return true;
    }
    // Check if component starts a layer (l_ prefix)
    // But not if it's fl_layer_apply or other fl_ flags
    if (/^l_/.test(component) && !component.startsWith("fl_")) {
      return true;
    }
    return false;
  }

  private endsIndentation(component: string): boolean {
    // Check if component is if_else (acts as both end and start)
    if (component === "if_else") {
      return true;
    }
    // Check if component is exactly if_end or end_if (standalone component)
    if (component === "if_end" || component === "end_if") {
      return true;
    }
    // Check if component contains fl_layer_apply as a parameter
    if (component.includes("fl_layer_apply")) {
      return true;
    }
    return false;
  }

  private isTransformationComponent(component: string): boolean {
    // Transformation components typically contain:
    // - Comma-separated parameters (e.g., "w_300,h_200")
    // - Underscores for parameter names (e.g., "w_300", "c_fill")
    // - Common transformation prefixes
    const hasComma = component.includes(",");
    const hasUnderscore = component.includes("_");
    const transformationPrefixes = /^(w_|h_|c_|g_|q_|f_|a_|bo_|r_|e_|o_|l_|u_|fl_|co_|b_|z_|ar_|x_|y_|dpr_|if_|else|end_|variable_)/;

    return hasComma || (hasUnderscore && transformationPrefixes.test(component));
  }

  private formatCloudinaryTransformationSyntax(text: string, options: vscode.FormattingOptions): string {
    const lines = text.split("\n");
    let indentLevel = 0;
    const formattedLines: string[] = [];
    const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    let consecutiveEmptyLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Handle empty lines - limit to maximum of 2 consecutive (one blank line)
      if (line === "") {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines <= 2) {
          formattedLines.push("");
        }
        continue;
      }

      // Reset empty line counter
      consecutiveEmptyLines = 0;

      // Skip comment-only lines (no indentation changes)
      if (line.startsWith("#")) {
        formattedLines.push(line);
        continue;
      }

      // Separate transformation from inline comment
      let transformPart = line;

      const hashIndex = line.indexOf("#");

      if (hashIndex > 0) {
        transformPart = line.substring(0, hashIndex).trim();
      }

      // Remove trailing comma or slash if present for checking
      const cleanTransform = transformPart.replace(/[,/]+$/, "");

      // Check if this line ends indentation (before adding the line)
      if (this.endsIndentation(cleanTransform)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add indentation
      const indentedLine = indent.repeat(indentLevel) + line;

      formattedLines.push(indentedLine);

      // Check if this line starts indentation (after adding the line)
      if (this.startsIndentation(cleanTransform)) {
        indentLevel++;
      }

      // Decrease indent after closing braces if not already at start
      if (cleanTransform.endsWith("}") && !cleanTransform.startsWith("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add blank line after block ends (if_end or fl_layer_apply)
      // Only add if the next line exists and is not already empty
      // Don't add blank line after if_else since it's a mid-block separator
      if (this.endsIndentation(cleanTransform) && cleanTransform !== "if_else") {
        const nextLineIndex = i + 1;
        if (nextLineIndex < lines.length) {
          const nextLine = lines[nextLineIndex].trim();
          if (nextLine !== "" && !nextLine.startsWith("#")) {
            formattedLines.push("");
          }
        }
      }
    }

    return formattedLines.join("\n");
  }
}
