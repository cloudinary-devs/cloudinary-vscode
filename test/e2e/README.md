# E2E Tests

End-to-end tests for the Cloudinary VS Code extension using [WebdriverIO](https://webdriver.io/) and [wdio-vscode-service](https://github.com/webdriverio-community/wdio-vscode-service).

## Setup

```bash
cd test/e2e
pnpm install
```

## Running Tests

```bash
pnpm test:e2e
```

This will:
1. Download a VS Code binary (if not already cached in `.wdio-vscode-service/`)
2. Launch VS Code with the extension loaded
3. Run all specs in `test/specs/`

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
├── test/
│   └── specs/                 # Test spec files
├── src/
│   └── utils/                 # Page object utilities
```

## Writing Tests

Tests use [Mocha](https://mochajs.org/) as the test framework and the `wdio-vscode-service` page objects to interact with VS Code.

```ts
import { activityBarUtils } from '../../src/utils/ActivityBarUtils'
import { sideBarViewUtils } from '../../src/utils/SideBarViewUtils'

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
