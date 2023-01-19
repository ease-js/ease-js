import React from "react";
import {
  createRoot,
  DependencyHost,
  DependencyRootHost,
  NewableDependencyKey,
  WeakDependencyHandle,
} from "../../core.ts";
import { Hoist } from "../../core.ts";
import { emplaceMap } from "../../core/tools/emplace.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { createRuntimeOnlyContext } from "../tools/runtime-only-context/mod.tsx";

// deno-lint-ignore no-explicit-any
type Any = any;

interface ReactStoreDescriptor<Instance> {
  constructor: ReactStoreConstructor<Instance>;
  keepAlive?: boolean;
  original: ReactStoreConstructor<Instance>;
}

export type ReactStoreConstructor<Instance> = NewableDependencyKey<
  [],
  Instance
>;

export interface ReactStoreContainer {
  readonly KeepAlive: <Class extends ReactStoreConstructor<Any>>(
    Store: Class,
  ) => void;
  readonly Provider: ReactStoreRootProvider;
  readonly clone: <Class extends ReactStoreConstructor<Any>>(
    Store: Class,
  ) => Class;
  readonly useClone: <Instance>(
    Store: ReactStoreConstructor<Instance>,
  ) => Instance;
  readonly useInstance: <Instance>(
    Store: ReactStoreConstructor<Instance>,
  ) => Instance;
}

export class ReactStoreRoot {
  // nothing
}

export interface ReactStoreRootProviderProps {
  readonly children?: React.ReactNode;
  readonly init?: (host: DependencyRootHost<ReactStoreRoot>) => void;
}

export interface ReactStoreRootProvider {
  (props: ReactStoreRootProviderProps): React.ReactElement;
}

export const ReactStoreContainer = createReactStoreContainer();

function createReactStoreContainer(): ReactStoreContainer {
  const descriptors = new WeakMap<
    ReactStoreConstructor<Any>,
    ReactStoreDescriptor<Any>
  >();
  const [useRootHost, RootHostProvider] = createRuntimeOnlyContext<
    DependencyRootHost<ReactStoreRoot>
  >("DependencyRootHost");

  const container: ReactStoreContainer = {
    KeepAlive(Store) {
      emplaceReactStoreDescriptor(Store).keepAlive = true;
    },
    Provider(props) {
      const { children, init } = props;
      const root = useConstant(() => {
        const host = createRoot(ReactStoreRoot);
        init?.(host);
        return host;
      });
      return <RootHostProvider value={root}>{children}</RootHostProvider>;
    },
    clone(Store) {
      const original: Any = descriptors.get(Store)?.original ?? Store;
      const constructor: Any = createReactStoreClone(original);
      descriptors.set(constructor, { constructor, original });
      return constructor;
    },
    useClone(Store) {
      return container.useInstance(useConstant(() => container.clone(Store)));
    },
    useInstance(Store) {
      const root = useRootHost();
      return useConstant(() => {
        const { constructor, keepAlive } = emplaceReactStoreDescriptor(Store);
        if (keepAlive) return [root.new(constructor)] as const;

        const handle: WeakDependencyHandle = {};
        const weakKey = (host: DependencyHost) => host;
        const weakHost: DependencyHost = root.call(weakKey);
        root.weaken(weakKey, handle);
        return [weakHost.new(constructor), handle] as const;
      })[0];
    },
  };

  return container;

  function createReactStoreClone<Class extends ReactStoreConstructor<Any>>(
    Parent: Class,
  ): Class;
  function createReactStoreClone(
    Parent: ReactStoreConstructor<Any>,
  ): ReactStoreConstructor<Any> {
    const SubClass = class ReactStoreClone extends Parent {};
    Hoist()(SubClass);
    return SubClass;
  }

  function emplaceReactStoreDescriptor<Instance>(
    Store: ReactStoreConstructor<Instance>,
  ): ReactStoreDescriptor<Instance> {
    return emplaceMap(descriptors, Store, {
      insert: () => ({
        constructor: createReactStoreClone(Store),
        original: Store,
      }),
    });
  }
}
