# Contributing to Cloudinary VS Code Extension

Thank you for your interest in contributing to the Cloudinary VS Code extension! This guide will help you get started with contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)


## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Visual Studio Code** (latest version)
- **Git**

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork the repo on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/cloudinary-vscode.git
   cd cloudinary-vscode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Cloudinary credentials**
   Create a global configuration file at:
   - macOS/Linux: `~/.cloudinary/environments.json`
   - Windows: `%USERPROFILE%\.cloudinary\environments.json`

   ```json
   {
     "your-cloud-name": {
       "apiKey": "your-api-key",
       "apiSecret": "your-api-secret"
     }
   }
   ```
   
   > **Note:** The **cloud name is the key** (the property name). You can optionally add `"uploadPreset"` if you want a default preset.

4. **Build the extension**
   ```bash
   npm run compile
   ```

5. **Run the extension**
   - Press `F5` in VS Code to launch a new Extension Development Host window
   - Test your changes in this new window


## Development Workflow

### Building

- **Compile TypeScript**: `npm run compile`
- **Watch mode** (auto-compile on changes): `npm run watch`
- **Prepare for publishing**: `npm run vscode:prepublish`

### Running and Testing

1. **Launch Extension Development Host**:
   - Open the project in VS Code
   - Press `F5` or run "Debug: Start Debugging"
   - This opens a new VS Code window with your extension loaded

2. **Test your changes**:
   - Open the Cloudinary view in the Activity Bar
   - Test various commands and functionality
   - Check the Debug Console for logs and errors

3. **Reload extension** (after code changes):
   - In the Extension Development Host window, press `Ctrl+R` / `Cmd+R`
   - Or use "Developer: Reload Window" command


### VS Code Integration

- Use the built-in VS Code extension APIs
- Follow VS Code's UX guidelines for consistency
- Handle errors gracefully with user-friendly messages

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation if needed


3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Go to GitHub and create a PR from your fork
   - Fill out the PR template completely
   - Link any related issues

### Commit Message Format

Use conventional commits format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
- `feat(upload): add upload preset selection`
- `fix(tree): resolve folder loading issue`
- `docs(readme): update installation instructions`

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Environment details**:
   - VS Code version
   - Extension version
   - Operating system
   - Node.js version

2. **Steps to reproduce**:
   - Clear, step-by-step instructions
   - Expected vs actual behavior
   - Screenshots/videos if helpful

3. **Cloudinary setup**:
   - Are you using a valid Cloudinary account?
   - Any specific folder structure or asset types?

4. **Logs and errors**:
   - Check VS Code Developer Tools (Help > Toggle Developer Tools)
   - Include relevant console errors

## Feature Requests

We welcome feature requests! When submitting one:

1. **Search existing issues** first to avoid duplicates
2. **Describe the use case** - why is this feature needed?
3. **Propose a solution** - how should it work?
4. **Consider alternatives** - are there other ways to achieve the goal?

### Areas for Contribution

Some areas where contributions are especially welcome:

- **Performance improvements**: Faster asset loading, better caching
- **New asset operations**: Additional right-click context menu actions
- **Enhanced search**: More advanced search and filtering options
- **UI/UX improvements**: Better visual design, accessibility
- **Error handling**: More informative error messages
- **Documentation**: Code comments, tutorials, examples
- **Testing**: Increased test coverage, integration tests


The extension uses:
- [Cloudinary Admin API](https://cloudinary.com/documentation/admin_api) for asset management
- [Cloudinary Upload Widget](https://cloudinary.com/documentation/upload_widget) for uploads


Thank you for contributing to the Cloudinary VS Code extension! 🚀
