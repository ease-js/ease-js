/**
 * # 依赖的创建、回收与引用
 *
 * 此模块实现了通用的 `class Dependency` 用于描述与管理程序的依赖关系。
 *
 * ## 简介
 *
 * Dependency 中同时储存了挂载树与引用关系两套数据，**挂载树以树的形式描述了节点实际的挂载结构，
 * 而引用关系以有向图的形式描述了节点的依赖关系**。
 *
 * 简单情况下，不需要共享依赖时，依赖的引用关系应当和挂载树同构，例如：
 *
 * ```plain
 *  ROOT
 *  /  \
 * A    B
 * ```
 *
 * 当存在共享依赖时，依赖的引用关系会复杂一些，例如下方示例中，左侧是挂载树、右侧是引用关系：
 *
 * ```plain
 *   RO_OT          RO_OT
 *  /  |  \         ↙   ↘
 * A   C   B       A     B
 *                  ↘   ↙
 *                    C
 * ```
 *
 * 上面的例子比较抽象，我们将它转换成具体的例子：可以假设 ROOT 为 JS 服务端程序的一个 Controller
 * 实例，而 A B C 均为 Services ，按右侧的引用关系解释则是 Controller 引用了 Service A
 * 与 B 、而 Service A 与 B 在 Controller 存活期间共享了 Service C 。假如 Service C
 * 不共享，则是下图所示的挂载树与引用关系：
 *
 * ```plain
 *  RO_OT           RO_OT
 *  /   \           ↙   ↘
 * A     B         A     B
 * |     |         ↓     ↓
 * C1    C2        C1    C2
 * ```
 *
 * ## 术语约定
 *
 * ```plain
 *   RO_OT          RO_OT
 *  /  |  \         ↙   ↘
 * A   C   B       A     B
 *                  ↘   ↙
 *                    C
 * ```
 *
 * 以上图为例，我们有如下说法：
 *
 * - 对于左侧的挂载树：
 *   - ROOT 是挂载树的_根节点_；
 *   - ROOT 是 A / B / C 的_祖先节点_，同时也是它们的_父节点_；
 *     <br>⇔ A / B / C 是 ROOT 的_后代节点_，同时也是它的_子节点_；
 *   - ROOT _安装_了 A 和 B ；
 *   - A / B 将共享依赖 C _安装_在了 ROOT 下；
 *   - A 与 B 可在 ROOT _范围_下共享依赖 C ；
 * - 对于右侧的引用关系：
 *   - ROOT _引用_了 A 和 B ；
 *     <br>⇔ ROOT _依赖_了 A 和 B ；
 *     <br>⇔ ROOT 有两个_依赖项_ A 和 B ；
 *     <br>⇔ A / B 存在一个_依赖方_ ROOT ；
 *   - A / B _引用_了 C ；
 *     <br>⇔ A / B _依赖_了 C ；
 *     <br>⇔ A / B 有一个_依赖项_ C ；
 *     <br>⇔ C 存在两个_依赖方_ A 和 B ；
 *
 * 此外，引用关系图中出现_回路_时，也可具体称为出现_循环依赖_。
 *
 * ## 用法与限制
 *
 * 当你通过 `new Dependency(init)` 创建一个 Dependency 实例时，此实例一定是挂载树的根节点；换句话说，你无法通过
 * `new Dependency(init)` 创建子依赖之后连通到已经存在的挂载树与引用关系图中，这是为了确保
 * Dependency 实例的内部数据具备充足的安全性，保障内部依赖回收机制不会轻易受到外界影响。
 *
 * Dependency 提供了 `link()` 与 `unlink()` 两个公共方法分别用于添加与删除依赖的引用关系，
 * Dependency 将在这两个方法内部自动完成依赖的加载与回收。由于每一个新增的子依赖都由一个新的
 * Dependency 实例来表示，由此可构建出一个树状的结构，用于描述与管理你的程序的依赖关系。
 *
 * ### 描述依赖
 *
 * 调用 `parent.link(descriptor)` 添加引用关系时，需要传入一个描述依赖信息的对象
 * `descriptor` ，其类型为 `interface DependencyDescriptor` ，它存在 `key` 与 `load`
 * 两个必传字段，分别用于标识依赖与加载提供外界使用的值：
 *
 * - 拥有相同 `key` 值的 `descriptor` 总是描述同一个依赖，因此在创建依赖之后，依然可以重复调用
 *   `link(descriptor)` 拿到先前创建的实例——只要 `key` 相同就行。
 * - 依赖创建后，不会立即调用 `load()` ，只有当外界首次访问 `child.value` 时，才会调用一次
 *   `load()` 并保存其返回内容，直至 `child` 被回收销毁。当 `child` 被回收之后，如果
 *   `descriptor` 中存在 `unload` 字段，那么此时 `unload(child.value)`
 *   会被调用，因此如果有需要，你可以将副作用的清理逻辑放在此函数中。
 *
 * ### 共享依赖
 *
 * `interface DependencyDescriptor` 存在一个可选的 `hoist` 字段，此字段决定了依赖的查找与安装策略：
 *
 * - 默认情况下， `hoist` 为非真值，调用 `link(descriptor)` 总是会将依赖安装在当前节点下、不会与其他节点共享。
 * - 当 `hoist` 配置为 `true` 时，调用 `link(descriptor)` 总是会从根节点中以 `key`
 *   为标识符查找是否存在已经安装的依赖，如果不存在则在根节点上安装此依赖，最后在当前节点创建一条引用记录。
 * - 当 `hoist` 配置为 `interface DependencyHoistConfig` ，情况稍微复杂一些。调用
 *   `link(descriptor)` 会从当前节点开始向上查找 `scope` 与 `hoist.scope`
 *   匹配的祖先节点（含当前节点）：
 *   - 如果存在符合条件的祖先节点，则将依赖安装在此祖先节点上，然后在当前节点创建一条引用记录。
 *   - 如果不存在符合条件的节点，并且没有关闭 `hoist.acceptRoot` ，则将依赖安装在根节点，然后在当前节点创建一条引用记录。
 *   - 如果不存在符合条件的节点，并且 `hoist.acceptRoot` 配置为 `false` ，则将抛出错误。
 *
 * 需要注意的是，安装与引用不是一回事。例如下图中，左侧是挂载树、右侧是引用关系， A 与 B 引用了共享依赖
 * C ，但是 C 被安装在 ROOT 下；当 A 与 B 均解除了对 C 的引用关系时， C 将被自动从 ROOT 上移除。
 *
 * ```plain
 *   RO_OT          RO_OT
 *  /  |  \         ↙   ↘
 * A   C   B       A     B
 *                  ↘   ↙
 *                    C
 * ```
 *
 * ### 回收依赖
 *
 * 对于非共享依赖， `unlink(key)` 即可回收依赖以及间接依赖；对于共享依赖，则会稍微复杂一些。
 *
 * 我们同样以引用关系图来描述共享依赖的回收过程。首先，这里有一个简单的依赖关系图，其中 ROOT
 * 引用了 A 和 B 、而 A 和 B 引用了 C ：
 *
 * ```plain
 *  RO_OT
 *  ↙   ↘
 * A     B
 *  ↘   ↙
 *    C
 * ```
 *
 * - 当 ROOT → A 的引用关系被解除后，**不存在 ROOT 到 A 的通路**，此时我们称 A 是_不可达_的，
 *   A 将会被回收、所有以 A 为起始顶点的边（引用关系）将会被删除：
 *
 * ```plain
 *  RO_OT     👉     RO_OT
 *      ↘     👉         ↘
 * ~A    B    👉          B
 *  ↘   ↙     👉         ↙
 *    C       👉       C
 * ```
 *
 * - 在上图基础之上，当 ROOT → B 的引用关系被解除后，**不存在 ROOT 到 B 的通路、也不存在
 *   ROOT 到 C 的通路**，因此 B 和 C 都将会被回收：
 *
 * ```plain
 *  RO_OT     👉     RO_OT
 *            👉
 *      ~B    👉
 *      ↙     👉
 *    C       👉
 * ```
 *
 * 采用上述策略后，即使引用关系出现循环依赖，也可以正常回收。
 *
 * ```plain
 *  RO_OT     👉     RO_OT     👉     RO_OT
 *      ↘     👉               👉
 * A  ←  B    👉    A  ← ~B    👉
 *  ↘   ↗     👉     ↘   ↗     👉
 *    C       👉       C       👉
 * ```
 *
 * ### 弱引用依赖
 *
 * 当需要配合其他已有框架运作时，依赖的控制权可能不全在我们手中，因此我们额外提供了
 * `weaken(key, handle)` 方法，允许将已安装依赖的控制权通过 `handle` 转移到外部。我们将借助
 * [FinalizationRegistry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry)
 * 监听 `handle` 的回收情况，一旦 `handle` 被 GC 回收，那么 `key` 对应的依赖也将会被回收。
 *
 * 以 React 为例，我们可以创建一个空白对象 `handle` ，将其托管给 React 储存，一旦 `handle`
 * 被 React 释放，对应的依赖也将被我们回收：
 *
 * ```ts
 * const root = new Dependency(...);
 * const DemoDescriptor = { ... };
 *
 * export function useWeakDependency() {
 *   const [handle] = React.useState((): DependencyWeakReferenceHandle => ({}));
 *   const [dependency] = React.useState(() => {
 *     const instance = root.link(DemoDescriptor);
 *     root.weaken(DemoDescriptor.key, handle);
 *     return instance;
 *   });
 *   return dependency;
 * }
 * ```
 *
 * @module
 */

