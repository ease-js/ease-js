import type React from "react";
import type { Observable, ObservableInputTuple, Subscription } from "rxjs";
import { BehaviorSubject, combineLatest } from "rxjs";
import { destructor } from "../../core.ts";
import type { BehaviorSubjectValueSelector } from "../tools/rxjs/use-behavior-subject-value.ts";
import {
  useBehaviorSubjectValue,
  useBehaviorSubjectValueWithSelector,
} from "../tools/rxjs/use-behavior-subject-value.ts";
import type {
  ReactStoreCreator,
  ReactStoreCreatorMixins,
  ReactStoreCreatorWithDestructor,
} from "./container.tsx";
import { store } from "./container.tsx";

// deno-lint-ignore no-explicit-any
type AnyCombination = readonly any[];

export type BehaviorSubjectStoreCreator<T> = ReactStoreCreator<
  BehaviorSubject<T>
>;

export type BehaviorSubjectStoreCreatorInputTuple<
  Combination extends AnyCombination,
> = {
  [Index in keyof Combination]: BehaviorSubjectStoreCreator<Combination[Index]>;
};

export interface CombinationDestinationCreator<Combination>
  extends
    ReactStoreCreatorWithDestructor<CombinationDestination<Combination>>,
    ReactStoreCreatorMixins,
    CombinationDestinationCreatorMixins {}

export interface CombinationDestinationCreatorMixins {
  useCombination<Result>(
    this: CombinationDestinationCreator<Result>,
  ): Result;
  useCombination<Result, Selection>(
    this: CombinationDestinationCreator<Result>,
    selector: BehaviorSubjectValueSelector<Result, Selection>,
    deps?: React.DependencyList,
  ): Selection;
}

export class CombinationDestination<Result> extends BehaviorSubject<Result> {
  readonly #subscription: Subscription;

  constructor(source: Observable<Result>) {
    super(undefined!);
    this.#subscription = source.subscribe(this);
  }

  unsubscribe(): void {
    this.#subscription.unsubscribe();
    super.unsubscribe();
  }
}

export function defineCombination<Combination extends AnyCombination>(
  deps: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
): CombinationDestinationCreator<Readonly<Combination>>;
export function defineCombination<Combination extends AnyCombination, Result>(
  deps: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector: (...combination: Combination) => Result,
): CombinationDestinationCreator<Result>;
export function defineCombination<Combination extends AnyCombination>(
  deps: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector?: (...combination: Combination) => unknown,
):
  | CombinationDestinationCreator<Readonly<Combination>>
  | CombinationDestinationCreator<unknown> {
  const createCombination: ReactStoreCreatorWithDestructor<
    CombinationDestination<unknown>
  > = function createCombination(host) {
    const sources = deps.map((dep): BehaviorSubject<unknown> => {
      return host.call(dep);
    });
    const observable = selector
      ? combineLatest(sources as ObservableInputTuple<Combination>, selector)
      : combineLatest(sources);
    return new CombinationDestination(observable);
  };
  createCombination[destructor] = (destination) => destination.unsubscribe();

  return Object.assign(store.mixin(createCombination), {
    useCombination,
  });
}

function useCombination<Result>(
  this: CombinationDestinationCreator<Result>,
): Result;
function useCombination<Result, Selection>(
  this: CombinationDestinationCreator<Result>,
  selector: BehaviorSubjectValueSelector<Result, Selection>,
  deps?: React.DependencyList,
): Selection;
function useCombination<Result, Selection>(
  this: CombinationDestinationCreator<Result>,
  selector?: BehaviorSubjectValueSelector<Result, Selection>,
  deps?: React.DependencyList,
): Result | Selection {
  return selector
    ? useBehaviorSubjectValueWithSelector(this.useInstance(), selector, deps)
    : useBehaviorSubjectValue(this.useInstance());
}
