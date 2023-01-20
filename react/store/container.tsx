import React from "react";
import type {
  CallableDependencyKey,
  DependencyHost,
  DependencyRootHost,
  WeakDependencyHandle,
  WithDependencyDestructor,
} from "../../core.ts";
import { createDependencyContainer } from "../../core.ts";
import { emplaceMap } from "../../core/tools/emplace.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { createRuntimeOnlyContext } from "../tools/runtime-only-context/mod.tsx";

interface ReactStoreCloneOptions extends ReactStoreDecorateOptions {
  /**
   * @default true
   */
  readonly weak?: boolean;
}

interface ReactStoreContainer {
  readonly Decorate: (
    options: ReactStoreDecorateOptions,
    // deno-lint-ignore no-explicit-any
  ) => <Creator extends ReactStoreCreator<any>>(create: Creator) => Creator;
  readonly Provider: ReactStoreRootProvider;
  // deno-lint-ignore no-explicit-any
  readonly Weaken: <Creator extends ReactStoreCreator<any>>(
    create: Creator,
  ) => Creator;
  // deno-lint-ignore no-explicit-any
  readonly clone: <Creator extends ReactStoreCreator<any>>(
    create: Creator,
    options?: ReactStoreCloneOptions,
  ) => Creator;
  // deno-lint-ignore no-explicit-any
  readonly mixin: <Creator extends ReactStoreCreator<any>>(
    create: Creator,
  ) => Creator & ReactStoreCreatorMixins;
  readonly useClone: <Value>(
    create: ReactStoreCreatorWithDestructor<Value>,
  ) => Value;
  readonly useInstance: <Value>(
    create: ReactStoreCreatorWithDestructor<Value>,
  ) => Value;
}

// deno-lint-ignore no-empty-interface
interface ReactStoreCreator<Value> extends CallableDependencyKey<[], Value> {}

interface ReactStoreCreatorMixins {
  // deno-lint-ignore no-explicit-any
  clone<Creator extends ReactStoreCreator<any>>(
    this: Creator,
    options?: ReactStoreCloneOptions,
  ): Creator;
  useClone<Value>(this: ReactStoreCreatorWithDestructor<Value>): Value;
  useInstance<Value>(this: ReactStoreCreatorWithDestructor<Value>): Value;
}

interface ReactStoreCreatorWithDestructor<Value>
  extends ReactStoreCreator<Value>, WithDependencyDestructor<Value> {}

interface ReactStoreDecorateOptions {
  /**
   * @default false
   */
  readonly weak?: boolean;
}

interface ReactStoreDescriptor<Value> {
  original?: ReactStoreCreator<Value>;
  weak?: boolean;
}

interface ReactStoreRootProvider {
  (props: ReactStoreRootProviderProps): React.ReactElement;
}

interface ReactStoreRootProviderProps {
  readonly children?: React.ReactNode;
  readonly create?: (host: DependencyRootHost<ReactStoreRoot>) => void;
}

export type {
  ReactStoreCloneOptions,
  ReactStoreContainer,
  ReactStoreCreator,
  ReactStoreCreatorMixins,
  ReactStoreCreatorWithDestructor,
  ReactStoreDecorateOptions,
  ReactStoreRootProvider,
  ReactStoreRootProviderProps,
};

export class ReactStoreRoot {
  // nothing
}

export const store = createReactStoreContainer();

function createReactStoreContainer(): ReactStoreContainer {
  const descriptors = new WeakMap<
    ReactStoreCreator<unknown>,
    ReactStoreDescriptor<unknown>
  >();
  const [useRootHost, RootHostProvider] = createRuntimeOnlyContext<
    DependencyRootHost<ReactStoreRoot>
  >("DependencyRootHost");

  const depContainer = createDependencyContainer({
    createDescriptor(descriptor) {
      return { ...descriptor, hoist: true };
    },
  });

  const mixins: ReactStoreCreatorMixins = {
    clone(options) {
      return clone(this, options);
    },
    useClone() {
      return useClone(this);
    },
    useInstance() {
      return useInstance(this);
    },
  };

  const Decorate: ReactStoreContainer["Decorate"] = function Decorate(options) {
    return function decorate(create) {
      const { weak } = options;
      const descriptor = emplaceReactStoreDescriptor(create);
      if (weak) descriptor.weak = true;
      return create;
    };
  };

  const Provider: ReactStoreContainer["Provider"] = function Provider(props) {
    const { children, create } = props;
    const root = useConstant(() => {
      const host = depContainer.createRoot(ReactStoreRoot);
      create?.(host);
      return host;
    });
    return <RootHostProvider value={root}>{children}</RootHostProvider>;
  };

  const clone: ReactStoreContainer["clone"] = function clone(
    create,
    options = {},
  ) {
    const original =
      (descriptors.get(create)?.original ?? create) as typeof create;
    const clone = new Proxy(original, {});
    descriptors.set(clone, { original, weak: options.weak !== false });
    return clone;
  };

  const mixin: ReactStoreContainer["mixin"] = function mixin(create) {
    return Object.assign(create, mixins);
  };

  const useClone: ReactStoreContainer["useClone"] = function useClone(create) {
    return useInstance(useConstant(() => clone(create)));
  };

  const useInstance: ReactStoreContainer["useInstance"] = function useInstance(
    create,
  ) {
    const root = useRootHost();
    return useConstant(() => {
      const descriptor = emplaceReactStoreDescriptor(create);
      if (!descriptor.weak) return [root.call(create)] as const;

      const handle: WeakDependencyHandle = {};
      const weakKey = (host: DependencyHost) => host;
      const weakHost: DependencyHost = root.call(weakKey);
      root.weaken(weakKey, handle);
      return [weakHost.call(create), handle] as const;
    })[0];
  };

  return {
    Decorate,
    Provider,
    Weaken: Decorate({ weak: true }),
    clone,
    mixin,
    useClone,
    useInstance,
  };

  function emplaceReactStoreDescriptor<Instance>(
    create: ReactStoreCreator<Instance>,
  ): ReactStoreDescriptor<Instance>;
  function emplaceReactStoreDescriptor(
    create: ReactStoreCreator<unknown>,
  ): ReactStoreDescriptor<unknown> {
    return emplaceMap(descriptors, create, { insert: () => ({}) });
  }
}
