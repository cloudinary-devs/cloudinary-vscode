import { browser, expect } from "@wdio/globals";
import allureReporter from '@wdio/allure-reporter';
import { WebViewTabBase } from "./WebViewTabBase.js";

function getPreviewTitle(publicId: string): string {
    return publicId.includes('/')
        ? publicId.split('/').pop() || publicId
        : publicId;
}

class AssetPreviewTab extends WebViewTabBase {
    constructor() {
        super('');
    }

    public async switchToAsset(publicId: string) {
        await allureReporter.addStep(`Switch to asset preview for "${publicId}"`);
        this.title = getPreviewTitle(publicId);
        await this.switchTo();
    }

    public async validateAssetDetails(publicId: string) {
        await allureReporter.addStep(`Validate asset preview details for "${publicId}"`);
        const title = await browser.$('.asset-header__title');
        await title.waitForDisplayed();
        expect(await title.getText()).toBe(getPreviewTitle(publicId));

        const previewCard = await browser.$('.card--elevated');
        await previewCard.waitForDisplayed();
        expect(await previewCard.getText()).toContain(publicId);

        const infoTab = await browser.$('[data-tab="info"]');
        await infoTab.waitForDisplayed();

        const urlsTab = await browser.$('[data-tab="urls"]');
        await urlsTab.waitForDisplayed();
    }
}

export const assetPreviewTab = new AssetPreviewTab();
