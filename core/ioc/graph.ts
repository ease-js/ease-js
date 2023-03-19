/**
 * # 依赖的创建、回收与引用
 *
 * 此模块实现了通用的 `class DependencyNode` 用于描述与管理程序的依赖关系。
 *
 * ## 简介
 *
 * DependencyNode 中同时储存了挂载树与引用关系两套数据，**挂载树以树的形式描述了节点实际的挂载结构，
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
 * 当你通过 `new DependencyNode()` 创建一个 DependencyNode
 * 实例时，此实例一定是挂载树的根节点；换句话说，你无法通过 `new DependencyNode()`
 * 创建子依赖之后连通到已经存在的挂载树与引用关系图中，这是为了确保 DependencyNode
 * 实例的内部数据具备充足的安全性，保障内部依赖回收机制不会轻易受到外界影响。
 *
 * DependencyNode 提供了 `link()` 与 `unlink()` 两个公共方法分别用于建立与删除依赖的引用关系，
 * DependencyNode 将在这两个方法内部自动完成依赖的加载与回收。由于每一个新增的子依赖都由一个新的
 * DependencyNode 实例来表示，由此可构建出一个树状的结构，用于描述与管理你的程序的依赖关系。
 *
 * ### 描述依赖
 *
 * 调用 `parent.link(key, definition)` 建立引用关系时，需要传入用于标识依赖的 `key`
 * 以及描述依赖信息的对象 `definition` ，后者类型为 `interface DependencyDefinition` ：
 *
 * - 每个 `key` 都唯一对应一个依赖，因此重复使用相同的 `key` 调用 `link(key, definition)`
 *   总是会拿到相同的 DependencyNode 实例。
 * - 依赖创建后，不会立即调用 `definition.load()` ，只有当外界首次访问 `node.payload`
 *   时，才会调用一次 `definition.load()` 并保存其返回内容，直至 `node` 被回收销毁。
 *
 * ### 共享依赖
 *
 * 调用 `node.link(key, definition)` 建立引用关系时，总是会先从当前节点开始向上查找与
 * `key` 匹配的已经存在的依赖，如果不存在才进行安装，然后与当前节点建立引用关系。
 *
 * 安装依赖时，将根据 `definition.hoist` 字段决定安装策略：
 *
 * - 当 `hoist` 缺省、或者配置为 `false` 时，总是安装在当前节点。
 * - 当 `hoist` 配置为 `true` 时，总是安装在根节点。
 * - 其他情况下，将从当前节点开始向上查找 `hoist` 指定的祖先节点（含当前节点）：
 *   - 如果存在符合条件的节点，则安装在此节点。
 *   - 如果不存在符合条件的节点，则安装在当前节点，与 `hoist: false` 行为相同。
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
 * 对于非共享依赖， `unlink(...keys)` 即可回收依赖以及间接依赖；对于共享依赖，则会稍微复杂一些。
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
 * const root = new DependencyNode();
 * const DemoKey: DependencyKey = Symbol("Demo");
 * const DemoDefinition: DependencyDefinition = { ... };
 *
 * export function useWeakDependency() {
 *   const [handle] = React.useState((): DependencyWeakReferenceHandle => ({}));
 *   const [node] = React.useState(() => {
 *     const instance = root.link(DemoKey, DemoDefinition);
 *     root.weaken(DemoKey, handle);
 *     return instance;
 *   });
 *   return node;
 * }
 * ```
 *
 * @module
 */

import { asserts } from "../deps.ts";
import { emplaceMap } from "../tools/emplace.ts";

// deno-lint-ignore no-explicit-any
export type AnyDependencyDefinition = DependencyDefinition<any>;

// deno-lint-ignore no-explicit-any
export type AnyDependencyNode = DependencyNode<any>;

/**
 * 依赖节点的定义。
 */
export interface DependencyDefinition<Payload = unknown> {
  /**
   * 依赖节点提升安装规则，可指定提升目标。
   *
   * @description
   * 配置为 `true` 则提升到根节点；配置为 `false` 则不会被提升。
   */
  readonly hoist: DependencyKey | boolean;
  /**
   * 依赖节点载荷的加载函数。
   *
   * @description
   * 仅当 {@link DependencyNode.payload} 首次被访问时才会被调用。
   */
  readonly load: (node: DependencyNode<Payload>) => Payload;
}

/**
 * 依赖节点在当前层级的标识。
 */
// deno-lint-ignore ban-types
export type DependencyKey = number | object | symbol | string;

/**
 * 弱引用依赖关系的句柄。
 */
// deno-lint-ignore ban-types
export type DependencyWeakRefHandle = object;

/**
 * 用于管理依赖关系的通用类。
 */
export class DependencyNode<Payload = unknown> {
  static {
    Object.freeze(this.prototype);
  }

  /**
   * 安装在当前节点的依赖。
   */
  #children: Map<DependencyKey, AnyDependencyNode> | undefined;
  /**
   * 当前节点的有效载荷。
   */
  #payload: ((this: this) => Payload) | undefined;
  /**
   * 当前节点引用的依赖。
   */
  #references: Map<DependencyKey, AnyDependencyNode> | undefined;
  /**
   * 当前节点被引用的位置。
   */
  #referrers: Set<AnyDependencyNode> | undefined;
  /**
   * 当前节点是否被回收。
   */
  #revoked = false;
  /**
   * 当前节点的 DisposableStack 。
   */
  #stack: DisposableStack | undefined;
  /**
   * 非根节点的信息，包括其索引与父节点。
   */
  #tree:
    | { readonly key: DependencyKey; readonly parent: AnyDependencyNode }
    | undefined;
  /**
   * 弱引用依赖的注册中心。
   */
  #weak: FinalizationRegistry<DependencyKey> | undefined;

