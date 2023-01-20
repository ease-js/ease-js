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

export const destructor = Symbol("DependencyDestructor");

// deno-lint-ignore no-explicit-any
type AnyDependency = Dependency<any, any>;
// deno-lint-ignore no-explicit-any
type AnyDependencyKey = DependencyKey<any, any>;
// deno-lint-ignore no-explicit-any
type AnyParams = readonly any[];
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
type DependencyDescriptorDraft<Params extends AnyParams, Value> = Writable<
  Pick<DependencyDescriptor<Params, Value>, "hoist" | "scope">
>;
type DependencyKey<Params extends AnyParams, Value> =
  | CallableDependencyKey<Params, Value>
  | NewableDependencyKey<Params, Value>;
type DependencyKeyWithDestructor<Params extends AnyParams, Value> =
  | CallableDependencyKeyWithDestructor<Params, Value>
  | NewableDependencyKeyWithDestructor<Params, Value>;
type DependencyScope =
  | CallableFunction
  | NewableFunction;
type WeakDependencyHandle = deps.WeakDependencyHandle;

type ParametersOfDependencyKey<Key extends AnyDependencyKey> = Key extends
  Dependency<infer Params, infer _Value> ? Params : never;
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

export interface CallableDependencyKey<Params extends AnyParams, Value> {
  (host: DependencyHost, ...params: Params): Value;
}

export interface CallableDependencyKeyWithDestructor<
  Params extends AnyParams,
  Value,
> extends
  CallableDependencyKey<Params, Value>,
  WithDependencyDestructor<Value> {}

export interface DependencyContainer {
  /**
   * @param scope 需要提升的范围，默认为 `true` 。
   */
  readonly Hoist: (
    scope?: DependencyScope | boolean,
  ) => <Key extends AnyDependencyKey>(key: Key) => Key;
  readonly Scope: (
    scope: DependencyScope | null,
  ) => <Key extends AnyDependencyKey>(key: Key) => Key;
  readonly createRoot: <Params extends AnyParams, Value>(
    key: NewableDependencyKey<Params, Value>,
    ...params: Params
  ) => DependencyRootHost<Value>;
}

export interface DependencyContainerHost {
  readonly createDescriptor: <Params extends AnyParams, Value>(
    descriptor: DependencyDescriptor<Params, Value>,
  ) => DependencyDescriptor<Params, Value>;
}

export interface DependencyHost {
  readonly call: <Params extends AnyParams, Value>(
    key: CallableDependencyKeyWithDestructor<Params, Value>,
    ...params: Params
  ) => Value;
  readonly new: <Params extends AnyParams, Value>(
    key: NewableDependencyKeyWithDestructor<Params, Value>,
    ...params: Params
  ) => Value;
  readonly revoke: <Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
  ) => void;
  readonly weaken: <Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
    handle: WeakDependencyHandle | null,
  ) => void;
}

export interface DependencyRootHost<RootValue> extends DependencyHost {
  readonly deref: () => RootValue;
  readonly enforce: <Params extends AnyParams, Value>(
    key: DependencyKeyWithDestructor<Params, Value>,
    value: Value,
  ) => void;
}

export interface NewableDependencyKey<Params extends AnyParams, Value> {
  new (host: DependencyHost, ...params: Params): Value;
}

export interface NewableDependencyKeyWithDestructor<
  Params extends AnyParams,
  Value,
> extends
  NewableDependencyKey<Params, Value>,
  WithDependencyDestructor<Value> {}

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
      revoke(key) {
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
