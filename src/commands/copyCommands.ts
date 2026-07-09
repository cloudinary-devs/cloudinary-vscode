import * as vscode from "vscode";
import { AnalyticsService } from "../analytics/analyticsService";

/**
 * Registers clipboard-related commands for copying asset details from Cloudinary.
 * @param context - The VS Code extension context.
 */
function registerClipboard(context: vscode.ExtensionContext, analytics?: AnalyticsService) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.copyUrl",
      (data: { data: { secure_url?: string } }) => {
        const secureUrl = data.data.secure_url;
        if (!secureUrl) {
          vscode.window.showErrorMessage("Invalid URL. Unable to copy.");
          return;
        }
        vscode.env.clipboard.writeText(secureUrl).then(() => {
          analytics?.track("copy_asset_url", { copy_type: "secure_url" });
          vscode.window.showInformationMessage(`Copied URL: ${secureUrl}`);
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.copyPublicId",
      (data: { data: { public_id?: string } }) => {
        const publicId = data.data.public_id;
        if (!publicId) {
          vscode.window.showErrorMessage("Invalid Public ID. Unable to copy.");
          return;
        }
        vscode.env.clipboard.writeText(publicId).then(() => {
          analytics?.track("copy_asset_public_id", { copy_type: "public_id" });
          vscode.window.showInformationMessage(`Copied Public ID: ${publicId}`);
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.copyOptimizedUrl",
      (data: { data: { optimized_url?: string } }) => {
        const optimizedUrl = data.data.optimized_url;
        if (!optimizedUrl) {
          vscode.window.showErrorMessage("Invalid Optimized URL. Unable to copy.");
          return;
        }
        vscode.env.clipboard.writeText(optimizedUrl).then(() => {
          analytics?.track("copy_asset_url", { copy_type: "optimized_url" });
          vscode.window.showInformationMessage(`Copied Optimized URL: ${optimizedUrl}`);
        });
      }
    )
  );
}

export default registerClipboard;
