import * as vscode from 'vscode';
import { generateUserAgent } from '../utils/userAgent';
import { isPlaceholderConfig } from './configUtils';

export type FolderModeOutcome = 'success' | 'error' | 'skipped';

/**
 * Result of a folder-mode detection attempt.
 * - `success`: credentials were accepted by the API (dynamicFolders is meaningful).
 * - `error`: the API rejected the credentials or could not be reached.
 * - `skipped`: detection was not attempted (missing or placeholder credentials).
 */
export interface FolderModeResult {
  dynamicFolders: boolean;
  outcome: FolderModeOutcome;
  status?: number;
  errorReason?: string;
}

/**
 * Detects if the cloud supports dynamic folders by making a request to the root folder API.
 * The returned result also reflects whether the configured credentials are valid, so callers
 * can report configuration success/error analytics.
 * @param cloudName - The cloud name.
 * @param apiKey - The API key.
 * @param apiSecret - The API secret.
 * @returns A {@link FolderModeResult} describing the folder mode and validation outcome.
 */
export async function detectFolderModeResult(
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<FolderModeResult> {
  if (!cloudName || !apiKey || !apiSecret) {
    vscode.window.showErrorMessage("Cloud name, API key, and API secret are required.");
    return { dynamicFolders: false, outcome: 'skipped', errorReason: 'missing_credentials' };
  }

  // Don't make API calls with placeholder credentials
  if (isPlaceholderConfig(cloudName, apiKey, apiSecret)) {
    return { dynamicFolders: false, outcome: 'skipped', errorReason: 'placeholder' };
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/folders`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        'User-Agent': generateUserAgent(),
      },
    });

    if (response.status === 200) {
      // Dynamic folders are supported
      return { dynamicFolders: true, outcome: 'success', status: 200 };
    } else if (response.status === 420) {
      // Dynamic folders are not supported (fixed folder mode)
      return { dynamicFolders: false, outcome: 'success', status: 420 };
    } else if (response.status === 401 || response.status === 403) {
      // Credentials were rejected
      return {
        dynamicFolders: false,
        outcome: 'error',
        status: response.status,
        errorReason: 'unauthorized',
      };
    } else {
      // Fallback to fixed folder mode for other errors
      return {
        dynamicFolders: false,
        outcome: 'error',
        status: response.status,
        errorReason: 'unexpected_status',
      };
    }
  } catch (error) {
    // Default to fixed folder mode if the request fails
    return { dynamicFolders: false, outcome: 'error', errorReason: 'network_error' };
  }
}
