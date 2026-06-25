import * as assert from "assert";
import { isConnected } from "../../config/connectionStatus";

const base = { cloudName: "demo", apiKey: "key", apiSecret: "secret" };

suite("isConnected", () => {
  test("present + validated → connected", () => {
    assert.strictEqual(isConnected({ ...base, credentialsValid: true }), true);
  });

  test("present + rejected → not connected", () => {
    assert.strictEqual(isConnected({ ...base, credentialsValid: false }), false);
  });

  test("present + unknown (pending/network) → stays connected (optimistic)", () => {
    assert.strictEqual(isConnected({ ...base, credentialsValid: undefined }), true);
  });

  test("missing any field → not connected, regardless of validity", () => {
    assert.strictEqual(isConnected({ cloudName: null, apiKey: "k", apiSecret: "s", credentialsValid: true }), false);
    assert.strictEqual(isConnected({ cloudName: "c", apiKey: null, apiSecret: "s", credentialsValid: true }), false);
    assert.strictEqual(isConnected({ cloudName: "c", apiKey: "k", apiSecret: null, credentialsValid: true }), false);
    assert.strictEqual(isConnected({ cloudName: "", apiKey: "", apiSecret: "", credentialsValid: undefined }), false);
  });
});
