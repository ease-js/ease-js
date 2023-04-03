import { asserts } from "../deps.ts";
// import { mock } from "../dev-deps.ts";

import type { DepInit } from "./mod.ts";
import { Dep } from "./mod.ts";

Deno.test("class Dep", async (t) => {
  await t.step("should be frozen", () => {
    asserts.assert(Object.isFrozen(Dep));
  });

  await t.step("Dep.provide(provide, init)", async (t) => {
    await t.step(
      "should use the `provide` and `init` to create a new Dep instance",
      () => {
        class Provide {}
        const factory = () => new Provide();
        const dep = Dep.provide(Provide, { factory, hoist: true });
        asserts.assert(dep instanceof Dep);
        asserts.assertStrictEquals(dep.factory, factory);
        asserts.assertStrictEquals(dep.hoist, true);
      },
    );

    await t.step(
      "should accept a `factory` function as the second argument",
      () => {
        class Provide {}
        const factory = () => new Provide();
        const dep = Dep.provide(Provide, factory);
        asserts.assert(dep instanceof Dep);
        asserts.assertStrictEquals(dep.factory, factory);
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

      asserts.assert(Dep[Symbol.hasInstance](dep));

      for (const value of invalidValues) {
        asserts.assertFalse(Dep[Symbol.hasInstance](value));
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
        asserts.assertThrows(() => {
          new Dep({ factory } as DepInit<unknown>);
        }, asserts.AssertionError);
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
        asserts.assertThrows(() => {
          new Dep({ factory: () => {}, hoist } as DepInit<unknown>);
        }, asserts.AssertionError);
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
        asserts.assertThrows(() => {
          new Dep({ factory: () => {}, provide } as DepInit<unknown>);
        }, asserts.AssertionError);
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

      asserts.assertStrictEquals(
        new Dep({ factory: demo, name: "1" }).name,
        "1",
      );
      asserts.assertStrictEquals(
        new Dep({ factory: demo, name: "2", provide: Demo }).name,
        "2",
      );
      asserts.assertStrictEquals(
        new Dep({ factory: demo, provide: Demo }).name,
        demo.name,
      );
      asserts.assertStrictEquals(
        new Dep({ factory: anonymous, provide: Demo }).name,
        Demo.name,
      );
      asserts.assertStrictEquals(
        new Dep({ factory: anonymous, provide: dep }).name,
        dep.name,
      );
      asserts.assertStrictEquals(
        new Dep({ factory: anonymous, provide: Anonymous }).name,
        "",
      );
    },
  );

  await t.step("should be frozen", () => {
    asserts.assert(Object.isFrozen(new Dep({ factory: () => {} })));
  });

  await t.step("dep.factory", async (t) => {
    await t.step("should equal to the `init.factory`", () => {
      function factory() {}
      asserts.assertStrictEquals(new Dep({ factory }).factory, factory);
    });
  });

  await t.step("dep.hoist", async (t) => {
    await t.step("should be resolved from `init.hoist`", () => {
      class Demo {}
      function factory() {}
      const dep1 = new Dep({ factory });
      const dep2 = new Dep({ factory, provide: Demo });

      asserts.assertStrictEquals(
        new Dep({ factory }).hoist,
        false,
      );
      asserts.assertStrictEquals(
        new Dep({ factory, hoist: undefined }).hoist,
        false,
      );
      asserts.assertStrictEquals(
        new Dep({ factory, hoist: false }).hoist,
        false,
      );
      asserts.assertStrictEquals(
        new Dep({ factory, hoist: dep1 }).hoist,
        dep1.key,
      );
      asserts.assertStrictEquals(
        new Dep({ factory, hoist: dep2 }).hoist,
        dep2.key,
      );
      asserts.assertStrictEquals(
        new Dep({ factory, hoist: Demo }).hoist,
        Demo,
      );
    });
  });

  await t.step("dep.key", async (t) => {
    await t.step("should be resolved from `init.provide`", () => {
      class Demo {}
      function factory() {}
      const dep1 = new Dep({ factory });
      const dep2 = new Dep({ factory, provide: Demo });

      asserts.assert(typeof new Dep({ factory }).key === "symbol");
      asserts.assertNotStrictEquals(
        new Dep({ factory }).key,
        new Dep({ factory }).key,
      );

      asserts.assertStrictEquals(new Dep({ factory, provide: Demo }).key, Demo);
      asserts.assertStrictEquals(
        new Dep({ factory, provide: dep1 }).key,
        dep1.key,
      );
      asserts.assertStrictEquals(
        new Dep({ factory, provide: dep2 }).key,
        dep2.key,
      );
    });
  });
});
