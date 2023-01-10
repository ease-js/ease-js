import { assertEquals, assertThrows } from "std/testing/asserts.ts";
import { revoke } from "./revocable.ts";

Deno.test("function revoke()", async (t): Promise<void> => {
  // revoke() tests
  await t.step(
    "should return true if some object is passed to revoke() at first time",
    () => {
      const testObj = {};

      assertEquals(revoke(testObj), true);
    },
  );

  await t.step(
    "should return false if some object is already passed to revoke()",
    () => {
      const testObj = {};

      assertEquals(revoke(testObj), true);
      assertEquals(revoke(testObj), false);
    },
  );

  // revoke.has() tests
  await t.step(
    "should return true when revoke.has() is invoked with objects collected by revoke()",
    () => {
      const testObj = {};

      assertEquals(revoke(testObj), true);
      assertEquals(revoke.has(testObj), true);
    },
  );

  await t.step(
    "should return false when revoke.has() is invoked with objects not collected by revoke()",
    () => {
      const outObj = {};

      assertEquals(revoke.has(outObj), false);
    },
  );

  // revoke.assert() tests
  await t.step(
    "should not throw an assertion and return undefined if some object is revoked by revoke()",
    () => {
      const testObj = {};

      assertEquals(revoke(testObj), true);
      assertEquals(revoke.assert(testObj), undefined);
    },
  );

  await t.step(
    "should throw an assertion if some object is not revoked by revoke()",
    () => {
      const outObj = {};

      assertThrows(() => {
        revoke.assert(outObj);
      });
    },
  );
});
