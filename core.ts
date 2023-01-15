import { createDependencyContainer } from "./core/ioc/container.ts";

export type {
  CallableDependencyKey,
  DependencyHost,
  DependencyKey,
  DependencyRootHost,
  DependencyScope,
  NewableDependencyKey,
  WeakDependencyHandle,
} from "./core/ioc/container.ts";

export const { Hoist, Scope, createRoot } = createDependencyContainer();
