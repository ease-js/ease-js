import z from '@ease-js/deps/zod';

export const PackModeSchema = z
  .enum(['development', 'production'])
  .describe('The packing mode, can be specified in the file ext like "main.development.ts".');
export const PackTargetSchema = z
  .enum(['node', 'web', 'webworker'])
  .describe('The packing target, can be specified in the file ext like "main.node.ts".');

const PackEntryPointExtendableConfigSchema = z
  .object({
    alias: z
      .record(z.string().min(1), z.union([z.literal(false), z.string().min(1)]))
      .optional()
      .describe('Create aliases for module specifiers.'),
    base: z
      .string()
      .optional()
      .describe(
        'The base URL when importing external resources like es modules, media files, etc.',
      ),
    cache: z
      .union([z.boolean(), z.string().min(1)])
      .transform(input => (input === true ? undefined : input))
      .optional()
      .describe('Cache directory.'),
    define: z
      .record(
        z.string().min(1),
        z.any().transform(input => JSON.stringify(input)),
      )
      .optional()
      .describe('Define global constant replacements.'),
    externals: z
      .array(z.union([z.string().min(1), z.instanceof(RegExp)]))
      .optional()
      .describe('External module specifier patterns.'),
    mode: PackModeSchema.optional(),
    outputDirectory: z
      .string()
      .optional()
      .describe('The output directory, an absolute path or a path relative to the root directory.'),
    target: PackTargetSchema.optional(),
  })
  .strict()
  .describe('Entry point extendable config.');

const PackEntryPointConfigSchema = PackEntryPointExtendableConfigSchema.extend({
  import: z
    .string()
    .min(1)
    .describe('The source file path, an absolute path or a path relative to the root directory.'),
})
  .strict()
  .describe('Entry point config.');

export const PackConfigSchema = z
  .object({
    configFilePath: z
      .string()
      .optional()
      .describe('Path of current config file, relative to the root directory.'),
    entry: z
      .record(z.string().min(1), PackEntryPointConfigSchema)
      .optional()
      .describe('Entry points map.'),
    root: z
      .string()
      .optional()
      .describe(
        'The root directory, ' +
          'an absolute path or a path relative to the current working directory, ' +
          'for resolving entry points.',
      ),
    watch: z.boolean().optional().describe('Watch input files.'),
  })
  .merge(PackEntryPointExtendableConfigSchema)
  .strict()
  .describe('Pack config.');

export type PackMode = z.output<typeof PackModeSchema>;
export type PackTarget = z.output<typeof PackTargetSchema>;
export type PackEntryPointConfig = z.input<typeof PackEntryPointConfigSchema>;
export type PackEntryPointResolvedConfig = z.output<typeof PackEntryPointConfigSchema>;
export type PackConfig = z.input<typeof PackConfigSchema>;
export type PackResolvedConfig = z.output<typeof PackConfigSchema>;
