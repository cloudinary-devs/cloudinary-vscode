function getRecordValue(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

export function formatError(error: unknown): string {
    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        const message = [
            getRecordValue(record, 'name'),
            getRecordValue(record, 'message'),
        ].filter(Boolean).join(': ');
        const httpCode = getRecordValue(record, 'http_code');
        if (message) {
            return httpCode ? `${message} (http_code=${httpCode})` : message;
        }
    }

    if (error instanceof Error) {
        const details = [error.name, error.message].filter(Boolean).join(': ');
        const record = error as Error & Record<string, unknown>;
        const httpCode = getRecordValue(record, 'http_code');
        return httpCode ? `${details} (http_code=${httpCode})` : details;
    }

    return String(error);
}

export function createHookError(message: string, error: unknown): Error {
    const wrappedError = new Error(`${message}: ${formatError(error)}`);
    if (error instanceof Error && error.stack) {
        wrappedError.stack = `${wrappedError.stack}\nCaused by: ${error.stack}`;
    }
    return wrappedError;
}
