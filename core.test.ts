import { assert } from "std/testing/asserts.ts";
import * as mod from "./core.ts";

Deno.test("module: core.ts", () => {
  assert("createDependencyContainer" in mod);
  assert("destructor" in mod);
});
