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
type DependencyHoistConfig = deps.DependencyHoistConfig<
  DependencyScope
>;
type DependencyKey<Params extends AnyParams, Value> =
  | CallableDependencyKey<Params, Value>
  | NewableDependencyKey<Params, Value>;
type DependencyScope = DependencyKey<Any, Any>;

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
  DependencyHoistConfig,
  DependencyKey,
  DependencyScope,
  NewableDependencyKey,
};

export interface DependencyContainer {
  readonly Hoist: (
    config: DependencyHoistConfig | false,
  ) => (key: DependencyKey<Any, Any>) => void;
  readonly Scope: (
    scope: DependencyScope | null,
  ) => (key: DependencyKey<Any, Any>) => void;
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

/**
 * 创建一个依赖容器。
 */
export function createDependencyContainer(): DependencyContainer {
  const DescriptorMap = new WeakMap<
    DependencyKey<Any, Any>,
    Writable<PartialDependencyDescriptor<Any, Any>>
  >();

  return {
    Hoist(config) {
      return function decorator(key) {
        updateDependencyDescriptor(key, (descriptor) => {
          descriptor.hoist = config;
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
  };

  function createDependencyHost(
    dependency: Dependency<Any, Any>,
  ): DependencyHost {
    return {
      call(key, ...params) {
        const descriptor = createDependencyDescriptor(key, (host) => {
          return key(host, ...params);
        });
        return dependency.link(descriptor).value;
      },
      new(key, ...params) {
        const descriptor = createDependencyDescriptor(key, (host) => {
          return new key(host, ...params);
        });
        return dependency.link(descriptor).value;
      },
      revoke(key) {
        dependency.unlink(key);
      },
    };
  }

  function createDependencyDescriptor<Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
    create: (host: DependencyHost) => Value,
  ): DependencyDescriptor<Params, Value> {
    const descriptor: PartialDependencyDescriptor<Params, Value> =
      DescriptorMap.get(key) || {};
    assert(descriptor, "Dependency not exists");
    const { hoist, scope = key } = descriptor;
    const load = (dependency: Dependency<Params, Value>) => {
      return create(createDependencyHost(dependency));
    };
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
