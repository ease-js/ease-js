import React from "react";
import type { Draft, Immutable } from "immer";
import { produce } from "immer";
import { BehaviorSubject } from "rxjs";
import {
  BehaviorSubjectValueSelector,
  useBehaviorSubjectValue,
  useBehaviorSubjectValueWithSelector,
} from "../tools/rxjs/use-behavior-subject-value.ts";
import type { ReactStoreConstructor } from "./container.tsx";
import { ReactStoreContainer } from "./container.tsx";

// deno-lint-ignore no-explicit-any
type Any = any;

export interface DefinedReactStateClass<State>
  extends
    ReactStoreConstructor<DefinedReactStateInstance<State>>,
    Omit<typeof ReactState, "prototype"> {
  prototype: DefinedReactStateInstance<State>;
}

export type DefinedReactStateInstance<State> = ReactState<State>;

export type StateOfReactStateInstance<Instance extends ReactState<Any>> =
  Instance extends ReactState<infer State> ? State : never;

export class ReactState<State> extends BehaviorSubject<Immutable<State>> {
  static clone<Class extends ReactStoreConstructor<Any>>(this: Class): Class {
    return ReactStoreContainer.clone(this);
  }

  static useLocalState<Instance extends ReactState<Any>>(
    this: ReactStoreConstructor<Instance>,
  ): [
    state: Immutable<StateOfReactStateInstance<Instance>>,
    instance: Instance,
  ] {
    const instance = ReactStoreContainer.useClone(this);
    return [useBehaviorSubjectValue(instance), instance];
  }

  static useState<Instance extends ReactState<Any>>(
    this: ReactStoreConstructor<Instance>,
  ): [
    state: Immutable<StateOfReactStateInstance<Instance>>,
    instance: Instance,
  ];
  static useState<Instance extends ReactState<Any>, Selection>(
    this: ReactStoreConstructor<Instance>,
    selector: BehaviorSubjectValueSelector<
      Immutable<StateOfReactStateInstance<Instance>>,
      Selection
    >,
    deps?: React.DependencyList,
  ): [state: Selection, instance: Instance];
  static useState<Instance extends ReactState<Any>, Selection>(
    this: ReactStoreConstructor<Instance>,
    selector?: BehaviorSubjectValueSelector<
      Immutable<StateOfReactStateInstance<Instance>>,
      Selection
    >,
    deps?: React.DependencyList,
  ): [
    state: Immutable<StateOfReactStateInstance<Instance>> | Selection,
    instance: Instance,
  ] {
    const instance = ReactStoreContainer.useInstance(this);
    return [
      selector
        ? useBehaviorSubjectValueWithSelector(instance, selector, deps)
        : useBehaviorSubjectValue(instance),
      instance,
    ];
  }

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

export function defineState<State>(
  init: Immutable<State>,
): DefinedReactStateClass<State> {
  return class DefinedReactState extends ReactState<State> {
    constructor() {
      super(init);
    }
  };
}
