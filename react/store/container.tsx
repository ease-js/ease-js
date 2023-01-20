import React from "react";
import type {
  CallableDependencyKey,
  DependencyHost,
  DependencyRootHost,
  WeakDependencyHandle,
} from "../../core.ts";
import { createDependencyContainer } from "../../core.ts";
import { emplaceMap } from "../../core/tools/emplace.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { createRuntimeOnlyContext } from "../tools/runtime-only-context/mod.tsx";

interface ReactStoreCloneOptions {
  /**
   * @default true
   */
  readonly weak?: boolean;
}

interface ReactStoreContainer {
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
  readonly useClone: <Value>(create: ReactStoreCreator<Value>) => Value;
  readonly useInstance: <Value>(create: ReactStoreCreator<Value>) => Value;
}

// deno-lint-ignore no-empty-interface
interface ReactStoreCreator<Value> extends CallableDependencyKey<[], Value> {}

interface ReactStoreCreatorMixins {
  // deno-lint-ignore no-explicit-any
  clone<Creator extends ReactStoreCreator<any>>(
    this: Creator,
    options?: ReactStoreCloneOptions,
  ): Creator;
  useClone<Value>(this: ReactStoreCreator<Value>): Value;
  useInstance<Value>(this: ReactStoreCreator<Value>): Value;
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
      return container.clone(this, options);
    },
    useClone() {
      return container.useClone(this);
    },
    useInstance() {
      return container.useInstance(this);
    },
  };

  const container: ReactStoreContainer = {
    Provider(props) {
      const { children, create } = props;
      const root = useConstant(() => {
        const host = depContainer.createRoot(ReactStoreRoot);
        create?.(host);
        return host;
      });
      return <RootHostProvider value={root}>{children}</RootHostProvider>;
    },
    Weaken(create) {
      emplaceReactStoreDescriptor(create).weak = true;
      return create;
    },
    clone(create, options = {}) {
      const { weak = true } = options;
      const original =
        (descriptors.get(create)?.original ?? create) as typeof create;
      const clone = new Proxy(original, {});
      descriptors.set(clone, { original, weak });
      return clone;
    },
    mixin(create) {
      return Object.assign(create, mixins);
    },
    useClone(create) {
      return container.useInstance(useConstant(() => container.clone(create)));
    },
    useInstance(create) {
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
    },
  };

  return container;

  function emplaceReactStoreDescriptor<Instance>(
    create: ReactStoreCreator<Instance>,
  ): ReactStoreDescriptor<Instance>;
  function emplaceReactStoreDescriptor(
    create: ReactStoreCreator<unknown>,
  ): ReactStoreDescriptor<unknown> {
    return emplaceMap(descriptors, create, { insert: () => ({}) });
  }
}
