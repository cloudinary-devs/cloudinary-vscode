# Development Setup

This guide will help you set up your development environment for contributing to the Cloudinary VS Code Extension.

## Prerequisites

- **Node.js** 18.x or later
- **npm** 8.x or later
- **Visual Studio Code** 1.85.0 or later
- **Git**
- **Cloudinary account** with API credentials

## Clone and Install

```bash
# Clone the repository
git clone https://github.com/cloudinary/cloudinary-vscode.git
cd cloudinary-vscode

# Install dependencies
npm install
```

## Configure Credentials

Create a Cloudinary configuration file:

**macOS/Linux:**
```bash
mkdir -p ~/.cloudinary
```

**Windows:**
```powershell
mkdir $env:USERPROFILE\.cloudinary
```

Create `environments.json` with your credentials:

```json
{
  "your-cloud-name": {
    "apiKey": "your-api-key",
    "apiSecret": "your-api-secret"
  }
}
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Type check + build |
| `npm run watch` | Watch mode (auto-rebuild) |
| `npm run check-types` | TypeScript type checking only |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

## Running the Extension

### Launch Extension Development Host

1. Open the project in VS Code
2. Press `F5` (or Run → Start Debugging)
3. A new VS Code window opens with your extension loaded
4. Make changes, then press `Ctrl+R` / `Cmd+R` in the dev window to reload

### Setting Breakpoints

1. Set breakpoints in `.ts` files (source maps are enabled)
2. Launch the Extension Development Host
3. Trigger the code path you want to debug
4. VS Code will pause at your breakpoints

## Testing

### Run All Tests

```bash
npm test
```

### Manual Testing Checklist

After making changes, verify:

- [ ] Extension activates without errors
- [ ] Tree view populates with folders/assets
- [ ] Commands work from command palette
- [ ] Context menus appear on correct items
- [ ] Webviews display correctly in light and dark themes
- [ ] Upload functionality works
- [ ] Error messages are user-friendly

## Creating a Package

To create a `.vsix` file for local installation:

```bash
npm run package
```

This creates `cloudinary-x.x.x.vsix` in the project root.

### Install Locally

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Click `...` menu → **Install from VSIX...**
4. Select the `.vsix` file

## Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Use `handleCloudinaryError()` for API errors
- Use the webview design system for UI components
- Keep dependencies minimal

## Useful VS Code Commands

When debugging the extension:

| Command | Description |
|---------|-------------|
| `Developer: Reload Window` | Reload after code changes |
| `Developer: Toggle Developer Tools` | Open browser dev tools for webviews |
| `Cloudinary: Show Welcome` | Test the welcome screen |
| `Cloudinary: Upload` | Test the upload panel |

## Troubleshooting

### Extension Not Loading

1. Check the Debug Console for errors
2. Verify `main` in package.json points to `dist/extension.js`
3. Run `npm run compile` to check for TypeScript errors

### Tree View Empty

1. Check credentials in config file
2. Verify network connectivity
3. Check Debug Console for API errors

### Webview Blank

1. Open Developer Tools (`Help → Toggle Developer Tools`)
2. Check Console tab for JavaScript errors
3. Verify Content Security Policy allows your resources

