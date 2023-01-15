import type { DependencyHost } from "../../core.ts";
import { createRuntimeOnlyContext } from "../tools/runtime-only-context/mod.tsx";

export const [useNearestDependencyHost, DependencyHostProvider] =
  createRuntimeOnlyContext<DependencyHost>("DependencyHost");

// export function useIsolatedDependencyHost(): DependencyHost {
//   const parent = useNearestDependencyHost();
//   const handle = useConstant((): WeakDependencyHandle => ({}));
//   return useConstant(() => {
//     const key: CallableDependencyKey<[], DependencyHost> = (host) => host;
//     const value = parent.call(key);
//     parent.weaken(key, handle);
//     return value;
//   });
// }
