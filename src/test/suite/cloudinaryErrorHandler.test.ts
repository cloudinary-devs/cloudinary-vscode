import * as assert from "assert";
import { isCredentialError } from "../../utils/cloudinaryErrorHandler";

suite("isCredentialError", () => {
  test("detects auth HTTP codes from SDK-shaped errors", () => {
    assert.strictEqual(isCredentialError({ error: { http_code: 401 } }), true);
    assert.strictEqual(isCredentialError({ error: { http_code: 403 } }), true);
    assert.strictEqual(isCredentialError({ error: { http_code: 420 } }), true);
    assert.strictEqual(isCredentialError({ http_code: 401 }), true);
    assert.strictEqual(isCredentialError({ response: { status: 403 } }), true);
  });

  test("detects credential-related messages", () => {
    assert.strictEqual(isCredentialError(new Error("Invalid Signature abc")), true);
    assert.strictEqual(isCredentialError({ message: "Unknown API key 123" }), true);
    assert.strictEqual(isCredentialError({ error: { message: "disabled account" } }), true);
  });

  test("does not flag unrelated errors", () => {
    assert.strictEqual(isCredentialError({ error: { http_code: 404 } }), false);
    assert.strictEqual(isCredentialError(new Error("Network timeout")), false);
    assert.strictEqual(isCredentialError({ message: "Resource not found" }), false);
    assert.strictEqual(isCredentialError(undefined), false);
    assert.strictEqual(isCredentialError(null), false);
  });
});
