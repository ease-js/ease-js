import React from "react";
import { assert } from "std/testing/asserts.ts";

export interface RuntimeOnlyContextProviderProps<Value> {
  children?: React.ReactNode;
  value: Value;
}

export interface RuntimeOnlyContextProvider<Value> {
  (props: RuntimeOnlyContextProviderProps<Value>): React.ReactElement;
  displayName?: string;
}

export type RuntimeOnlyContext<Value> = [
  useContext: () => Value,
  Provider: RuntimeOnlyContextProvider<Value>,
];

/**
 * 创建没有 defaultValue 的 Context 。在调用 useContext() 读取 Context 时，如果当前组件不在 Provider 下，则直接抛出错误。
 */
export function createRuntimeOnlyContext<Value>(
  name?: string | false,
): RuntimeOnlyContext<Value> {
  const displayName = name || "Anonymous";
  const Context = React.createContext<readonly [Value] | null>(null);

  const useContext: () => Value = () => {
    const value = React.useContext(Context);
    assert(
      value,
      `Read runtime only context failed, please ensure the provider of "${displayName}" has been mounted`,
    );
    return value[0];
  };
  const Provider: RuntimeOnlyContextProvider<Value> = (props) => {
    const { children, value } = props;
    const ref = React.useRef<readonly [Value]>();

    if (!ref.current || !Object.is(ref.current[0], value)) {
      ref.current = [value];
    }

    return <Context.Provider value={ref.current}>{children}</Context.Provider>;
  };

  Context.displayName = displayName;
  Provider.displayName = `${displayName}Provider`;

  return [useContext, Provider];
}
