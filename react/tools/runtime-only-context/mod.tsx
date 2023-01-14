import React from "react";
import { assert } from "std/testing/asserts.ts";

export interface RuntimeOnlyContextProviderProps<Value> {
  children?: React.ReactNode;
  value: Value;
}

/**
 * 创建没有 defaultValue 的 Context 。在调用 useContext() 读取 Context 时，如果当前组件不在 Provider 下，则直接抛出错误。
 */
export function createRuntimeOnlyContext<Value>(
  name?: string | false,
): [
  useContext: () => Value,
  Provider: (
    props: RuntimeOnlyContextProviderProps<Value>,
  ) => React.ReactElement,
] {
  const displayName = name || "Anonymous";
  const Context = React.createContext<readonly [Value] | null>(null);
  Context.displayName = displayName;

  const Provider = function RuntimeOnlyContextProvider(
    props: RuntimeOnlyContextProviderProps<Value>,
  ): React.ReactElement {
    const { children, value } = props;
    const ref = React.useRef<readonly [Value]>();

    if (!ref.current || !Object.is(ref.current[0], value)) {
      ref.current = [value];
    }

    return <Context.Provider value={ref.current}>{children}</Context.Provider>;
  };

  const useContext = function useRuntimeOnlyContext(): Value {
    const value = React.useContext(Context);
    assert(
      value,
      `Read runtime only context failed, please ensure the provider of "${displayName}" has been mounted`,
    );
    return value[0];
  };

  return [useContext, Provider];
}
