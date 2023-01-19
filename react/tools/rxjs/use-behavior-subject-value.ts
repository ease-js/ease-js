import React from "react";
import type { BehaviorSubject } from "rxjs";

const EmptyArray = [] as const;

export function useBehaviorSubjectValue<Value>(
  subject: BehaviorSubject<Value>,
): Value {
  const params = React.useMemo(() => {
    const getSnapshot = (): Value => subject.getValue();
    const subscribe = (onChange: () => void): () => void => {
      const subscription = subject.subscribe(onChange);
      return () => subscription.unsubscribe();
    };
    return [subscribe, getSnapshot] as const;
  }, [subject]);

  return React.useSyncExternalStore(...params);
}

export interface BehaviorSubjectValueSelector<Value, Selection> {
  (value: Value): Selection;
  (value: Value, prevValue: Value, prevSelection: Selection): Selection;
}

export function useBehaviorSubjectValueWithSelector<Value, Selection>(
  subject: BehaviorSubject<Value>,
  selector: BehaviorSubjectValueSelector<Value, Selection>,
  deps: React.DependencyList = EmptyArray,
): Selection {
  const params = React.useMemo(() => {
    let memoized: readonly [value: Value, selection: Selection] | undefined;

    const getSnapshot = (): Selection => {
      const value = subject.getValue();
      if (!memoized) {
        memoized = [value, selector(value)];
      } else if (!Object.is(memoized[0], value)) {
        memoized = [value, selector(value, ...memoized)];
      }
      return memoized[1];
    };
    const subscribe = (onChange: () => void): () => void => {
      const subscription = subject.subscribe(onChange);
      return () => subscription.unsubscribe();
    };
    return [subscribe, getSnapshot] as const;
  }, [subject, ...deps]);

  return React.useSyncExternalStore(...params);
}
