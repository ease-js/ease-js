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

export interface BehaviorSubjectCombinationCreator<
  Combination extends AnyCombination,
> extends
  ReactStoreCreator<BehaviorSubject<Combination>>,
  ReactStoreCreatorMixins,
  BehaviorSubjectCombinationCreatorMixins {}

export interface BehaviorSubjectCombinationCreatorMixins {
  useLocalState<Combination extends AnyCombination>(
    this: BehaviorSubjectCombinationCreator<Combination>,
  ): Combination;
  useState<Combination extends AnyCombination>(
    this: BehaviorSubjectCombinationCreator<Combination>,
  ): Combination;
  useState<Combination extends AnyCombination, Selection>(
    this: BehaviorSubjectCombinationCreator<Combination>,
    selector: BehaviorSubjectValueSelector<Combination, Selection>,
    deps?: React.DependencyList,
  ): Selection;
}

export function defineCombination<Combination extends AnyCombination>(
  creators: readonly [...BehaviorSubjectStoreCreatorInputTuple<Combination>],
): BehaviorSubjectCombinationCreator<Combination> {
  return Object.assign(ReactStoreContainer.mixin(createCombination), {
    useLocalState,
    useState,
  });

  function createCombination(): BehaviorSubject<Combination> {
    const subject = new BehaviorSubject<Combination>(undefined!);
    combineLatest<Combination>(creators as ObservableInputTuple<Combination>)
      .subscribe(subject);
    return subject;
  }
}

function useLocalState<Combination extends AnyCombination>(
  this: BehaviorSubjectCombinationCreator<Combination>,
): Combination {
  return useBehaviorSubjectValue(this.useClone());
}

function useState<Combination extends AnyCombination>(
  this: BehaviorSubjectCombinationCreator<Combination>,
): Combination;
function useState<Combination extends AnyCombination, Selection>(
  this: BehaviorSubjectCombinationCreator<Combination>,
  selector: BehaviorSubjectValueSelector<Combination, Selection>,
  deps?: React.DependencyList,
): Selection;
function useState<Combination extends AnyCombination, Selection>(
  this: BehaviorSubjectCombinationCreator<Combination>,
  selector?: BehaviorSubjectValueSelector<Combination, Selection>,
  deps?: React.DependencyList,
): Combination | Selection {
  return selector
    ? useBehaviorSubjectValueWithSelector(this.useInstance(), selector, deps)
    : useBehaviorSubjectValue(this.useInstance());
}
