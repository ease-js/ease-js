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
  useLocalState<Combination>(
    this: BehaviorSubjectCombinationCreator<Combination>,
  ): Combination;
  useState<Combination>(
    this: BehaviorSubjectCombinationCreator<Combination>,
  ): Combination;
  useState<Combination, Selection>(
    this: BehaviorSubjectCombinationCreator<Combination>,
    selector: BehaviorSubjectValueSelector<Combination, Selection>,
    deps?: React.DependencyList,
  ): Selection;
}

export function defineCombination<Combination extends AnyCombination>(
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
): BehaviorSubjectCombinationCreator<Readonly<Combination>>;
export function defineCombination<
  Combination extends AnyCombination,
  Selection,
>(
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector: (...combination: Combination) => Selection,
): BehaviorSubjectCombinationCreator<Selection>;
export function defineCombination<Combination extends AnyCombination>(
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
  selector: (...combination: Combination) => unknown = defaultSelector,
):
  | BehaviorSubjectCombinationCreator<Readonly<Combination>>
  | BehaviorSubjectCombinationCreator<unknown> {
  return Object.assign(ReactStoreContainer.mixin(createCombination), {
    useLocalState,
    useState,
  });

  function createCombination(): BehaviorSubject<unknown> {
    const subject = new BehaviorSubject<unknown>(undefined);
    combineLatest<Combination, unknown>(
      creators as ObservableInputTuple<Combination>,
      selector,
    )
      .subscribe(subject);
    return subject;
  }
}

function defaultSelector<Combination extends AnyCombination>(
  ...combination: Combination
): Combination {
  return combination;
}

function useLocalState<Combination>(
  this: BehaviorSubjectCombinationCreator<Combination>,
): Combination {
  return useBehaviorSubjectValue(this.useClone());
}

function useState<Combination>(
  this: BehaviorSubjectCombinationCreator<Combination>,
): Combination;
function useState<Combination, Selection>(
  this: BehaviorSubjectCombinationCreator<Combination>,
  selector: BehaviorSubjectValueSelector<Combination, Selection>,
  deps?: React.DependencyList,
): Selection;
function useState<Combination, Selection>(
  this: BehaviorSubjectCombinationCreator<Combination>,
  selector?: BehaviorSubjectValueSelector<Combination, Selection>,
  deps?: React.DependencyList,
): Combination | Selection {
  return selector
    ? useBehaviorSubjectValueWithSelector(this.useInstance(), selector, deps)
    : useBehaviorSubjectValue(this.useInstance());
}
