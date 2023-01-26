import { asserts } from "../deps.ts";

import { revoke } from "./revocable.ts";

Deno.test("revoke(input)", async (t): Promise<void> => {
  // revoke() tests
  await t.step(
    "should return true if some object is passed to revoke() at first time",
    () => {
      const testObj = {};

      asserts.assertStrictEquals(revoke(testObj), true);
    },
  );

  await t.step(
    "should return false if some object is already passed to revoke()",
    () => {
      const testObj = {};

      asserts.assertStrictEquals(revoke(testObj), true);
      asserts.assertStrictEquals(revoke(testObj), false);
    },
  );

  await t.step("revoke.has(input)", async (t) => {
    await t.step(
      "should return true when revoke.has() is invoked with objects collected by revoke()",
      () => {
        const testObj = {};

        asserts.assertStrictEquals(revoke(testObj), true);
        asserts.assertStrictEquals(revoke.has(testObj), true);
      },
    );

    await t.step(
      "should return false when revoke.has() is invoked with objects not collected by revoke()",
      () => {
        const outObj = {};

        asserts.assertStrictEquals(revoke.has(outObj), false);
      },
    );
  });

  await t.step("revoke.assert(input)", async (t) => {
    await t.step(
      "should throw an assertion and return undefined if some object is revoked by revoke()",
      () => {
        const testObj = {};

        asserts.assertStrictEquals(revoke(testObj), true);
        asserts.assertThrows(() => {
          revoke.assert(testObj);
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should not throw an assertion if some object is not revoked by revoke()",
      () => {
        const outObj = {};

        asserts.assertStrictEquals(revoke.assert(outObj), undefined);
      },
    );
  });
});
