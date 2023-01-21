/**
 * 此模块创建了一对 API ，调用 revoke(input) 可将传入的 input 对象标记为已回收，而调用
 * revoke.assert(input) 则可用于断言传入的 input 对象**没有**被标记为已回收。
 *
 * @module
 */

import { assert } from "std/testing/asserts.ts";

// deno-lint-ignore ban-types
type RevocableType = object;

interface RevokeAPI {
  (input: RevocableType): boolean;
  readonly assert: (input: RevocableType) => void;
  readonly has: (input: RevocableType) => boolean;
}

/**
 * 调用 revoke(input) 可将传入的 input 对象标记为已回收。
 *
 * @returns 返回一个布尔值，表明当前对象是否未曾被回收过。
 *
 * @example
 * ```ts
 * const input = {};
 * revoke.has(input);      // false
 * revoke.assert(input);   // ✅
 *
 * revoke(input);          // true
 * revoke(input);          // false
 * revoke.has(input);      // true
 * revoke.assert(input);   // ❌
 * ```
 */
const container: RevokeAPI = /** #__PURE__ */ createContainer();
export { container as revoke };

function createContainer(): RevokeAPI {
  const Revoked = new WeakSet();

  const assertUnrevoked: RevokeAPI["assert"] = (input: RevocableType) => {
    assert(!hasBeenRevoked(input), "Cannot access revoked object");
  };

  const hasBeenRevoked: RevokeAPI["has"] = (input: RevocableType) => {
    return Revoked.has(input);
  };

  function revoke(input: RevocableType): boolean {
    if (hasBeenRevoked(input)) return false;
    Revoked.add(input);
    return true;
  }

  // 新版 decorators 暂时不可用
  // const decorate = (method) => {
  //   return function (this: RevocableType) {
  //     assertUnrevoked(this);
  //     return Reflect.apply(method, this, arguments);
  //   }
  // }

  revoke.assert = assertUnrevoked;
  revoke.has = hasBeenRevoked;

  return revoke;
}
