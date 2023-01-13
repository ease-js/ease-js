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
  | SimpleDependencyKey<Params, Value>
  | TemplateDependencyKey<Params, Value>;
type DependencyScope = new (...params: Any) => Any;

type SimpleDependencyKey<Params extends AnyParams, Value> = new (
  host: DependencyHost,
  ...params: Params
) => Value;

type TemplateDependencyBrand = { readonly brand: unique symbol }["brand"];
// https://github.com/tc39/proposal-symbols-as-weakmap-keys
// export type TemplateDependency<Value> = symbol & { brand: Value };
type TemplateDependencyKey<Params extends AnyParams, Value> = {
  readonly [Brand in TemplateDependencyBrand]: {
    readonly params: Params;
    readonly value: Value;
  };
};

// deno-lint-ignore no-empty-interface
interface SimpleDependencyDescriptor<Params extends AnyParams, Value>
  extends Pick<DependencyDescriptor<Params, Value>, "hoist"> {}
interface TemplateDependencyDescriptor<Params extends AnyParams, Value>
  extends Pick<DependencyDescriptor<Params, Value>, "hoist" | "scope"> {
  readonly load: (host: DependencyHost, ...params: Params) => Value;
}

export type {
  DependencyHoistConfig,
  DependencyKey,
  DependencyScope,
  SimpleDependencyKey,
  TemplateDependencyDescriptor,
  TemplateDependencyKey,
};

export interface DependencyContainer {
  readonly Hoist: (
    config: DependencyHoistConfig | false,
  ) => (key: SimpleDependencyKey<Any, Any>) => void;
  readonly define: <Params extends AnyParams, Value>(
    descriptor:
      | TemplateDependencyDescriptor<Params, Value>
      | TemplateDependencyDescriptor<Params, Value>["load"],
  ) => TemplateDependencyKey<Params, Value>;
}

export interface DependencyHost {
  readonly revoke: <Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
  ) => void;
  readonly use: <Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
    ...params: Params
  ) => Value;
}

/**
 * 创建一个依赖容器。
 */
export function createDependencyContainer(): DependencyContainer {
  const SimpleDependencyDescriptorMap = new WeakMap<
    SimpleDependencyKey<Any, Any>,
    Writable<SimpleDependencyDescriptor<Any, Any>>
  >();
  const TemplateDependencyDescriptorMap = new WeakMap<
    TemplateDependencyKey<Any, Any>,
    TemplateDependencyDescriptor<Any, Any>
  >();

  return {
    Hoist(config) {
      return function decorator(key) {
        updateSimpleDependencyDescriptor(key, (descriptor) => {
          descriptor.hoist = config;
        });
      };
    },
    define<Params extends AnyParams, Value>(
      descriptorOrLoader:
        | TemplateDependencyDescriptor<Params, Value>
        | TemplateDependencyDescriptor<Params, Value>["load"],
    ) {
      const key = {} as TemplateDependencyKey<Params, Value>;
      const descriptor: TemplateDependencyDescriptor<Params, Value> =
        typeof descriptorOrLoader === "function"
          ? { load: descriptorOrLoader }
          : descriptorOrLoader;
      TemplateDependencyDescriptorMap.set(key, descriptor);
      return key;
    },
  };

  function createDependencyHost(
    dependency: Dependency<Any, Any>,
  ): DependencyHost {
    return {
      revoke(key) {
        dependency.unlink(key);
      },
      use(key, ...params) {
        const descriptor = transformDependencyDescriptor(key, params);
        return dependency.link(descriptor).value;
      },
    };
  }

  function transformDependencyDescriptor<Params extends AnyParams, Value>(
    key: DependencyKey<Params, Value>,
    params: Params,
  ): DependencyDescriptor<Params, Value> {
    if (isDependencyTemplateHandle(key)) {
      return transformTemplateDependencyDescriptor(key, params);
    }
    return transformSimpleDependencyDescriptor(key, params);
  }

  function transformSimpleDependencyDescriptor<Params extends AnyParams, Value>(
    key: SimpleDependencyKey<Params, Value>,
    params: Params,
  ): DependencyDescriptor<Params, Value> {
    const { hoist } = SimpleDependencyDescriptorMap.get(key) ?? {};
    const load = (dependency: Dependency<Params, Value>) => {
      return new key(createDependencyHost(dependency), ...params);
    };
    return { hoist, key, load, scope: key };
  }

  function transformTemplateDependencyDescriptor<
    Params extends AnyParams,
    Value,
  >(
    key: TemplateDependencyKey<Params, Value>,
    params: Params,
  ): DependencyDescriptor<Params, Value> {
    const descriptor: TemplateDependencyDescriptor<Params, Value> | undefined =
      TemplateDependencyDescriptorMap.get(key);
    assert(descriptor, "Dependency not exists");
    const { hoist, load: proxy, scope } = descriptor;
    const load = (dependency: Dependency<Params, Value>) => {
      return proxy(createDependencyHost(dependency), ...params);
    };
    return { hoist, key, load, scope };
  }

  function updateSimpleDependencyDescriptor<Params extends AnyParams, Value>(
    key: SimpleDependencyKey<Params, Value>,
    update: (
      descriptor: Writable<SimpleDependencyDescriptor<Params, Value>>,
    ) => void,
  ): void {
    const descriptor = emplaceMap(SimpleDependencyDescriptorMap, key, {
      insert: (): SimpleDependencyDescriptor<Params, Value> => ({}),
    });

    update(descriptor);
  }
}

function isDependencyTemplateHandle<Params extends AnyParams, Value>(
  key: DependencyKey<Params, Value>,
): key is TemplateDependencyKey<Params, Value> {
  return typeof key === "object";
}
