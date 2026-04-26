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

To run a specific test file:

```bash
pnpm test:e2e --spec [FILE_PATH]
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
├── wdio.conf.ts              # WebdriverIO configuration
├── tsconfig.json              # TypeScript config for e2e tests
├── package.json               # Dependencies (separate from root)
├── specs/                     # Test spec files
├── src/
│   └── utils/                 # Page object utilities
```

## Writing Tests

Tests use [Mocha](https://mochajs.org/) as the test framework and the `wdio-vscode-service` page objects to interact with VS Code.

VS Code page object references:
- [wdio-vscode-service API](https://jubilant-broccoli-www5lem.pages.github.io/vscode-po/index.html) — full API reference for the WebdriverIO VS Code service.

```ts
import { activityBarUtils } from '../src/utils/ActivityBarUtils.js'
import { sideBarViewUtils } from '../src/utils/SideBarViewUtils.js'

it('should open the Cloudinary view', async () => {
    await activityBarUtils.openView('Cloudinary')
    await sideBarViewUtils.validateSideBarViewTitle('CLOUDINARY')
    await sideBarViewUtils.validateContentItemsExist(['cats', 'dogs'])
})
```

### Allure Reporting

Steps are reported via `allureReporter.addStep()` inside utility methods. WebDriver-level steps (findElement, etc.) are disabled in the config to keep reports clean.

## Configuration

Key settings in `wdio.conf.ts`:

| Setting | Value | Description |
|---------|-------|-------------|
| `browserVersion` | `'stable'` | VS Code version to test against |
| `logLevel` | `'warn'` | Suppresses verbose WebDriver logs |
| `extensionPath` | `../../` | Points to the root extension directory |
