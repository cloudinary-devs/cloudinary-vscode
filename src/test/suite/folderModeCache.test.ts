import * as assert from "assert";
import * as vscode from "vscode";
import {
  FOLDER_MODE_TTL_MS,
  folderModeCacheKey,
  isFolderModeFresh,
  readFolderModeCache,
  writeFolderModeCache,
} from "../../config/folderModeCache";

/** Minimal in-memory Memento for testing. */
class FakeStorage implements Pick<vscode.Memento, "get" | "update"> {
  private values = new Map<string, unknown>();

  constructor(seed: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(seed)) {
      this.values.set(k, v);
    }
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.values.has(key) ? (this.values.get(key) as T) : defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  raw(key: string): unknown {
    return this.values.get(key);
  }
}

const memento = (storage: FakeStorage) => storage as unknown as vscode.Memento;

suite("folderModeCache", () => {
  test("readFolderModeCache returns a timestamped entry", () => {
    const entry = { value: true, detectedAt: 1000 };
    const storage = new FakeStorage({ [folderModeCacheKey("demo")]: entry });
    assert.deepStrictEqual(readFolderModeCache(memento(storage), "demo"), entry);
  });

  test("readFolderModeCache ignores legacy plain-boolean entries", () => {
    const storage = new FakeStorage({ [folderModeCacheKey("demo")]: true });
    assert.strictEqual(readFolderModeCache(memento(storage), "demo"), undefined);
  });

  test("readFolderModeCache returns undefined when absent", () => {
    assert.strictEqual(readFolderModeCache(memento(new FakeStorage()), "demo"), undefined);
  });

  test("isFolderModeFresh: within TTL is fresh, beyond TTL is stale", () => {
    const now = 10_000_000;
    assert.strictEqual(isFolderModeFresh({ value: true, detectedAt: now - 1 }, now), true);
    assert.strictEqual(
      isFolderModeFresh({ value: true, detectedAt: now - FOLDER_MODE_TTL_MS - 1 }, now),
      false
    );
    // Exactly at the TTL boundary is considered stale (strict less-than).
    assert.strictEqual(
      isFolderModeFresh({ value: true, detectedAt: now - FOLDER_MODE_TTL_MS }, now),
      false
    );
  });

  test("writeFolderModeCache persists a timestamped entry", async () => {
    const storage = new FakeStorage();
    await writeFolderModeCache(memento(storage), "demo", true, 4242);
    assert.deepStrictEqual(storage.raw(folderModeCacheKey("demo")), {
      value: true,
      detectedAt: 4242,
    });
  });

  test("write then read round-trips and is fresh at write time", async () => {
    const storage = new FakeStorage();
    const now = 50_000;
    await writeFolderModeCache(memento(storage), "demo", false, now);
    const cached = readFolderModeCache(memento(storage), "demo");
    assert.ok(cached);
    assert.strictEqual(cached!.value, false);
    assert.strictEqual(isFolderModeFresh(cached!, now), true);
  });
});
