/**
 * # 依赖容器
 *
 * 此模块实现了 `function createDependencyContainer()` 用于创建储存依赖信息的容器
 * `interface DependencyContainer` ，通过约定一些简单的限制条件将 `class Dependency`
 * 提供的接口封装为 `interface DependencyHost` 以弱化 `class Dependency`
 * 的存在感、减少开发者对 `class Dependency` 内部数据结构的感知。
 *
 * ## 简介
 *
 * 在设计此模块时，我们确定了三个预设条件：
 *
 * - 默认所有的依赖都是动态加载的。
 * - 依赖是否可以被共享应当由其自身决定、而不是由使用方决定，因为依赖的实现方更清楚自身的逻辑是否适合共享。
 * - 默认 class 优先，但不排斥 function 。
 *
 * ## 用法
 *
 * `interface DependencyContainer` 包含一个核心 API `createRoot(class MyRoot)`
 * ，它将返回掌控根节点依赖控制权的 `interface DependencyRootHost` 。
 *
 * `interface DependencyContainer` 还包含两个装饰器 `@Hoist()` 与 `@Scope()`
 * ，分别用于设置依赖的提升配置与共享范围。
 *
 * 通常来说，装饰器都是在依赖实现的位置使用的，例如下方的代码实现了 `class UserService`
 * ，当它被使用时、将被提升到 `Controller` 层级下共享同一个实例：
 *
 * ```ts
 * import { Controller } from "...";
 *
 * class UserService {
 *   static {
 *     Hoist(Controller)(this);
 *   }
 *
 *   ...
 * }
 *
 * class MyController {
 *   static {
 *     Scope(Controller)(this);
 *   }
 *
 *   readonly #user: UserService;
 *
 *   constructor(host: DependencyHost) {
 *     this.#user = host.new(UserService);
 *   }
 * }
 * ```
 *
 * 我们约定，依赖必须通过 class 或者 function 来实现，并且分别满足
 * `new (host: DependencyHost, ...rest: any[]) => any` 与
 * `(host: DependencyHost, ...rest: any[]) => any` 的类型约束，其中的 `host`
 * 就是由我们注入的内容。当一个依赖需要使用其他依赖时，即可通过 `host.call(function, ...rest)`
 * 或是 `host.new(class, ...rest)` 委托我们帮忙创建或是共享：
 *
 * ```ts
 * declare function createDemoDynamicService(
 *   host: DependencyHost,
 *   port: number,
 * ): DemoDynamicService;
 *
 * declare class UserService {
 *   constructor(host: DependencyHost);
 * }
 *
 * class MyController {
 *   readonly #dynamic: DemoDynamicService;
 *   readonly #user: UserService;
 *
 *   constructor(host: DependencyHost) {
 *     this.#dynamic = host.call(createDemoDynamicService, 8080);
 *     this.#user = host.new(UserService);
 *   }
 * }
 * ```
 *
 * @module
 */

import { asserts } from "../deps.ts";

import { emplaceMap } from "../tools/emplace.ts";
import * as deps from "./dependency.ts";

/**
 * 依赖的副作用清理函数的键。当依赖被回收后，会调用此键对应的函数。
 *
 * @example
 * ```ts
 * class MyService {
 *   static [destructor](instance: MyService): void {
 *     instance.destroy();
 *   }
 *
 *   constructor(host: DependencyHost) { ... }
 *
 *   destroy(): void { ... }
 * }
 * ```
 *
 * @example
 * ```ts
 * interface MyService {
 *   destroy(): void;
 * }
 *
 * function createMyService(host: DependencyHost): MyService { ... }
 *
 * createMyService[destructor] = (instance: MyService): void => {
 *   instance.destroy();
 * }
 * ```
 */
export const destructor = Symbol("DependencyDestructor");

/**
 * 任意的 {@link Dependency} 实例。
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
type AnyDependency = Dependency<any, any>;
/**
 * 任意的 {@link DependencyKey} 。
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
type AnyDependencyKey = DependencyKey<any, any>;
/**
 * 任意的依赖创建参数。
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
type AnyParams = readonly any[];
/**
 * 移除 T 的属性的 `readonly` 修饰符。
 *
 * @internal
 */
