import { asserts } from "./core/deps.ts";
import * as mod from "./core.ts";

class TestRoot {}

abstract class TestCounter {
  #count = 0;
  readonly #host: mod.DependencyHost;

  constructor(host: mod.DependencyHost) {
    this.#host = host;
  }

  get count(): number {
    return this.#count;
  }

  get host(): mod.DependencyHost {
    return this.#host;
  }

  increase(): void {
    this.#count += 1;
  }
}

Deno.test("module: core.ts", () => {
  asserts.assert("container" in mod);
  asserts.assert("createDependencyContainer" in mod);
  asserts.assert("destructor" in mod);
});

Deno.test("container", async (t) => {
  await t.step("should not rewrite the descriptor", () => {
    const root = mod.container.createRoot(TestRoot);

    @mod.container.Hoist()
    @mod.container.Scope(TestCounter)
    class Counter extends TestCounter {}

    @mod.container.Hoist(TestCounter)
    class ChildA extends TestCounter {}
    class ChildB extends TestCounter {}

    const counter1 = root.call((host) => host.new(Counter));
    const counter2 = root.call((host) => host.new(Counter));

    // 不改写依赖提升规则
    asserts.assertStrictEquals(counter1, counter2);
    asserts.assertStrictEquals(counter1, root.new(Counter));

    // 不改写依赖 Scope
    asserts.assertStrictEquals(
      counter1.host.new(ChildA),
      counter1.host.new(ChildB).host.new(ChildA),
    );

    // 默认不提升依赖
    asserts.assertNotStrictEquals(counter1.host.new(ChildB), root.new(ChildB));
  });
});
