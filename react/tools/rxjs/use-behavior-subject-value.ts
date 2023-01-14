import React from "react";
import { BehaviorSubject } from "rxjs";

export function useBehaviorSubjectValue<Value>(
  subject: BehaviorSubject<Value>,
): Value {
  const [getSnapshot, subscribe] = React.useMemo(() => {
    return [
      (): Value => subject.getValue(),
      (onChange: () => void): () => void => {
        const subscription = subject.subscribe(onChange);
        return () => subscription.unsubscribe();
      },
    ] as const;
  }, [subject]);

  return React.useSyncExternalStore(subscribe, getSnapshot);
}