type Writable<T> = { -readonly [Key in keyof T]: T[Key] };

/**
 * 对范型进行了限制的 {@link deps.Dependency} 实例的类型。
 *
 * @internal
 */
type Dependency<Params extends AnyParams, Value> = deps.Dependency<
  DependencyKey<Params, Value>,
  DependencyScope,
  Value
>;
/**
 * 对范型进行了限制的 {@link deps.DependencyDescriptor} 实例的类型。
 */
type DependencyDescriptor<Params extends AnyParams, Value> =
  deps.DependencyDescriptor<
    DependencyKey<Params, Value>,
    DependencyScope,
    Value
  >;
/**
 * 可通过装饰器设置的 {@link DependencyDescriptor} 的内容。
 *
 * @internal
 */
type DependencyDescriptorDraft<Params extends AnyParams, Value> = Writable<
  Pick<DependencyDescriptor<Params, Value>, "hoist" | "scope">
>;
/**
 * 依赖标识符的类型，必须是分别满足 `new (host: DependencyHost, ...rest: any[]) => any`
 * 与 `(host: DependencyHost, ...rest: any[]) => any` 类型约束的 class 或 function 。
 */
type DependencyKey<Params extends AnyParams, Value> =
  | CallableDependencyKey<Params, Value>
  | NewableDependencyKey<Params, Value>;
/**
 * 包含副作用清理函数的 {@link DependencyKey} 。
 */
type DependencyKeyWithDestructor<Params extends AnyParams, Value> =
  | CallableDependencyKeyWithDestructor<Params, Value>
  | NewableDependencyKeyWithDestructor<Params, Value>;
/**
 * 依赖提升共享范围。
 */
type DependencyScope =
  | CallableFunction
  | NewableFunction;
/**
 * 弱引用依赖的句柄 {@link deps.WeakDependencyHandle} 。
 */
type WeakDependencyHandle = deps.WeakDependencyHandle;

/**
 * 获取 {@link DependencyKey|DependencyKey<Params, Value>} 的 Params 类型。
 */
type ParametersOfDependencyKey<Key extends AnyDependencyKey> = Key extends
  Dependency<infer Params, infer _Value> ? Params : never;
/**
 * 获取 {@link DependencyKey|DependencyKey<Params, Value>} 的 Value 类型。
 */
type ValueOfDependencyKey<Key extends AnyDependencyKey> = Key extends
  Dependency<infer _Params, infer Value> ? Value : never;

export type {
  DependencyDescriptor,
  DependencyKey,
  DependencyKeyWithDestructor,
  DependencyScope,
  ParametersOfDependencyKey,
  ValueOfDependencyKey,
  WeakDependencyHandle,
};

/**
 * 以 function 形式实现的依赖。
 */
export interface CallableDependencyKey<Params extends AnyParams, Value> {
  (host: DependencyHost, ...params: Params): Value;
}

/**
 * 包含副作用清理函数的 {@link CallableDependencyKey} 。
 */
export interface CallableDependencyKeyWithDestructor<
  Params extends AnyParams,
  Value,
> extends
  CallableDependencyKey<Params, Value>,
  WithDependencyDestructor<Value> {}

/**
 * 依赖容器接口。
 */
