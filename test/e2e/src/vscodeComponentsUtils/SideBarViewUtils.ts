import { browser, expect } from "@wdio/globals"
import { TreeItem } from "wdio-vscode-service"
import allureReporter from '@wdio/allure-reporter'

/**
 * Actions available in the Side Bar View.
 */
export enum SideBarViewActions {
    UPLOAD = ' Upload',
    SEARCH = ' Search',
    REFRESH = '  Refresh',
}

/**
 * Utility class for interacting with the Side Bar View in VS Code.
 */
class SideBarViewUtils {
    /**
     * Gets the Side Bar View instance.
     */
    public async getSideBarView() {
        const workbench = await browser.getWorkbench()
        return workbench.getSideBar()
    }

    /**
     * Validates the title of the Side Bar View.
     */
    public async validateSideBarViewTitle(expectedTitle: string) {
        await allureReporter.addStep(`Validate title is "${expectedTitle}"`);
        let currentTitle = '';
        try {
            await browser.waitUntil(async () => {
                const sideBarView = await this.getSideBarView()
                const titlePart = sideBarView.getTitlePart()
                currentTitle = await titlePart.getTitle()
                return currentTitle === expectedTitle
            })
        } catch {
            throw new Error(`Expected sidebar title to be "${expectedTitle}", but got "${currentTitle}"`)
        }
    }

    /**
     * Gets the content of the Side Bar View.
     */
    public async getSideBarViewContent() {
        await allureReporter.addStep('Get content of the Side Bar View');
        const sideBarView = await this.getSideBarView()
        return sideBarView.getContent()
    }

    /**
     * Validates that the content of the Side Bar View contains the expected items.
     */
    public async validateContentItemsExist(expectedItems: string[]) {
        await allureReporter.addStep(`Validate content items exist: [${expectedItems.join(', ')}]`);
        await this.waitContentToLoad();
        const content = await this.getSideBarViewContent();
        const sections = await content.getSections();
        const visibleItems = await sections[0].getVisibleItems() as TreeItem[];
        const itemLabels = await Promise.all(
            visibleItems.map(item => item.getLabel())
        );
        for (const expected of expectedItems) {
            expect(itemLabels).toContain(expected);
        }
    }

    /**
     * Waits for the content of the Side Bar View to load.
     */
    public async clickAction(action: SideBarViewActions) {
        await allureReporter.addStep(`Click the "${action.trim()}" action button`);
        const sideBarView = await this.getSideBarView();
        const titlePart = sideBarView.getTitlePart();
        const actionButton = await titlePart.elem.$(`.//*[@title='${action}' or @aria-label='${action}']`);
        await actionButton.waitForClickable();
        await actionButton.click();
    }

    public async waitContentToLoad() {
        await allureReporter.addStep('Wait for content to load');
        await browser.waitUntil(async () => {
            try {
                const content = await this.getSideBarViewContent()
                const sections = await content.getSections()
                
                if (sections.length === 0) {
                    return false
                }

                const visibleItems = await sections[0].getVisibleItems() as TreeItem[]
                return visibleItems.length > 0
            } catch {
                return false
            }
        }, { timeout: 15000, timeoutMsg: 'Timed out waiting for tree items to appear' })
    }
        
}

export const sideBarViewUtils = new SideBarViewUtils()