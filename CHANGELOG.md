# Changelog

All notable changes to the Cloudinary VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-09

### Changed
- **README refresh** - New overview demo animation, feature docs for the Docs AI assistant, home screen, and Configure AI Tools, and a note about holding Shift when dragging files into the upload panel in VS Code.

## [1.0.0] - 2026-06-30

### Added
- **Docs AI assistant** - In-editor chat with Cloudinary documentation. Includes chat history, source citations, and a dedicated webview panel.
- **Homescreen sidebar** - Redesigned home view with search, environment switcher, recent conversations, and an AI tools panel.
- **Configure AI Tools** - One-click installer for Cloudinary skills and MCP servers across Cursor, GitHub Copilot, Windsurf, Claude Code, and Universal targets. Scope-aware (global vs. workspace) with install-status detection.
- **Webview-based asset explorer** - Replaces the native VS Code tree view. Supports streaming pagination, search, and parallel fetching.
- **Analytics tracking** - Anonymous usage telemetry for commands and webview interactions. Sensitive payload keys are stripped before transmission; session id persisted in global state.
- **CI: VSIX build artifacts** - Feature branches now produce installable VSIX builds with PR-comment download links.

### Changed
- **Welcome screen interactions** - Refreshed onboarding flow.
- **Cloudinary webview toolbar** - Unified toolbar styling across Docs AI, library, and homescreen.
- **Homescreen renders shell instantly** - Static shell paints first, data loads asynchronously.
- **AI tools platform detection** - Auto-detects installed AI platforms (Cursor, Copilot, etc.) on panel open; defaults to GitHub Copilot when running inside VS Code.

### Fixed
- Preview and upload panels close on environment switch instead of attempting in-place update.
- Home recent-conversations list refreshes correctly after new chats.
- Upload panel title shows the active cloud name; presets refetched on environment switch.
- Docs AI prompt handoff no longer flashes during transition.

## [0.1.5]

Skipped — released as part of 1.0.0.

## [0.1.4] - 2026-04-16

### Added
- E2E test infrastructure for automated extension testing

### Fixed
- VSIX package no longer includes development-only files, reducing package size

## [0.1.3] - 2026-02-03

### Added
- **New upload UI** - Simpler UI with easy drag and dropping of files directly onto the upload widget with visual feedback
- **Upload progress tracking** - Real-time progress indicators for file uploads
- **Uploaded asset gallery** - View thumbnails of recently uploaded assets with quick actions
- **Dynamic folder selection** - Select target folder directly in upload widget
- **View Options command** - New unified command for filtering and sorting assets
- **Status bar folder mode** - Shows whether environment uses Dynamic or Fixed folder mode
- **Developer documentation** - Architecture guides in `docs/` folder

### Changed
- **Upload presets are now optional** - Omit preset to use signed uploads (previously required)
- Improved asset preview metadata display
- Refactored webview system with external CSS/JS for better maintainability

### Fixed
- **Chunked upload for large files** - Files over 100MB now upload reliably using chunked upload API
- **Video preview playback** - Added `media-src` to Content Security Policy to allow video/audio playback
- Prevented duplicate preview panels opening for the same asset

### Removed
- "Load More Assets" command (replaced by automatic loading indicator)
- Separate "Set Resource Filter" and "Set Sort Order" commands (replaced by "View Options")

## [0.1.2] - 2025-11-13

### Fixed
- Corrected typo in clearSearch command filename
- Video optimization now uses `f_auto:video` for proper video format handling
- Upload widget now correctly uses `asset_folder` parameter in dynamic folders mode to respect preset configuration
- Prevented API calls with placeholder credentials on first installation

### Added
- Copy buttons for public ID and URLs in asset preview


## [0.1.1] - 2025-09-05

### Added
- **Asset Explorer** - Browse Cloudinary folders and assets in VS Code Tree View
- **Search & Filter** - Find assets by public ID or filter by resource type (image, video, raw)
- **Optimized Preview** - Preview images and videos with automatic format and quality optimization
- **Right-click Actions** - Copy Public ID, Secure URL, or Optimized URL directly from context menu
- **Upload Widget** - Upload files directly to Cloudinary from VS Code with upload preset selection
- **Environment Switching** - Switch between multiple Cloudinary product environments
- **Status Bar Indicator** - Shows active Cloudinary environment in VS Code status bar
- **Configuration Management** - Support for both global and workspace-specific configuration files
- **Welcome Screen** - Getting started guide for new users
- **Error Handling** - Comprehensive error handling with user-friendly messages

### Features
- Tree view integration with VS Code Activity Bar
- Drag and drop support in upload widget
- Asset refresh functionality
- Support for both fixed and dynamic folder modes
- Configurable upload presets
- General availability release baseline

### Technical
- Built with TypeScript
- Uses Cloudinary Admin API for asset management
- Integrates Cloudinary Upload Widget
- Comprehensive test suite
- ESLint code quality checks
- VS Code Extension API compliance
