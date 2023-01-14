import React from "react";
import { createRoot } from "../../core.ts";
import { useConstant } from "../tools/memo/use-constant.ts";
import { DependencyHostProvider } from "./context.ts";

export class ReactApp {
  // noop
}

export interface ReactAppProviderProps {
  children?: React.ReactNode;
}

export function ReactAppProvider(
  props: ReactAppProviderProps,
): React.ReactElement {
  const { children } = props;
  const host = useConstant(() => createRoot(ReactApp));

  return (
    <DependencyHostProvider value={host}>{children}</DependencyHostProvider>
  );
}
