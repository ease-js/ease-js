import {
  assert,
  assertExists,
  assertFalse,
} from "https://deno.land/std@0.170.0/testing/asserts.ts";
import { emplaceMap } from "../tools/emplace.ts";

const nothing = Symbol("nothing");

// class UnstableDependencyWeakRegistry<Scope, Token, Value> {
//   readonly #dependencies = new Map<
//     Token,
//     WeakRef<Dependency<Scope, Token, Value>>
//   >();
//   readonly #finalization = new FinalizationRegistry((token: Token): void => {
//     this.#dependencies.delete(token);
//   });
//
//   clear(): void {
//     this.#dependencies.clear();
//   }
//
//   emplace(
//     token: Token,
//     insert: () => Dependency<Scope, Token, Value>,
//   ): Dependency<Scope, Token, Value> {
//     const existing = this.#dependencies.get(token)?.deref();
//     if (existing) return existing;
//
//     const child = insert();
//     this.#dependencies.set(token, new WeakRef(child));
//     this.#finalization.register(child, token);
//     return child;
//   }
// }

export class Dependency<Scope, Token, Value = unknown> {
  readonly #scope: NonNullable<Scope>;
  readonly #token: Token;
  #children = new Map<Token, Dependency<Scope, Token>>();
  #parent: Dependency<Scope, Token> | undefined;
  #value: Value | typeof nothing = nothing;

  constructor(scope: Scope, token: Token) {
    assertExists(scope);

    this.#scope = scope;
    this.#token = token;
  }

  get value(): Value {
    assertUnrevoked(this);
    assert(
      typeof this.#value !== "symbol" || this.#value !== nothing,
      "Dependency is not ready yet",
    );

    return this.#value;
  }

  allocate<ChildValue>(
    token: Token,
    childScope: Scope,
    underScope?: Scope | null,
  ): Dependency<Scope, Token, ChildValue>;
  allocate(
    token: Token,
    childScope: Scope,
    underScope: Scope | null = this.#scope,
  ): Dependency<Scope, Token> {
    assertUnrevoked(this);

    let parent: Dependency<Scope, Token> | undefined;
    for (
      parent = this;
      parent.#scope !== underScope && parent.#parent;
      parent = parent.#parent
    ) {
      // noop
    }

    return emplaceMap(parent.#children, token, {
      insert: () => {
        const child = new Dependency<Scope, Token>(childScope, token);
        child.#parent = parent;
        return child;
      },
    });
  }

  prepare(value: Value): void {
    assertUnrevoked(this);
    assert(this.#value === nothing, "Value can only be set once");

    this.#value = value;
  }

  revoke(): void {
    if (isRevoked(this)) return;

    const parent = this.#parent;
    const pending: Map<Token, Dependency<Scope, Token>>[] = [];
    const free = (
      dep: Dependency<Scope, Token>,
    ): Map<Token, Dependency<Scope, Token>> => {
      const children = dep.#children;
      dep.#children = null!;
      dep.#parent = undefined;
      dep.#value = nothing;
      revoke(dep);
      return children;
    };

    if (parent) parent.#children.delete(this.#token);
    let children: Map<Token, Dependency<Scope, Token>> | undefined = free(this);
    do {
      for (const child of children.values()) {
        pending.push(free(child));
      }

      children.clear();
    } while ((children = pending.pop()));
  }
}

const Revoked = new WeakSet();

// deno-lint-ignore ban-types
type RevocableObject = object;

// 新版 decorators 暂时不可用
// function AssertUnrevoked<T extends CallableFunction>(method: T): T;
// function AssertUnrevoked(method: CallableFunction): CallableFunction {
//   return function (this: RevocableObject) {
//     assertUnrevoked(this);
//     return Reflect.apply(method, this, arguments);
//   }
// }

function assertUnrevoked(object: RevocableObject): void {
  assertFalse(isRevoked(object), "Cannot access revoked object");
}

function isRevoked(object: RevocableObject): boolean {
  return Revoked.has(object);
}

function revoke(object: RevocableObject): void {
  Revoked.add(object);
}