import { asserts } from "../deps.ts";
import { emplaceMap } from "../tools/emplace.ts";
import { revoke } from "../tools/revocable.ts";

// 特殊的 scope 类型，与 TypeScript 的 never 类似
const NeverScope = Symbol("NeverScope");

/**
 * 对一项依赖的描述，相对于仅包含依赖自身信息的 {@link DependencyInit} ，此接口还包含
 * {@link DependencyDescriptor.hoist|hoist} 等与外部关系的限制条件的描述。
 */
export interface DependencyDescriptor<Key, Scope, Value = unknown>
  extends DependencyInit<Key, Scope, Value> {
  /**
   * 此依赖被安装时的提升规则。配置为 `true` 则提升到根节点；不配置此选项、或者传入 `false`
   * 则不会被提升，也就无法被共享。
   */
  readonly hoist?: DependencyHoistConfig<Scope> | boolean;
  /**
   * 当前依赖的唯一标识。
   */
  readonly key: Key;
}

/**
 * 依赖被安装时的提升规则，只有被提升安装的依赖才能被共享。
 */
export interface DependencyHoistConfig<Scope> {
  /**
   * 当此依赖被安装时，如果指定的提升范围 {@link scope} 不存在，是否接受提升到根节点。
   *
   * @default true
   */
  readonly acceptRoot?: boolean;
  /**
   * 当此依赖被安装时，应当提升到哪个范围下。
   */
  readonly scope: Scope;
}

