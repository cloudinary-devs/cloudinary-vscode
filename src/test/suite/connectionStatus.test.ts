import * as assert from "assert";
import { getConnectionStatus } from "../../config/connectionStatus";

const base = { cloudName: "demo", apiKey: "key", apiSecret: "secret" };

suite("getConnectionStatus", () => {
  test("present + validated → connected", () => {
    assert.strictEqual(getConnectionStatus({ ...base, credentialsValid: true }), "connected");
  });

  test("present + rejected → invalidCredentials (never 'connected' for bad creds)", () => {
    assert.strictEqual(getConnectionStatus({ ...base, credentialsValid: false }), "invalidCredentials");
  });

  test("present + unknown (pending/offline) → checking (not connected, not broken)", () => {
    assert.strictEqual(getConnectionStatus({ ...base, credentialsValid: undefined }), "checking");
  });

  test("missing any field → setupNeeded regardless of validity", () => {
    assert.strictEqual(
      getConnectionStatus({ cloudName: null, apiKey: "k", apiSecret: "s", credentialsValid: true }),
      "setupNeeded"
    );
    assert.strictEqual(
      getConnectionStatus({ cloudName: "c", apiKey: null, apiSecret: "s", credentialsValid: true }),
      "setupNeeded"
    );
    assert.strictEqual(
      getConnectionStatus({ cloudName: "c", apiKey: "k", apiSecret: null, credentialsValid: undefined }),
      "setupNeeded"
    );
  });

  test("the cached-invalid-credentials repro: a stale cache cannot make rejected creds 'connected'", () => {
    // Simulates DOC-11110 repro: folder mode was cached (so dynamicFolders is
    // known) but the current secret is now rejected → credentialsValid=false.
    assert.strictEqual(getConnectionStatus({ ...base, credentialsValid: false }), "invalidCredentials");
  });
});
