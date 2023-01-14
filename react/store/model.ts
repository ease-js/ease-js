import type { Draft } from "immer";
import { createDraft, finishDraft } from "immer";
import { useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import type { NewableDependencyKey } from "../../core.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { useDependencyHost } from "./context.ts";

// deno-lint-ignore no-explicit-any
export abstract class Model<State extends { readonly [key: string]: any }>
  extends BehaviorSubject<State> {
  // deno-lint-ignore no-explicit-any
  static useModel<T extends Model<any>>(
    this: NewableDependencyKey<[], T>,
  ): [state: T["value"], model: T] {
    const host = useDependencyHost();
    const model = useConstant(() => host.new(this));

    const getSnapshot = useConstant(() => {
      return (): T["value"] => model.getValue();
    });
    const subscribe = useConstant(() => {
      return (onChange: () => void): () => void => {
        const subscription = model.subscribe(onChange);
        return () => subscription.unsubscribe();
      };
    });

    const state = useSyncExternalStore(subscribe, getSnapshot);
    return [state, model];
  }

  #draft: readonly [Draft<State>] | undefined;

  get draft(): Draft<State> {
    this.#draft ??= [createDraft(this.getValue())];
    return this.#draft[0];
  }

  commit(): void {
    const draft = this.#draft;
    this.#draft = undefined;

    if (draft) {
      const value = finishDraft(draft[0]) as State;
      if (!Object.is(this.getValue(), value)) this.next(value);
    }
  }

  next(value: State) {
    const draft = this.#draft;
    this.#draft = undefined;
    if (draft) finishDraft(draft);
    super.next(value);
  }
}
