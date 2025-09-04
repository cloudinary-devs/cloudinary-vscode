import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CloudinaryEnvironment {
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;  // Default upload preset to use
}

/**
 * Returns the absolute path to the global Cloudinary config file.
 * If it doesn't exist, it creates one with a placeholder template.
 */
export function getGlobalConfigPath(): string {
  const homeDir = os.homedir();
  const cloudinaryDir = path.join(homeDir, '.cloudinary');
  const envPath = path.join(cloudinaryDir, 'environments.json');

  if (!fs.existsSync(cloudinaryDir)) {
    fs.mkdirSync(cloudinaryDir, { recursive: true });
  }

  if (!fs.existsSync(envPath)) {
    const template: Record<string, CloudinaryEnvironment> = {
      'your-cloud-name-1': {
        apiKey: '<your-api-key>',
        apiSecret: '<your-api-secret>',
        uploadPreset: '<your-default-upload-preset>'  // Default preset to use
      },
      'your-cloud-name-2': {
        apiKey: '<your-api-key>',
        apiSecret: '<your-api-secret>',
        uploadPreset: '<your-default-upload-preset>'  // Default preset to use
      },
    };
    fs.writeFileSync(envPath, JSON.stringify(template, null, 2), 'utf-8');

    vscode.window.showInformationMessage(
      '✅ Created global Cloudinary config at ~/.cloudinary/environments.json'
    );
  }

  return envPath;
}

/**
 * Loads Cloudinary environments from either the workspace config or global config.
 * Workspace config (if available) overrides the global file.
 */
export async function loadEnvironments(): Promise<Record<string, CloudinaryEnvironment>> {
  const globalPath = getGlobalConfigPath();
  let globalEnvs: Record<string, CloudinaryEnvironment> = {};

  try {
    const raw = fs.readFileSync(globalPath, 'utf-8');
    globalEnvs = JSON.parse(raw);
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `❌ Failed to read global Cloudinary config: ${err.message}`
    );
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {return globalEnvs;}

  const workspaceRoot = folders[0].uri.fsPath;
  const localPath = path.join(workspaceRoot, '.cloudinary', 'environments.json');

  try {
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `❌ Failed to read workspace Cloudinary config: ${err.message}`
    );
  }

  return globalEnvs;
}