import React from "react";
import type {
  DependencyHost,
  DependencyRootHost,
  NewableDependencyKey,
  WeakDependencyHandle,
} from "../../core.ts";
import { createDependencyContainer } from "../../core.ts";
import { emplaceMap } from "../../core/tools/emplace.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { createRuntimeOnlyContext } from "../tools/runtime-only-context/mod.tsx";

// deno-lint-ignore no-explicit-any
type Any = any;
type EmptyParams = [];

type ReactStoreConstructor<Instance> = NewableDependencyKey<
  EmptyParams,
  Instance
>;

interface ReactStoreContainer {
  readonly KeepAlive: <Constructor extends ReactStoreConstructor<Any>>(
    Store: Constructor,
  ) => void;
  readonly Provider: ReactStoreRootProvider;
  readonly clone: <Constructor extends ReactStoreConstructor<Any>>(
    Store: Constructor,
  ) => Constructor;
  readonly useClone: <Instance>(
    Store: ReactStoreConstructor<Instance>,
  ) => Instance;
  readonly useInstance: <Instance>(
    Store: ReactStoreConstructor<Instance>,
  ) => Instance;
}

interface ReactStoreDescriptor<Instance> {
  keepAlive?: boolean;
  original?: ReactStoreConstructor<Instance>;
}

interface ReactStoreRootProvider {
  (props: ReactStoreRootProviderProps): React.ReactElement;
}

interface ReactStoreRootProviderProps {
  readonly children?: React.ReactNode;
  readonly init?: (host: DependencyRootHost<ReactStoreRoot>) => void;
}

export type {
  ReactStoreConstructor,
  ReactStoreRootProvider,
  ReactStoreRootProviderProps,
};

export class ReactStoreRoot {
  // nothing
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

  const depContainer = createDependencyContainer({
    createDescriptor(descriptor) {
      return { ...descriptor, hoist: true };
    },
  });

  const container: ReactStoreContainer = {
    KeepAlive(Store) {
      emplaceReactStoreDescriptor(Store).keepAlive = true;
    },
    Provider(props) {
      const { children, init } = props;
      const root = useConstant(() => {
        const host = depContainer.createRoot(ReactStoreRoot);
        init?.(host);
        return host;
      });
      return <RootHostProvider value={root}>{children}</RootHostProvider>;
    },
    clone(Store) {
      const original: Any = descriptors.get(Store)?.original ?? Store;
      const clone: Any = class ReactStoreClone extends original {};
      descriptors.set(clone, { original });
      return clone;
    },
    useClone(Store) {
      return container.useInstance(useConstant(() => container.clone(Store)));
    },
    useInstance(Store) {
      const root = useRootHost();
      return useConstant(() => {
        const { keepAlive } = emplaceReactStoreDescriptor(Store);
        if (keepAlive) return [root.new(Store)] as const;

        const handle: WeakDependencyHandle = {};
        const weakKey = (host: DependencyHost) => host;
        const weakHost: DependencyHost = root.call(weakKey);
        root.weaken(weakKey, handle);
        return [weakHost.new(Store), handle] as const;
      })[0];
    },
  };

  return container;

  function emplaceReactStoreDescriptor<Instance>(
    Store: ReactStoreConstructor<Instance>,
  ): ReactStoreDescriptor<Instance> {
    return emplaceMap(descriptors, Store, { insert: () => ({}) });
  }
}
