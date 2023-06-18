/**
 * 针对 ReadonlyMap 类型提供的抽象接口。
 */
export interface AbstractReadonlyMap<Key, Value> {
  readonly get: (key: Key) => Value | undefined;
  readonly has: (key: Key) => boolean;
  // deno-lint-ignore no-explicit-any
  readonly set: (key: Key, value: Value) => any;
}

/**
 * 获取 Map 的键的类型。
 */
export declare type KeyOfMap<
  // deno-lint-ignore no-explicit-any
  MapInstance extends AbstractReadonlyMap<any, any>,
> // deno-lint-ignore no-explicit-any
 = MapInstance extends AbstractReadonlyMap<infer Key, any> ? Key : never;

/**
 * 获取 Map 的值的类型。
 */
export declare type ValueOfMap<
  // deno-lint-ignore no-explicit-any
  MapInstance extends AbstractReadonlyMap<any, any>,
> // deno-lint-ignore no-explicit-any
 = MapInstance extends AbstractReadonlyMap<any, infer Value> ? Value : never;
