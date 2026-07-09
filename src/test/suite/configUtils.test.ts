import * as assert from "assert";
import { hasCompleteEnvironment } from "../../config/configUtils";

suite("configUtils", () => {
  suite("hasCompleteEnvironment", () => {
    test("accepts a cloud keyed environment with required credentials", () => {
      assert.strictEqual(
        hasCompleteEnvironment("demo", { apiKey: "key", apiSecret: "secret" }),
        true
      );
    });

    test("rejects an empty config object", () => {
      assert.strictEqual(hasCompleteEnvironment(undefined, undefined), false);
    });

    test("rejects an environment missing required credentials", () => {
      assert.strictEqual(hasCompleteEnvironment("demo", {}), false);
      assert.strictEqual(hasCompleteEnvironment("demo", { apiKey: "key" }), false);
      assert.strictEqual(hasCompleteEnvironment("demo", { apiSecret: "secret" }), false);
    });
  });
});