/**
 * 创建一项依赖所需的初始配置。
 */
export interface DependencyInit<Key, Scope, Value = unknown> {
  /**
   * 当前节点保存的具有实际使用价值的内容，提供给引用此依赖的其他依赖使用。只有首次访问
   * {@link Dependency.value} 时会调用此函数进行创建。
   */
  readonly load: (dependency: Dependency<Key, Scope, Value>) => Value;
  /**
   * 当前节点的依赖共享范围的句柄。假如后代依赖想要在此节点共享依赖，则需要指定同一个
   * {@link DependencyHoistConfig.scope|scope} 取值才能成功安装在此节点下。
   *
   * @description
   * 对于非根节点的依赖，不配置此项、或者传入 `null` 与 `undefined` 则不允许任何共享依赖安装在此处。
   */
  readonly scope?: Scope | null;
  /**
   * 当前节点被回收后，调用此函数进行清理。如果 {@link load|load()} 未曾被调用，则不会执行
   * {@link unload|unload()} 。
   */
  readonly unload?: (value: Value) => void;
}

/**
 * 弱引用关系的句柄。
 */
// deno-lint-ignore ban-types
export type DependencyWeakReferenceHandle = object;

/**
 * 用于管理依赖关系的通用类。
 */
export class Dependency<Key, Scope, Value = unknown> {
  /**
   * 安装在当前节点的依赖。
   */
  #children: Map<Key, Dependency<Key, Scope>> | undefined;
  /**
   * 当前节点的父节点，以及在父节点中的索引。
   */
  #parent: readonly [instance: Dependency<Key, Scope>, key: Key] | undefined;
  /**
   * 当前节点引用的依赖。
   */
  #references: Map<Key, Dependency<Key, Scope>> | undefined;
  /**
   * 当前节点被引用的位置。
   */
  #referrers: Set<Dependency<Key, Scope>> | undefined;
  /**
   * 当前节点的 {@link DependencyInit.scope|scope} ，用于后代节点选择共享依赖的边界范围。
   */
  #scope: Scope | typeof NeverScope;
  /**
   * 当前节点保存的值。
   */
  #value: { (): Value; unload?: () => void } | undefined;
  /**
   * 弱引用依赖的注册中心。
   */
  #weak: FinalizationRegistry<Key> | undefined;

