import { AnalyticsService } from "./analyticsService";
import type { FolderModeResult } from "../config/detectFolderMode";

/**
 * Emits a config validation analytics event based on a folder-mode detection result.
 * Fires `config_validation_succeeded` when the credentials were accepted, or
 * `config_validation_failed` when they were rejected or unreachable. `skipped`
 * outcomes (missing or placeholder credentials) emit nothing.
 *
 * The payload never includes credentials; only the active cloud name (attached by
 * the analytics service), the folder mode, and a coarse error reason are reported.
 *
 * @param analytics - The analytics service, if available.
 * @param result - The folder-mode detection result.
 * @param entryPoint - Where validation was triggered (activation, config_change, switch).
 */
export function trackConfigValidation(
  analytics: AnalyticsService | undefined,
  result: FolderModeResult,
  entryPoint: string
): void {
  if (!analytics || result.outcome === "skipped") {
    return;
  }

  if (result.outcome === "success") {
    analytics.track("config_validation_succeeded", {
      folder_mode: result.dynamicFolders ? "dynamic" : "fixed",
      entry_point: entryPoint,
    });
    return;
  }

  analytics.track("config_validation_failed", {
    error_reason: result.errorReason,
    status: result.status,
    entry_point: entryPoint,
  });
}
