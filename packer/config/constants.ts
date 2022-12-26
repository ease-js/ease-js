import module from 'node:module';

export const BuiltinModulesMap: {
  readonly [key: string]: readonly (RegExp | string)[] | undefined;
} = {
  node: [/^node:/, ...module.builtinModules],
};

export type SourceFileType = 'css' | 'html' | 'js' | 'json' | 'ts';

export const SourceFileExtMapWithoutDot: { readonly [key in SourceFileType]: readonly string[] } = {
  css: ['css'],
  html: ['htm', 'html'],
  js: ['jsx', 'mjs', 'cjs', 'js'],
  json: ['json', 'jsonc'],
  ts: ['tsx', 'ts'],
};

export const SourceFileExtListWithoutDot: readonly string[] = Object.values(
  SourceFileExtMapWithoutDot,
).flat(1);
