import * as vscode from "vscode";

export class CldtDecorationProvider {
  private variableDecoration: vscode.TextEditorDecorationType;
  private keywordDecoration: vscode.TextEditorDecorationType;
  private numberDecoration: vscode.TextEditorDecorationType;

  constructor() {
    // Bold white for variables - explicitly set color
    this.variableDecoration = vscode.window.createTextEditorDecorationType({
      fontWeight: "bold",
      light: { color: "#000000" }, // Black for light themes
      dark: { color: "#D4D4D4" }, // Light gray/white for dark themes
    });

    // Blue for keywords
    this.keywordDecoration = vscode.window.createTextEditorDecorationType({
      light: { color: "#0000FF" }, // Blue for light themes
      dark: { color: "#569CD6" }, // VS Code blue for dark themes
    });

    // Light green for numbers
    this.numberDecoration = vscode.window.createTextEditorDecorationType({
      light: { color: "#098658" }, // Dark green for light themes
      dark: { color: "#B5CEA8" }, // Light green for dark themes
    });
  }

  public updateDecorations(editor: vscode.TextEditor) {
    if (editor.document.languageId !== "cldt") {
      return;
    }

    const text = editor.document.getText();
    const variableRanges: vscode.Range[] = [];
    const keywordRanges: vscode.Range[] = [];
    const numberRanges: vscode.Range[] = [];

    // Split text into lines for better position tracking
    const lines = text.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let match: RegExpExecArray | null;

      // Match variables: $varName or $(varName) in assignments and calls
      const variableRegex = /\$(?:\([a-zA-Z][a-zA-Z0-9]*\)|[a-zA-Z][a-zA-Z0-9]*)/g;
      while ((match = variableRegex.exec(line)) !== null) {
        const startPos = new vscode.Position(lineNum, match.index);
        const endPos = new vscode.Position(lineNum, match.index + match[0].length);
        variableRanges.push(new vscode.Range(startPos, endPos));
      }

      // Match all control flow keywords
      const keywordRegex = /(if_isndef|if_else|if_end|if_eq|if_ne|if_gt|if_lt|if_gte|if_lte)/g;
      while ((match = keywordRegex.exec(line)) !== null) {
        const startPos = new vscode.Position(lineNum, match.index);
        const endPos = new vscode.Position(lineNum, match.index + match[0].length);
        keywordRanges.push(new vscode.Range(startPos, endPos));
      }

      // Match numbers in various contexts:
      // 1. After underscore in assignments: $width_800
      // 2. After underscore in parameters: w_800
      // 3. Standalone numbers
      const numberRegex = /\b\d+(?:\.\d+)?(?=\/|,|\s|$)|(?<=_)\d+(?:\.\d+)?(?=\/|,|\s|$)/g;
      while ((match = numberRegex.exec(line)) !== null) {
        const startPos = new vscode.Position(lineNum, match.index);
        const endPos = new vscode.Position(lineNum, match.index + match[0].length);
        numberRanges.push(new vscode.Range(startPos, endPos));
      }
    }

    editor.setDecorations(this.variableDecoration, variableRanges);
    editor.setDecorations(this.keywordDecoration, keywordRanges);
    editor.setDecorations(this.numberDecoration, numberRanges);
  }

  public dispose() {
    this.variableDecoration.dispose();
    this.keywordDecoration.dispose();
    this.numberDecoration.dispose();
  }
}
