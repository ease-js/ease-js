import React from "react";

/**
 * 在当前组件首次渲染时调用 initializer() 创建一个常量，其返回值将会被保存起来。
 */
export function useConstant<Constant>(initializer: () => Constant): Constant {
  return React.useState(initializer)[0];
}
