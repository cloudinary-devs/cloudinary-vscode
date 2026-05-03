import { browser } from "@wdio/globals"
import { InputBox } from "wdio-vscode-service"
import allureReporter from '@wdio/allure-reporter'

/**
 * Utility class for interacting with the VS Code InputBox / Command Palette.
 */
class InputBoxUtils {

    /**
     * Opens the VS Code command palette.
     */
    public async getInputBox() {
        await allureReporter.addStep('Get Input Box instance');
        const inputBox = await browser.$('.quick-input-widget input');
        await inputBox.waitForDisplayed();
        return inputBox;
    }

    /**
     * Fills an already-visible InputBox with text and confirms.
     * Use when an action (e.g. Search) has already opened an InputBox.
     */
    public async fillAndConfirm(text: string) {
        await allureReporter.addStep(`Fill input box "${text}"`);
        const inputBox = await this.getInputBox();
        await inputBox.setValue(text);
        await browser.keys('Enter');
    }
}

export const inputBoxUtils = new InputBoxUtils()
