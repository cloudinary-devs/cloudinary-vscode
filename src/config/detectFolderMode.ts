import * as vscode from 'vscode';
import { generateUserAgent } from '../utils/userAgent';

/**
 * Detects if the cloud supports dynamic folders by making a request to the root folder API.
 * @param cloudName - The cloud name.
 * @param apiKey - The API key.
 * @param apiSecret - The API secret.
 * @returns True if dynamic folders are supported, false otherwise.
 */
export default async function detectFolderMode(
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  if (!cloudName || !apiKey || !apiSecret) {
    vscode.window.showErrorMessage("❌ Cloud name, API key, and API secret are required.");
    return false;
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
      return true; // Dynamic folders are supported
    } else if (response.status === 420) {
      return false; // Dynamic folders are not supported (fixed folder mode)
    } else {
      // Fallback to fixed folder mode for other errors
      return false;
    }
  } catch (error) {
    // Default to fixed folder mode if the request fails
    return false;
  }
}