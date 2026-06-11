import { randomUUID } from "crypto";

export type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type AnalyticsPayload = Record<string, unknown>;

type AnalyticsStorage = {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
};

type AnalyticsServiceOptions = {
  extensionVersion: string;
  storage: AnalyticsStorage;
  getCloudName?: () => string | null | undefined;
  getDebugId?: () => string | null | undefined;
  getIdePlatform?: () => string;
  fetchFn?: (url: string, init: { method: "POST" }) => Promise<unknown>;
  now?: () => Date;
  createSessionId?: () => string;
};

const ANALYTICS_ENDPOINT = "https://analytics-api.cloudinary.com";
const ANALYTICS_FEATURE = "vscode_extension";
const SESSION_STORAGE_KEY = "cloudinary.analyticsSessionId";
const SENSITIVE_PAYLOAD_KEYS = new Set([
  "apikey",
  "api_key",
  "apisecret",
  "api_secret",
  "accesstoken",
  "access_token",
  "authorization",
  "clientsecret",
  "client_secret",
  "email",
  "idtoken",
  "id_token",
  "message",
  "message_content",
  "password",
  "phone",
  "prompt",
  "refreshtoken",
  "refresh_token",
  "secret",
  "token",
  "useremail",
  "user_email",
  "user_message",
]);
const RESERVED_PAYLOAD_KEYS = new Set([
  "source",
  "extension_version",
  "ide_platform",
  "session_id",
  "event_time",
  "event",
]);

function isSafeEventName(eventName: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(eventName);
}

function normalizePayloadKey(key: string): string {
  return key.trim().replace(/[-.\s]/g, "_").toLowerCase();
}

function normalizePayloadValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function isSensitivePayloadKey(key: string): boolean {
  const normalizedKey = normalizePayloadKey(key);
  return SENSITIVE_PAYLOAD_KEYS.has(normalizedKey);
}

function isReservedPayloadKey(key: string): boolean {
  return RESERVED_PAYLOAD_KEYS.has(normalizePayloadKey(key));
}

export class AnalyticsService {
  private readonly extensionVersion: string;
  private readonly storage: AnalyticsStorage;
  private readonly getCloudName: () => string | null | undefined;
  private readonly getDebugId: () => string | null | undefined;
  private readonly getIdePlatform: () => string;
  private readonly fetchFn: (url: string, init: { method: "POST" }) => Promise<unknown>;
  private readonly now: () => Date;
  private readonly createSessionId: () => string;

  constructor(options: AnalyticsServiceOptions) {
    this.extensionVersion = options.extensionVersion;
    this.storage = options.storage;
    this.getCloudName = options.getCloudName ?? (() => undefined);
    this.getDebugId = options.getDebugId ?? (() => undefined);
    this.getIdePlatform = options.getIdePlatform ?? (() => "unknown");
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? (() => new Date());
    this.createSessionId = options.createSessionId ?? randomUUID;
  }

  track(eventName: string, payload: AnalyticsPayload = {}): void {
    void this.send(eventName, payload);
  }

  async send(eventName: string, payload: AnalyticsPayload = {}): Promise<void> {
    if (!isSafeEventName(eventName)) {
      return;
    }

    const sessionId = await this.getSessionId();
    const cloudName = normalizePayloadValue(this.getCloudName());
    const debugId = normalizePayloadValue(this.getDebugId());
    const params = new URLSearchParams({
      source: ANALYTICS_FEATURE,
      event: eventName,
      extension_version: this.extensionVersion,
      ide_platform: this.getIdePlatform(),
      session_id: sessionId,
      event_time: this.now().toISOString(),
    });

    if (cloudName) {
      params.set("cloud_name", cloudName);
    }
    if (debugId) {
      params.set("debug_id", debugId);
    }

    for (const [key, value] of Object.entries(payload)) {
      if (!key || isReservedPayloadKey(key) || isSensitivePayloadKey(key)) {
        continue;
      }

      const normalized = normalizePayloadValue(value);
      if (normalized !== undefined) {
        params.set(key, normalized);
      }
    }

    const url = `${ANALYTICS_ENDPOINT}/${ANALYTICS_FEATURE}?${params.toString()}`;

    try {
      await this.fetchFn(url, { method: "POST" });
    } catch {
      // Analytics must never interrupt extension workflows.
    }
  }

  private async getSessionId(): Promise<string> {
    const existing = this.storage.get<string>(SESSION_STORAGE_KEY, "");
    if (existing) {
      return existing;
    }

    const created = this.createSessionId();
    await this.storage.update(SESSION_STORAGE_KEY, created);
    return created;
  }
}
