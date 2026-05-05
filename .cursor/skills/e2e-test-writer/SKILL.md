---
name: e2e-test-writer
description: Generate WebdriverIO e2e tests for the cloudinary-vscode extension from user-provided test step flows. Use when the user provides numbered test steps, asks to write an e2e test, create a spec file, or automate a VS Code extension test scenario.
---

# E2E Test Writer

Generate WebdriverIO e2e tests for the cloudinary-vscode VS Code extension from user-provided test step flows.

## Before You Start

1. Read the full conventions and rules from the agent reference:

   **Read file:** `.cursor/rules/e2e_generator.agent.md`

   This contains all project conventions, utility class APIs, and component references. You **must** follow every rule in that file.

2. Read the existing spec files to absorb the exact style:

   **Read files:**
   - `test/e2e/specs/loadMlAssets.spec.ts`
   - `test/e2e/specs/uploadFromSideBarView.spec.ts`

3. Identify which utility classes and webview tabs the test flow will need. Read them:

   **Read folder:** `test/e2e/src/vscodeComponentsUtils/` (read relevant utils)
   **Read folder:** `test/e2e/src/webViewTabs/` (read relevant tabs)

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Analyze the test flow
- [ ] Step 2: Identify needed utilities and gaps
- [ ] Step 3: Extend utilities or create new ones (if needed)
- [ ] Step 4: Write the spec file
- [ ] Step 5: Verify conventions compliance
```

### Step 1: Analyze the test flow

Parse the user's numbered steps into three categories:

- **Setup** — steps that seed test data (uploads, file creation) → go into `beforeEach`
- **Actions** — steps that interact with VS Code UI → go into `it()` body
- **Assertions** — steps that validate outcomes → go into `it()` body after actions
- **Cleanup** — implied from setup (always delete created assets) → go into `afterEach`

### Step 2: Identify needed utilities and gaps

For each action/assertion step, determine:

1. Which utility class handles it? (check the reference tables in `e2e_generator.agent.md`)
2. Does the required method already exist?
3. If not, what new method or new class is needed?

**If a step involves VS Code chrome** (activity bar, sidebar, notifications, editor, etc.) → use `vscodeComponentsUtils/`
**If a step involves extension webview DOM** (buttons, inputs inside a webview tab) → use `webViewTabs/`
**If a step involves Cloudinary API** (upload, delete, query) → use `CloudinarySDK` directly

### Step 3: Extend utilities or create new ones (if needed)

When the existing utils don't cover a step:

**Adding a method to an existing util:**
- Read the util file
- Add the new method following the class conventions (Allure step, no caching, etc.)
- **Never import one util into another** — utils must stay independent

**Creating a new util class:**
- Follow the exact pattern from Rule 4 in `e2e_generator.agent.md`
- Place in `test/e2e/src/vscodeComponentsUtils/`
- Keep it lean — only add methods that are genuinely needed

**Creating a new webview tab page object:**
- Follow the exact pattern from Rule 5 in `e2e_generator.agent.md`
- Place in `test/e2e/src/webViewTabs/`
- Extend `WebViewTabBase`

**Do NOT create convenience methods that combine multiple utils** (e.g. don't create `sideBarViewUtils.search()` that internally calls `inputBoxUtils.fillAndConfirm()`). The spec file is where utils get composed together.

### Step 4: Write the spec file

Create `test/e2e/specs/<camelCaseName>.spec.ts` using this template:

```typescript
import path from 'node:path';
import crypto from 'node:crypto';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { SideBarViewActions, sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { inputBoxUtils } from '../src/vscodeComponentsUtils/InputBoxUtils.js';
import { pathUtils } from '../src/utils/pathUtils.js';
import { browser } from '@wdio/globals';
// ... add other imports as needed (always with .js extension)

describe('Describe the feature being tested', () => {

    const cloudinarySDK = new CloudinarySDK();
    const assetPublicID = `${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        try {
            // Seed: upload assets, copy files, etc.
        } catch (error) {
            throw new Error('Error in setup:', error);
        }
    });

    afterEach(async () => {
        try {
            // Cleanup: delete all created assets
            await cloudinarySDK.V2.api.delete_resources([assetPublicID]);
        } catch (error) {
            throw new Error('Error in cleanup:', error);
        }
    });

    it('should <expected behavior from the flow>', async () => {
        // Compose util calls directly — each step maps to a util call
        // Step 1: ...
        // Step 2: ...
        // Step N: ...
    });
});
```

**Critical rules for the spec:**
- One `describe` block per file, one feature area
- Every local import uses `.js` extension
- Import specific enums alongside utils (e.g. `{ SideBarViewActions, sideBarViewUtils }`)
- Import `browser` from `@wdio/globals` when needed
- Unique IDs use `crypto.randomUUID().substring(0, 8)` (no mandatory prefix)
- `beforeEach`/`afterEach` wrapped in try/catch
- No direct `browser.getWorkbench()` calls — only util methods
- No `browser.pause()` — only `waitUntil` or util wait methods
- Compose multiple util calls directly in the spec — don't rely on combined wrappers
- Use `allureReporter.addStep()` for inline business validations in the spec

### Step 5: Verify conventions compliance

Before presenting the result, verify:

- [ ] All local imports use `.js` extensions
- [ ] No `browser.getWorkbench()` in the spec file
- [ ] No `browser.pause()` anywhere
- [ ] All utility methods have `allureReporter.addStep()` as first line
- [ ] New utility classes are exported as singletons
- [ ] **No cross-util imports** — utils do not import other utils
- [ ] **No convenience wrappers** — no util method calls another util's methods
- [ ] `beforeEach` seeds data, `afterEach` cleans up
- [ ] Asset IDs use `crypto.randomUUID().substring(0, 8)`
- [ ] File is named `camelCase.spec.ts` under `test/e2e/specs/`
- [ ] One `describe` block with one feature area
- [ ] Spec composes util calls directly (e.g. `clickAction()` + `inputBoxUtils.fillAndConfirm()` as separate calls)

## Example: Converting a user flow to a test

**User provides:**
```
1. Upload an asset
2. Click search on the side bar
3. Search for uploaded asset
4. Validate only the searched asset appears in the side bar view
```

**Step-by-step mapping:**
- Step 1 → `beforeEach` (seed via `cloudinarySDK.V2.uploader.upload()`)
- Step 2 → `sideBarViewUtils.clickAction(SideBarViewActions.SEARCH)` (reuses existing `clickAction`)
- Step 3 → `inputBoxUtils.fillAndConfirm(assetPublicID)` (separate call, NOT wrapped inside sideBarViewUtils)
- Step 4 → `sideBarViewUtils.validateContentItemsExist(...)` + `sideBarViewUtils.validateContentItemsNumber(...)` (two calls)
- Cleanup → `afterEach` deletes the asset

**Resulting spec:**

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

**Key patterns demonstrated:**
- Utils are composed directly in the spec (`clickAction` + `inputBoxUtils.fillAndConfirm` as separate calls)
- No cross-util imports — `SideBarViewUtils` does NOT import `InputBoxUtils`
- Validations are split: `validateContentItemsExist` for labels + `validateContentItemsNumber` for count
- `SideBarViewActions.SEARCH` enum is imported alongside the util