export interface DependencyContainer {
  /**
   * 设置依赖提升共享配置 {@link DependencyDescriptor.hoist|hoist} 的装饰器。
   *
   * @param scope 需要提升的范围，默认为 `true` 。
   *
   * @description
   * 默认情况下，没有使用装饰器时，依赖不会被提升共享，使用此装饰器可改变默认行为。
   */
  readonly Hoist: (
    scope?: DependencyScope | boolean,
  ) => <Key extends AnyDependencyKey>(key: Key) => Key;
  /**
   * 设置依赖自身 {@link DependencyDescriptor.scope|scope} 的装饰器，通常是为了配合 {@link Hoist} 使用的。
   *
   * @description
   * 默认情况下，没有使用装饰器时，依赖的 {@link DependencyDescriptor.scope|scope} 就是
   * {@link DependencyKey} 其本身。使用此装饰器可改变默认行为，传入 `null`
   * 则不允许任何共享依赖安装在此处。
   */
  readonly Scope: (
    scope: DependencyScope | null,
  ) => <Key extends AnyDependencyKey>(key: Key) => Key;
  /**
   * 创建依赖挂载树的根节点，并返回可以控制此节点的 {@link DependencyRootHost} 接口。
   *
   * @description
   * 我们约定，根节点的实现形式必须是 class 。
   */
  readonly createRoot: <Params extends AnyParams, Value>(
    key: NewableDependencyKey<Params, Value>,
    ...params: Params
  ) => DependencyRootHost<Value>;
}

/**
 * 控制 {@link DependencyContainer} 行为的一组接口。
 */
export interface DependencyContainerHost {
  /**
   * {@link DependencyContainer} 创建完整的依赖描述信息 {@link DependencyDescriptor}
   * 后会调用此函数，你可以在此处对其进行改写。
   */
  readonly createDescriptor: <Params extends AnyParams, Value>(
    descriptor: DependencyDescriptor<Params, Value>,
  ) => DependencyDescriptor<Params, Value>;
}

/**
 * 提供给依赖动态加载与回收子依赖的接口。
 */
export interface DependencyHost {
  /**
   * 加载一个以 function 形式实现的依赖。
   *
   * @description
   * 如果此依赖需要额外参数 `params` ，可通过 `host.call(key, ...params)`
   * 的形式传入。需要注意的是，只有首次创建才会使用传入的 `params` 。
   */
  readonly call: <Params extends AnyParams, Value>(
    key: CallableDependencyKeyWithDestructor<Params, Value>,
    ...params: Params
  ) => Value;
  /**
   * 加载一个以 class 形式实现的依赖。
   *
   * @description
   * 如果此依赖需要额外参数 `params` ，可通过 `host.new(key, ...params)`
   * 的形式传入。需要注意的是，只有首次创建才会使用传入的 `params` 。
   */
  readonly new: <Params extends AnyParams, Value>(
    key: NewableDependencyKeyWithDestructor<Params, Value>,
    ...params: Params
  ) => Value;
  /**
   * 解除对指定依赖的引用关系，当其不再被其他地方引用时将会被回收释放。
   */
  readonly unlink: <Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
  ) => void;
  /**
   * 将指定**已存在的**依赖转换为弱引用依赖，或是从弱引用依赖转回强引用依赖。
   *
   * @description
   * 如果没有通过 {@link call|host.call(key)} 或是 {@link new|host.new(key)}
   * 引用过此依赖，则不会有任何效果。
   *
   * 如果传入的 {@link handle} 非空，那么当 {@link handle} 被 GC 垃圾回收时，将自动解除对
   * {@link key} 依赖的引用关系（相当于 {@link unlink|host.unlink(key)} ）。
   *
   * 对于相同的 {@link key} 重复设置不同的 {@link handle} ，则只有最后一次设置的
   * {@link handle} 会生效。
   *
   * 如果传入的 {@link handle} 为 `null` ，那么 {@link key} 依赖关系将不会被自动解除，只能手动通过
   * {@link unlink|host.unlink(key)} 解除。
   */
  readonly weaken: <Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
    handle: WeakDependencyHandle | null,
  ) => void;
}

/**
 * 提供给根节点依赖动态加载与回收子依赖的接口。
 */
export interface DependencyRootHost<RootValue> extends DependencyHost {
  /**
   * 获取当前根节点储存的值。
   */
  readonly deref: () => RootValue;
  /**
   * 在当前节点安装 {@link key} 依赖，并将其值设置为 {@link value} ，通常用于单元测试。
   *
   * @description
   * 如果 {@link key} 已经被安装、并且其值与 {@link value} 不同，则会抛出错误。
   */
  readonly enforce: <Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
    value: Value,
  ) => void;
}

/**
 * 以 class 形式实现的依赖。
 */
