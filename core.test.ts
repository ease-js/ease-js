import { asserts } from "./core/deps.ts";
import * as mod from "./core.ts";

Deno.test("module", () => {
  // ioc
  asserts.assert("Dep" in mod);
  asserts.assert("DepAgent" in mod);
  asserts.assert("DepRegistry" in mod);
  asserts.assert("depMeta" in mod);
});
