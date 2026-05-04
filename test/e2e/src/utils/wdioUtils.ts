import allureReporter from '@wdio/allure-reporter'
import { $ } from '@wdio/globals';
import { ClickOptions } from 'webdriverio';

/**
 * Utility class for interacting with the WebDriverIO browser.
 */
class WdioUtils {
    /**
     * Clicks on an element.
     * @param selector - The selector of the element to click.
     */
    public async click(selector: string, options?: ClickOptions): Promise<void> {
        await allureReporter.addStep(`Click an element '${selector}'`);
        const element = $(selector);
        await element.waitForExist();
        await element.waitForClickable();
        return element.click(options);
    }
        
}

export default new WdioUtils();