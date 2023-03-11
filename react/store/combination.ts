import type { React } from "../deps.ts";
import { core, rxjs } from "../deps.ts";

import type { BehaviorSubjectValueSelector } from "../tools/use-behavior-subject-value.ts";
import {
  useBehaviorSubjectValue,
  useBehaviorSubjectValueWithSelector,
} from "../tools/use-behavior-subject-value.ts";
import type {
  ReactStoreCreator,
  ReactStoreCreatorMixins,
  ReactStoreCreatorWithDestructor,
} from "./container.tsx";
import { store } from "./container.tsx";

// deno-lint-ignore no-explicit-any
type AnyCombination = readonly any[];

export type BehaviorSubjectStoreCreator<T> = ReactStoreCreator<
  rxjs.BehaviorSubject<T>
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

export class CombinationDestination<Result>
  extends rxjs.BehaviorSubject<Result> {
  readonly #subscription: rxjs.Subscription;

  constructor(source: rxjs.Observable<Result>) {
    super(undefined!);
    this.#subscription = source.subscribe(this);
  }

  get [Symbol.toStringTag](): string {
    return "CombinationDestination";
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
    const sources = deps.map((dep): rxjs.BehaviorSubject<unknown> => {
      return host.call(dep);
    }) as rxjs.ObservableInputTuple<Combination>;
    const observable = selector
      ? rxjs.combineLatest(sources, selector)
      : rxjs.combineLatest(sources);
    return new CombinationDestination(observable);
  };
  createCombination[core.destructor] = (destination) => {
    destination.unsubscribe();
  };

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
