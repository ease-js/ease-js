import { asserts } from "./core/deps.ts";
import * as mod from "./core.ts";

Deno.test("module: core.ts", () => {
  asserts.assert("createDependencyContainer" in mod);
  asserts.assert("destructor" in mod);
});
