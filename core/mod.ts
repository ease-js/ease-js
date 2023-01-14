import { createDependencyContainer } from "./ioc/container.ts";

export type {
  CallableDependencyKey,
  DependencyHost,
  DependencyKey,
  DependencyRootHost,
  DependencyScope,
  NewableDependencyKey,
} from "./ioc/container.ts";

export const { Hoist, Scope, createRoot } = createDependencyContainer();
