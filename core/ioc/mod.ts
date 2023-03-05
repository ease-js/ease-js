import type { DependencyContainer } from "./container.ts";
import { createDependencyContainer } from "./container.ts";

export * from "./container.ts";

export const container: DependencyContainer = createDependencyContainer({
  createDescriptor: (descriptor) => descriptor,
});
