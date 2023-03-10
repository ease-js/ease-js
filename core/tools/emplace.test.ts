import { asserts } from "../deps.ts";

import { emplaceMap } from "./emplace.ts";

Deno.test("emplaceMap(map, key, handlers)", async (t) => {
  await t.step(
    "should insert a new entry if none of the existing entries match the given key",
    () => {
      const map = new Map([[1, 1]]);

      asserts.assertStrictEquals(
        emplaceMap(map, 2, { insert: (key) => key }),
        2,
      );
      asserts.assertStrictEquals(map.get(2), 2);
      asserts.assertStrictEquals(map.size, 2);
    },
  );

  await t.step(
    "should return `undefined` if none of the existing entries match the key and `insert` is not given",
    () => {
      const map = new Map([[1, 1]]);

      asserts.assertStrictEquals(
        emplaceMap(map, 2, { update: (existing) => existing + 1 }),
        undefined,
      );
      asserts.assertStrictEquals(map.size, 1);
    },
  );

  await t.step("should return the value of the matched entry", () => {
    const map = new Map([[1, 1]]);

    asserts.assertStrictEquals(emplaceMap(map, 1, { insert: (key) => key }), 1);
    asserts.assertStrictEquals(map.size, 1);
  });

  await t.step(
    "should update the element that satisfies the predicate while `update` handler is given",
    () => {
      const map = new Map([[1, 1]]);

      asserts.assertStrictEquals(
        emplaceMap(map, 1, { update: (existing) => existing + 1 }),
        2,
      );
      asserts.assertStrictEquals(map.size, 1);
      asserts.assertStrictEquals(map.get(1), 2);
    },
  );
});
