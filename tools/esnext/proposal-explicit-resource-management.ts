import { assert } from "../std/testing/asserts.ts";

declare global {
  interface Disposable {
    /**
     * Disposes of resources within this object.
     */
    [Symbol.dispose](): void;
  }

  class DisposableStack implements Disposable {
    /**
     * Gets a value indicating whether the stack has been disposed.
     */
    get disposed(): boolean;

    /**
     * Adds a non-disposable resource and a disposal callback to the top of the stack.
     *
     * @param value - A resource to be disposed.
     * @param onDispose - A callback invoked to dispose the provided value.
     * @returns The provided value.
     */
    adopt<T>(value: T, onDispose: (value: T) => void): T;

    /**
     * Adds a disposal callback to the top of the stack.
     *
     * @param onDispose - A callback to evaluate when this object is disposed.
     */
    defer(onDispose: () => void): void;

    /**
     * Alias for `[Symbol.dispose]()`.
     */
    dispose(): void;

    /**
     * Moves all resources currently in this stack into a new `DisposableStack`.
     * @returns The new `DisposableStack`.
     */
    move(): DisposableStack;

    /**
     * Adds a resource to the top of the stack. Has no effect if provided `null` or `undefined`.
     *
     * @param value - A `Disposable` object, `null`, or `undefined`.
     * @returns The provided value.
     */
    use<T extends Disposable | null | undefined>(value: T): T;

    /**
     * Disposes of resources within this object.
     */
    [Symbol.dispose](): void;

    [Symbol.toStringTag]: string;
  }

  class SuppressedError extends Error {
    /**
     * Wraps an error that suppresses another error, and the error that was suppressed.
     *
     * @param error The error that resulted in a suppression.
     * @param suppressed The error that was suppressed.
     * @param message The message for the error.
     * @param options Options for the error.
     */
    constructor(
      error: unknown,
      suppressed: unknown,
      message?: string,
      options?: ErrorOptions,
    );

    /**
     * The error that resulted in a suppression.
     */
    error: unknown;

    /**
     * The error that was suppressed.
     */
    suppressed: unknown;
  }

  interface SymbolConstructor {
    readonly dispose: unique symbol;
  }
}

// Symbol.dispose --->
(() => {
  const name = "dispose";

  if (name in (Symbol as SymbolConstructor)) return;

  __defineConst(Symbol, "dispose", Symbol(`Symbol.${name}`));
})();
// <--- Symbol.dispose

// DisposableStack --->
(() => {
  const name = "DisposableStack";

  if (name in globalThis) return;

  const impl = class DisposableStack {
    static {
      const proto = this.prototype;
      __defineConst(this, "name", name, true, true);
      __defineConst(proto, Symbol.toStringTag, name, true);
    }

    #stack: (() => void)[] | undefined = [];

    get disposed(): boolean {
      return !this.#stack;
    }

    adopt<T>(value: T, onDispose: (value: T) => void): T {
      assert(typeof onDispose === "function");
      this.#ensureStack().push(() => onDispose(value));
      return value;
    }

    defer(onDispose: () => void): void {
      assert(typeof onDispose === "function");
      this.#ensureStack().push(onDispose);
    }

    dispose(): void {
      this.#dispose();
    }

    move(): DisposableStack {
      const stack = this.#ensureStack();
      const dest = new DisposableStack();
      dest.#stack = stack;
      this.#stack = undefined;
      return dest;
    }

    use<T extends Disposable | null | undefined>(value: T): T {
      if (value) this.#ensureStack().push(() => value[Symbol.dispose]());
      return value;
    }

    [Symbol.dispose](): void {
      this.#dispose();
    }

    #dispose(): void {
      const stack = this.#stack;
      if (!stack) return;

      this.#stack = undefined;
      let thrown = false;
      let suppressed: unknown;

      for (let index = stack.length, dispose: () => void; index > 0;) {
        dispose = stack[--index];
        try {
          dispose();
        } catch (error) {
          if (thrown) {
            suppressed = new SuppressedError(error, suppressed);
          } else {
            thrown = true;
            suppressed = error;
          }
        }
      }

      if (thrown) throw suppressed;
    }

    #ensureStack(): (() => void)[] {
      if (!this.#stack) throw new ReferenceError(`${name} already disposed`);
      return this.#stack;
    }
  };

  __defineConst(globalThis, name, impl, true, true);
})();
// <--- DisposableStack

// SuppressedError --->
(() => {
  const name = "SuppressedError";

  if (name in globalThis) return;

  const impl = class SuppressedError extends Error {
    static {
      const proto = this.prototype;
      __defineConst(this, "name", name, true, true);
      __defineConst(proto, Symbol.toStringTag, name, true);
      __defineConst(proto, "message", "", true, true);
      __defineConst(proto, "name", name, true, true);
    }

    constructor(
      error: unknown,
      suppressed: unknown,
      message?: string,
      options?: ErrorOptions,
    ) {
      super(message, options);
      __defineConst(this, "error", error, true, true);
      __defineConst(this, "suppressed", suppressed, true, true);
    }
  };

  __defineConst(globalThis, name, impl, true, true);
})();
// <--- SuppressedError

function __defineConst(
  target: Parameters<typeof Reflect["defineProperty"]>[0],
  key: Parameters<typeof Reflect["defineProperty"]>[1],
  value: unknown,
  configurable?: boolean,
  writable?: boolean,
  enumerable?: boolean,
) {
  Reflect.defineProperty(target, key, {
    configurable,
    enumerable,
    value,
    writable,
  });
}
