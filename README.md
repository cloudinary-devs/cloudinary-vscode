# Cloudinary VS Code Extension (Beta)

Easily explore, search, preview, and upload Cloudinary assets directly inside Visual Studio Code.

**Note**: This is a beta version of the extension. Some features are subject to change. Please report any problems or feedback by opening an issue.

---

## Features

- **Asset Explorer** – View Cloudinary folders and assets in a VS Code Tree View
- **Search & Filter** – Quickly locate assets by public ID or type
- **Optimized Preview** – Preview images/videos with Cloudinary transformations applied (`f_auto`, `q_auto`)
- **Right-click Actions** – Copy Public ID or URL instantly
- **Upload Widget** – Upload directly to root or folder via Cloudinary's embedded widget
- **Environment Switching** – Switch between different product environments defined in config
- **Status Bar Indicator** – Shows the active Cloudinary environment

---

## Configuration

**Requirements**

Before using this extension, ensure you have:
1. A **Cloudinary account** ([Sign up for free](https://cloudinary.com/users/register_free)).
2. Your **Cloudinary API credentials**:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

Instead of using VS Code settings, this extension reads your credentials from an `environments.json` file.

### 1. **Global Config** (Default)
Located at:
- macOS/Linux: `~/.cloudinary/environments.json`
- Windows: `%USERPROFILE%\.cloudinary\environments.json`

Auto-created with placeholder content on first use:

```json
{
  "your-cloud-name-1": {
    "apiKey": "<your-api-key>",
    "apiSecret": "<your-api-secret>",
    "uploadPreset": "<your-default-upload-preset>"
  },
  "your-cloud-name-2": {
    "apiKey": "<your-api-key>",
    "apiSecret": "<your-api-secret>",
    "uploadPreset": "<your-default-upload-preset>"
  }
}
```

### 2. **Workspace Config** (Optional override)
You can also include a project-specific config:
```
.project-root/.cloudinary/environments.json
```
This will override the global config if found.


Once a valid configuration has been added, the active environment will be shown in the status bar at the bottom of the window. Click this to switch environments.

---

## Usage

![Opening and browsing assets](https://res.cloudinary.com/demo/video/upload/w_1200/f_auto:animated/q_auto/du_41/e_accelerate:100/e_loop/docs/vscode-video-1)

### Open the Media Library
- Click the **Cloudinary** icon in the Activity Bar
- Browse folders and assets from your connected environment

### Switch Environments
- Click the **Cloudinary status bar item** (bottom bar)
- Select from configured environments

### Upload
- Click Upload from the title bar to upload to the root, or click **Upload here** on a folder entry to upload to that folder.
- Alternatively, run `Cloudinary: Upload`.
- **Upload Presets**: The extension automatically detects and lets you choose from your configured upload presets before uploading. Upload presets allow you to define upload parameters like transformations, folder destinations, tags, and processing options that are applied consistently to your uploads.
- **Learn more**: See the [Cloudinary Upload Presets documentation](https://cloudinary.com/documentation/upload_presets) for details on creating and configuring upload presets for different use cases.

![Uploading assets](https://res.cloudinary.com/demo/video/upload/w_1200/f_auto:animated/q_auto/e_accelerate:100/e_loop/docs/vscode-extension-vid3)

### Filter or Search
- Click "Filter" in the title bar or run `Cloudinary: Filter` to narrow assets by type
- Click "Search" in the title bar or run `Cloudinary: Search` to search by public ID

![Filtering and searching](https://res.cloudinary.com/demo/video/upload/w_1200/f_auto:animated/q_auto/e_accelerate:50/e_loop/docs/vscode-extension-vid2)

### Copy Info
- Right-click any asset to:
  - **Copy Public ID**
  - **Copy Secure URL**

### Preview Assets
- Click any asset to open a preview webview
- Supports images, videos, and raw files

### Refresh Tree
- Click "Refresh" to reload the tree

---

## Known Limitations
- Asset filtering is limited to basic types (image, video, raw)
- No options to control number of items returned in tree or root folder
- Drag and drop and pasting URLs into the Upload widget is not supported yet

---

## Contribute

Got feedback or feature ideas? Open an issue.

---

## Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)

---

Build, preview and upload faster with Cloudinary inside VS Code!