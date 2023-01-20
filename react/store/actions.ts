import type {
  ReactStoreCreator,
  ReactStoreCreatorMixins,
} from "./container.tsx";
import { store } from "./container.tsx";

// deno-lint-ignore no-explicit-any
type AnyStores = readonly any[];

export interface ReactActionsCreator<Actions>
  extends ReactStoreCreator<Actions>, ReactStoreCreatorMixins {}

export function defineActions<Stores extends AnyStores>(
  deps: readonly [
    ...{ [Index in keyof Stores]: ReactStoreCreator<Stores[Index]> },
  ],
): {
  define<Actions>(
    init: (...stores: Stores) => Actions,
  ): ReactActionsCreator<Actions>;
} {
  return {
    define<Actions>(init: (...stores: Stores) => Actions) {
      const createActions: ReactStoreCreator<Actions> = function createActions(
        host,
      ) {
        return Reflect.apply(init, null, deps.map((dep) => host.call(dep)));
      };

      return store.mixin(createActions);
    },
  };
}
