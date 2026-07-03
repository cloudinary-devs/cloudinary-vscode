import { browser, expect } from "@wdio/globals";
import allureReporter from '@wdio/allure-reporter';
import { Key } from 'webdriverio';
import { WebViewTabBase } from "./WebViewTabBase.js";

function cssAttributeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

class LibraryViewPage extends WebViewTabBase {
    constructor() {
        super('Cloudinary Media Library');
    }

    public async waitForLoaded() {
        await allureReporter.addStep('Wait for library webview to load');
        await this.switchTo();
        try {
            const root = await browser.$('#lib-root');
            await root.waitForExist();
        } finally {
            await this.switchBack();
        }
    }

    public async clickToolbarAction(action: 'openUploadWidget' | 'refresh') {
        await allureReporter.addStep(`Click library toolbar action: ${action}`);
        await this.switchTo();
        try {
            const button = await browser.$(`[data-cld-action-toolbar] [data-action="${action}"]`);
            await button.waitForClickable();
            await button.click();
        } finally {
            await this.switchBack();
        }
    }

    public async fillSearchInput(query: string) {
        await allureReporter.addStep(`Fill library search input with value '${query}'`);
        await this.switchTo();
        try {
            const input = await browser.$('#lib-search-input');
            await input.waitForDisplayed();
            await input.setValue(query);
            await browser.keys(Key.Enter);
            await this.waitForSearchResults(query);
        } finally {
            await this.switchBack();
        }
    }

    public async validateAssetsExist(publicIds: string[]) {
        await allureReporter.addStep(`Validate library assets exist: [${publicIds.join(', ')}]`);
        await this.switchTo();
        try {
            for (const publicId of publicIds) {
                const selector = `.lib-row--asset[data-public-id="${cssAttributeValue(publicId)}"]`;
                await browser.waitUntil(async () => {
                    const asset = await browser.$(selector);
                    return asset.isExisting();
                }, {
                    timeout: 15000,
                    timeoutMsg: `Timed out waiting for asset "${publicId}" to appear in the library`,
                });
            }
        } finally {
            await this.switchBack();
        }
    }

    public async validateVisibleAssetCount(expectedCount: number) {
        await allureReporter.addStep(`Validate ${expectedCount} visible asset rows`);
        await this.switchTo();
        try {
            let visibleCount = 0;
            await browser.waitUntil(async () => {
                visibleCount = await this.getVisibleAssetRowsCount();
                return visibleCount === expectedCount;
            }, {
                timeout: 15000,
                timeoutMsg: `Expected ${expectedCount} visible asset rows`,
            }).catch(() => {
                throw new Error(`Expected ${expectedCount} visible asset rows, got ${visibleCount}`);
            });
            expect(visibleCount).toBe(expectedCount);
        } finally {
            await this.switchBack();
        }
    }

    private async getVisibleAssetRowsCount() {
        const rows = await browser.$$('.lib-row--asset');
        let visibleCount = 0;
        for (const row of rows) {
            if (await row.isDisplayed()) {
                visibleCount += 1;
            }
        }
        return visibleCount;
    }

    private async waitForSearchResults(query: string) {
        const expectedQuery = query.trim();
        await browser.waitUntil(async () => {
            const loading = await browser.$('#lib-search-loading');
            const loadingClass = await loading.getAttribute('class');
            const pendingRows = await browser.$$('.lib-row--search-loading');
            const clearSearchRow = await browser.$('.lib-row--clear');
            const clearSearchText = await clearSearchRow.isExisting()
                ? await clearSearchRow.getText()
                : '';
            const input = await browser.$('#lib-search-input');
            const inputValue = await input.getValue();

            return inputValue.trim() === expectedQuery
                && clearSearchText.includes(expectedQuery)
                && loadingClass.includes('hidden')
                && pendingRows.length === 0;
        }, {
            timeout: 15000,
            timeoutMsg: `Timed out waiting for library search results for "${expectedQuery}"`,
        });
    }
}

export const libraryViewPage = new LibraryViewPage();
