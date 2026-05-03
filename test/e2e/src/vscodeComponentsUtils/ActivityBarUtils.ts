import { browser } from "@wdio/globals"
import allureReporter from '@wdio/allure-reporter'

/**
 * Utility class for interacting with the Activity Bar in VS Code.
 */
class ActivityBarUtils {

    /**
     * Gets the Activity Bar instance.
     */
    public async getActivityBar() {
        await allureReporter.addStep('Get Activity Bar instance');
        const workbench = await browser.getWorkbench()
        return workbench.getActivityBar()
    }

    /**
     * Opens a view in the Activity Bar.
     */
    public async openView(item: string) {
        await allureReporter.addStep(`Open "${item}" view`);
        const activityBar = await this.getActivityBar()
        const viewControl = await activityBar.getViewControl(item)
        if (!viewControl) {
            throw new Error(`Activity bar item "${item}" not found`)
        }
        await viewControl.openView()
        return viewControl
    }
}

export const activityBarUtils = new ActivityBarUtils()