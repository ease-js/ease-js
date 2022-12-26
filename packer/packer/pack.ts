import BabelPresetEnv from '@babel/preset-env';
import BabelPresetReact from '@babel/preset-react';
import BabelPresetTypeScript from '@babel/preset-typescript';
import TerserPlugin from '@ease-js/deps/terser-webpack-plugin';
import webpack from '@ease-js/deps/webpack';
import path from 'node:path';
import { defaultPackEntryPoints } from '../config/defaults.js';
import type { PackConfig, PackEntryPointResolvedConfig } from '../config/schema.js';
import { PackConfigSchema } from '../config/schema.js';
import {
  BuiltinModulesMap,
  SourceFileExtListWithoutDot,
  SourceFileExtMapWithoutDot,
} from '../config/constants.js';
import { ProgressPlugin } from './webpack-progress-plugin.js';
import { createRequire } from 'module';

export async function pack(config: PackConfig): Promise<void> {
  const {
    configFilePath,
    root = '.',
    entry = await defaultPackEntryPoints(root),
    watch = false,
    ...extendable
  } = await PackConfigSchema.parseAsync(config);

  const require = createRequire(import.meta.url);
  const uniqueKey = `u${Math.random().toString(16).slice(2, 12).padStart(10, '0')}`;

  const compilerConfigs = Object.keys(entry).map((name): webpack.Configuration => {
    const entryConfig: PackEntryPointResolvedConfig = {
      ...extendable,
      ...entry[name],
    };

    const {
      alias = {},
      base = '/',
      cache = '.local/pack-cache/',
      define = {},
      externals = [],
      import: file,
      mode = 'production',
      outputDirectory = 'dist',
      target = 'web',
    } = entryConfig;

    const builtinModules: readonly RegExp[] = BuiltinModulesMap[target] || [];
    const scriptFileExts = [SourceFileExtMapWithoutDot.ts, SourceFileExtMapWithoutDot.js].flat(1);
    const externalModulePatterns: readonly (string | RegExp)[] = [...builtinModules, ...externals];

    const isExternalModule = (request: string): boolean => {
      return externalModulePatterns.some(pattern => {
        return typeof pattern === 'string' ? pattern === request : pattern.test(request);
      });
    };

    const internalModuleAlias: Record<string, string | false> = {};
    const externalModuleAlias: Record<string, string> = {};

    for (const [name, value] of Object.entries(alias)) {
      if (typeof value === 'string' && isExternalModule(value)) externalModuleAlias[name] = value;
      else internalModuleAlias[name] = value;
    }

    return {
      cache: cache
        ? {
            buildDependencies: {
              easeConfig: configFilePath ? [path.resolve(root, configFilePath)] : [],
              tsconfig: [path.resolve(root, 'tsconfig.json')],
            },
            cacheDirectory: path.resolve(root, cache),
            type: 'filesystem',
          }
        : { type: 'memory' },
      context: path.resolve(root),
      devtool: mode === 'development' ? 'cheap-module-source-map' : 'source-map',
      entry: { [name]: file },
      experiments: {
        futureDefaults: true,
        lazyCompilation: watch,
        outputModule: true,
        topLevelAwait: true,
      },
      externals: [
        (ctx, callback) =>
          isExternalModule(ctx.request || '') ? callback(undefined, ctx.request) : callback(),
        externalModuleAlias,
      ],
      externalsType: 'module',
      infrastructureLogging: { level: 'info' },
      mode,
      module: {
        parser: {
          asset: { dataUrlCondition: { maxSize: 4 * 1024 } },
        },
        rules: [
          {
            oneOf: [
              {
                test: RegExp(`\\.(${scriptFileExts.join('|')})$`),
                type: 'javascript/esm',
                parser: { createRequire: false, importMeta: false },
                exclude: /node_modules/,
                resolve: {
                  extensionAlias: { '.js': scriptFileExts.map(ext => `.${ext}`) },
                  fullySpecified: true,
                },
                use: {
                  loader: require.resolve('@ease-js/deps/babel-loader'),
                  options: {
                    babelrc: false,
                    compact: mode === 'development' ? false : 'auto',
                    configFile: false,
                    presets: [
                      [BabelPresetEnv, {}],
                      [
                        BabelPresetReact,
                        { development: mode === 'development', runtime: 'automatic' },
                      ],
                      [BabelPresetTypeScript, {}],
                    ],
                    targets: ['last 2 versions', 'not dead'],
                  },
                },
              },
              {
                test: /\.(woff|woff2|eot|ttf|otf|ttc|gif|png|jpe?g|webp|bmp|ico|svg)$/i,
                oneOf: [
                  { type: 'asset/inline', resourceQuery: /inline/ },
                  { type: 'asset/resource', resourceQuery: /url/ },
                  { type: 'asset' },
                ],
              },
              {
                exclude: [/^$/, RegExp(`\\.(${SourceFileExtListWithoutDot.join('|')})$`)],
                type: 'asset/resource',
              },
            ],
          },
        ],
      },
      name,
      node: false,
      optimization: {
        minimize: mode === 'production',
        minimizer:
          mode === 'production'
            ? [new TerserPlugin({ terserOptions: { compress: { passes: 2 } } })]
            : [],
        nodeEnv: target === 'node' ? false : mode,
        runtimeChunk: false,
        splitChunks: false,
      },
      output: {
        assetModuleFilename: 'asset/[name].[hash:8][ext]',
        environment: {
          arrowFunction: true,
          bigIntLiteral: true,
          const: true,
          destructuring: true,
          dynamicImport: true,
          forOf: true,
          module: true,
          optionalChaining: true,
          templateLiteral: true,
        },
        filename: 'js/[name].js',
        globalObject: 'globalThis',
        library: { type: 'module' },
        module: true,
        path: path.resolve(root, outputDirectory),
        publicPath: new URL(base, `${uniqueKey}:///`).href.replace(RegExp(`^${uniqueKey}://`), ''),
      },
      plugins: [new ProgressPlugin(name), new webpack.DefinePlugin(define)],
      resolve: {
        alias: internalModuleAlias,
        conditionNames: [mode, target, 'import', 'module'],
        mainFields: ['module', 'main'],
      },
      resolveLoader: {
        modules: [],
        preferAbsolute: true,
      },
      stats: 'none',
      target: 'es2022',
      watch,
    };
  });

  await new Promise<void>((resolve, reject) => {
    webpack(compilerConfigs, (error, stats) => {
      if (stats?.hasErrors()) {
        const message = stats.toString({ colors: process.stdout.isTTY, preset: 'errors-only' });
        process.stdout.write(message);
      }

      if (error) reject(error);
      else resolve();
    });
  });
}
