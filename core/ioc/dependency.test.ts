import { assertSpyCallArgs, assertSpyCalls, spy } from "std/testing/mock.ts";
import {
  assert,
  AssertionError,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "std/testing/asserts.ts";
import type {
  DependencyDescriptor,
  WeakDependencyHandle,
} from "./dependency.ts";
import { Dependency } from "./dependency.ts";

// 设置 --v8-flags=--expose-gc 即可启用此 API
declare const gc: undefined | (() => void);

Deno.test("new Dependency(init)", async (t) => {
  await t.step("should assert `init.load` is a function", () => {
    new Dependency({ load: () => {} });

    assertThrows(() => {
      new Dependency({ load: null! });
    }, AssertionError);
  });

  await t.step("should assert `init.unload` is undefined or a function", () => {
    new Dependency({ load: () => {}, unload: () => {} });
    new Dependency({ load: () => {}, unload: undefined });

    assertThrows(() => {
      new Dependency({ load: () => {}, unload: null! });
    }, AssertionError);
    assertThrows(() => {
      new Dependency({ load: () => {}, unload: {} as never });
    }, AssertionError);
  });
});

Deno.test("dependency.value", async (t) => {
  await t.step(
    "should throw an assertion when accessed after the dependency has been revoked",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      const dep = root.link({ key, load: () => {} });

      dep.value;
      root.unlink(key);
      assertThrows(() => {
        dep.value;
      }, AssertionError);
    },
  );

  await t.step(
    "should invoke `init.load()` when `dependency.value` is accessed for the first time",
    () => {
      const load = spy(() => ({}));
      const root = new Dependency({ load });

      assertSpyCalls(load, 0);

      assertStrictEquals(root.value, root.value);
      assertStrictEquals(root.value, load.calls[0].returned);
      assertSpyCalls(load, 1);
      assertSpyCallArgs(load, 0, [root]);
    },
  );

  await t.step(
    "should throw an assertion if the circular reference relationship is not built lazily",
    () => {
      const root = new Dependency({ load: () => 0 });
      const dep1: DependencyDescriptor<unknown, unknown, unknown> = {
        hoist: true,
        key: 1,
        load: (dep) => {
          dep.link(dep2).value;
        },
      };
      const dep2: DependencyDescriptor<unknown, unknown, unknown> = {
        hoist: true,
        key: 2,
        load: (dep) => {
          dep.link(dep1).value;
        },
      };

      assertThrows(() => {
        root.link(dep1).value;
      }, AssertionError);
    },
  );

  await t.step(
    "should throw an assertion if accessed inside `init.load()`",
    () => {
      const root = new Dependency({ load: () => 0 });

      assertThrows(() => {
        root.link({ key: 1, load: (dep) => dep.value }).value;
      }, AssertionError);
    },
  );

  await t.step(
    "should not throw an assertion if the circular reference relationship is built lazily",
    () => {
      const root = new Dependency({ load: () => 0 });
      const dep1: DependencyDescriptor<unknown, unknown, [0, () => number]> = {
        hoist: true,
        key: 1,
        load: (dep) => [0, () => dep.link(dep2).value],
      };
      const dep2: DependencyDescriptor<unknown, unknown, number> = {
        hoist: true,
        key: 2,
        load: (dep) => dep.link(dep1).value[0] + 1,
      };

      assertStrictEquals(root.link(dep1).value[1](), 1);
      assertStrictEquals(root.link(dep2).value, 1);
    },
  );
});

Deno.test("dependency[@@toStringTag]", async (t) => {
  await t.step("should equal `Dependency`", () => {
    const root = new Dependency({ load: () => {} });
    assertStrictEquals(root[Symbol.toStringTag], "Dependency");
    assertStrictEquals(Dependency.prototype[Symbol.toStringTag], "Dependency");
  });
});

