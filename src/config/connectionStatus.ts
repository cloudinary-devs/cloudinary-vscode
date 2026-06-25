/** Inputs needed to decide the homescreen connection status. */
export interface ConnectionStatusInput {
  cloudName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  /** `true` validated OK, `false` rejected by API, `undefined` not yet known. */
  credentialsValid: boolean | undefined;
}

/**
 * - `connected`: credentials present and validated against the API.
 * - `setupNeeded`: credentials missing, or actively rejected (e.g. 401/403).
 * - `checking`: credentials present but not yet validated (or validation could
 *   not complete, e.g. offline). Deliberately neither "Connected" nor "Setup
 *   needed" so we never claim a valid cloud is broken, nor claim an unverified
 *   (possibly invalid) cloud is connected.
 */
export type ConnectionStatus = "connected" | "setupNeeded" | "checking";

/**
 * Decides the homescreen connection status from credentials + validation state.
 *
 * A folder-mode cache is keyed by cloud name, not by the API key/secret, so it
 * must never be allowed to imply "connected"; only an explicit
 * `credentialsValid === true` (a successful live validation) does that.
 */
export function getConnectionStatus(input: ConnectionStatusInput): ConnectionStatus {
  const hasCredentials = !!(input.cloudName && input.apiKey && input.apiSecret);
  if (!hasCredentials) {
    return "setupNeeded";
  }
  if (input.credentialsValid === true) {
    return "connected";
  }
  if (input.credentialsValid === false) {
    return "setupNeeded";
  }
  return "checking";
}
