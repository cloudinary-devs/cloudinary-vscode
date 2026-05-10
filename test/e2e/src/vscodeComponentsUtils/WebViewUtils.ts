import { browser } from "@wdio/globals"


class WebViewUtils {
    /**
     * Gets the WebView instance by exact title match.
     */
    public async getWebView(title: string) {
        const workbench = await browser.getWorkbench()
        const exactMatch = new RegExp(`^${title}$`);
        return browser.waitUntil(() => workbench.getWebviewByTitle(exactMatch), {
            timeoutMsg: `WebView with title "${title}" not found`,
        })
    }
}

export const webViewUtils = new WebViewUtils()