Deno.test("dependency.link(descriptor)", async (t) => {
  await t.step(
    "should throw an assertion when invoked after the dependency has been revoked",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      const dep = root.link({ key, load: () => {} });

      dep.link({ key: count(), load: () => {} });
      root.unlink(key);
      assertThrows(() => {
        dep.link({ key: count(), load: () => {} });
      }, AssertionError);
    },
  );

  await t.step(
    "should return the same dependency instance for the same `descriptor.key`",
    () => {
      const root = new Dependency({ load: () => {} });
      const load1 = spy(() => ({}));
      const load2 = spy(() => ({}));
      assertStrictEquals(
        root.link({ key: 1, load: load1 }),
        root.link({ key: 1, load: load2 }),
      );
      assertStrictEquals(
        root.link({ key: 1, load: load1 }).value,
        root.link({ key: 1, load: load2 }).value,
      );
      assertSpyCalls(load1, 1);
      assertSpyCalls(load2, 0);
    },
  );

  await t.step("should throw an error if no hoist target is available", () => {
    const rootScope = count();
    const childScope = NaN;
    const root = new Dependency({ load: () => {}, scope: rootScope });
    const child = root.link({
      key: count(),
      load: () => {},
      scope: childScope,
    });

    root.link({ hoist: true, key: count(), load: () => {} });
    root.link({ hoist: false, key: count(), load: () => {} });
    root.link({
      hoist: { acceptRoot: true, scope: count() },
      key: count(),
      load: () => {},
    });
    root.link({
      hoist: { acceptRoot: false, scope: rootScope },
      key: count(),
      load: () => {},
    });

    child.link({
      hoist: { acceptRoot: false, scope: childScope },
      key: count(),
      load: () => {},
    });

    assertThrows(() => {
      root.link({
        hoist: { acceptRoot: false, scope: count() },
        key: count(),
        load: () => {},
      });
    }, Error);
  });

  await t.step(
    "should return the same hoisted dependency instance for the same `descriptor.key` and `descriptor.hoist`",
    () => {
      const root = new Dependency({ load: () => {}, scope: "root" });
      const depA = root.link({ key: count(), load: () => {}, scope: "a" });
      const depB = root.link({ key: count(), load: () => {}, scope: "b" });
      const descriptor1: DependencyDescriptor<unknown, string, unknown> = {
        hoist: true,
        key: count(),
        load: () => {},
      };
      const descriptor2: DependencyDescriptor<unknown, string, unknown> = {
        hoist: { acceptRoot: false, scope: "root" },
        key: count(),
        load: () => {},
      };
      const descriptor3: DependencyDescriptor<unknown, string, unknown> = {
        hoist: { acceptRoot: true, scope: "" },
        key: count(),
        load: () => {},
      };
      const descriptor4: DependencyDescriptor<unknown, string, unknown> = {
        hoist: false,
        key: count(),
        load: () => {},
      };

      for (const descriptor of [descriptor1, descriptor2, descriptor3]) {
        assertStrictEquals(depA.link(descriptor), depB.link(descriptor));
      }
      assertNotStrictEquals(depA.link(descriptor4), depB.link(descriptor4));
    },
  );
});

Deno.test("dependency.unlink(key)", async (t) => {
  await t.step(
    "should throw an assertion when invoked after the dependency has been revoked",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      const dep = root.link({ key, load: () => {} });

      dep.unlink(count());
      root.unlink(key);
      assertThrows(() => {
        dep.unlink(count());
      }, AssertionError);
    },
  );

  await t.step(
    "should do nothing if no reference record is found for the `key`",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      root.unlink(key);
      assertStrictEquals(root.link({ key, load: () => 1 }).value, 1);
      root.unlink(key);
      assertStrictEquals(root.link({ key, load: () => 2 }).value, 2);
    },
  );

  await t.step("should not revoke the reachable dependency", () => {
    const root = new Dependency({ load: () => {} });
    const keyA = count();
    const keyB = count();
    const loadC = spy(() => ({}));
    const unloadC = spy(() => {});
    const descriptorC: DependencyDescriptor<unknown, unknown, unknown> = {
      hoist: true,
      key: count(),
      load: loadC,
      unload: unloadC,
    };
    const depA = root.link({ key: keyA, load: () => {} });
    const depB = root.link({ key: keyB, load: () => {} });
    const depC = depA.link(descriptorC);

    assertStrictEquals(depC, depB.link(descriptorC));
    assertStrictEquals(depC.value, loadC.calls[0].returned);

    depA.unlink(descriptorC.key);
    assertSpyCalls(unloadC, 0);
    depB.unlink(descriptorC.key);
    assertSpyCalls(unloadC, 1);
  });

  await t.step("should revoke the unreachable dependency", async () => {
    const cleanedToken = new Set<string>();
    const finalization = new FinalizationRegistry<string>((token) => {
      cleanedToken.add(token);
    });
    const root = new Dependency({ load: () => {} });
    const keyB = count();
    const loadA = () => {
      const value = {};
      finalization.register(value, "a");
      return value;
    };
    const loadB = () => {
      const value = {};
      finalization.register(value, "b");
      return value;
    };
    const unloadA = spy(() => {});
    const unloadB = spy(() => {});
    const descriptorA: DependencyDescriptor<unknown, unknown, unknown> = {
      hoist: true,
      key: count(),
      load: loadA,
      unload: unloadA,
    };
    const depA = root.link(descriptorA);
    const depB = depA.link({ key: keyB, load: loadB, unload: unloadB });

    assertStrictEquals(depA, depB.link(descriptorA));
    assert(typeof depA.value === "object");
    assert(typeof depB.value === "object");

    root.unlink(descriptorA.key);
    assertSpyCalls(unloadA, 1);
    assertSpyCalls(unloadB, 1);

    if (typeof gc === "function") {
      unloadA.calls.splice(0);
      unloadB.calls.splice(0);
      await waitGC();
      assert(cleanedToken.has("a"));
      assert(cleanedToken.has("b"));
    }
  });

  await t.step(
    "should invoke `init.unload?.()` after the dependency has been revoked",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      const load = spy(() => ({}));
      const unload = spy(() => {});
      const dep = root.link({ key, load, unload });

      assertSpyCalls(load, 0);
      assertSpyCalls(unload, 0);

      assertStrictEquals(dep.value, load.calls[0].returned);
      assertSpyCalls(load, 1);
      assertSpyCalls(unload, 0);

      root.unlink(key);
      root.unlink(key);
      assertSpyCalls(load, 1);
      assertSpyCalls(unload, 1);
      assertSpyCallArgs(unload, 0, [load.calls[0].returned]);
    },
  );

  await t.step(
    "should delay the execution of `init.unload()` until the dependency collection is completed, " +
      "so as to avoid dependency collection being interrupted by the error thrown by `init.unload()`",
    () => {
      const root = new Dependency({ load: () => {} });
      const keyA = count();
      const keyB = count();
      const unloadA = spy(() => {
        assertThrows(() => {
          depA.value;
        }, AssertionError);
        assertThrows(() => {
          depB.value;
        }, AssertionError);
      });
      const unloadB = spy(() => {
        assertThrows(() => {
          depA.value;
        }, AssertionError);
        assertThrows(() => {
          depB.value;
        }, AssertionError);
      });
      const depA = root.link({ key: keyA, load: () => {}, unload: unloadA });
      const depB = depA.link({ key: keyB, load: () => {}, unload: unloadB });

      depA.value;
      depB.value;

      root.unlink(keyA);
      assertSpyCalls(unloadA, 1);
      assertSpyCalls(unloadB, 1);
    },
  );

  await t.step(
    "should not invoke `init.unload()` if `init.load()` has never been invoked",
    () => {
      const load = spy(() => ({}));
      const unload = spy(() => {});
      const root = new Dependency({ load: () => {} });
      const key = count();
      root.link({ key, load, unload });

      assertSpyCalls(load, 0);
      assertSpyCalls(unload, 0);

      root.unlink(key);
      root.unlink(key);
      assertSpyCalls(load, 0);
      assertSpyCalls(unload, 0);
    },
  );
});

