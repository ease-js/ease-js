import type { Draft } from "immer";
import { createDraft, finishDraft } from "immer";
import { useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import type { NewableDependencyKey } from "../../core.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { useDependencyHost } from "./context.ts";

// deno-lint-ignore no-explicit-any
export type AnyModelState = { readonly [key: string | number]: any };

export abstract class Model<State extends AnyModelState>
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

  #draft: Draft<State> | null = null;

  get draft(): Draft<State> {
    if (this.#draft === null) this.#draft = createDraft(this.getValue());
    return this.#draft;
  }

  commit(): void {
    const next = this.#finishDraft();
    if (next !== null && !Object.is(this.getValue(), next)) {
      this.next(next);
    }
  }

  complete(): void {
    this.#finishDraft();
    super.complete();
  }

  next(value: State): void {
    this.#finishDraft();
    super.next(value);
  }

  #finishDraft(): State | null {
    const draft = this.#draft;
    this.#draft = null;
    return draft === null ? null : finishDraft(draft) as State;
  }
}
