import { browser } from "@wdio/globals"
import allureReporter from '@wdio/allure-reporter'


class WebViewUtils {
    /**
     * Gets the WebView instance by exact title match.
     */
    public async getWebView(title: string) {
        await allureReporter.addStep(`Get WebView with title "${title}"`);
        const workbench = await browser.getWorkbench()
        const exactMatch = new RegExp(`^${title}$`);
        return browser.waitUntil(() => workbench.getWebviewByTitle(exactMatch), {
            timeoutMsg: `WebView with title "${title}" not found`,
        })
    }
}

export const webViewUtils = new WebViewUtils()