  /**
   * 读取当前节点的有效载荷，在完成初始化之前，此属性不可以被读取。
   */
  get payload(): Payload {
    this.#assertRevoked();
    asserts.assert(this.#payload, "the payload is not available");
    return this.#payload();
  }

  /**
   * 当前节点的 {@link DisposableStack} ，在当前节点被回收后自动销毁。
   */
  get stack(): DisposableStack {
    this.#assertRevoked();
    return this.#stack ??= new DisposableStack();
  }

  get [Symbol.toStringTag](): string {
    return "DependencyNode";
  }

  /**
   * 删除所有依赖引用关系，期间将自动完成依赖的回收。
   */
  clear(): void {
    this.#assertRevoked();
    const references = this.#references;
    if (!references) return;
    this.#references = undefined;
    this.#unlink(references.values());
  }

  /**
   * 建立依赖引用关系，期间将自动完成依赖的加载。
   */
  link<RefPayload>(
    key: DependencyKey,
    definition: DependencyDefinition<RefPayload>,
  ): DependencyNode<RefPayload> {
    this.#assertRevoked();

    return emplaceMap(this.#references ??= new Map(), key, {
      insert: (): AnyDependencyNode => {
        const { hoist, load } = definition;

        // deno-lint-ignore no-this-alias
        let node: AnyDependencyNode | undefined = this;
        let parent: AnyDependencyNode = node;
        let reference: AnyDependencyNode | undefined;

        do {
          reference = node.#children?.get(key);
          if (reference) break;

          if (hoist === true) parent = node;
          else if (Object.is(node.#tree?.key, hoist)) parent = node;
        } while ((node = node.#tree?.parent));

        if (!reference) {
          reference = new DependencyNode<RefPayload>();
          reference.#payload = function () {
            this.#payload = undefined;
            const payload = load(this);
            this.#payload = () => payload;
            return payload;
          };
          reference.#tree = { key, parent };
          parent.#children ??= new Map();
          parent.#children.set(key, reference);
        }

        reference.#referrers ??= new Set();
        reference.#referrers.add(this);

        return reference;
      },
    });
  }

  /**
   * 删除依赖引用关系，期间将自动完成依赖的回收。
   */
  unlink(...keys: DependencyKey[]): void {
    this.#assertRevoked();

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
  weaken(key: DependencyKey, handle: DependencyWeakRefHandle | null): void {
    this.#assertRevoked();

    const reference = this.#references?.get(key);
    if (!reference) return;

    // 移除上一次注册的 handle
    this.#weak?.unregister(reference);

    if (handle) {
      this.#weak ??= new FinalizationRegistry((heldValue) => {
        this.unlink(heldValue);
      });
      this.#weak.register(handle, key, reference);
    }
  }

  #assertRevoked(): void {
    asserts.assertFalse(this.#revoked, "dependency has been revoked");
  }

  /**
   * 当前节点是否无法溯源到根节点，如果无法回溯，说明当前节点需要被回收。
   */
  #isUnreachable(): boolean {
    const pending: Iterable<AnyDependencyNode>[] = [];
    const visited = new WeakSet<AnyDependencyNode>();
    let iterable: Iterable<AnyDependencyNode> | undefined = [this];

    do {
      for (const referrer of iterable) {
        if (referrer.#revoked || visited.has(referrer)) continue;
        visited.add(referrer);

        // 已到达根节点，说明依然存在存活的依赖引用了当前节点
        if (!referrer.#tree) return false;
        if (referrer.#referrers?.size) pending.push(referrer.#referrers);
      }
    } while ((iterable = pending.pop()));

    return true;
  }

  /**
   * 删除依赖引用关系，期间将自动完成依赖的回收。
   */
  #unlink(nodes: Iterable<AnyDependencyNode>): void {
    let stack: DisposableStack | undefined;
    const pending: (readonly AnyDependencyNode[])[] = [];

    // 广度遍历
    unlink(this, nodes);

    for (
      let iterable: Iterable<AnyDependencyNode> | undefined;
      (iterable = pending.pop());
    ) {
      for (const dep of iterable) {
        if (dep.#revoked) continue;
        dep.#revoked = true;

        if (dep.#references) {
          unlink(dep, dep.#references.values());
          dep.#references = undefined;
        }

        if (dep.#stack) {
          (stack ??= new DisposableStack()).use(dep.#stack);
          dep.#stack = undefined;
        }

        if (dep.#tree) {
          dep.#tree.parent.#children?.delete(dep.#tree.key);
          dep.#tree = undefined;
        }

        dep.#children = undefined;
        dep.#payload = undefined;
        dep.#referrers = undefined;
        dep.#weak = undefined;
      }
    }

    stack?.dispose();

    function unlink(
      referrer: AnyDependencyNode,
      references: Iterable<AnyDependencyNode>,
    ): void {
      const unreachable: AnyDependencyNode[] = [];
      for (const reference of references) {
        referrer.#weak?.unregister(reference);
        reference.#referrers?.delete(referrer);
        if (reference.#isUnreachable()) unreachable.push(reference);
      }
      if (unreachable.length) pending.push(unreachable);
    }
  }
}
