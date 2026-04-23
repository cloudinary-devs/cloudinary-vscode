import { browser } from "@wdio/globals"
import allureReporter from '@wdio/allure-reporter'
import { WebViewTabBase } from "./WebViewTabBase.js";

/**
 * Utility class for interacting with the Upload to Cloudinary webview.
 */
class UploadToCloudinaryTab extends WebViewTabBase {

    constructor() {
        super('Upload to Cloudinary');
    }

    /**
     * Uploads a local file via the upload widget's file input.
     * Uses the wdio-vscode-service WebView page object for iframe switching.
     */
    public async uploadLocalFile(absoluteFilePath: string) {
        await allureReporter.addStep(`Upload file: ${absoluteFilePath}`);

        const fileInput = await browser.$('#fileInput');
        await fileInput.waitForExist();
        await browser.execute((el: any) => {
            el.style.display = 'block';
            el.style.opacity = '1';
        }, fileInput as any);
        await fileInput.setValue(absoluteFilePath);

        await this.waitForAllUploadsToComplete();
    }

    /**
     * Waits for all uploads to complete.
     */
    public async waitForAllUploadsToComplete() {
        await browser.waitUntil(async () => {
            const statuses = await browser.$$('.queue-item__status');
            const count = await statuses.length;
            if (count === 0) {
                return false
            };

            const textPromises = await statuses.map(el => el.getText());
            const texts = await Promise.all(textPromises);
            return texts.every(text => text === 'Complete');
        }, { timeoutMsg: 'Not all uploads completed in time' });
    }

    /**
     * Opens the Advanced Options section.
     */
    public async openAdvancedOptions() {
        await allureReporter.addStep('Open Advanced Options');

        const header = await browser.$('#advancedHeader');
        await header.waitForClickable();
        await header.click();
    }

    /**
     * Fills the Custom Public ID input.
     */
    public async fillCustomPublicId(publicId: string) {
        await allureReporter.addStep(`Fill Custom Public ID: ${publicId}`);

        const input = await browser.$('#publicIdInput');
        await input.waitForExist();
        await input.setValue(publicId);
    }
}

export const uploadToCloudinaryTab = new UploadToCloudinaryTab()
