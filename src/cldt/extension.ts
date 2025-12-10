import * as vscode from "vscode";
import { CldtCompletionProvider } from "./completionProvider";
import { CldtDecorationProvider } from "./decorationProvider";
import { CldtDefinitionProvider } from "./definitionProvider";
import { CldtDiagnostics } from "./diagnostics";
import { CldtFormattingProvider } from "./formattingProvider";
import { CldtHoverProvider } from "./hoverProvider";
import { CldtPreviewProvider } from "./previewProvider";

export function CldtActivate(context: vscode.ExtensionContext) {
  console.log("CLDT Editor extension Activated");

  const languageId = "cldt";

  // Register completion provider
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    languageId,
    new CldtCompletionProvider(),
    ":",
    " ",
    "\n"
  );

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider(
    languageId,
    new CldtHoverProvider()
  );

  // Register definition provider
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    languageId,
    new CldtDefinitionProvider()
  );

  // Register formatting provider
  const formattingProvider =
    vscode.languages.registerDocumentFormattingEditProvider(
      languageId,
      new CldtFormattingProvider()
    );

  // Initialize diagnostics
  const diagnostics = new CldtDiagnostics();
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection(languageId);
  context.subscriptions.push(diagnosticCollection);

  // Update diagnostics on document change
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (event.document.languageId === languageId) {
        diagnostics.updateDiagnostics(event.document, diagnosticCollection);
      }
    }
  );

  // Update diagnostics on document open
  const documentOpenListener = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (document.languageId === languageId) {
        diagnostics.updateDiagnostics(document, diagnosticCollection);
      }
    }
  );

  // Clear diagnostics on document close
  const documentCloseListener = vscode.workspace.onDidCloseTextDocument(
    (document) => {
      if (document.languageId === languageId) {
        diagnosticCollection.delete(document.uri);
      }
    }
  );

  // Initialize decoration provider
  const decorationProvider = new CldtDecorationProvider();

  // Update decorations for active editor
  const updateDecorations = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === languageId) {
      decorationProvider.updateDecorations(editor);
    }
  };

  // Update decorations on document change
  const decorationChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const editor = vscode.window.activeTextEditor;
      if (
        editor &&
        event.document === editor.document &&
        editor.document.languageId === languageId
      ) {
        decorationProvider.updateDecorations(editor);
      }
    }
  );

  // Update decorations on editor change
  const decorationEditorChangeListener =
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === languageId) {
        decorationProvider.updateDecorations(editor);
      }
    });

  // Initialize preview provider
  const previewProvider = new CldtPreviewProvider(context.extensionUri);

  // Register preview commands
  const showPreviewCommand = vscode.commands.registerCommand(
    "cldt.showPreview",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === languageId) {
        previewProvider.showPreview(editor.document);
      }
    }
  );

  const showPreviewToSideCommand = vscode.commands.registerCommand(
    "cldt.showPreviewToSide",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === languageId) {
        previewProvider.showPreview(editor.document);
      }
    }
  );

  // Update preview when document changes
  const documentChangePreviewListener =
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === languageId) {
        previewProvider.updateContent(event.document, true);
      }
    });

  // Force immediate preview update when document is saved
  const documentSavePreviewListener = vscode.workspace.onDidSaveTextDocument(
    (document) => {
      if (document.languageId === languageId) {
        previewProvider.updateContent(document, true);
      }
    }
  );

  // Update preview when switching between editors
  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor && editor.document.languageId === languageId) {
        previewProvider.updateContent(editor.document);
      }
    }
  );

  // Auto-open preview when a CLDT file is opened - DISABLED
  // const autoOpenPreviewListener = vscode.workspace.onDidOpenTextDocument((document) => {
  //   if (document.languageId === languageId) {
  //     previewProvider.showPreview(document);
  //   }
  // });

  context.subscriptions.push(
    completionProvider,
    hoverProvider,
    definitionProvider,
    formattingProvider,
    documentChangeListener,
    documentOpenListener,
    documentCloseListener,
    decorationChangeListener,
    decorationEditorChangeListener,
    showPreviewCommand,
    showPreviewToSideCommand,
    documentChangePreviewListener,
    documentSavePreviewListener,
    editorChangeListener
    // autoOpenPreviewListener // DISABLED - preview must be opened manually via command
  );

  // Trigger diagnostics for currently open documents
  vscode.workspace.textDocuments.forEach((document) => {
    if (document.languageId === languageId) {
      diagnostics.updateDiagnostics(document, diagnosticCollection);
    }
  });

  // Auto-open preview for already open CLDT documents - DISABLED
  // vscode.workspace.textDocuments.forEach((document) => {
  //   if (document.languageId === languageId) {
  //     previewProvider.showPreview(document);
  //   }
  // });

  // Apply decorations to already open CLDT documents
  updateDecorations();
}

export function CldtDeactivate() {
  console.log("CLDT Editor extension is now deactivated");
}
