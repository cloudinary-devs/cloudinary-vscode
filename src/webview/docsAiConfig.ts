import * as vscode from "vscode";

export const DEFAULT_DOCS_AI_API_BASE = "https://cld-docs-ai-delta.vercel.app";

export function normalizeDocsAiApiBase(value: unknown): string {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return DEFAULT_DOCS_AI_API_BASE;
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return DEFAULT_DOCS_AI_API_BASE;
    }

    url.hash = "";
    url.search = "";

    return url.href.replace(/\/+$/, "");
  } catch {
    return DEFAULT_DOCS_AI_API_BASE;
  }
}

export function getDocsAiApiBase(): string {
  const configuredBase = vscode.workspace
    .getConfiguration()
    .get<string>("cloudinary.docsAi.apiBase");

  return normalizeDocsAiApiBase(configuredBase);
}
