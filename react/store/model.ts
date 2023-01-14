import type { Draft } from "immer";
import { createDraft, finishDraft } from "immer";
import { useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import type { NewableDependencyKey } from "../../core.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { useDependencyHost } from "./context.ts";

// deno-lint-ignore no-explicit-any
type AnyState = { readonly [key: PropertyKey]: any };

export abstract class Model<State extends AnyState> {
  // deno-lint-ignore no-explicit-any
  static useModel<Instance extends Model<any>>(
    this: NewableDependencyKey<[], Instance>,
  ): [state: Instance["state"], model: Instance] {
    const host = useDependencyHost();
    const model = useConstant(() => host.new(this));

    const getSnapshot = useConstant(() => {
      return (): Instance["state"] => model.state;
    });
    const subscribe = useConstant(() => {
      return (onChange: () => void): () => void => {
        const subscription = model.#subject.subscribe(onChange);
        return () => subscription.unsubscribe();
      };
    });

    const state = useSyncExternalStore(subscribe, getSnapshot);
    return [state, model];
  }

  #draft: Draft<State> | undefined;
  readonly #subject: BehaviorSubject<State>;

  constructor(initialState: State) {
    this.#subject = new BehaviorSubject(initialState);
  }

  get draft(): Draft<State> {
    return this.#draft ??= createDraft(this.state);
  }

  get state(): State {
    return this.#subject.getValue();
  }
  set state(value: State) {
    this.#finishDraft();
    this.#subject.next(value);
  }

  commit(): void {
    const next = this.#finishDraft();
    if (next !== undefined) this.state = next;
  }

  #finishDraft(): State | undefined {
    const draft = this.#draft;
    if (draft === undefined) return;
    this.#draft = undefined;
    return finishDraft(draft) as State;
  }
}