Deno.test("dependency.weaken(key, handle)", async (t) => {
  await t.step(
    "should throw an assertion when invoked after the dependency has been revoked",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      const dep = root.link({ key, load: () => {} });

      dep.weaken(count(), {});
      root.unlink(key);
      assertThrows(() => {
        dep.weaken(count(), {});
      }, AssertionError);
    },
  );

  await t.step(
    "should do nothing if no reference record is found for the `key`",
    () => {
      const root = new Dependency({ load: () => {} });
      const key = count();
      root.weaken(key, {});
      assertStrictEquals(root.link({ key, load: () => 1 }).value, 1);
    },
  );

  if (typeof gc === "function") {
    await t.step(
      "should execute `dependency.unlink(key)` after the last `handle` object has been revoked by GC",
      async () => {
        let handle: WeakDependencyHandle;

        const root = new Dependency({ load: () => {} });
        const key = count();
        const load = spy(() => ({}));
        const unload = spy(() => {});
        const dep1 = root.link({ key, load, unload });
        const unlink = spy(root, "unlink");

        assertStrictEquals(dep1.value, load.calls[0].returned);
        assertSpyCalls(load, 1);
        assertSpyCalls(unload, 0);
        assertSpyCalls(unlink, 0);

        handle = {};
        root.weaken(key, handle);
        handle = {};
        root.weaken(key, handle);
        await waitGC();
        assertSpyCalls(unload, 0);
        assertSpyCalls(unlink, 0);
        assertStrictEquals(root.link({ key, load, unload }), dep1);

        root.weaken(key, null);
        handle = {};
        await waitGC();
        assertSpyCalls(unload, 0);
        assertSpyCalls(unlink, 0);
        assertStrictEquals(root.link({ key, load, unload }), dep1);

        root.weaken(key, handle);
        handle = {};
        await waitGC();
        assertSpyCalls(unload, 1);
        assertSpyCalls(unlink, 1);
        assertNotStrictEquals(root.link({ key, load, unload }), dep1);
      },
    );

    await t.step(
      "should unregister `handle` after the dependency has been revoked manually",
      async () => {
        let handle: WeakDependencyHandle;

        const root = new Dependency({ load: () => {} });
        const [key1, key2] = [count(), count()];
        const [load1, load2] = [spy(() => ({})), spy(() => ({}))];
        const dep1 = root.link({ key: key1, load: load1 });
        const dep2 = dep1.link({ key: key2, load: load2 });
        const unlink0 = spy(root, "unlink");
        const unlink1 = spy(dep1, "unlink");

        assertStrictEquals(dep1.value, load1.calls[0].returned);
        assertStrictEquals(dep2.value, load2.calls[0].returned);
        assertSpyCalls(load1, 1);
        assertSpyCalls(load2, 1);
        assertSpyCalls(unlink0, 0);
        assertSpyCalls(unlink1, 0);

        handle = {};
        root.weaken(key1, handle);
        dep1.weaken(key2, handle);
        root.unlink(key1);
        assertSpyCalls(unlink0, 1);
        assertSpyCalls(unlink1, 0);

        handle = {};
        await waitGC();
        assertSpyCalls(unlink0, 1);
        assertSpyCalls(unlink1, 0);
      },
    );
  }
});

function count(): number {
  const self = count as unknown as { current?: number };
  self.current ||= 0;
  return self.current++;
}

function waitGC(): Promise<void> {
  assert(typeof gc === "function");
  gc();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
