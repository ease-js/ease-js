import type React from "react";
import type { Draft, Immutable } from "immer";
import { produce } from "immer";
import { BehaviorSubject } from "rxjs";
import { useConstant } from "../tools/memo/use-constant.ts";
import type { BehaviorSubjectValueSelector } from "../tools/rxjs/use-behavior-subject-value.ts";
import {
  useBehaviorSubjectValue,
  useBehaviorSubjectValueWithSelector,
} from "../tools/rxjs/use-behavior-subject-value.ts";
import type {
  ReactStoreCreator,
  ReactStoreCreatorMixins,
} from "./container.tsx";
import { store } from "./container.tsx";

export interface ReactStateCreator<State>
  extends
    ReactStoreCreator<ReactState<State>>,
    ReactStoreCreatorMixins,
    ReactStateCreatorMixins {}

export interface ReactStateCreatorMixins {
  useLocalState<State>(this: ReactStateCreator<State>): [
    state: Immutable<State>,
    produce: (recipe: ReactStateProduceRecipe<State>) => void,
  ];
  useState<State>(this: ReactStateCreator<State>): [
    state: Immutable<State>,
    produce: (recipe: ReactStateProduceRecipe<State>) => void,
  ];
  useState<State, Selection>(
    this: ReactStateCreator<State>,
    selector: BehaviorSubjectValueSelector<Immutable<State>, Selection>,
    deps?: React.DependencyList,
  ): [
    state: Selection,
    produce: (recipe: ReactStateProduceRecipe<State>) => void,
  ];
}

export type ReactStateProduceRecipe<State> = (
  draft: Draft<State>,
) => void | Draft<State>;

// deno-lint-ignore no-explicit-any
export type StateOfReactStateInstance<Instance extends ReactState<any>> =
  Instance extends ReactState<infer State> ? State : never;

export class ReactState<State> extends BehaviorSubject<Immutable<State>> {
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
): ReactStateCreator<State> {
  const createReactState: ReactStoreCreator<ReactState<State>> =
    function createReactState() {
      return new ReactState(init);
    };

  return Object.assign(store.mixin(createReactState), {
    useLocalState,
    useState,
  });
}

function useLocalState<State>(this: ReactStateCreator<State>): [
  state: Immutable<State>,
  produce: (recipe: ReactStateProduceRecipe<State>) => void,
] {
  const instance = this.useClone();
  return [
    useBehaviorSubjectValue(instance),
    useConstant(() => (recipe) => instance.produce(recipe)),
  ];
}

function useState<State>(this: ReactStateCreator<State>): [
  state: Immutable<State>,
  produce: (recipe: ReactStateProduceRecipe<State>) => void,
];
function useState<State, Selection>(
  this: ReactStateCreator<State>,
  selector: BehaviorSubjectValueSelector<Immutable<State>, Selection>,
  deps?: React.DependencyList,
): [
  state: Selection,
  produce: (recipe: ReactStateProduceRecipe<State>) => void,
];
function useState<State, Selection>(
  this: ReactStateCreator<State>,
  selector?: BehaviorSubjectValueSelector<Immutable<State>, Selection>,
  deps?: React.DependencyList,
): [
  state: Immutable<State> | Selection,
  produce: (recipe: ReactStateProduceRecipe<State>) => void,
] {
  const instance = this.useInstance();
  return [
    selector
      ? useBehaviorSubjectValueWithSelector(instance, selector, deps)
      : useBehaviorSubjectValue(instance),
    useConstant(() => (recipe) => instance.produce(recipe)),
  ];
}
