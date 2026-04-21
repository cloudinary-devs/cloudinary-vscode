# Adding Features

This guide explains how to add new functionality to the Cloudinary VS Code Extension.

## Adding a New Command

### 1. Create the Command File

Create a new file in `src/commands/`:

```typescript
// src/commands/myNewCommand.ts
import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

function registerMyNewCommand(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.myNewCommand", async () => {
      // Implementation here
      vscode.window.showInformationMessage("Command executed!");
    })
  );
}

export default registerMyNewCommand;
```

### 2. Register the Command

Add to `src/commands/registerCommands.ts`:

```typescript
import registerMyNewCommand from "./myNewCommand";

function registerAllCommands(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  // ... existing registrations
  registerMyNewCommand(context, provider);
}
```

### 3. Add to Package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "cloudinary.myNewCommand",
        "title": "My New Command",
        "category": "Cloudinary",
        "icon": "$(symbol-misc)"
      }
    ]
  }
}
```

### 4. Add Menu Placement (Optional)

```json
{
  "contributes": {
    "menus": {
      "view/title": [
        {
          "command": "cloudinary.myNewCommand",
          "when": "view == cloudinaryMediaLibrary",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "cloudinary.myNewCommand",
          "when": "viewItem == asset",
          "group": "inline"
        }
      ]
    }
  }
}
```

## Adding a New Tree Item Type

### 1. Add the Type

In `src/tree/cloudinaryItem.ts`:

```typescript
export type CloudinaryItemType = 
  | 'asset' 
  | 'folder' 
  | 'loadMore' 
  | 'myNewType';  // Add your type
```

### 2. Handle in Constructor

```typescript
else if (type === 'myNewType') {
  this.contextValue = 'myNewType';
  this.iconPath = new vscode.ThemeIcon('symbol-misc');
  this.tooltip = 'My new item type';
  this.command = {
    command: 'cloudinary.handleMyNewType',
    title: 'Handle',
    arguments: [data],
  };
}
```

### 3. Create Items in Provider

In `src/tree/treeDataProvider.ts`:

```typescript
const myItem = new CloudinaryItem(
  'Item Label',
  vscode.TreeItemCollapsibleState.None,
  'myNewType',
  { customData: 'value' },
  this.cloudName!,
  this.dynamicFolders
);
items.push(myItem);
```

### 4. Add Context Menu (Optional)

```json
{
  "contributes": {
    "menus": {
      "view/item/context": [
        {
          "command": "cloudinary.myCommand",
          "when": "viewItem == myNewType"
        }
      ]
    }
  }
}
```

## Adding a New Webview

### 1. Create the Command File

```typescript
// src/commands/myWebview.ts
import * as vscode from "vscode";
import { createWebviewDocument, getScriptUri } from "../webview/webviewUtils";
import { escapeHtml } from "../webview/utils/helpers";

let panel: vscode.WebviewPanel | undefined;

function registerMyWebview(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openMyWebview", () => {
      if (panel) {
        panel.reveal();
        return;
      }

      panel = vscode.window.createWebviewPanel(
        "cloudinaryMyWebview",
        "My Webview",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "src", "webview", "media"),
          ],
        }
      );

      panel.webview.html = createWebviewDocument({
        title: "My Webview",
        webview: panel.webview,
        extensionUri: context.extensionUri,
        bodyContent: getContent(),
        inlineScript: "initCommon();",
      });

      panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
          case "doSomething":
            // Handle message
            break;
        }
      });

      panel.onDidDispose(() => {
        panel = undefined;
      });
    })
  );
}

function getContent(): string {
  return `
    <div class="container">
      <div class="card card--elevated">
        <div class="card__body">
          <h2>My Webview</h2>
          <p>Content here</p>
          <button class="btn btn--primary" id="myButton">Click Me</button>
        </div>
      </div>
    </div>
  `;
}

export default registerMyWebview;
```

### 2. Add Custom JavaScript (Optional)

Create `src/webview/media/scripts/my-webview.js`:

```javascript
/**
 * My Webview functionality.
 */

function initMyWebview() {
  const button = document.getElementById('myButton');
  if (button) {
    button.addEventListener('click', () => {
      vscode.postMessage({ command: 'doSomething' });
    });
  }
}
```

Update the webview to include it:

```typescript
const myScriptUri = getScriptUri(panel.webview, context.extensionUri, "my-webview.js");

panel.webview.html = createWebviewDocument({
  // ...
  additionalScripts: [myScriptUri],
  inlineScript: "initCommon(); initMyWebview();",
});
```

### 3. Register and Add to Package.json

Same as adding a command (see above).

## Adding Configuration Options

### 1. Update Configuration Interface

In `src/config/configUtils.ts`:

```typescript
export interface CloudinaryEnvironment {
  apiKey: string;
  apiSecret: string;
  uploadPreset?: string;
  myNewOption?: string;  // Add your option
}
```

### 2. Use in Code

```typescript
const myOption = provider.getConfig().myNewOption || 'default';
```

### 3. Document the Option

Update `docs/configuration.md` with the new option.

## Common Patterns

### Error Handling

```typescript
import { handleCloudinaryError } from '../utils/cloudinaryErrorHandler';

try {
  const result = await cloudinary.api.someMethod();
} catch (err: any) {
  handleCloudinaryError('Operation failed', err);
}
```

### User Input

```typescript
// Input box
const query = await vscode.window.showInputBox({
  placeHolder: 'Enter search term',
  prompt: 'Search assets by public ID',
  validateInput: (value) => value ? null : 'Cannot be empty'
});

if (!query) return;  // User cancelled

// Quick pick
const selected = await vscode.window.showQuickPick(
  ['Option 1', 'Option 2', 'Option 3'],
  { placeHolder: 'Select an option' }
);
```

### Progress Indicator

```typescript
await vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: 'Loading assets...',
    cancellable: false,
  },
  async (progress) => {
    progress.report({ increment: 0 });
    // Do work
    progress.report({ increment: 50 });
    // More work
    progress.report({ increment: 100 });
  }
);
```

### Refresh Tree View

```typescript
// After modifying data
provider.refresh();  // Fires _onDidChangeTreeData
```

## Testing Your Changes

1. **Compile**: `npm run compile`
2. **Launch**: Press `F5` to open Extension Development Host
3. **Test**: Verify functionality works as expected
4. **Reload**: Press `Ctrl+R` / `Cmd+R` after code changes

### Manual Testing Checklist

- [ ] Feature works in light and dark themes
- [ ] Error cases show user-friendly messages
- [ ] Keyboard navigation works
- [ ] No console errors in Developer Tools

## Code Style Guidelines

1. **TypeScript strict mode** - Fix all type errors
2. **Use existing patterns** - Follow conventions in similar files
3. **Escape HTML** - Always use `escapeHtml()` for dynamic content
4. **Use design system** - Use component classes from `components.css`
5. **Handle errors** - Use `handleCloudinaryError()` for API errors
6. **Document** - Add JSDoc comments for public functions
