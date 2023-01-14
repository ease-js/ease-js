import type { Draft } from "immer";
import { createDraft, finishDraft } from "immer";
import { BehaviorSubject } from "rxjs";
import type { DependencyScope } from "../../core.ts";
import { Hoist, Scope } from "../../core.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { useDependencyHost } from "./context.ts";

export class ReactState<State> extends BehaviorSubject<State> {
  #draft: Draft<readonly [State]> | undefined;

  constructor(initialState: State) {
    super(initialState);
  }

  get draft(): Draft<State> {
    return (this.#draft ??= createDraft([this.getValue()] as const))[0];
  }

  commit(): void {
    const next = this.#finish();
    if (next) this.next(next[0]);
  }

  complete(): void {
    this.#finish();
    super.complete();
  }

  error(error: unknown): void {
    this.#finish();
    super.error(error);
  }

  next(value: State): void {
    this.#finish();
    super.next(value);
  }

  #finish(): readonly [State] | undefined {
    const draft = this.#draft;
    if (draft === undefined) return;
    this.#draft = undefined;
    return finishDraft(draft) as readonly [State];
  }
}

export interface StateDefinition<State> {
  readonly hoist?: DependencyScope | false;
  readonly state: State;
}

export function defineState<State>(
  definition: StateDefinition<State>,
): () => ReactState<State> {
  const { hoist = false, state: initialState } = definition;

  @Hoist(hoist)
  @Scope(ReactState)
  class SpecifyReactState extends ReactState<State> {
    constructor() {
      super(initialState);
    }
  }

  return function useState(): ReactState<State> {
    const host = useDependencyHost();
    return useConstant(() => host.new(SpecifyReactState));
  };
}
