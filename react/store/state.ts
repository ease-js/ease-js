import type { Draft } from "immer";
import { produce } from "immer";
import { BehaviorSubject } from "rxjs";
import type { DependencyScope, NewableDependencyKey } from "../../core.ts";
import { Hoist, Scope } from "../../core.ts";

export abstract class ReactState<State> extends BehaviorSubject<State> {
  constructor(initialState: State) {
    super(initialState);
  }

  get [Symbol.toStringTag](): string {
    return "ReactState";
  }

  produce(recipe: (draft: Draft<State>) => void | Draft<State>): void {
    this.next(produce(this.getValue(), recipe));
  }
}

export interface DefinedReactStateClass<State>
  extends NewableDependencyKey<[], DefinedReactStateInstance<State>> {
  prototype: DefinedReactStateInstance<State>;
}

export type DefinedReactStateInstance<State> = ReactState<State>;

export interface StateDefinition<State> {
  readonly hoist?: DependencyScope | boolean;
  readonly init: State;
}

export function defineState<State>(
  definition: StateDefinition<State>,
): DefinedReactStateClass<State> {
  const { hoist, init } = definition;

  @Hoist(hoist)
  @Scope(ReactState)
  class DefinedReactState extends ReactState<State> {
    constructor() {
      super(init);
    }
  }

  return DefinedReactState;
}
