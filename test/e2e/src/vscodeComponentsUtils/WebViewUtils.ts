import { browser } from "@wdio/globals"


class WebViewUtils {
    /**
     * Gets the WebView instance.
     */
    public async getWebView(title: string) {
        const workbench = await browser.getWorkbench()
        return browser.waitUntil(() => workbench.getWebviewByTitle(title), {
            timeoutMsg: `WebView with title "${title}" not found`,
        })
    }
}

export const webViewUtils = new WebViewUtils()