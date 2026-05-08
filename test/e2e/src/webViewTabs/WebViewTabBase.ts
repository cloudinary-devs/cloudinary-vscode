import { WebView } from "wdio-vscode-service";
import { webViewUtils } from "../vscodeComponentsUtils/WebViewUtils.js";


/**
 * Base class for all webview tabs.
 */
export abstract class WebViewTabBase {
    protected title: string;
    protected webview: WebView | null = null;

    /**
     * Constructor.
     * @param title - The title of the webview tab.
     */
    constructor(title: string) {
        this.title = title;
    }

    /**
     * Switches to the webview tab.
     */
    public async switchTo() {
        this.webview = await webViewUtils.getWebView(this.title);
        await this.webview.open();
    }

    /**
     * Switches back to the main view.
     */
    public async switchBack() {
        if (!this.webview) {
            throw new Error('WebView not opened. Call switchTo() first.');
        }
        await this.webview.close();
        this.webview = null;
    }
}