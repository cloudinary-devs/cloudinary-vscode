import * as vscode from "vscode";

/**
 * Timestamped folder-mode cache entry stored in globalState.
 *
 * The folder mode is re-detected on every activation/save/switch (detection also
 * validates the live credentials), so this cache is only a fallback that keeps a
 * last-known folder mode for UI continuity when a detection attempt fails for a
 * non-credential reason (e.g. the network is down). `detectedAt` records when it
 * was last confirmed.
 */
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
