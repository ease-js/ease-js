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
  useLocalState<Result>(
    this: BehaviorSubjectCombinationCreator<Result>,
  ): Result;
  useState<Result>(
    this: BehaviorSubjectCombinationCreator<Result>,
  ): Result;
  useState<Result, Selection>(
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
  return Object.assign(ReactStoreContainer.mixin(createCombination), {
    useLocalState,
    useState,
  });

  function createCombination(): BehaviorSubject<unknown> {
    const subject = new BehaviorSubject<unknown>(undefined);
    const observable = selector
      ? combineLatest<Combination, unknown>(
        creators as ObservableInputTuple<Combination>,
        selector,
      )
      : combineLatest<Combination>(
        creators as ObservableInputTuple<Combination>,
      );
    observable.subscribe(subject);
    return subject;
  }
}

function useLocalState<Result>(
  this: BehaviorSubjectCombinationCreator<Result>,
): Result {
  return useBehaviorSubjectValue(this.useClone());
}

function useState<Result>(
  this: BehaviorSubjectCombinationCreator<Result>,
): Result;
function useState<Result, Selection>(
  this: BehaviorSubjectCombinationCreator<Result>,
  selector: BehaviorSubjectValueSelector<Result, Selection>,
  deps?: React.DependencyList,
): Selection;
function useState<Result, Selection>(
  this: BehaviorSubjectCombinationCreator<Result>,
  selector?: BehaviorSubjectValueSelector<Result, Selection>,
  deps?: React.DependencyList,
): Result | Selection {
  return selector
    ? useBehaviorSubjectValueWithSelector(this.useInstance(), selector, deps)
    : useBehaviorSubjectValue(this.useInstance());
}
