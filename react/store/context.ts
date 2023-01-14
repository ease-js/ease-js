import type { DependencyHost } from "../../core.ts";
import { createRuntimeOnlyContext } from "../tools/runtime-only-context/mod.tsx";

export const [useDependencyHost, DependencyHostProvider] =
  createRuntimeOnlyContext<DependencyHost>("DependencyHost");
