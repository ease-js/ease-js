import { destructor } from "../../core.ts";
import type {
  ReactStoreCreator,
  ReactStoreCreatorMixins,
  ReactStoreCreatorWithDestructor,
} from "./container.tsx";
import { store } from "./container.tsx";

// deno-lint-ignore no-explicit-any
type AnyStores = readonly any[];

interface AnyActions {
  readonly [destructor]?: () => void;
}

export interface ReactActionsCreator<Actions extends AnyActions>
  extends ReactStoreCreatorWithDestructor<Actions>, ReactStoreCreatorMixins {}

export function defineActions<Stores extends AnyStores>(
  deps: readonly [
    ...{ [Index in keyof Stores]: ReactStoreCreator<Stores[Index]> },
  ],
): {
  define<Actions extends AnyActions>(
    init: (...stores: Stores) => Actions,
  ): ReactActionsCreator<Actions>;
} {
  return {
    define<Actions extends AnyActions>(init: (...stores: Stores) => Actions) {
      const createActions: ReactStoreCreatorWithDestructor<Actions> =
        function createActions(host) {
          return (init as (...stores: AnyStores) => Actions)(
            ...deps.map((dep) => host.call(dep)),
          );
        };
      createActions[destructor] = (actions) => actions[destructor]?.();

      return store.mixin(createActions);
    },
  };
}
