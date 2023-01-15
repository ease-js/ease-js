import type {
  DependencyHost,
  DependencyScope,
  NewableDependencyKey,
} from "../../core.ts";
import { Hoist, Scope } from "../../core.ts";
import { DefinedReactStateClass, ReactState } from "./state.ts";

export abstract class ReactModel {
  get [Symbol.toStringTag](): string {
    return "ReactModel";
  }
}

export interface DefinedReactModelClass<Actions, State>
  extends NewableDependencyKey<[], DefinedReactModelInstance<Actions, State>> {
  prototype: DefinedReactModelInstance<Actions, State>;
}

export interface DefinedReactModelInstance<Actions, State> extends ReactModel {
  get actions(): Actions;
  get state(): ReactState<State>;
}

export interface ModelDefinition<Actions, State> {
  readonly actions: (state: ReactState<State>) => Actions;
  readonly hoist?: DependencyScope | boolean;
  readonly state: DefinedReactStateClass<State>;
}

export function defineModel<Actions, State>(
  definition: ModelDefinition<Actions, State>,
): DefinedReactModelClass<Actions, State> {
  const { actions, hoist, state } = definition;

  @Hoist(hoist)
  @Scope(ReactModel)
  class DefinedReactModel extends ReactModel {
    readonly #actions: Actions;
    readonly #state: ReactState<State>;

    constructor(host: DependencyHost) {
      super();
      this.#state = host.new(state);
      this.#actions = actions(this.#state);
    }

    get actions(): Actions {
      return this.#actions;
    }

    get state(): ReactState<State> {
      return this.#state;
    }
  }

  return DefinedReactModel;
}
