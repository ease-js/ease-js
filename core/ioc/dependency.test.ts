import { asserts } from "../deps.ts";
import { mock } from "../dev-deps.ts";

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

    asserts.assertThrows(() => {
      new Dependency({ load: null! });
    }, asserts.AssertionError);
  });

  await t.step("should assert `init.unload` is undefined or a function", () => {
    new Dependency({ load: () => {}, unload: () => {} });
    new Dependency({ load: () => {}, unload: undefined });

    asserts.assertThrows(() => {
      new Dependency({ load: () => {}, unload: null! });
    }, asserts.AssertionError);
    asserts.assertThrows(() => {
      new Dependency({ load: () => {}, unload: {} as never });
    }, asserts.AssertionError);
  });

  await t.step("dependency.value", async (t) => {
    await t.step(
      "should throw an assertion when accessed after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const dep = root.link({ key, load: () => {} });

        dep.value;
        root.unlink(key);
        asserts.assertThrows(() => {
          dep.value;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should invoke `init.load()` when `dependency.value` is accessed for the first time",
      () => {
        const load = mock.spy(() => ({}));
        const root = new Dependency({ load });

        mock.assertSpyCalls(load, 0);

        asserts.assertStrictEquals(root.value, root.value);
        asserts.assertStrictEquals(root.value, load.calls[0].returned);
        mock.assertSpyCalls(load, 1);
        mock.assertSpyCallArgs(load, 0, [root]);
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

        asserts.assertThrows(() => {
          root.link(dep1).value;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if accessed inside `init.load()`",
      () => {
        const root = new Dependency({ load: () => 0 });

        asserts.assertThrows(() => {
          root.link({ key: 1, load: (dep) => dep.value }).value;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should not throw an assertion if the circular reference relationship is built lazily",
      () => {
        const root = new Dependency({ load: () => 0 });
        const dep1: DependencyDescriptor<unknown, unknown, [0, () => number]> =
          {
            hoist: true,
            key: 1,
            load: (dep) => [0, () => dep.link(dep2).value],
          };
        const dep2: DependencyDescriptor<unknown, unknown, number> = {
          hoist: true,
          key: 2,
          load: (dep) => dep.link(dep1).value[0] + 1,
        };

        asserts.assertStrictEquals(root.link(dep1).value[1](), 1);
        asserts.assertStrictEquals(root.link(dep2).value, 1);
      },
    );
  });

  await t.step("dependency[@@toStringTag]", async (t) => {
    await t.step("should equal `'Dependency'`", () => {
      const root = new Dependency({ load: () => {} });
      asserts.assertStrictEquals(root[Symbol.toStringTag], "Dependency");
      asserts.assertStrictEquals(
        Dependency.prototype[Symbol.toStringTag],
        "Dependency",
      );
    });
  });

  await t.step("dependency.link(descriptor)", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const dep = root.link({ key, load: () => {} });

        dep.link({ key: count(), load: () => {} });
        root.unlink(key);
        asserts.assertThrows(() => {
          dep.link({ key: count(), load: () => {} });
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should return the same dependency instance for the same `descriptor.key`",
      () => {
        const root = new Dependency({ load: () => {} });
        const load1 = mock.spy(() => ({}));
        const load2 = mock.spy(() => ({}));
        asserts.assertStrictEquals(
          root.link({ key: 1, load: load1 }),
          root.link({ key: 1, load: load2 }),
        );
        asserts.assertStrictEquals(
          root.link({ key: 1, load: load1 }).value,
          root.link({ key: 1, load: load2 }).value,
        );
        mock.assertSpyCalls(load1, 1);
        mock.assertSpyCalls(load2, 0);
      },
    );

    await t.step(
      "should throw an error if no hoist target is available",
      () => {
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

        asserts.assertThrows(() => {
          root.link({
            hoist: { acceptRoot: false, scope: count() },
            key: count(),
            load: () => {},
          });
        }, Error);
      },
    );

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
          asserts.assertStrictEquals(
            depA.link(descriptor),
            depB.link(descriptor),
          );
        }
        asserts.assertNotStrictEquals(
          depA.link(descriptor4),
          depB.link(descriptor4),
        );
      },
    );
  });

  await t.step("dependency.unlink(...keys)", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const dep = root.link({ key, load: () => {} });

        dep.unlink(count());
        root.unlink(key);
        asserts.assertThrows(() => {
          dep.unlink(count());
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should do nothing if no reference record is found for the `key`",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        root.unlink(key);
        asserts.assertStrictEquals(root.link({ key, load: () => 1 }).value, 1);
        root.unlink(key);
        asserts.assertStrictEquals(root.link({ key, load: () => 2 }).value, 2);
      },
    );

    await t.step("should not revoke the reachable dependency", () => {
      const root = new Dependency({ load: () => {} });
      const keyA = count();
      const keyB = count();
      const loadC = mock.spy(() => ({}));
      const unloadC = mock.spy(() => {});
      const descriptorC: DependencyDescriptor<unknown, unknown, unknown> = {
        hoist: true,
        key: count(),
        load: loadC,
        unload: unloadC,
      };
      const depA = root.link({ key: keyA, load: () => {} });
      const depB = root.link({ key: keyB, load: () => {} });
      const depC = depA.link(descriptorC);

      asserts.assertStrictEquals(depC, depB.link(descriptorC));
      asserts.assertStrictEquals(depC.value, loadC.calls[0].returned);

      depA.unlink(descriptorC.key);
      mock.assertSpyCalls(unloadC, 0);
      depB.unlink(descriptorC.key);
      mock.assertSpyCalls(unloadC, 1);
    });

    await t.step("should revoke the unreachable dependency", async () => {
      const cleanedToken = new Set<string>();
      const finalization = new FinalizationRegistry<string>((token) => {
        cleanedToken.add(token);
      });
      const root = new Dependency({ load: () => {} });
      const keyB = count();
      const keyC = count();
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
      const loadC = () => {
        const value = {};
        finalization.register(value, "c");
        return value;
      };
      const unloadA = mock.spy(() => {});
      const unloadB = mock.spy(() => {});
      const unloadC = mock.spy(() => {});
      const descriptorA: DependencyDescriptor<unknown, unknown, unknown> = {
        hoist: true,
        key: count(),
        load: loadA,
        unload: unloadA,
      };
      const depA = root.link(descriptorA);
      const depB = depA.link({ key: keyB, load: loadB, unload: unloadB });
      const depC = root.link({ key: keyC, load: loadC, unload: unloadC });

      asserts.assertStrictEquals(depA, depB.link(descriptorA));
      asserts.assert(typeof depA.value === "object");
      asserts.assert(typeof depB.value === "object");
      asserts.assert(typeof depC.value === "object");

      root.unlink(descriptorA.key, keyC);
      mock.assertSpyCalls(unloadA, 1);
      mock.assertSpyCalls(unloadB, 1);
      mock.assertSpyCalls(unloadC, 1);

      if (typeof gc === "function") {
        unloadA.calls.splice(0);
        unloadB.calls.splice(0);
        unloadC.calls.splice(0);
        await waitGC();
        asserts.assert(cleanedToken.has("a"));
        asserts.assert(cleanedToken.has("b"));
        asserts.assert(cleanedToken.has("c"));
      }
    });

    await t.step(
      "should invoke `init.unload?.()` after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const load = mock.spy(() => ({}));
        const unload = mock.spy(() => {});
        const dep = root.link({ key, load, unload });

        mock.assertSpyCalls(load, 0);
        mock.assertSpyCalls(unload, 0);

        asserts.assertStrictEquals(dep.value, load.calls[0].returned);
        mock.assertSpyCalls(load, 1);
        mock.assertSpyCalls(unload, 0);

        root.unlink(key);
        root.unlink(key);
        mock.assertSpyCalls(load, 1);
        mock.assertSpyCalls(unload, 1);
        mock.assertSpyCallArgs(unload, 0, [load.calls[0].returned]);
      },
    );

    await t.step(
      "should delay the execution of `init.unload()` until the dependency collection is completed, " +
        "so as to avoid dependency collection being interrupted by the error thrown by `init.unload()`",
      () => {
        const root = new Dependency({ load: () => {} });
        const keyA = count();
        const keyB = count();
        const unloadA = mock.spy(() => {
          asserts.assertThrows(() => {
            depA.value;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            depB.value;
          }, asserts.AssertionError);
        });
        const unloadB = mock.spy(() => {
          asserts.assertThrows(() => {
            depA.value;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            depB.value;
          }, asserts.AssertionError);
        });
        const depA = root.link({ key: keyA, load: () => {}, unload: unloadA });
        const depB = root.link({ key: keyB, load: () => {}, unload: unloadB });

        depA.value;
        depB.value;

        root.unlink(keyA, keyB);
        mock.assertSpyCalls(unloadA, 1);
        mock.assertSpyCalls(unloadB, 1);
      },
    );

    await t.step(
      "should not invoke `init.unload()` if `init.load()` has never been invoked",
      () => {
        const load = mock.spy(() => ({}));
        const unload = mock.spy(() => {});
        const root = new Dependency({ load: () => {} });
        const key = count();
        root.link({ key, load, unload });

        mock.assertSpyCalls(load, 0);
        mock.assertSpyCalls(unload, 0);

        root.unlink(key);
        root.unlink(key);
        mock.assertSpyCalls(load, 0);
        mock.assertSpyCalls(unload, 0);
      },
    );
  });

  await t.step("dependency.unlinkAll()", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const dep = root.link({ key, load: () => {} });

        dep.unlinkAll();
        root.unlinkAll();
        asserts.assertThrows(() => {
          dep.unlinkAll();
        }, asserts.AssertionError);
      },
    );

    await t.step("should do nothing if no reference exists", () => {
      const key = count();
      const root = new Dependency({ load: () => {} });
      root.unlinkAll();
      asserts.assertStrictEquals(root.link({ key, load: () => 1 }).value, 1);
      root.unlinkAll();
      asserts.assertStrictEquals(root.link({ key, load: () => 2 }).value, 2);
    });

    await t.step(
      "should revoke all of the unreachable dependencies",
      async () => {
        const cleanedToken = new Set<string>();
        const finalization = new FinalizationRegistry<string>((token) => {
          cleanedToken.add(token);
        });
        const root = new Dependency({ load: () => {} });
        const keyB = count();
        const keyC = count();
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
        const loadC = () => {
          const value = {};
          finalization.register(value, "c");
          return value;
        };
        const unloadA = mock.spy(() => {});
        const unloadB = mock.spy(() => {});
        const unloadC = mock.spy(() => {});
        const descriptorA: DependencyDescriptor<unknown, unknown, unknown> = {
          hoist: true,
          key: count(),
          load: loadA,
          unload: unloadA,
        };
        const depA = root.link(descriptorA);
        const depB = root.link({ key: keyB, load: loadB, unload: unloadB });
        const depC = depB.link({ key: keyC, load: loadC, unload: unloadC });

        asserts.assertStrictEquals(depA, depB.link(descriptorA));
        asserts.assert(typeof depA.value === "object");
        asserts.assert(typeof depB.value === "object");
        asserts.assert(typeof depC.value === "object");

        depB.unlinkAll();
        mock.assertSpyCalls(unloadA, 0);
        mock.assertSpyCalls(unloadB, 0);
        mock.assertSpyCalls(unloadC, 1);

        if (typeof gc === "function") {
          unloadA.calls.splice(0);
          unloadB.calls.splice(0);
          unloadC.calls.splice(0);
          await waitGC();
          asserts.assertFalse(cleanedToken.has("a"));
          asserts.assertFalse(cleanedToken.has("b"));
          asserts.assert(cleanedToken.has("c"));
        }
      },
    );

    await t.step(
      "should invoke `init.unload?.()` after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const load = mock.spy(() => ({}));
        const unload = mock.spy(() => {});
        const dep = root.link({ key, load, unload });

        mock.assertSpyCalls(load, 0);
        mock.assertSpyCalls(unload, 0);

        asserts.assertStrictEquals(dep.value, load.calls[0].returned);
        mock.assertSpyCalls(load, 1);
        mock.assertSpyCalls(unload, 0);

        root.unlinkAll();
        root.unlinkAll();
        mock.assertSpyCalls(load, 1);
        mock.assertSpyCalls(unload, 1);
        mock.assertSpyCallArgs(unload, 0, [load.calls[0].returned]);
      },
    );

    await t.step(
      "should delay the execution of `init.unload()` until the dependency collection is completed, " +
        "so as to avoid dependency collection being interrupted by the error thrown by `init.unload()`",
      () => {
        const root = new Dependency({ load: () => {} });
        const keyA = count();
        const keyB = count();
        const unloadA = mock.spy(() => {
          asserts.assertThrows(() => {
            depA.value;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            depB.value;
          }, asserts.AssertionError);
        });
        const unloadB = mock.spy(() => {
          asserts.assertThrows(() => {
            depA.value;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            depB.value;
          }, asserts.AssertionError);
        });
        const depA = root.link({ key: keyA, load: () => {}, unload: unloadA });
        const depB = root.link({ key: keyB, load: () => {}, unload: unloadB });

        depA.value;
        depB.value;

        root.unlinkAll();
        mock.assertSpyCalls(unloadA, 1);
        mock.assertSpyCalls(unloadB, 1);
      },
    );

    await t.step(
      "should not invoke `init.unload()` if `init.load()` has never been invoked",
      () => {
        const load = mock.spy(() => ({}));
        const unload = mock.spy(() => {});
        const root = new Dependency({ load: () => {} });
        const key = count();
        root.link({ key, load, unload });

        mock.assertSpyCalls(load, 0);
        mock.assertSpyCalls(unload, 0);

        root.unlinkAll();
        root.unlinkAll();
        mock.assertSpyCalls(load, 0);
        mock.assertSpyCalls(unload, 0);
      },
    );
  });

  await t.step("dependency.weaken(key, handle)", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the dependency has been revoked",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        const dep = root.link({ key, load: () => {} });

        dep.weaken(count(), {});
        root.unlink(key);
        asserts.assertThrows(() => {
          dep.weaken(count(), {});
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should do nothing if no reference record is found for the `key`",
      () => {
        const root = new Dependency({ load: () => {} });
        const key = count();
        root.weaken(key, {});
        asserts.assertStrictEquals(root.link({ key, load: () => 1 }).value, 1);
      },
    );

    if (typeof gc === "function") {
      await t.step(
        "should execute `dependency.unlink(key)` after the last `handle` object has been revoked by GC",
        async () => {
          let handle: WeakDependencyHandle;

          const root = new Dependency({ load: () => {} });
          const key = count();
          const load = mock.spy(() => ({}));
          const unload = mock.spy(() => {});
          const dep1 = root.link({ key, load, unload });
          const unlink = mock.spy(root, "unlink");

          asserts.assertStrictEquals(dep1.value, load.calls[0].returned);
          mock.assertSpyCalls(load, 1);
          mock.assertSpyCalls(unload, 0);
          mock.assertSpyCalls(unlink, 0);

          handle = {};
          root.weaken(key, handle);
          handle = {};
          root.weaken(key, handle);
          await waitGC();
          mock.assertSpyCalls(unload, 0);
          mock.assertSpyCalls(unlink, 0);
          asserts.assertStrictEquals(root.link({ key, load, unload }), dep1);

          root.weaken(key, null);
          handle = {};
          await waitGC();
          mock.assertSpyCalls(unload, 0);
          mock.assertSpyCalls(unlink, 0);
          asserts.assertStrictEquals(root.link({ key, load, unload }), dep1);

          root.weaken(key, handle);
          handle = {};
          await waitGC();
          mock.assertSpyCalls(unload, 1);
          mock.assertSpyCalls(unlink, 1);
          asserts.assertNotStrictEquals(root.link({ key, load, unload }), dep1);
        },
      );

      await t.step(
        "should unregister `handle` after the dependency has been revoked manually",
        async () => {
          let handle: WeakDependencyHandle;

          const root = new Dependency({ load: () => {} });
          const [key1, key2] = [count(), count()];
          const [load1, load2] = [mock.spy(() => ({})), mock.spy(() => ({}))];
          const dep1 = root.link({ key: key1, load: load1 });
          const dep2 = dep1.link({ key: key2, load: load2 });
          const unlink0 = mock.spy(root, "unlink");
          const unlink1 = mock.spy(dep1, "unlink");

          asserts.assertStrictEquals(dep1.value, load1.calls[0].returned);
          asserts.assertStrictEquals(dep2.value, load2.calls[0].returned);
          mock.assertSpyCalls(load1, 1);
          mock.assertSpyCalls(load2, 1);
          mock.assertSpyCalls(unlink0, 0);
          mock.assertSpyCalls(unlink1, 0);

          handle = {};
          root.weaken(key1, handle);
          dep1.weaken(key2, handle);
          root.unlink(key1);
          mock.assertSpyCalls(unlink0, 1);
          mock.assertSpyCalls(unlink1, 0);

          handle = {};
          await waitGC();
          mock.assertSpyCalls(unlink0, 1);
          mock.assertSpyCalls(unlink1, 0);
        },
      );
    }
  });
});

function count(): number {
  const self = count as unknown as { current?: number };
  self.current ||= 0;
  return self.current++;
}

function waitGC(): Promise<void> {
  asserts.assert(typeof gc === "function");
  gc();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
