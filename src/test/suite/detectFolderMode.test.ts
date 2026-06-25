import * as assert from "assert";
import { resolveFolderModeState } from "../../config/detectFolderMode";

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
      resolveFolderModeState({ outcome: "success", dynamicFolders: false, status: 420 }),
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
