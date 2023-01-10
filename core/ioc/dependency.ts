/**
 * # 依赖管理
 *
 * 此模块实现了通用的 class Dependency 用于管理依赖关系。
 *
 * ## 简介
 *
 * Dependency 中同时储存了挂载树与引用关系两套数据，其中**挂载树顾名思义是一颗树、而引用关系则是有向连通图**。
 *
 * 简单情况下，不需要共享依赖时，依赖的引用关系应当和挂载树同构，例如：
 *
 * ```plain
 *  ROOT
 *  /  \
 * A    B
 * ```
 *
 * 当存在共享依赖时，依赖的引用关系会复杂一些，例如下方示例中，左侧时挂载树、右侧是引用关系：
 *
 * ```plain
 *   RO_OT          RO_OT
 *  /  |  \         /   \
 * A   C   B       A     B
 *                  \   /
 *                    C
 * ```
 *
 * 上面的例子比较抽象，我们将它转换成具体的例子：可以假设 ROOT 为 JS 服务端程序的一个 Controller
 * 实例，而 A B C 均为 Services ，按右侧的引用关系解释则是 Controller 引用了 Service A
 * 与 B 、而 Service A 与 B 在 Controller 存活期间共享了 Service C 。假如 Service C
 * 不共享，则是下图所示的挂载树与引用关系：
 *
 * ```plain
 *  RO_OT        RO_OT
 *  /   \        /   \
 * A     B      A     B
 * |     |      |     |
 * C1    C2     C1    C2
 * ```
 *
 * ## 名词约定
 *
 * ```plain
 *   RO_OT          RO_OT
 *  /  |  \         /   \
 * A   C   B       A     B
 *                  \   /
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
 * ## 使用限制
 *
 * 当你通过 `new Dependency(init)` 创建一个 Dependency 实例时，此实例一定是挂载树的根节点；换句话说，你无法通过
 * `new Dependency(init)` 创建子依赖之后连通到已经存在的挂载树与引用关系图中。不用担心，
 * Dependency 提供了足够可靠的两个公共方法 link() 与 unlink() ，分别用于加载与移除子依赖。
 *
 * @module
 */

import { assertExists } from "std/testing/asserts.ts";
import { emplaceMap } from "../tools/emplace.ts";
import { revoke } from "../tools/revocable.ts";

// 特殊的 scope 类型，与 TypeScript 的 any / never 类似
const AnyScope = Symbol("AnyScope");
const NeverScope = Symbol("NeverScope");

/**
 * 对一项依赖的描述。
 */
export interface DependencyDescriptor<Scope, Value = unknown>
  extends DependencyInit<Scope, Value> {
  /**
   * 当此依赖被安装时，如果指定的 shareScope 不存在，是否接受直接安装在根节点。
   *
   * @default false
   */
  readonly acceptRootScope?: boolean;
  /**
   * 当此依赖被安装时，应当安装在哪个范围下。不配置此选项、或者传入 `null` 与
   * `undefined` ，则此依赖不会被共享。
   */
  readonly shareScope?: Scope | null;
}

/**
 * 创建一项依赖所需的初始配置。
 */
