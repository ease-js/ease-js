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
import { ReactStoreContainer } from "./container.tsx";

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
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
): BehaviorSubjectCombinationCreator<Readonly<Combination>>;
export function defineCombination<Combination extends AnyCombination, Result>(
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector: (...combination: Combination) => Result,
): BehaviorSubjectCombinationCreator<Result>;
export function defineCombination<Combination extends AnyCombination>(
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector?: (...combination: Combination) => unknown,
):
  | BehaviorSubjectCombinationCreator<Readonly<Combination>>
  | BehaviorSubjectCombinationCreator<unknown> {
  const createCombination: BehaviorSubjectStoreCreator<unknown> =
    function createCombination(host) {
      const subject = new BehaviorSubject<unknown>(undefined);
      const stores = creators.map((create): BehaviorSubject<unknown> => {
        return host.call(create);
      });
      const observable = selector
        ? combineLatest(stores as ObservableInputTuple<Combination>, selector)
        : combineLatest(stores);
      observable.subscribe(subject);
      return subject;
    };

  return Object.assign(ReactStoreContainer.mixin(createCombination), {
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
