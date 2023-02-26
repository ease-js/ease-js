import type { DependencyContainer } from "./core/ioc/container.ts";
import { createDependencyContainer } from "./core/ioc/container.ts";

export * from "./core/ioc/container.ts";

export const container: DependencyContainer = createDependencyContainer({
  createDescriptor: (descriptor) => descriptor,
});
