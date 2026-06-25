import * as vscode from 'vscode';
import { getGlobalConfigPath } from '../config/configUtils';

/**
 * Whether a Cloudinary error was caused by invalid/unauthorized credentials
 * (bad cloud name, API key, or secret) rather than some other failure.
 */
export function isCredentialError(error: any): boolean {
    const httpCode = error?.error?.http_code ?? error?.http_code ?? error?.response?.status;
    if (httpCode === 401 || httpCode === 403 || httpCode === 420) {
        return true;
    }
    const message =
        (typeof error?.message === 'string' && error.message) ||
        (typeof error?.error?.message === 'string' && error.error.message) ||
        '';
    return /invalid signature|api key|api secret|unknown api key|disabled account|unauthorized|invalid credentials/i.test(
        message
    );
}

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

    // Credential failures get a clearer, actionable message instead of a raw
    // SDK error, since the fix is almost always "correct your credentials".
    const message = isCredentialError(error)
        ? `${context}: your Cloudinary credentials appear to be invalid or unauthorized. Check the cloud name, API key, and API secret in your config.`
        : `${context}: ${extractMessage(error)}. Fix your config and reselect an environment.`;
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
