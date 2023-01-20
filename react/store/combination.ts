import type React from "react";
import type { ObservableInputTuple } from "rxjs";
import { BehaviorSubject, combineLatest } from "rxjs";
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

export interface BehaviorSubjectCombinationCreator<Combination>
  extends
    ReactStoreCreator<BehaviorSubject<Combination>>,
    ReactStoreCreatorMixins,
    BehaviorSubjectCombinationCreatorMixins {}

export interface BehaviorSubjectCombinationCreatorMixins {
  useCombination<Result>(
    this: BehaviorSubjectCombinationCreator<Result>,
  ): Result;
  useCombination<Result, Selection>(
    this: BehaviorSubjectCombinationCreator<Result>,
    selector: BehaviorSubjectValueSelector<Result, Selection>,
    deps?: React.DependencyList,
  ): Selection;
}

export function defineCombination<Combination extends AnyCombination>(
  deps: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
): BehaviorSubjectCombinationCreator<Readonly<Combination>>;
export function defineCombination<Combination extends AnyCombination, Result>(
  deps: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector: (...combination: Combination) => Result,
): BehaviorSubjectCombinationCreator<Result>;
export function defineCombination<Combination extends AnyCombination>(
  deps: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector?: (...combination: Combination) => unknown,
):
  | BehaviorSubjectCombinationCreator<Readonly<Combination>>
  | BehaviorSubjectCombinationCreator<unknown> {
  const createCombination: ReactStoreCreator<BehaviorSubject<unknown>> =
    function createCombination(host) {
      const dest = new BehaviorSubject<unknown>(undefined);
      const sources = deps.map((dep): BehaviorSubject<unknown> => {
        return host.call(dep);
      });
      const observable = selector
        ? combineLatest(sources as ObservableInputTuple<Combination>, selector)
        : combineLatest(sources);
      observable.subscribe(dest);
      return dest;
    };

  return Object.assign(store.mixin(createCombination), {
    useCombination,
  });
}

function useCombination<Result>(
  this: BehaviorSubjectCombinationCreator<Result>,
): Result;
function useCombination<Result, Selection>(
  this: BehaviorSubjectCombinationCreator<Result>,
  selector: BehaviorSubjectValueSelector<Result, Selection>,
  deps?: React.DependencyList,
): Selection;
function useCombination<Result, Selection>(
  this: BehaviorSubjectCombinationCreator<Result>,
  selector?: BehaviorSubjectValueSelector<Result, Selection>,
  deps?: React.DependencyList,
): Result | Selection {
  return selector
    ? useBehaviorSubjectValueWithSelector(this.useInstance(), selector, deps)
    : useBehaviorSubjectValue(this.useInstance());
}