export interface DependencyInit<Scope, Value = unknown> {
  /**
   * 当前节点的依赖共享范围的句柄。假如后代依赖想要在此节点共享依赖，则需要指定同一个 scope
   * 取值才能成功安装在此节点下。
   *
   * @description
   * 对于非根节点的依赖，不配置此项、或者传入 `null` 与 `undefined` 则不允许任何共享依赖安装在此处。
   */
  readonly scope?: Scope;
  /**
   * 当前节点保存的具有实际使用价值的内容，提供给引用此依赖的其他依赖使用。也可以在创建
   * Dependency 之后，通过赋值 `dependency.value` 来更改。
   *
   * @description
   * `null` 与 `undefined` 都将被视为空。
   */
  readonly value?: Value;
}

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
   * 当前节点的 scope ，用于后代节点选择共享依赖的边界范围。
   */
  #scope: Scope | typeof NeverScope;
  /**
   * 当前节点保存的值。
   */
  #value: Value | undefined;

  /**
   * 当前节点是否为根节点。
   */
  get #isRoot(): boolean {
    // 没有被回收 && 不存在 #parent
    return !revoke.has(this) && !this.#parent;
  }

  constructor(init: DependencyInit<Scope, Value>) {
    this.#scope = init.scope ?? NeverScope;
    this.#value = init.value;
  }

  /**
   * 读写当前节点保存的值，不接受 `null` 与 `undefined` 。
   *
   * 在首次赋值之前，此属性不可以被读取。
   */
  get value(): NonNullable<Value> {
    revoke.assert(this);
    assertExists(this.#value, "Dependency not ready yet");

    return this.#value;
  }
  set value(value: NonNullable<Value>) {
    revoke.assert(this);
    assertExists(value);

    this.#value = value;
  }

  /**
   * 加载依赖。
   */
  link<ChildValue>(
    key: Key,
    descriptor: DependencyDescriptor<Scope, ChildValue>,
  ): Dependency<Key, Scope, ChildValue>;
  link(
    key: Key,
    descriptor: DependencyDescriptor<Scope>,
  ): Dependency<Key, Scope> {
    revoke.assert(this);

    this.#references ??= new Map();
    return emplaceMap(this.#references, key, {
      insert: () => {
        const reference = this.#lookupShareScope(
          descriptor.acceptRootScope ?? false,
          descriptor.shareScope ?? AnyScope,
        ).#install(key, descriptor);
        reference.#referrers ??= new Set();
        reference.#referrers.add(this);
        return reference;
      },
    });
  }

  /**
   * 回收依赖。
   */
  unlink(key: Key): void {
    revoke.assert(this);

    const startNode = this.#references?.get(key);
    if (!startNode) return;

    this.#references!.delete(key);
    startNode.#referrers?.delete(this);
    if (!startNode.#isUnreachable()) return;

    const pending: Iterable<Dependency<Key, Scope>>[] = [];
    let iterable: Iterable<Dependency<Key, Scope>> | undefined = [startNode];

    do {
      for (const dep of iterable) {
        // 调用 revoke(dep) 会立即将 dep 标记为已回收，
        // 因此不会在后续 #isUnreachable() 遍历 referrers 时被误判为根节点
        if (!revoke(dep)) continue;

        if (dep.#parent) {
          dep.#parent[0].#children?.delete(dep.#parent[1]);
          dep.#parent = undefined;
        }

        if (dep.#references) {
          const unreachable: Dependency<Key, Scope>[] = [];
          for (const reference of dep.#references.values()) {
            reference.#referrers?.delete(dep);
            if (reference.#isUnreachable()) unreachable.push(reference);
          }

          if (unreachable.length) pending.push(unreachable);
          dep.#references = undefined;
        }

        dep.#children = undefined;
        dep.#referrers = undefined;
        dep.#scope = NeverScope;
        dep.#value = undefined;
      }
    } while ((iterable = pending.pop()));
  }

  /**
   * 在当前节点安装一个新依赖。
   */
  #install<ChildValue>(
    key: Key,
    init: DependencyInit<Scope, ChildValue>,
  ): Dependency<Key, Scope, ChildValue>;
  #install(
    key: Key,
    init: DependencyInit<Scope>,
  ): Dependency<Key, Scope> {
    this.#children ??= new Map();
    return emplaceMap(this.#children, key, {
      insert: () => {
        const child = new Dependency<Key, Scope>(init);
        child.#parent = [this, key];
        return child;
      },
    });
  }

  /**
   * 当前节点是否无法溯源到根节点，如果无法回溯，说明当前节点需要被回收。
   */
  #isUnreachable(): boolean {
    // 已经被回收了
    if (revoke.has(this)) return true;

    const pending: Iterable<Dependency<Key, Scope>>[] = [];
    const visited = new WeakSet<Dependency<Key, Scope>>();
    let iterable: Iterable<Dependency<Key, Scope>> | undefined = [this];

    do {
      for (const referrer of iterable) {
        if (visited.has(referrer)) continue;
        visited.add(referrer);

        // 已到达根节点，说明依然存在存活的依赖引用了当前节点
        // 如果节点已被回收，则 #isRoot 一定为假
        if (referrer.#isRoot) return false;
        if (referrer.#referrers?.size) pending.push(referrer.#referrers);
      }
    } while ((iterable = pending.pop()));

    return true;
  }

  /**
   * 查找可用的共享范围。
   */
  #lookupShareScope(
    acceptRootScope: boolean,
    shareScope: Scope | typeof AnyScope,
  ): Dependency<Key, Scope> {
    if (shareScope === AnyScope) return this;

    const { is } = Object;
    let ancestor: Dependency<Key, Scope> | undefined;
    for (
      ancestor = this;
      !is(ancestor.#scope, shareScope);
      ancestor = ancestor.#parent[0]
    ) {
      if (!ancestor.#parent) {
        if (acceptRootScope) return ancestor;
        throw new Error("No matching shareScope found");
      }
    }
    return ancestor;
  }
}