  constructor(init: DependencyInit<Key, Scope, Value>) {
    const { load, scope, unload } = init;
    asserts.assert(typeof load === "function");
    asserts.assert(unload === undefined || typeof unload === "function");

    this.#scope = scope ?? NeverScope;
    this.#value = () => {
      // 在调用 this.#value() 的过程中，再次访问 dependency.value 不会重复调用此函数
      this.#value = undefined;
      const value = load(this);
      this.#value = () => value;
      if (unload) this.#value.unload = () => unload(value);
      return value;
    };
  }

  /**
   * 读取当前节点保存的值，在完成初始化之前，此属性不可以被读取。
   */
  get value(): Value {
    revoke.assert(this);
    asserts.assert(this.#value, "Dependency not ready yet");
    return this.#value();
  }

  get [Symbol.toStringTag](): string {
    return "Dependency";
  }

  /**
   * 删除所有依赖引用关系，期间将自动完成依赖的回收。
   */
  clear(): void {
    revoke.assert(this);

    const references = this.#references;
    if (!references) return;

    this.#references = undefined;
    this.#unlink(references.values());
  }

  /**
   * 添加依赖引用关系，期间将自动完成依赖的加载。
   */
  link<ChildValue>(
    descriptor: DependencyDescriptor<Key, Scope, ChildValue>,
  ): Dependency<Key, Scope, ChildValue>;
  link(descriptor: DependencyDescriptor<Key, Scope>): Dependency<Key, Scope> {
    revoke.assert(this);

    const { hoist, key } = descriptor;
    return emplaceMap(this.#references ??= new Map(), key, {
      insert: () => {
        // deno-lint-ignore no-this-alias
        let parent: Dependency<Key, Scope> = this;

        if (hoist === true) {
          while (parent.#parent) parent = parent.#parent[0];
        } else if (hoist) {
          const { is } = Object;
          const { acceptRoot = true, scope } = hoist;
          for (; !is(parent.#scope, scope); parent = parent.#parent[0]) {
            if (!parent.#parent) {
              if (acceptRoot) break;
              else throw new Error("No matching hoist scope found");
            }
          }
        }

        const reference = emplaceMap(parent.#children ??= new Map(), key, {
          insert: () => {
            const child = new Dependency<Key, Scope>(descriptor);
            child.#parent = [parent, key];
            return child;
          },
        });
        reference.#referrers ??= new Set();
        reference.#referrers.add(this);
        return reference;
      },
    });
  }

  /**
   * 删除依赖引用关系，期间将自动完成依赖的回收。
   */
  unlink(...keys: Key[]): void {
    revoke.assert(this);

    const references = this.#references;
    if (!references) return;

    this.#unlink((function* () {
      for (const key of keys) {
        const reference = references.get(key);
        if (reference) {
          references.delete(key);
          yield reference;
        }
      }
    })());
  }

  /**
   * 将已存在的依赖引用关系转为弱引用，如果传入 `null` 则恢复为强引用。
   */
  weaken(key: Key, handle: DependencyWeakReferenceHandle | null): void {
    revoke.assert(this);

    const reference = this.#references?.get(key);
    if (!reference) return;

    // 移除上一次注册的 handle
    this.#weak?.unregister(reference);

    if (handle) {
      this.#weak ??= new FinalizationRegistry((heldKey) => {
        this.unlink(heldKey);
      });
      this.#weak.register(handle, key, reference);
    }
  }

  /**
   * 当前节点是否无法溯源到根节点，如果无法回溯，说明当前节点需要被回收。
   */
  #isUnreachable(): boolean {
    const pending: Iterable<Dependency<Key, Scope>>[] = [];
    const visited = new WeakSet<Dependency<Key, Scope>>();
    let iterable: Iterable<Dependency<Key, Scope>> | undefined = [this];

    do {
      for (const referrer of iterable) {
        if (revoke.has(referrer) || visited.has(referrer)) continue;
        visited.add(referrer);

        // 已到达根节点，说明依然存在存活的依赖引用了当前节点
        if (!referrer.#parent) return false;
        if (referrer.#referrers?.size) pending.push(referrer.#referrers);
      }
    } while ((iterable = pending.pop()));

    return true;
  }

  /**
   * 删除依赖引用关系，期间将自动完成依赖的回收。
   */
  #unlink(deps: Iterable<Dependency<Key, Scope>>): void {
    const destructors: (() => void)[] = [];
    const pending: (readonly Dependency<Key, Scope>[])[] = [];

    // 广度遍历
    unlink(this, deps);

    for (
      let iterable: Iterable<Dependency<Key, Scope>> | undefined;
      (iterable = pending.pop());
    ) {
      for (const dep of iterable) {
        // 调用 revoke(dep) 会立即将 dep 标记为已回收，
        // 因此不会在后续 #isUnreachable() 遍历 referrers 时被误判为根节点
        if (!revoke(dep)) continue;

        if (dep.#parent) {
          dep.#parent[0].#children?.delete(dep.#parent[1]);
          dep.#parent = undefined;
        }

        if (dep.#references) {
          unlink(dep, dep.#references.values());
          dep.#references = undefined;
        }

        if (dep.#value) {
          const { unload } = dep.#value;
          if (unload) destructors.push(unload);
          dep.#value = undefined;
        }

        dep.#children = undefined;
        dep.#referrers = undefined;
        dep.#scope = NeverScope;
        dep.#weak = undefined;
      }
    }

    for (
      let index = destructors.length - 1, unload: () => void;
      index >= 0;
      index -= 1
    ) {
      unload = destructors[index];
      unload();
    }

    function unlink(
      referrer: Dependency<Key, Scope>,
      references: Iterable<Dependency<Key, Scope>>,
    ): void {
      const unreachable: Dependency<Key, Scope>[] = [];
      for (const reference of references) {
        referrer.#weak?.unregister(reference);
        reference.#referrers?.delete(referrer);
        if (reference.#isUnreachable()) unreachable.push(reference);
      }
      if (unreachable.length) pending.push(unreachable);
    }
  }
}
