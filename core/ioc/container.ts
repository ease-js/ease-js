/**
 * # 依赖容器
 *
 * 默认所有的依赖都是动态的。
 *
 * @module
 */

import { assert } from "std/testing/asserts.ts";
import { emplaceMap } from "../tools/emplace.ts";
import * as deps from "./dependency.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
type AnyParams = readonly Any[];
type Writable<T> = { -readonly [Key in keyof T]: T[Key] };

type Dependency<Params extends AnyParams, Value> = deps.Dependency<
  DependencyKey<Params, Value>,
  DependencyScope,
  Value
>;
type DependencyDescriptor<Params extends AnyParams, Value> =
  deps.DependencyDescriptor<
    DependencyKey<Params, Value>,
    DependencyScope,
    Value
  >;
type DependencyKey<Params extends AnyParams, Value> =
  | CallableDependencyKey<Params, Value>
  | NewableDependencyKey<Params, Value>;
type DependencyScope =
  | ((...params: Any) => Any)
  | (new (...params: Any) => Any);

type CallableDependencyKey<Params extends AnyParams, Value> = (
  host: DependencyHost,
  ...params: Params
) => Value;
type NewableDependencyKey<Params extends AnyParams, Value> = new (
  host: DependencyHost,
  ...params: Params
) => Value;

type PartialDependencyDescriptor<Params extends AnyParams, Value> = Pick<
  DependencyDescriptor<Params, Value>,
  "hoist" | "scope"
>;

export type {
  CallableDependencyKey,
  DependencyKey,
  DependencyScope,
  NewableDependencyKey,
};

export interface DependencyContainer {
  readonly Hoist: (
    scope: DependencyScope | false,
  ) => (key: DependencyKey<Any, Any>) => void;
  readonly Scope: (
    scope: DependencyScope | null,
  ) => (key: DependencyKey<Any, Any>) => void;
  readonly createRoot: <Params extends AnyParams, Value>(
    key: NewableDependencyKey<Params, Value>,
    ...params: Params
  ) => DependencyRootHost<Value>;
}

export interface DependencyHost {
  readonly call: <Params extends AnyParams, Value>(
    key: CallableDependencyKey<Params, Value>,
    ...params: Params
  ) => Value;
  readonly new: <Params extends AnyParams, Value>(
    key: NewableDependencyKey<Params, Value>,
    ...params: Params
  ) => Value;
  readonly revoke: <Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
  ) => void;
}

export interface DependencyRootHost<RootValue> extends DependencyHost {
  readonly deref: () => RootValue;
  readonly enforce: <Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
    value: Value,
  ) => void;
}

/**
 * 创建一个依赖容器。
 */
export function createDependencyContainer(): DependencyContainer {
  const DescriptorMap = new WeakMap<
    DependencyKey<Any, Any>,
    Writable<PartialDependencyDescriptor<Any, Any>>
  >();

  return {
    Hoist(scope) {
      return function decorator(key) {
        updateDependencyDescriptor(key, (descriptor) => {
          descriptor.hoist = scope ? { scope } : false;
        });
      };
    },
    Scope(scope) {
      return function decorator(key) {
        updateDependencyDescriptor(key, (descriptor) => {
          descriptor.scope = scope;
        });
      };
    },
    createRoot(key, ...params) {
      const load = createNewableDependencyLoader(key, params);
      const descriptor = createDependencyDescriptor(key, load);
      const dependency = new deps.Dependency(descriptor);
      return createDependencyRootHost(dependency);
    },
  };

  function createDependencyHost(
    dependency: Dependency<Any, Any>,
  ): DependencyHost {
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
      revoke(key) {
        dependency.unlink(key);
      },
    };
  }

  function createDependencyRootHost<RootValue>(
    dependency: Dependency<Any, Any>,
  ): DependencyRootHost<RootValue> {
    return {
      ...createDependencyHost(dependency),
      deref() {
        return dependency.value;
      },
      enforce(key, value) {
        const descriptor = createDependencyDescriptor(key, () => value);
        const child = dependency.link(descriptor);
        assert(
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
    key: DependencyKey<Params, Value>,
    load: (dependency: Dependency<Params, Value>) => Value,
  ): DependencyDescriptor<Params, Value> {
    const descriptor: PartialDependencyDescriptor<Params, Value> =
      DescriptorMap.get(key) || {};
    const { hoist, scope = key } = descriptor;
    return { hoist, key, load, scope };
  }

  function updateDependencyDescriptor<Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
    update: (
      descriptor: Writable<PartialDependencyDescriptor<Params, Value>>,
    ) => void,
  ): void {
    const descriptor = emplaceMap(DescriptorMap, key, {
      insert: (): PartialDependencyDescriptor<Params, Value> => ({}),
    });

    update(descriptor);
  }
}
