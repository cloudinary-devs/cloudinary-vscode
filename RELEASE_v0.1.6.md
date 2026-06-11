# Cloudinary VS Code Extension — v0.1.6

> Test build for the doc team. Not yet published to the marketplace.

## What's new

### Added

- **Docs AI assistant** — In-editor chat with Cloudinary documentation. Includes chat history, source citations, and a dedicated webview panel.
- **Homescreen sidebar** — Redesigned home view with search, environment switcher, recent conversations, and an AI tools panel.
- **Configure AI Tools** — One-click installer for Cloudinary skills and MCP servers across Cursor, GitHub Copilot, Windsurf, Claude Code, and Universal targets. Scope-aware (global vs. workspace) with install-status detection.
- **Webview-based asset explorer** — Replaces the native VS Code tree view. Supports streaming pagination, search, and parallel fetching.
- **Analytics tracking** — Anonymous usage telemetry for commands and webview interactions. Sensitive payload keys are stripped before transmission; session id persisted in global state.
- **CI: VSIX build artifacts** — Feature branches now produce installable VSIX builds with PR-comment download links.

### Changed

- **Welcome screen interactions** — Refreshed onboarding flow.
- **Cloudinary webview toolbar** — Unified toolbar styling across Docs AI, library, and homescreen.
- **Homescreen renders shell instantly** — Static shell paints first, data loads asynchronously.
- **AI tools platform detection** — Auto-detects installed AI platforms (Cursor, Copilot, etc.) on panel open; defaults to GitHub Copilot when running inside VS Code.

### Fixed

- Preview and upload panels close on environment switch instead of attempting in-place update.
- Home recent-conversations list refreshes correctly after new chats.
- Upload panel title shows the active cloud name; presets refetched on environment switch.
- Docs AI prompt handoff no longer flashes during transition.

## Install

1. Save the `cloudinary-0.1.6.vsix` file somewhere on your machine.
2. In VS Code: `Cmd+Shift+P` → **Extensions: Install from VSIX…** → pick the file.
   Or from a terminal: `code --install-extension cloudinary-0.1.6.vsix --force`
3. Reload the window: `Cmd+Shift+P` → **Developer: Reload Window**.

The Cloudinary icon should appear in the Activity Bar.
