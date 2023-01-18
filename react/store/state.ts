import type { Draft, Immutable } from "immer";
import { produce } from "immer";
import { BehaviorSubject } from "rxjs";

export class ReactState<State> extends BehaviorSubject<Immutable<State>> {
  constructor(initialState: Immutable<State>) {
    super(initialState);
  }

  get [Symbol.toStringTag](): string {
    return "ReactState";
  }

  produce(recipe: (draft: Draft<State>) => void | Draft<State>): void {
    this.next(produce(this.getValue(), recipe));
  }
}

export interface DefinedReactStateClass<State> {
  new (): DefinedReactStateInstance<State>;
  prototype: DefinedReactStateInstance<State>;
}

export type DefinedReactStateInstance<State> = ReactState<State>;

export function defineState<State>(
  init: Immutable<State>,
): DefinedReactStateClass<State> {
  return class DefinedReactState extends ReactState<State> {
    constructor() {
      super(init);
    }
  };
}
