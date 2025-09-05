import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Transforms app name to camelCase editor name
 * @param appName - The raw app name from vscode.env.appName
 * @returns Transformed editor name
 */
function transformAppNameToEditorName(appName: string): string {
    if (!appName) { return 'VSCode'; }

    // Convert to lowercase for easier matching
    const lowerAppName = appName.toLowerCase();

    // Handle special cases and transformations
    if (lowerAppName.includes('cursor')) { return 'Cursor'; }
    if (lowerAppName.includes('visual studio code')) { return 'VSCode'; }
    if (lowerAppName.includes('windsurf')) { return 'Windsurf'; }
    if (lowerAppName.includes('insiders')) { return 'VSCodeInsiders'; }
    if (lowerAppName.includes('code - oss')) { return 'VSCodeOSS'; }

    // Generic transformation: remove special characters, split on whitespace, and camelCase
    const cleanName = appName.replace(/[^\w\s]/g, '').trim();
    const words = cleanName.split(/\s+/);

    if (words.length === 0) { return 'VSCode'; }
    if (words.length === 1) { return words[0]; }

    // First word lowercase, subsequent words capitalized
    return words[0].toLowerCase() + words.slice(1).map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join('');
}

/**
 * Detects the editor application and version
 * @returns Object with editor name and version
 */
function detectEditor(): { name: string; version: string } {
    const appName = vscode.env.appName || 'Visual Studio Code';
    const editorName = transformAppNameToEditorName(appName);

    return {
        name: editorName,
        version: vscode.version
    };
}

/**
 * Generates a user agent string for Cloudinary API requests following the format:
 * CloudinaryVSCode/<plugin ver> (<editor> <ver>)
 * The SDK will automatically append its own version info
 */
export function generateUserAgent(): string {
    try {
        const extensionManifest = vscode.extensions.getExtension('Cloudinary.cloudinary');
        const extensionVersion = extensionManifest?.packageJSON?.version || '0.1.0';

        const editor = detectEditor();

        // Format: CloudinaryVSCode/<plugin ver> (<editor> <ver>)
        // SDK will append: CloudinaryNodeJS/<sdk ver>
        return `CloudinaryVSCode/${extensionVersion} (${editor.name} ${editor.version})`;
    } catch (error) {
        // Fallback in case of any errors
        return `CloudinaryVSCode/0.0.7 (VSCode ${vscode.version})`;
    }
} 