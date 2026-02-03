# Changelog

All notable changes to the Cloudinary VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Beta version with ongoing feature development

### Technical
- Built with TypeScript
- Uses Cloudinary Admin API for asset management
- Integrates Cloudinary Upload Widget
- Comprehensive test suite
- ESLint code quality checks
- VS Code Extension API compliance
