import { globby } from 'globby';
import path from 'node:path';
import { SourceFileExtListWithoutDot } from './constants.js';
import type { PackEntryPointResolvedConfig } from './schema.js';
import { PackModeSchema, PackTargetSchema } from './schema.js';

export async function defaultPackEntryPoints(
  root: string,
): Promise<Record<string, PackEntryPointResolvedConfig>> {
  const exts = SourceFileExtListWithoutDot;
  const variantOptions = [PackTargetSchema.options, PackModeSchema.options] as const;
  const variants = [
    ...variantOptions,
    combine(variantOptions).map(combination => combination.join('-')),
  ].join(',');

  const files = await globby([`main.{${exts}}`, `main-{${variants}}.{${exts}}`], {
    absolute: false,
    cwd: path.resolve(root),
    onlyFiles: true,
  });

  return files.reduce<Record<string, PackEntryPointResolvedConfig>>((map, file) => {
    const [basename] = file.split('.');
    const entry: PackEntryPointResolvedConfig = { import: `./${file}` };

    for (const fragment of basename.split('-').slice(1)) {
      const asMode = PackModeSchema.safeParse(fragment);
      const asTarget = PackTargetSchema.safeParse(fragment);

      if (asMode.success) entry.mode = asMode.data;
      else if (asTarget.success) entry.target = asTarget.data;
    }

    map[basename] = entry;
    return map;
  }, {});
}

type CombineArray<
  T extends readonly (readonly any[])[],
  Result extends any[] = [],
> = T extends readonly [readonly (infer U)[], ...infer Rest]
  ? Rest extends readonly (readonly any[])[]
    ? CombineArray<Rest, [...Result, U]>
    : [...Result, U]
  : Result;

function combine<T extends readonly [readonly any[], ...(readonly any[])[]]>(
  arrays: T,
): CombineArray<T>[];
function combine(arrays: readonly (readonly unknown[])[]): any[][] {
  if (!arrays.length) return [];

  const [firstArray, ...restArrays] = arrays;
  const initialValue: any[][] = [[...firstArray]];
  const combinations = restArrays.reduce<any[][]>((prev, array) => {
    return prev.reduce<any[][]>((next, combination) => {
      return next.concat(array.map(element => [...combination, element]));
    }, []);
  }, initialValue);

  return combinations;
}
