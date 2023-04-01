import { asserts } from "../deps.ts";
import { emplaceMap } from "../tools/emplace.ts";
import * as graph from "./graph.ts";

/**
 * 指明依赖元信息 {@link DepMeta} 的键名，通常由装饰器注入。
 */
export const depMeta = Symbol.for("dependency.meta");

/**
 * 任意的 {@link Dep} 。
 */
// deno-lint-ignore no-explicit-any
export type AnyDep = Dep<any>;

/**
 * 任意的 {@link DepLike} 。
 */
// deno-lint-ignore no-explicit-any
export type AnyDepLike = DepLike<any>;

/**
 * 以 class 的形式创建出的依赖定义 {@link Dep} 。
 */
export interface ClassDep<Payload> {
  new (agent: DepAgent): Payload;
  readonly [depMeta]?: Partial<DepMeta>;
}

/**
 * 一项依赖的声明。
 */
export class Dep<Payload> implements DepMeta {
  static {
    Object.freeze(this);
  }

  /**
   * 创建一项新的依赖声明，相对于 `new Dep(init)` 做了一些类型增强。
   */
  static provide<Provide extends AnyDepLike>(
    provide: Provide,
    init:
      | DepInit<PayloadOfDep<Provide>>["factory"]
      | Omit<DepInit<PayloadOfDep<Provide>>, "provide">,
  ): Dep<PayloadOfDep<Provide>> {
    return new Dep({
      ...(typeof init === "function" ? { factory: init } : init),
      provide,
    });
  }

  static [Symbol.hasInstance](input: unknown): input is Dep<unknown> {
    return typeof input === "object" && input !== null && #flag in input;
  }

  /**
   * 用于创建依赖载荷的函数。
   */
  readonly factory: (agent: DepAgent) => Payload;
  /**
   * 依赖提升安装规则，可指定提升目标。
   */
  readonly hoist: boolean | DepKey;
  /**
   * 依赖的标识。
   */
  readonly key: DepKey;
  /**
   * 依赖的名称，通常用于调试。
   */
  readonly name: string;

  readonly #flag: undefined;

  constructor(init: DepInit<Payload>) {
    const { factory, hoist = false, name, provide } = init;

    {
      asserts.assert(
        typeof factory === "function",
        "factory is not a function",
      );
      this.factory = factory;
    }

    {
      switch (typeof hoist) {
        case "boolean":
        case "function":
        case "symbol":
          this.hoist = hoist;
          break;
        default:
          asserts.assert(hoist instanceof Dep, "invalid hoist config");
          this.hoist = hoist.key;
          break;
      }
    }

    {
      this.name = String(name || factory.name || "");

      switch (typeof provide) {
        case "function":
          this.name ||= String(provide.name || "");
          this.key = provide;
          break;
        case "undefined":
          this.key = Symbol(this.name);
          break;
        default:
          asserts.assert(provide instanceof Dep, "invalid provide config");
          this.name ||= provide.name;
          this.key = provide.key;
          break;
      }
    }

    Object.freeze(this);
  }
}

/**
 * 用于管理依赖的一组接口。
 */
export class DepAgent {
  readonly #node: graph.AnyDependencyNode;
  readonly #registry: DepRegistry;

  constructor(node: graph.AnyDependencyNode, registry: DepRegistry) {
    this.#node = node;
    this.#registry = registry;
  }

  /**
   * 当前实例的 {@link DisposableStack} ，在实例被回收后自动销毁。
   */
  get stack(): DisposableStack {
    return this.#node.stack;
  }

  /**
   * 解除对所有依赖的引用关系。
   */
  clear(): void {
    this.#node.clear();
  }

  /**
   * 引用 {@link dep} 依赖。
   */
  ref<T extends AnyDepLike>(dep: T): PayloadOfDep<T> {
    const { factory, hoist, key } = this.#registry.resolve(dep);
    return this.#node.link<PayloadOfDep<T>>(key, {
      hoist,
      load: (node) => factory(new DepAgent(node, this.#registry)),
    }).payload;
  }

  shadow(): { revoke: () => void; shadow: DepAgent } {
    const { key, shadow } = this.#node.shadow();
    return {
      revoke: () => this.#node.unlink(key),
      shadow: new DepAgent(shadow, this.#registry),
    };
  }

  /**
   * 解除对 {@link dep} 依赖的引用关系。
   */
  unref(dep: AnyDepLike): void {
    this.#node.unlink(this.#registry.resolve(dep).key);
  }

  /**
   * 将已加载的 {@link dep} 依赖转为弱引用、或是从弱引用转回强引用。
   *
   * @description
   * 如果没有通过 {@link ref|ref(dep)} 引用过此依赖，则不会有任何效果。
   *
   * 对于同一个 {@link dep} 重复调用此方法时，最新的 {@link handle} 总是会覆盖旧的 {@link handle} 。
   *
   * 如果传入的 {@link handle} 非空，那么当 {@link handle} 被 GC 垃圾回收时，将自动解除对
   * {@link dep} 依赖的引用关系（相当于 {@link unref|unref(dep)} ）。
   *
   * 如果传入的 {@link handle} 为空，那么 {@link dep} 将会转回强引用，只能手动通过
   * {@link unref|unref(dep)} 手动解除以来关系。
   */
  weaken(dep: AnyDepLike, handle: DepWeakRefHandle | null): void {
    this.#node.weaken(this.#registry.resolve(dep).key, handle);
  }
}

/**
 * 用于创建一项依赖声明的参数。
 */
export interface DepInit<Payload> extends Partial<DepMeta> {
  /**
   * 用于创建依赖载荷的函数。
   */
  readonly factory: (agent: DepAgent) => Payload;
  /**
   * 当前 factory 是否用于提供另一项依赖的载荷，如果不设置此项，则会声明为一个独立的依赖。
   */
  readonly provide?: DepLike<Payload>;
}

/**
 * 依赖标识的类型。
 */
export type DepKey = NewableFunction | symbol;

/**
 * 一项依赖的声明 {@link Dep} ，或者一项可以转换为依赖声明的内容。
 */
export type DepLike<Payload> = ClassDep<Payload> | Dep<Payload>;

/**
 * 依赖的元信息。
 */
export interface DepMeta {
  /**
   * 依赖提升安装规则，可指定提升目标。
   *
   * @description
   * 配置为 `true` 则提升到根节点；配置为 `false` 则不会被提升。
   */
  readonly hoist?: boolean | AnyDep | DepKey;
  /**
   * 依赖的名称，通常用于调试。
   */
  readonly name?: string;
}

/**
 * 依赖注册中心。
 */
export class DepRegistry {
  readonly #deps = new WeakMap<Exclude<AnyDepLike, AnyDep>, AnyDep>();

  resolve<T extends AnyDepLike>(unresolved: T): Dep<PayloadOfDep<T>> {
    if (unresolved instanceof Dep) return unresolved;

    return emplaceMap(this.#deps, unresolved, {
      insert: (depLike) => {
        return new Dep({
          ...(Object.hasOwn(depLike, depMeta) ? depLike[depMeta] : undefined),
          factory: (agent) => new depLike(agent),
          provide: depLike,
        });
      },
    });
  }
}

/**
 * 弱引用关系的句柄。
 */
// deno-lint-ignore ban-types
export type DepWeakRefHandle = object;

/**
 * 获取依赖的载荷类型。
 */
export type PayloadOfDep<Dep extends AnyDepLike> = Dep extends
  DepLike<infer Payload> ? Payload : never;
