import { browser, expect } from "@wdio/globals"
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
     * Validates that the upload widget's primary controls rendered.
     */
    public async validateUploadControlsReady() {
        await allureReporter.addStep('Validate upload controls are ready');

        const folderSelect = await browser.$('#folderSelect');
        await folderSelect.waitForDisplayed();

        const presetSelect = await browser.$('#presetSelect');
        await presetSelect.waitForDisplayed();
        expect(await presetSelect.getValue()).toBe('');

        const advancedHeader = await browser.$('#advancedHeader');
        await advancedHeader.waitForClickable();

        const dropZone = await browser.$('#dropZone');
        await dropZone.waitForDisplayed();
        expect(await dropZone.getText()).toContain('Hold Shift, then drag & drop files here');

        const browseButton = await browser.$('#browseBtn');
        await browseButton.waitForClickable();

        const localTab = await browser.$('[data-tab="local"]');
        await localTab.waitForDisplayed();

        const urlTab = await browser.$('[data-tab="url"]');
        await urlTab.waitForDisplayed();
    }

    /**
     * Waits until folder options have been hydrated or fallen back to root.
     */
    public async waitForFolderOptionsLoaded() {
        await allureReporter.addStep('Wait for folder options to load');

        await browser.waitUntil(async () => {
            const loadingHint = await browser.$('#folderLoadingHint');
            return !(await loadingHint.isExisting());
        }, {
            timeout: 15000,
            timeoutMsg: 'Folder options did not finish loading',
        });
    }

    /**
     * Validates that uploads can still target the root folder.
     */
    public async validateRootFolderOption() {
        await allureReporter.addStep('Validate root folder option exists');

        const folderSelect = await browser.$('#folderSelect');
        await folderSelect.waitForDisplayed();
        const options = await browser.execute(() => {
            return Array.from(document.querySelectorAll<HTMLOptionElement>('#folderSelect option'))
                .map((option) => ({
                    label: option.textContent || '',
                    value: option.value,
                }));
        });
        const labels = options.map((option) => option.label);
        const values = options.map((option) => option.value);
        expect(labels).toContain('/ (root)');
        expect(values).toContain('');
    }

    /**
     * Waits for all uploads to complete.
     */
    public async waitForAllUploadsToComplete() {
        await allureReporter.addStep('Wait for all uploads to complete');
        let uploadError: string | undefined;
        await browser.waitUntil(async () => {
            const statuses = await browser.$$('.queue-item__status');
            const count = await statuses.length;
            if (count === 0) {
                return false
            };

            const textPromises = await statuses.map(el => el.getText());
            const texts = await Promise.all(textPromises);
            uploadError = texts.find(text => text !== 'Complete' && !text.endsWith('%') && text !== 'Pending...');
            if (uploadError) {
                return true;
            }
            return texts.every(text => text === 'Complete');
        }, { timeoutMsg: 'Not all uploads completed in time' });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError}`);
        }
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
