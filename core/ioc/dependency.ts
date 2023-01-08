/**
 * 此模块实现了 class Dependency 用于管理实例的依赖关系。
 *
 * 共享的弱引用依赖可以自动回收，而强引用依赖需要手动回收。
 *
 * @module
 */

import { assertExists } from "https://deno.land/std@0.170.0/testing/asserts.ts";
import { emplaceMap } from "../tools/emplace.ts";
import { revoke } from "../tools/revocable.ts";

// 特殊的 scope 类型，与 TypeScript 的 any / never 类似
const AnyScope = Symbol("AnyScope");
const NeverScope = Symbol("NeverScope");

export interface DependencyInit<Scope, Value = unknown> {
  readonly scope?: Scope;
  readonly value?: Value;
}

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

  constructor(init: DependencyInit<Scope, Value>) {
    this.#scope = init.scope === undefined ? NeverScope : init.scope;
    this.#value = init.value;
  }

  /**
   * 读写当前节点保存的值，不接受 null 与 undefined 。
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
   *
   * @param shareScope 指定向上查找共享依赖的范围，不指定则不向上查找。
   */
  link<ChildValue>(
    key: Key,
    init: DependencyInit<Scope, ChildValue>,
    shareScope?: Scope,
  ): Dependency<Key, Scope, ChildValue>;
  link(
    key: Key,
    init: DependencyInit<Scope>,
    shareScope: Scope | typeof AnyScope = AnyScope,
  ): Dependency<Key, Scope> {
    revoke.assert(this);

    this.#references ??= new Map();
    return emplaceMap(this.#references, key, {
      insert: () => {
        const reference = this.#lookupAncestor(shareScope).#install(key, init);
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
    const root = this.#references?.get(key);
    if (!root) return;

    this.#references!.delete(key);
    root.#referrers?.delete(this);
    if (root.#referrers?.size) return;

    const pending: Iterable<Dependency<Key, Scope>>[] = [];
    let iterable: Iterable<Dependency<Key, Scope>> | undefined = [root];

    do {
      for (const dep of iterable) {
        if (!revoke(dep)) continue;

        if (dep.#parent) {
          dep.#parent[0].#children?.delete(dep.#parent[1]);
          dep.#parent = undefined;
        }

        if (dep.#references) {
          const unreachable: Dependency<Key, Scope>[] = [];
          for (const reference of dep.#references.values()) {
            reference.#referrers?.delete(dep);
            if (!reference.#referrers?.size) unreachable.push(reference);
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
   * 查找指定 scope 下的祖先节点：
   * - 传入 AnyScope 总是会命中当前节点；
   * - 如果没有找到符合条件的祖先节点，则使用根节点。
   */
  #lookupAncestor(under: Scope | typeof AnyScope): Dependency<Key, Scope> {
    if (under === AnyScope) return this;

    const { is } = Object;
    let ancestor: Dependency<Key, Scope> | undefined;
    for (
      ancestor = this;
      ancestor.#parent && !is(ancestor.#scope, under);
      ancestor = ancestor.#parent[0]
    ) {
      // noop
    }
    return ancestor;
  }
}
