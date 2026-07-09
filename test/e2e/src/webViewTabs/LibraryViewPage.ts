import { browser, expect } from "@wdio/globals";
import allureReporter from '@wdio/allure-reporter';
import { Key } from 'webdriverio';
import { WebViewTabBase } from "./WebViewTabBase.js";

type ResourceTypeFilter = 'all' | 'image' | 'video' | 'raw';
type SortDirection = 'desc' | 'asc';

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

    public async setResourceTypeFilter(filter: ResourceTypeFilter) {
        await allureReporter.addStep(`Set library resource type filter to "${filter}"`);
        await this.switchTo();
        try {
            const select = await browser.$('#lib-filter-type');
            await select.waitForDisplayed();
            await select.selectByAttribute('value', filter);
            await browser.execute((element: HTMLSelectElement) => {
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }, select);
            await this.waitForFilterValue('#lib-filter-type', filter);
            await this.waitForRowsToSettle();
        } finally {
            await this.switchBack();
        }
    }

    public async setSortDirection(sortDirection: SortDirection) {
        await allureReporter.addStep(`Set library sort direction to "${sortDirection}"`);
        await this.switchTo();
        try {
            const select = await browser.$('#lib-filter-sort');
            await select.waitForDisplayed();
            await select.selectByAttribute('value', sortDirection);
            await browser.execute((element: HTMLSelectElement) => {
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }, select);
            await this.waitForFilterValue('#lib-filter-sort', sortDirection);
            await this.waitForRowsToSettle();
        } finally {
            await this.switchBack();
        }
    }

    public async validateFilterState(filter: ResourceTypeFilter, sortDirection: SortDirection) {
        await allureReporter.addStep(`Validate library filter state: type "${filter}", sort "${sortDirection}"`);
        await this.switchTo();
        try {
            const typeSelect = await browser.$('#lib-filter-type');
            const sortSelect = await browser.$('#lib-filter-sort');
            await typeSelect.waitForDisplayed();
            await sortSelect.waitForDisplayed();
            expect(await typeSelect.getValue()).toBe(filter);
            expect(await sortSelect.getValue()).toBe(sortDirection);
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

    public async validateSearchInputValue(query: string) {
        await allureReporter.addStep(`Validate library search input value is '${query}'`);
        await this.switchTo();
        try {
            const input = await browser.$('#lib-search-input');
            await input.waitForDisplayed();
            expect((await input.getValue()).trim()).toBe(query.trim());
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

    public async validateAssetsNotVisible(publicIds: string[]) {
        await allureReporter.addStep(`Validate library assets are not visible: [${publicIds.join(', ')}]`);
        await this.switchTo();
        try {
            for (const publicId of publicIds) {
                const selector = `.lib-row--asset[data-public-id="${cssAttributeValue(publicId)}"]`;
                await browser.waitUntil(async () => {
                    const asset = await browser.$(selector);
                    return !(await asset.isExisting()) || !(await asset.isDisplayed());
                }, {
                    timeout: 15000,
                    timeoutMsg: `Timed out waiting for asset "${publicId}" to be hidden from the library`,
                });
            }
        } finally {
            await this.switchBack();
        }
    }

    public async validateAssetHasResourceType(publicId: string, resourceType: Exclude<ResourceTypeFilter, 'all'>) {
        await allureReporter.addStep(`Validate asset "${publicId}" has resource type "${resourceType}"`);
        await this.switchTo();
        try {
            const selector = `.lib-row--asset.lib-row--${resourceType}[data-public-id="${cssAttributeValue(publicId)}"]`;
            await browser.waitUntil(async () => {
                const asset = await browser.$(selector);
                return asset.isExisting();
            }, {
                timeout: 15000,
                timeoutMsg: `Timed out waiting for asset "${publicId}" with resource type "${resourceType}"`,
            });
        } finally {
            await this.switchBack();
        }
    }

    public async clickAsset(publicId: string) {
        await allureReporter.addStep(`Click library asset "${publicId}"`);
        await this.switchTo();
        try {
            const selector = `.lib-row--asset[data-public-id="${cssAttributeValue(publicId)}"]`;
            const asset = await browser.$(selector);
            await asset.waitForClickable();
            await asset.click();
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

    private async waitForFilterValue(selector: string, expectedValue: string) {
        await browser.waitUntil(async () => {
            const select = await browser.$(selector);
            return await select.getValue() === expectedValue;
        }, {
            timeout: 5000,
            timeoutMsg: `Expected ${selector} to have value "${expectedValue}"`,
        });
    }

    private async waitForRowsToSettle() {
        await browser.waitUntil(async () => {
            const loading = await browser.$('#lib-search-loading');
            const loadingClass = await loading.isExisting()
                ? await loading.getAttribute('class')
                : 'hidden';
            const pendingRows = await browser.$$('.lib-row--search-loading');
            return loadingClass.includes('hidden') && pendingRows.length === 0;
        }, {
            timeout: 15000,
            timeoutMsg: 'Timed out waiting for library rows to settle',
        });
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
