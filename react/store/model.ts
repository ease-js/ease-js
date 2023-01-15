import type { DependencyScope, NewableDependencyKey } from "../../core.ts";
import { Hoist, Scope } from "../../core.ts";

export abstract class ReactModel<Actions> {
  readonly #actions: Actions;

  constructor(actions: Actions) {
    this.#actions = actions;
  }

  get actions(): Actions {
    return this.#actions;
  }

  get [Symbol.toStringTag](): string {
    return "ReactModel";
  }
}

export interface DefinedReactModelClass<Actions>
  extends NewableDependencyKey<[], DefinedReactModelInstance<Actions>> {
  prototype: DefinedReactModelInstance<Actions>;
}

export type DefinedReactModelInstance<Actions> = ReactModel<Actions>;

export interface ModelDefinition<Actions> {
  readonly hoist?: DependencyScope | boolean;
  readonly init: () => Actions;
}

// type ValueOfDependencyKeys<
//   // deno-lint-ignore no-explicit-any
//   Keys extends readonly DependencyKey<[], any>[],
//   // deno-lint-ignore no-explicit-any
//   Result extends any[] = [],
// > = Keys extends readonly [infer Key, ...infer Rest]
//   // deno-lint-ignore no-explicit-any
//   ? Rest extends readonly DependencyKey<[], any>[]
//     // deno-lint-ignore no-explicit-any
//     ? Key extends DependencyKey<[], any>
//       ? ValueOfDependencyKeys<Rest, [...Result, ValueOfDependencyKey<Key>]>
//     : Result
//   : Result
//   : Result;

export function defineModel<Actions>(
  definition: ModelDefinition<Actions>,
): DefinedReactModelClass<Actions> {
  const { hoist, init } = definition;

  @Hoist(hoist)
  @Scope(ReactModel)
  class DefinedReactModel extends ReactModel<Actions> {
    constructor() {
      super(init());
    }
  }

  return DefinedReactModel;
}
