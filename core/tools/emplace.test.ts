import { assertEquals } from "std/testing/asserts.ts";
import { describe, it } from "std/testing/bdd.ts";
import { emplaceMap } from "./emplace.ts";

describe("function emplaceMap()", () => {
  it("should insert a new entry if none of the existing entries match the given key", () => {
    const map = new Map([[1, 1]]);

    assertEquals(emplaceMap(map, 2, { insert: (key) => key }), 2);
    assertEquals(map.get(2), 2);
    assertEquals(map.size, 2);
  });

  it("should return `undefined` if none of the existing entries match the key and `insert` is not given", () => {
    const map = new Map([[1, 1]]);

    assertEquals(
      emplaceMap(map, 2, { update: (existing) => existing + 1 }),
      undefined,
    );
    assertEquals(map.size, 1);
  });

  it("should return the value of the matched entry", () => {
    const map = new Map([[1, 1]]);

    assertEquals(emplaceMap(map, 1, { insert: (key) => key }), 1);
    assertEquals(map.size, 1);
  });

  it("should update the element that satisfies the predicate while `update` handler is given", () => {
    const map = new Map([[1, 1]]);

    assertEquals(emplaceMap(map, 1, { update: (existing) => existing + 1 }), 2);
    assertEquals(map.size, 1);
    assertEquals(map.get(1), 2);
  });
});
