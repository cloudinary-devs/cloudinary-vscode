import * as vscode from 'vscode';
import { getGlobalConfigPath } from '../config/configUtils';

export async function handleCloudinaryError(context: string, error: any) {
    const extractMessage = (err: any): string => {
        if (!err) {return 'Unknown error';}
        if (typeof err === 'string') {return err;}
        if (err.message) {return err.message;}
        if (err.error && typeof err.error.message === 'string') {return err.error.message;}
        if (err.response && typeof err.response.data?.message === 'string') {return err.response.data.message;}
        // Log error for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
            console.log('Cloudinary Error:', error);
        }
        return JSON.stringify(err, null, 2).slice(0, 200); // fallback: stringify safely
    };

    const message = `${context}: ${extractMessage(error)}. Fix your config and reselect an environment.`;
    const choice = await vscode.window.showErrorMessage(message, 'Open Global Config');

    if (choice === 'Open Global Config') {
        try {
            const envPath = getGlobalConfigPath();
            const doc = await vscode.workspace.openTextDocument(envPath);
            await vscode.window.showTextDocument(doc);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Could not open config: ${err.message || String(err)}`);
        }
    }
}
