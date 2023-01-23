import { assertSpyCallArgs, assertSpyCalls, spy } from "std/testing/mock.ts";
import {
  assert,
  AssertionError,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "std/testing/asserts.ts";
import type {
  DependencyContainerHost,
  DependencyHost,
  WeakDependencyHandle,
} from "./container.ts";
import { createDependencyContainer, destructor } from "./container.ts";

// 设置 --v8-flags=--expose-gc 即可启用此 API
declare const gc: undefined | (() => void);

class TestRoot {}

abstract class TestCounter {
  #count = 0;
  readonly #host: DependencyHost;

  constructor(host: DependencyHost) {
    this.#host = host;
  }

  get count(): number {
    return this.#count;
  }

  get host(): DependencyHost {
    return this.#host;
  }

  increase(): void {
    this.#count += 1;
  }
}

Deno.test("createDependencyContainer(containerHost)", async (t) => {
  await t.step(
    "should allow `containerHost.createDescriptor(descriptor)` to rewrite any dependency descriptors",
    () => {
      const key = () => {};
      const unload = spy();
      const containerHost = {
        createDescriptor: spy((descriptor) => {
          return ({ ...descriptor, unload });
        }),
      } satisfies DependencyContainerHost;

      const container = createDependencyContainer(containerHost);
      const root = container.createRoot(TestRoot);

      assertSpyCalls(containerHost.createDescriptor, 1);
      root.call(key);
      assertSpyCalls(unload, 0);
      assertSpyCalls(containerHost.createDescriptor, 2);
      root.unlink(key);
      assertSpyCalls(unload, 1);
    },
  );
});

Deno.test("DependencyContainer: container", async (t) => {
  const container = createDependencyContainer({
    createDescriptor: (descriptor) => descriptor,
  });

  await t.step("container.Hoist(scope)", async (t) => {
    await t.step(
      "should return a decorator that configures the `hoist`",
      () => {
        const decorate = container.Hoist(true);
        const root = container.createRoot(TestRoot);

        // 装饰器需要返回经过装饰后的 class 或是 function 以便适应多种写法
        class Noop {}
        assertStrictEquals(decorate(Noop), Noop);

        // 测试装饰器是否可复用
        @decorate
        class CounterA extends TestCounter {}
        @decorate
        class CounterB extends TestCounter {}
        const dep0 = root.call((host) => host.new(CounterA));
        const dep1 = root.call((host) => host.new(CounterA));

        const dep2 = root.call((host) => host.new(CounterB));
        const dep3 = root.call((host) => host.new(CounterB));
        assertStrictEquals(dep0, dep1);
        assertStrictEquals(dep2, dep3);
        assert(dep0 instanceof CounterA && dep2 instanceof CounterB);

        // 外层装饰器执行时机靠后，因此可以覆盖前面的装饰器的配置
        @container.Hoist(false)
        @container.Hoist(true)
        class CounterC extends TestCounter {}
        const dep4 = root.call((host) => host.new(CounterC));
        const dep5 = root.call((host) => host.new(CounterC));
        assertNotStrictEquals(dep4, dep5);
        assert(dep4 instanceof CounterC && dep5 instanceof CounterC);

        // 复杂的 hoist 配置
        @container.Hoist(TestRoot)
        class CounterD extends TestCounter {}
        const dep6 = root.call((host) => host.new(CounterD));
        const dep7 = root.call((host) => host.new(CounterD));
        assertStrictEquals(dep6, dep7);
        assert(dep6 instanceof CounterD && dep7 instanceof CounterD);

        const keyA = (host: DependencyHost) => host.new(CounterE);
        @container.Hoist(keyA)
        class CounterE extends TestCounter {}
        const dep8 = root.call(keyA);
        assertStrictEquals(dep8, dep8.host.new(CounterE));
        assertStrictEquals(dep8, dep8.host.call((host) => host.new(CounterE)));
        assertNotStrictEquals(dep8, root.call((host) => host.new(CounterE)));
      },
    );

    await t.step(
      "should use `true` as the default value for `scope`",
      () => {
        const root = container.createRoot(TestRoot);

        @container.Hoist()
        class CounterA extends TestCounter {}
        assertStrictEquals(
          root.call((host) => host.new(CounterA)),
          root.call((host) => host.new(CounterA)),
        );
      },
    );
  });

  await t.step("container.Scope(scope)", async (t) => {
    await t.step(
      "should return a decorator that configures the `scope`",
      () => {
        const decorate = container.Scope(TestCounter);
        const root = container.createRoot(TestRoot);

        const key = () => ({});
        container.Hoist(TestCounter)(key);

        // 装饰器需要返回经过装饰后的 class 或是 function 以便适应多种写法
        class Noop {}
        assertStrictEquals(decorate(Noop), Noop);

        // 测试装饰器是否可复用
        @decorate
        class CounterA extends TestCounter {}
        @decorate
        class CounterB extends TestCounter {}
        const dep0 = root.call((host) => host.new(CounterA));
        const dep1 = root.call((host) => host.new(CounterB));

        for (const dep of [dep0, dep1]) {
          assertNotStrictEquals(root.call(key), dep.host.call(key));
          assertStrictEquals(
            dep.host.call(key),
            dep.host.call((host) => host.call(key)),
          );
          assertStrictEquals(
            dep.host.call((host) => host.call(key)),
            dep.host.call((host) => host.call(key)),
          );
        }

        // 外层装饰器执行时机靠后，因此可以覆盖前面的装饰器的配置
        @container.Scope(null)
        @container.Scope(TestCounter)
        class CounterC extends TestCounter {}
        const dep2 = root.call((host) => host.new(CounterC));
        // 没有匹配的 scope ，默认 hoist 到 root
        assertStrictEquals(root.call(key), dep2.host.call(key));
        assertStrictEquals(
          dep2.host.call(key),
          dep2.host.call((host) => host.call(key)),
        );
      },
    );
  });

  await t.step("container.createRoot(Root, ...params)", async (t) => {
    await t.step("should create a new `Dependency` instance", () => {
      assertNotStrictEquals(
        container.createRoot(TestRoot),
        container.createRoot(TestRoot),
      );
    });

    await t.step(
      "should not construct `Root` until `deref()` is called",
      () => {
        const Root = spy();
        const root = container.createRoot(
          Root as unknown as (new () => unknown),
        );
        assertSpyCalls(Root, 0);
        assert(root.deref() instanceof Root);
        assertStrictEquals(root.deref(), root.deref());
        assertSpyCalls(Root, 1);
      },
    );
  });
});

Deno.test("DependencyRootHost: root", async (t) => {
  const container = createDependencyContainer({
    createDescriptor: (descriptor) => descriptor,
  });

  await t.step("root.deref()", async (t) => {
    const root = container.createRoot(TestRoot);

    await t.step("should return the instance of `Root`", () => {
      assert(root.deref() instanceof TestRoot);
      assertStrictEquals(root.deref(), root.deref());
    });
  });

  await t.step("root.enforce(key, value)", async (t) => {
    const root = container.createRoot(TestRoot);

    await t.step("should install the dependency with the given `value`", () => {
      @container.Hoist()
      class Counter extends TestCounter {}
      const instance = new Counter(root);

      root.enforce(Counter, instance);
      root.enforce(Counter, instance);
      assertStrictEquals(root.new(Counter), instance);
      assertStrictEquals(root.call((host) => host.new(Counter)), instance);
    });

    await t.step(
      "should throw an assertion if the dependency has already been installed with another value",
      () => {
        class Counter extends TestCounter {}
        const instance = new Counter(root);

        assertNotStrictEquals(root.new(Counter), instance);
        assertStrictEquals(root.new(Counter), root.new(Counter));
        assertThrows(() => {
          root.enforce(Counter, instance);
        }, AssertionError);
        assertNotStrictEquals(root.new(Counter), instance);
      },
    );
  });
});

Deno.test("DependencyHost: host", async (t) => {
  const container = createDependencyContainer({
    createDescriptor: (descriptor) => descriptor,
  });

  await t.step(
    "should throw an assertion when its methods are invoked " +
      "after the dependency has been revoked",
    () => {
      const root = container.createRoot(TestRoot);

      class Counter extends TestCounter {
        static [destructor] = spy((instance: Counter): void => {
          assertThrows(() => {
            instance.host.unlink(() => {});
          }, AssertionError);
          assertThrows(() => {
            instance.host.call(() => {});
          }, AssertionError);
          assertThrows(() => {
            instance.host.new(class extends TestCounter {});
          }, AssertionError);
          assertThrows(() => {
            instance.host.weaken(() => {}, null);
          }, AssertionError);
        });
      }

      root.new(Counter);
      root.unlink(Counter);
      assertSpyCalls(Counter[destructor], 1);
    },
  );

  await t.step("host.call(key, ...params)", async (t) => {
    const root = container.createRoot(TestRoot);

    await t.step(
      "should create a reference to the dependency and return the loaded value",
      () => {
        const key = spy(() => ({}));

        assertStrictEquals(root.call(key), key.calls[0].returned);
        assertStrictEquals(root.call(key), root.call(key));
        assertSpyCalls(key, 1);
      },
    );

    await t.step(
      "should only use the `params` when loading the dependency for the first time",
      () => {
        const callback = spy(() => ({}));
        const key = (_host: unknown, callback: () => unknown) => callback();

        assertStrictEquals(root.call(key, callback), root.call(key, callback));
        assertSpyCalls(callback, 1);
      },
    );

    await t.step("should use the `key` as the default `scope`", () => {
      const parent = (host: DependencyHost) => host;
      const child = container.Hoist(parent)(spy(() => ({})));

      assertStrictEquals(
        root.call(parent).call(child),
        root.call(parent).call((host) => host.call(child)),
      );
      assertSpyCalls(child, 1);

      assertNotStrictEquals(root.call(child), root.call(parent).call(child));
      assertSpyCalls(child, 2);
    });

    await t.step(
      "should use the `key[destructor]` as the `descriptor.unload` " +
        "that will be invoked after the dependency has been revoked",
      () => {
        const key = Object.assign(() => ({}), { [destructor]: spy() });

        const value = root.call(key);
        assertSpyCalls(key[destructor], 0);

        root.unlink(key);
        assertSpyCalls(key[destructor], 1);
        assertSpyCallArgs(key[destructor], 0, [value]);

        assertNotStrictEquals(root.call(key), value);
      },
    );
  });

  await t.step("host.new(key, ...params)", async (t) => {
    const root = container.createRoot(TestRoot);

    await t.step(
      "should create a reference to the dependency and return the loaded value",
      () => {
        class Counter extends TestCounter {}
        assertStrictEquals(root.new(Counter), root.new(Counter));
      },
    );

    await t.step(
      "should only use the `params` when loading the dependency for the first time",
      () => {
        const callback = spy(() => ({}));
        class Counter extends TestCounter {
          constructor(host: DependencyHost, callback: () => void) {
            super(host);
            callback();
          }
        }

        assertStrictEquals(
          root.new(Counter, callback),
          root.new(Counter, callback),
        );
        assertSpyCalls(callback, 1);
      },
    );

    await t.step("should use the `key` as the default `scope`", () => {
      class parent extends TestCounter {}
      const child = container.Hoist(parent)(spy(() => ({})));

      assertStrictEquals(
        root.new(parent).host.call(child),
        root.new(parent).host.call((host) => host.call(child)),
      );
      assertSpyCalls(child, 1);

      assertNotStrictEquals(
        root.call(child),
        root.new(parent).host.call(child),
      );
      assertSpyCalls(child, 2);
    });

    await t.step(
      "should use the `key[destructor]` as the `descriptor.unload` " +
        "that will be invoked after the dependency has been revoked",
      () => {
        class key extends TestCounter {
          static [destructor] = spy();
        }

        const instance = root.new(key);
        assert(instance instanceof key);
        assertSpyCalls(key[destructor], 0);

        root.unlink(key);
        assertSpyCalls(key[destructor], 1);
        assertSpyCallArgs(key[destructor], 0, [instance]);

        assertNotStrictEquals(root.new(key), instance);
      },
    );
  });

  await t.step("host.unlink(key)", async (t) => {
    const root = container.createRoot(TestRoot);

    await t.step(
      "should do nothing if no reference record is found for the `key`",
      () => {
        root.unlink(() => {});
      },
    );

    await t.step(
      "should invoke the destructor after the dependency has been revoked",
      () => {
        const key = Object.assign(() => ({}), { [destructor]: spy() });

        const value = root.call(key);
        assertSpyCalls(key[destructor], 0);

        root.unlink(key);
        assertSpyCalls(key[destructor], 1);
        root.unlink(key);
        assertSpyCalls(key[destructor], 1);

        assertNotStrictEquals(root.call(key), value);
        assertSpyCalls(key[destructor], 1);

        root.unlink(key);
        assertSpyCalls(key[destructor], 2);
      },
    );
  });

  await t.step("host.weaken(key, handle)", async (t) => {
    const root = container.createRoot(TestRoot);

    if (typeof gc === "function") {
      await t.step(
        "should unlink the dependency after the `handle` object has been revoked by GC",
        async () => {
          let handle: WeakDependencyHandle;

          const key = () => ({});
          const value = root.call(key);

          handle = {};
          root.weaken(key, handle);
          handle = {};
          await waitGC();

          assertNotStrictEquals(root.call(key), value);
          assertStrictEquals(root.call(key), root.call(key));
        },
      );
    }
  });
});

function waitGC(): Promise<void> {
  assert(typeof gc === "function");
  gc();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
