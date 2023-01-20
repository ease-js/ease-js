import React from "react";
import type { Draft, Immutable } from "immer";
import { produce } from "immer";
import { BehaviorSubject } from "rxjs";
import { useConstant } from "../tools/memo/use-constant.ts";
import {
  BehaviorSubjectValueSelector,
  useBehaviorSubjectValue,
  useBehaviorSubjectValueWithSelector,
} from "../tools/rxjs/use-behavior-subject-value.ts";
import type { ReactStoreConstructor } from "./container.tsx";
import { ReactStoreContainer } from "./container.tsx";

// deno-lint-ignore no-explicit-any
type AnyReactState = ReactState<any>;

export interface DefinedReactStateClass<State>
  extends
    ReactStoreConstructor<DefinedReactStateInstance<State>>,
    Omit<typeof ReactState, "prototype"> {
  prototype: DefinedReactStateInstance<State>;
}

export type DefinedReactStateInstance<State> = ReactState<State>;

export type ReactStateProduceRecipe<State> = (
  draft: Draft<State>,
) => void | Draft<State>;

export type StateOfReactStateInstance<Instance extends AnyReactState> =
  Instance extends ReactState<infer State> ? State : never;

export class ReactState<State> extends BehaviorSubject<Immutable<State>> {
  static clone<Class extends ReactStoreConstructor<AnyReactState>>(
    this: Class,
  ): Class {
    return ReactStoreContainer.clone(this);
  }

  static useClone<Instance extends AnyReactState>(
    this: ReactStoreConstructor<Instance>,
  ): Instance {
    return ReactStoreContainer.useClone(this);
  }

  static useInstance<Instance extends AnyReactState>(
    this: ReactStoreConstructor<Instance>,
  ): Instance {
    return ReactStoreContainer.useInstance(this);
  }

  static useLocalState<Instance extends AnyReactState>(
    this: ReactStoreConstructor<Instance>,
  ): [
    state: Immutable<StateOfReactStateInstance<Instance>>,
    produce: (
      recipe: ReactStateProduceRecipe<StateOfReactStateInstance<Instance>>,
    ) => void,
  ] {
    const instance = ReactStoreContainer.useClone(this);
    return [
      useBehaviorSubjectValue(instance),
      useConstant(() => (recipe) => instance.produce(recipe)),
    ];
  }

  static useState<Instance extends AnyReactState>(
    this: ReactStoreConstructor<Instance>,
  ): [
    state: Immutable<StateOfReactStateInstance<Instance>>,
    produce: (
      recipe: ReactStateProduceRecipe<StateOfReactStateInstance<Instance>>,
    ) => void,
  ];
  static useState<Instance extends AnyReactState, Selection>(
    this: ReactStoreConstructor<Instance>,
    selector: BehaviorSubjectValueSelector<
      Immutable<StateOfReactStateInstance<Instance>>,
      Selection
    >,
    deps?: React.DependencyList,
  ): [
    state: Selection,
    produce: (
      recipe: ReactStateProduceRecipe<StateOfReactStateInstance<Instance>>,
    ) => void,
  ];
  static useState<Instance extends AnyReactState, Selection>(
    this: ReactStoreConstructor<Instance>,
    selector?: BehaviorSubjectValueSelector<
      Immutable<StateOfReactStateInstance<Instance>>,
      Selection
    >,
    deps?: React.DependencyList,
  ): [
    state: Immutable<StateOfReactStateInstance<Instance>> | Selection,
    produce: (
      recipe: ReactStateProduceRecipe<StateOfReactStateInstance<Instance>>,
    ) => void,
  ] {
    const instance = ReactStoreContainer.useInstance(this);
    return [
      selector
        ? useBehaviorSubjectValueWithSelector(instance, selector, deps)
        : useBehaviorSubjectValue(instance),
      useConstant(() => (recipe) => instance.produce(recipe)),
    ];
  }

  constructor(initialState: Immutable<State>) {
    super(initialState);
  }

  get [Symbol.toStringTag](): string {
    return "ReactState";
  }

  produce(recipe: ReactStateProduceRecipe<State>): void {
    this.next(produce(this.getValue(), recipe));
  }
}

export function defineState<State>(
  init: Immutable<State>,
): DefinedReactStateClass<State> {
  return class DefinedReactState extends ReactState<State> {
    constructor() {
      super(init);
    }
  };
}
