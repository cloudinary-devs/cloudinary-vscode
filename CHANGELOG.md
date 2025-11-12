# Changelog

All notable changes to the Cloudinary VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
