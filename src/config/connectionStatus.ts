/** Inputs needed to decide the homescreen connection status. */
export interface ConnectionStatusInput {
  cloudName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  /** `true` validated OK, `false` rejected by API, `undefined` not yet known. */
  credentialsValid: boolean | undefined;
}

/**
 * Whether the homescreen should report "Connected".
 *
 * True only when all credential fields are present AND the credentials have not
 * been actively rejected. A pending/unknown validation (`undefined`) stays
 * optimistic: credentials are always validated on activation/save/switch, so
 * `undefined` is a brief, self-correcting state, and we must not flash a valid
 * cloud as "Setup needed" during the startup check or a transient network blip.
 * Only a definitive `false` (e.g. 401/403) downgrades to "Setup needed".
 */
export function isConnected(input: ConnectionStatusInput): boolean {
  const hasCredentials = !!(input.cloudName && input.apiKey && input.apiSecret);
  return hasCredentials && input.credentialsValid !== false;
}
