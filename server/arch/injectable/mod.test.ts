import {
  assert,
  assertFalse,
  AssertionError,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "../../../tools/std/testing/asserts.ts";
import type { DepInit } from "./mod.ts";
import { Dep } from "./mod.ts";

Deno.test("class Dep", async (t) => {
  await t.step("should be frozen", () => {
    assert(Object.isFrozen(Dep));
  });

  await t.step("Dep.provide(provide, init)", async (t) => {
    await t.step(
      "should use the `provide` and `init` to create a new Dep instance",
      () => {
        class Provide {}
        const factory = () => new Provide();
        const dep = Dep.provide(Provide, { factory, hoist: true });
        assert(dep instanceof Dep);
        assertStrictEquals(dep.factory, factory);
        assertStrictEquals(dep.hoist, true);
      },
    );

    await t.step(
      "should accept a `factory` function as the second argument",
      () => {
        class Provide {}
        const factory = () => new Provide();
        const dep = Dep.provide(Provide, factory);
        assert(dep instanceof Dep);
        assertStrictEquals(dep.factory, factory);
      },
    );
  });

  await t.step("Dep[@@hasInstance](input)", async (t) => {
    await t.step("should return if the input is a Dep instance", () => {
      const dep = new Dep({ factory: () => {} });
      const invalidValues = [
        ...[1n, 1, false, true, "", Symbol()],
        ...[{}, class {}, null, undefined, Object.create(dep)],
        ...[Object.setPrototypeOf({}, Dep.prototype), new Proxy(dep, {})],
      ];

      assert(Dep[Symbol.hasInstance](dep));

      for (const value of invalidValues) {
        assertFalse(Dep[Symbol.hasInstance](value));
      }
    });
  });
});

Deno.test("new Dep(init)", async (t) => {
  await t.step(
    "should throw an assertion if `init.factory` is not a function",
    () => {
      const validValues: unknown[] = [() => {}, class {}];
      const invalidValues: unknown[] = [1n, 1, null, "", Symbol(), undefined];

      for (const factory of validValues) {
        new Dep({ factory } as DepInit<unknown>);
      }

      for (const factory of invalidValues) {
        assertThrows(() => {
          new Dep({ factory } as DepInit<unknown>);
        }, AssertionError);
      }
    },
  );

  await t.step(
    "should throw an assertion if `init.hoist` is neither a boolean, a Dep, nor a DepKey",
    () => {
      const validValues: unknown[] = [
        ...[false, true, () => {}, class {}, Symbol(), undefined],
        ...[new Dep({ factory: () => {} })],
      ];
      const invalidValues: unknown[] = [1n, 1, {}, null, ""];

      for (const hoist of validValues) {
        new Dep({ factory: () => {}, hoist } as DepInit<unknown>);
      }

      for (const hoist of invalidValues) {
        assertThrows(() => {
          new Dep({ factory: () => {}, hoist } as DepInit<unknown>);
        }, AssertionError);
      }
    },
  );

  await t.step(
    "should throw an assertion if `init.provide` is not a DepLike",
    () => {
      const validValues: unknown[] = [
        ...[() => {}, class {}, undefined],
        ...[new Dep({ factory: () => {} })],
      ];
      const invalidValues: unknown[] = [
        ...[1n, false, true, 1],
        ...[{}, null, "", Symbol()],
      ];

      for (const provide of validValues) {
        new Dep({ factory: () => {}, provide } as DepInit<unknown>);
      }

      for (const provide of invalidValues) {
        assertThrows(() => {
          new Dep({ factory: () => {}, provide } as DepInit<unknown>);
        }, AssertionError);
      }
    },
  );

  await t.step(
    "should try using the `init.name`, `init.factory.name`, provide name as the `Dep.name`",
    () => {
      class Demo {}
      function demo() {}
      const anonymous = (() => () => {})();
      const Anonymous = (() => class {})();
      const dep = new Dep({ factory: () => {}, name: "0" });

      assertStrictEquals(
        new Dep({ factory: demo, name: "1" }).name,
        "1",
      );
      assertStrictEquals(
        new Dep({ factory: demo, name: "2", provide: Demo }).name,
        "2",
      );
      assertStrictEquals(
        new Dep({ factory: demo, provide: Demo }).name,
        demo.name,
      );
      assertStrictEquals(
        new Dep({ factory: anonymous, provide: Demo }).name,
        Demo.name,
      );
      assertStrictEquals(
        new Dep({ factory: anonymous, provide: dep }).name,
        dep.name,
      );
      assertStrictEquals(
        new Dep({ factory: anonymous, provide: Anonymous }).name,
        "",
      );
    },
  );

  await t.step("should be frozen", () => {
    assert(Object.isFrozen(new Dep({ factory: () => {} })));
  });

  await t.step("dep.factory", async (t) => {
    await t.step("should equal to the `init.factory`", () => {
      function factory() {}
      assertStrictEquals(new Dep({ factory }).factory, factory);
    });
  });

  await t.step("dep.hoist", async (t) => {
    await t.step("should be resolved from `init.hoist`", () => {
      class Demo {}
      function factory() {}
      const dep1 = new Dep({ factory });
      const dep2 = new Dep({ factory, provide: Demo });

      assertStrictEquals(new Dep({ factory }).hoist, false);
      assertStrictEquals(new Dep({ factory, hoist: undefined }).hoist, false);
      assertStrictEquals(new Dep({ factory, hoist: false }).hoist, false);
      assertStrictEquals(new Dep({ factory, hoist: dep1 }).hoist, dep1.key);
      assertStrictEquals(new Dep({ factory, hoist: dep2 }).hoist, dep2.key);
      assertStrictEquals(new Dep({ factory, hoist: Demo }).hoist, Demo);
    });
  });

  await t.step("dep.key", async (t) => {
    await t.step("should be resolved from `init.provide`", () => {
      class Demo {}
      function factory() {}
      const dep1 = new Dep({ factory });
      const dep2 = new Dep({ factory, provide: Demo });

      assert(typeof new Dep({ factory }).key === "symbol");
      assertNotStrictEquals(new Dep({ factory }).key, new Dep({ factory }).key);

      assertStrictEquals(new Dep({ factory, provide: Demo }).key, Demo);
      assertStrictEquals(new Dep({ factory, provide: dep1 }).key, dep1.key);
      assertStrictEquals(new Dep({ factory, provide: dep2 }).key, dep2.key);
    });
  });
});
