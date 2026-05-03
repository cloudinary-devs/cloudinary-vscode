# E2E Tests

End-to-end tests for the Cloudinary VS Code extension using [WebdriverIO](https://webdriver.io/) and [wdio-vscode-service](https://github.com/webdriverio-community/wdio-vscode-service).

## Setup

```bash
cd test/e2e
pnpm install
```

## Environment variables

End-to-end runs require Cloudinary credentials in `process.env`. The `onPrepare` hook in `wdio.conf.ts` reads `E2E_CLOUD`, `E2E_API_KEY`, and `E2E_API_SECRET`, then writes `~/.cloudinary/environments.json` in the shape the extension expects (cloud name as the top-level key, with `apiKey` and `apiSecret`).

| Variable | Description |
|----------|-------------|
| `E2E_CLOUD` | Cloudinary cloud name |
| `E2E_API_KEY` | API key |
| `E2E_API_SECRET` | API secret |

**Local:** add a `test/e2e/.env` file (gitignored) such as:

## Running Tests

```bash
pnpm test:e2e
```

This will:
1. Download a VS Code binary (if not already cached in `.wdio-vscode-service/`)
2. Launch VS Code with the extension loaded
3. Run all specs in `specs/`

## Viewing Reports

After a test run, generate and open the Allure report:

```bash
pnpm test:report
```

## Project Structure

```
test/e2e/
├── wdio.conf.ts                          # WebdriverIO configuration
├── tsconfig.json                         # TypeScript config (ESM, strict)
├── package.json                          # Dependencies (separate from root)
├── assets/                               # Test fixture files (images, etc.)
├── specs/                                # Test spec files (*.spec.ts)
├── src/
│   ├── sdks/
│   │   └── cloudinarySDK.ts              # Cloudinary Node SDK wrapper
│   ├── utils/
│   │   └── pathUtils.ts                  # File path helpers
│   ├── vscodeComponentsUtils/            # Wrappers around wdio-vscode-service page objects
│   └── webViewTabs/                      # Page objects for extension webview tabs
│       ├── WebViewTabBase.ts             # Abstract base class for webview tabs
```

## Writing Tests

Tests use [Mocha](https://mochajs.org/) as the test framework and the `wdio-vscode-service` page objects to interact with VS Code.

VS Code page object references:
- [wdio-vscode-service API](https://jubilant-broccoli-www5lem.pages.github.io/vscode-po/index.html) — full API reference for the WebdriverIO VS Code service.

VS Code page object references:
- [wdio-vscode-service API](https://webdriverio-community.github.io/wdio-vscode-service/modules.html)

### Manual approach

Write specs directly following the patterns in existing `specs/*.spec.ts` files and the conventions documented in `.cursor/rules/e2e_generator.agent.md`.

### AI-assisted approach (Cursor skill)

The project includes an **e2e-test-writer** Cursor skill (`.cursor/skills/e2e-test-writer/`) that generates tests from numbered step flows.

**How to use:**

1. Open Cursor in this repository
2. In the chat, attach the skill and provide your test steps:

```
/e2e-test-writer add test with the following steps:
1. upload an asset
2. click search on the side bar
3. search for uploaded asset
4. validate only the searched asset appears in the side bar view
```

3. The agent will:
   - Read the project conventions from `.cursor/rules/e2e_generator.agent.md`
   - Inspect existing specs and utility classes
   - Identify which utils already cover the steps and what's missing
   - Add new methods to utility classes if needed
   - Generate the spec file following all project patterns

**Example output** — for the search flow above, the skill generates:

```typescript
import path from 'node:path';
import crypto from 'node:crypto';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { SideBarViewActions, sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { inputBoxUtils } from '../src/vscodeComponentsUtils/InputBoxUtils.js';
import { pathUtils } from '../src/utils/pathUtils.js';
import { browser } from '@wdio/globals';

describe('Search asset from side bar', () => {

    const cloudinarySDK = new CloudinarySDK();
    const assetPublicID = `${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        try {
            await cloudinarySDK.V2.uploader.upload(
                path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'),
                { public_id: assetPublicID }
            );
        } catch (error) {
            throw new Error('Error uploading asset:', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([assetPublicID]);
        } catch (error) {
            throw new Error('Error deleting asset:', error);
        }
    });

    it('should find the uploaded asset via sidebar search', async () => {
        await activityBarUtils.openView('Cloudinary');

        await sideBarViewUtils.clickAction(SideBarViewActions.SEARCH);

        await inputBoxUtils.fillAndConfirm(assetPublicID);

        await sideBarViewUtils.validateContentItemsExist(['Clear Search', assetPublicID]);
        await sideBarViewUtils.validateContentItemsNumber(2);
    });
});
```

**Key conventions the skill enforces:**
- ESM imports with `.js` extensions on all local paths
- Utils are composed directly in specs — no cross-util imports
- Allure step logging in every utility method
- Self-contained tests with seed/cleanup in `beforeEach`/`afterEach`
- `waitUntil` with `timeoutMsg` — never `browser.pause()`

### Allure Reporting

Steps are reported via `allureReporter.addStep()` inside utility methods. WebDriver-level steps (findElement, etc.) are disabled in the config to keep reports clean.

## Configuration

Key settings in `wdio.conf.ts`:

| Setting | Value | Description |
|---------|-------|-------------|
| `browserVersion` | `'stable'` | VS Code version to test against |
| `logLevel` | `'warn'` | Suppresses verbose WebDriver logs |
| `extensionPath` | `../../` | Points to the root extension directory |
