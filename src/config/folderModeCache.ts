import * as vscode from "vscode";

/**
 * How long a detected folder mode stays trusted before it is re-validated.
 * Cloudinary accounts can migrate from fixed to dynamic folders, so the cached
 * mode must expire rather than live forever.
 */
export const FOLDER_MODE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Timestamped folder-mode cache entry stored in globalState. */
export interface CachedFolderMode {
  value: boolean;
  detectedAt: number;
}

/** Returns the globalState key under which a cloud's folder mode is cached. */
export function folderModeCacheKey(cloudName: string): string {
  return `cloudinary.dynamicFolders.${cloudName}`;
}

/**
 * Reads the cached folder-mode entry for a cloud.
 *
 * Returns the entry only when it is a timestamped object. Legacy plain-boolean
 * entries (written before the cache carried a timestamp) are ignored so installs
 * stuck on an outdated mode re-validate and self-heal. No TTL check is applied
 * here — callers decide whether they want a still-fresh value or a last-known
 * value to fall back on after a failed detection.
 */
export function readFolderModeCache(
  storage: vscode.Memento,
  cloudName: string
): CachedFolderMode | undefined {
  const cached = storage.get(folderModeCacheKey(cloudName)) as
    | CachedFolderMode
    | boolean
    | undefined;
  if (
    cached &&
    typeof cached === "object" &&
    typeof cached.value === "boolean" &&
    Number.isFinite(cached.detectedAt)
  ) {
    return cached;
  }
  return undefined;
}

/** Whether a cache entry is still within the TTL and can be used without re-validating. */
export function isFolderModeFresh(entry: CachedFolderMode, now: number = Date.now()): boolean {
  return now - entry.detectedAt < FOLDER_MODE_TTL_MS;
}

/** Persists a freshly detected folder mode with the current timestamp. */
export function writeFolderModeCache(
  storage: vscode.Memento,
  cloudName: string,
  value: boolean,
  now: number = Date.now()
): Thenable<void> {
  return storage.update(folderModeCacheKey(cloudName), {
    value,
    detectedAt: now,
  } satisfies CachedFolderMode);
}
