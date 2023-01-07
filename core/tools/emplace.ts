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

/**
 * 更新 map 中 key 对应的 value ：
 *
 * - 如果 map 中**不存在** key 相关记录：
 *   - 传入 handlers.insert 时，调用 insert() 创建一个新的记录插入到 map 当中，并返回新的值；
 *   - 没有传入 handlers.insert 时，返回 `undefined` ；
 * - 如果 map 中**存在** key 相关记录：
 *   - 传入 handlers.update 时，调用 update() 获取更新后的值并插入到 map 当中，然后返回新的值；
 *   - 没有传入 handlers.update 时，返回已存在的值。
 *
 * @see https://github.com/tc39/proposal-upsert
 */
export function emplaceMap<
  // deno-lint-ignore no-explicit-any
  M extends Map<any, any> | WeakMap<any, any> | AbstractReadonlyMap<any, any>,
>(
  map: M,
  key: KeyOfMap<M>,
  handlers: {
    readonly insert: (key: KeyOfMap<M>, map: M) => ValueOfMap<M>;
    readonly update?: (
      existing: ValueOfMap<M>,
      key: KeyOfMap<M>,
      map: M,
    ) => ValueOfMap<M>;
  },
): ValueOfMap<M>;
export function emplaceMap<
  // deno-lint-ignore no-explicit-any
  M extends Map<any, any> | WeakMap<any, any> | AbstractReadonlyMap<any, any>,
>(
  map: M,
  key: KeyOfMap<M>,
  handlers: {
    readonly insert?: (key: KeyOfMap<M>, map: M) => ValueOfMap<M>;
    readonly update: (
      existing: ValueOfMap<M>,
      key: KeyOfMap<M>,
      map: M,
    ) => ValueOfMap<M>;
  },
): ValueOfMap<M> | undefined;
export function emplaceMap<
  // deno-lint-ignore no-explicit-any
  M extends Map<any, any> | WeakMap<any, any> | AbstractReadonlyMap<any, any>,
>(
  map: M,
  key: KeyOfMap<M>,
  handlers: {
    readonly insert?: (key: KeyOfMap<M>, map: M) => ValueOfMap<M>;
    readonly update?: (
      existing: ValueOfMap<M>,
      key: KeyOfMap<M>,
      map: M,
    ) => ValueOfMap<M>;
  },
): ValueOfMap<M> | undefined {
  const { insert, update } = handlers;

  // map 上存储的 value 可能为 undefined
  // 所以需要用 map.has() 而不是 map.get() !== undefined
  if (map.has(key)) {
    let value: ValueOfMap<M> = map.get(key);

    if (update) {
      value = update(value, key, map);
      map.set(key, value);
    }

    return value;
  }

  if (!insert) return;

  const value = insert(key, map);
  map.set(key, value);
  return value;
}
