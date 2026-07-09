import * as assert from "assert";
import { detectFolderModeResult, resolveFolderModeState } from "../../config/detectFolderMode";

suite("resolveFolderModeState", () => {
  test("success marks credentials valid and uses detected folder mode", () => {
    assert.deepStrictEqual(
      resolveFolderModeState({ outcome: "success", dynamicFolders: true, status: 200 }),
      { dynamicFolders: true, credentialsValid: true }
    );
  });

  test("unauthorized credentials stay invalid even with a cached folder mode", () => {
    assert.deepStrictEqual(
      resolveFolderModeState(
        {
          outcome: "error",
          errorReason: "unauthorized",
          status: 401,
          dynamicFolders: false,
        },
        { value: true, detectedAt: Date.now() }
      ),
      { dynamicFolders: false, credentialsValid: false }
    );
  });

  test("transient failures can reuse cached folder mode without validating credentials", () => {
    assert.deepStrictEqual(
      resolveFolderModeState(
        {
          outcome: "error",
          errorReason: "network_error",
          dynamicFolders: false,
        },
        { value: true, detectedAt: Date.now() }
      ),
      { dynamicFolders: true, credentialsValid: undefined }
    );
  });

  test("success (fixed mode) marks credentials valid", () => {
    assert.deepStrictEqual(
      resolveFolderModeState({ outcome: "success", dynamicFolders: false, status: 200 }),
      { dynamicFolders: false, credentialsValid: true }
    );
  });

  test("transient failure without a cache → unknown validity, default mode", () => {
    assert.deepStrictEqual(
      resolveFolderModeState({ outcome: "error", errorReason: "network_error", dynamicFolders: false }),
      { dynamicFolders: false, credentialsValid: undefined }
    );
  });

  test("skipped (placeholder/missing creds) → unknown validity", () => {
    assert.deepStrictEqual(
      resolveFolderModeState({ outcome: "skipped", errorReason: "placeholder", dynamicFolders: false }),
      { dynamicFolders: false, credentialsValid: undefined }
    );
  });
});

suite("detectFolderModeResult", () => {
  const originalFetch = globalThis.fetch;

  teardown(() => {
    (globalThis as any).fetch = originalFetch;
  });

  function mockConfigResponse(status: number, body: unknown): void {
    (globalThis as any).fetch = async (url: string) => {
      assert.strictEqual(url, "https://api.cloudinary.com/v1_1/demo/config?settings=true");
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    };
  }

  test("uses Admin API config folder_mode=dynamic", async () => {
    mockConfigResponse(200, { settings: { folder_mode: "dynamic" } });

    assert.deepStrictEqual(
      await detectFolderModeResult("demo", "key", "secret"),
      { dynamicFolders: true, outcome: "success", status: 200 }
    );
  });

  test("uses Admin API config folder_mode=fixed", async () => {
    mockConfigResponse(200, { settings: { folder_mode: "fixed" } });

    assert.deepStrictEqual(
      await detectFolderModeResult("demo", "key", "secret"),
      { dynamicFolders: false, outcome: "success", status: 200 }
    );
  });

  test("does not infer dynamic mode from any successful config response", async () => {
    mockConfigResponse(200, { settings: {} });

    assert.deepStrictEqual(
      await detectFolderModeResult("demo", "key", "secret"),
      {
        dynamicFolders: false,
        outcome: "error",
        status: 200,
        errorReason: "unexpected_response",
      }
    );
  });

  test("marks rejected credentials unauthorized", async () => {
    mockConfigResponse(401, { error: { message: "Unauthorized" } });

    assert.deepStrictEqual(
      await detectFolderModeResult("demo", "key", "secret"),
      {
        dynamicFolders: false,
        outcome: "error",
        status: 401,
        errorReason: "unauthorized",
      }
    );
  });
});