export interface NewableDependencyKey<Params extends AnyParams, Value> {
  new (host: DependencyHost, ...params: Params): Value;
}

/**
 * 包含副作用清理函数的 {@link NewableDependencyKey} 。
 */
export interface NewableDependencyKeyWithDestructor<
  Params extends AnyParams,
  Value,
> extends
  NewableDependencyKey<Params, Value>,
  WithDependencyDestructor<Value> {}

/**
 * 依赖的副作用清理函数。
 */
export interface WithDependencyDestructor<Value> {
  [destructor]?: (value: Value) => void;
}

/**
 * 创建一个依赖容器。
 */
export function createDependencyContainer(
  containerHost: DependencyContainerHost,
): DependencyContainer {
  const descriptorDrafts = new WeakMap<
    AnyDependencyKey,
    // deno-lint-ignore no-explicit-any
    DependencyDescriptorDraft<any, any>
  >();

  return {
    Hoist(scope = true) {
      return function decorator(key) {
        updateDependencyDescriptor(key, (draft) => {
          if (scope) draft.hoist = scope === true ? scope : { scope };
          else delete draft.hoist;
        });
        return key;
      };
    },
    Scope(scope) {
      return function decorator(key) {
        updateDependencyDescriptor(key, (draft) => {
          if (scope) draft.scope = scope;
          else delete draft.scope;
        });
        return key;
      };
    },
    createRoot(key, ...params) {
      const load = createNewableDependencyLoader(key, params);
      const descriptor = createDependencyDescriptor(key, load);
      const dependency = new deps.Dependency(descriptor);
      return createDependencyRootHost(dependency);
    },
  };

  function createDependencyHost(dependency: AnyDependency): DependencyHost {
    return {
      call(key, ...params) {
        const load = createCallableDependencyLoader(key, params);
        const descriptor = createDependencyDescriptor(key, load);
        return dependency.link(descriptor).value;
      },
      new(key, ...params) {
        const load = createNewableDependencyLoader(key, params);
        const descriptor = createDependencyDescriptor(key, load);
        return dependency.link(descriptor).value;
      },
      unlink(key) {
        dependency.unlink(key);
      },
      weaken(key, handle) {
        dependency.weaken(key, handle);
      },
    };
  }

  function createDependencyRootHost<RootValue>(
    dependency: AnyDependency,
  ): DependencyRootHost<RootValue> {
    return {
      ...createDependencyHost(dependency),
      deref() {
        return dependency.value;
      },
      enforce(key, value) {
        const descriptor = createDependencyDescriptor(key, () => value);
        const child = dependency.link(descriptor);
        asserts.assert(
          Object.is(child.value, value),
          "Existing dependency value does not equal to the given one",
        );
      },
    };
  }

  function createCallableDependencyLoader<Params extends AnyParams, Value>(
    key: CallableDependencyKey<Params, Value>,
    params: Params,
  ): (dependency: Dependency<Params, Value>) => Value {
    return (dependency) => {
      return key(createDependencyHost(dependency), ...params);
    };
  }

  function createNewableDependencyLoader<Params extends AnyParams, Value>(
    key: NewableDependencyKey<Params, Value>,
    params: Params,
  ): (dependency: Dependency<Params, Value>) => Value {
    return (dependency) => {
      return new key(createDependencyHost(dependency), ...params);
    };
  }

  function createDependencyDescriptor<Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
    load: (dependency: Dependency<Params, Value>) => Value,
  ): DependencyDescriptor<Params, Value> {
    const draft: DependencyDescriptorDraft<Params, Value> =
      descriptorDrafts.get(key) || {};
    const { hoist, scope = key } = draft;
    const unload = key[destructor];
    return containerHost.createDescriptor({ hoist, key, load, scope, unload });
  }

  function updateDependencyDescriptor<Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
    update: (draft: DependencyDescriptorDraft<Params, Value>) => void,
  ): void {
    const draft = emplaceMap(descriptorDrafts, key, {
      insert: (): DependencyDescriptorDraft<Params, Value> => ({}),
    });

    update(draft);
  }
}
