import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { Worker } from 'jest-worker';
import { validate } from 'schema-utils';
import serialize from 'serialize-javascript';
import webpack from 'webpack';
import * as terser from 'terser';
import terserPackageJSON from 'terser/package.json';
import * as minify from './terser-webpack-plugin/minify.js';
// @ts-expect-error
import NodeThreadsWorkerExports from '../node_modules/jest-worker/build/workers/NodeThreadsWorker.js';
// @ts-expect-error
import WorkerPoolExports from '../node_modules/jest-worker/build/WorkerPool.js';
const WorkerPool =
  typeof WorkerPoolExports === 'function' ? WorkerPoolExports : WorkerPoolExports.default;

class CustomWorkerPool extends WorkerPool {
  createWorker(workerOptions: any) {
    const require = createRequire(import.meta.url);
    const NodeThreadsWorker = typeof NodeThreadsWorkerExports === 'function' ? NodeThreadsWorkerExports : NodeThreadsWorkerExports.default;
    return new NodeThreadsWorker({
      ...workerOptions,
      childWorkerPath: require.resolve('./terser-webpack-plugin/jest-thread-worker.js'),
    });
  }
}


export default class TerserPlugin {
  private options: any;

  public constructor(options: any) {
    validate(schema(), options || {}, {
      name: 'Terser Plugin',
      baseDataPath: 'options',
    });

    // TODO make `minimizer` option instead `minify` and `terserOptions` in the next major release, also rename `terserMinify` to `terserMinimize`
    const {
      minify = terserMinify,
      terserOptions = {},
      test = /\.[cm]?js(\?.*)?$/i,
      extractComments = true,
      parallel = true,
      include,
      exclude,
    } = options || {};

    this.options = {
      test,
      extractComments,
      parallel,
      include,
      exclude,
      minimizer: {
        implementation: minify,
        options: terserOptions,
      },
    };
  }

  private static isSourceMap(input: any) {
    // All required options for `new TraceMap(...options)`
    // https://github.com/jridgewell/trace-mapping#usage
    return Boolean(
      input &&
        input.version &&
        input.sources &&
        Array.isArray(input.sources) &&
        typeof input.mappings === 'string',
    );
  }

  private static buildWarning(warning: any, file: any) {
    const builtWarning: any = new Error(warning.toString());

    builtWarning.name = 'Warning';
    builtWarning.hideStack = true;
    builtWarning.file = file;

    return builtWarning;
  }

  private static buildError(error: any, file: any, sourceMap: any, requestShortener: any) {
    let builtError: any;

    if (typeof error === 'string') {
      builtError = new Error(`${file} from Terser plugin\n${error}`);
      builtError.file = file;

      return builtError;
    }

    if (error.line) {
      const original =
        sourceMap &&
        originalPositionFor(sourceMap, {
          line: error.line,
          column: error.col,
        });

      if (original && original.source && requestShortener) {
        builtError = new Error(
          `${file} from Terser plugin\n${error.message} [${requestShortener.shorten(
            original.source,
          )}:${original.line},${original.column}][${file}:${error.line},${error.col}]${
            error.stack ? `\n${error.stack.split('\n').slice(1).join('\n')}` : ''
          }`,
        );
        builtError.file = file;

        return builtError;
      }

      builtError = new Error(
        `${file} from Terser plugin\n${error.message} [${file}:${error.line},${error.col}]${
          error.stack ? `\n${error.stack.split('\n').slice(1).join('\n')}` : ''
        }`,
      );
      builtError.file = file;

      return builtError;
    }

    if (error.stack) {
      builtError = new Error(
        `${file} from Terser plugin\n${
          typeof error.message !== 'undefined' ? error.message : ''
        }\n${error.stack}`,
      );
      builtError.file = file;

      return builtError;
    }

    builtError = new Error(`${file} from Terser plugin\n${error.message}`);
    builtError.file = file;

    return builtError;
  }

  private static getAvailableNumberOfCores(parallel: any) {
    // In some cases cpus() returns undefined
    // https://github.com/nodejs/node/issues/19022
    const cpus = os.cpus() || { length: 1 };

    return parallel === true ? cpus.length - 1 : Math.min(Number(parallel) || 0, cpus.length - 1);
  }

  private async optimize(
    compiler: webpack.Compiler,
    compilation: webpack.Compilation,
    assets: Record<string, webpack.sources.Source>,
    optimizeOptions: any,
  ) {
    const cache = compilation.getCache('TerserWebpackPlugin');
    let numberOfAssets = 0;
    const assetsForMinify = await Promise.all(
      Object.keys(assets)
        .filter(name => {
          const { info } = compilation.getAsset(name)!;

          if (
            // Skip double minimize assets from child compilation
            info.minimized ||
            // Skip minimizing for extracted comments assets
            info.extractedComments
          ) {
            return false;
          }

          if (
            !compiler.webpack.ModuleFilenameHelpers.matchObject.bind(
              // eslint-disable-next-line no-undefined
              undefined,
              this.options,
            )(name)
          ) {
            return false;
          }

          return true;
        })
        .map(async name => {
          const { info, source } = compilation.getAsset(name)!;

          const eTag = cache.getLazyHashedEtag(source);
          const cacheItem = cache.getItemCache(name, eTag);
          const output = await cacheItem.getPromise();

          if (!output) {
            numberOfAssets += 1;
          }

          return { name, info, inputSource: source, output, cacheItem };
        }),
    );

    if (assetsForMinify.length === 0) {
      return;
    }

    let getWorker: any;
    let initializedWorker: any;
    let numberOfWorkers: any;

    if (optimizeOptions.availableNumberOfCores > 0) {
      // Do not create unnecessary workers when the number of files is less than the available cores, it saves memory
      numberOfWorkers = Math.min(numberOfAssets, optimizeOptions.availableNumberOfCores);
      // eslint-disable-next-line consistent-return
      getWorker = () => {
        if (initializedWorker) {
          return initializedWorker;
        }

        const require = createRequire(import.meta.url);
        initializedWorker = new Worker(require.resolve('./terser-webpack-plugin/minify.js'), {
          WorkerPool: CustomWorkerPool as any,
          enableWorkerThreads: true,
          exposedMethods: Object.keys(minify),
          numWorkers: numberOfWorkers,
        });

        // https://github.com/facebook/jest/issues/8872#issuecomment-524822081
        const workerStdout = initializedWorker.getStdout();

        if (workerStdout) {
          workerStdout.on('data', (chunk: any) => process.stdout.write(chunk));
        }

        const workerStderr = initializedWorker.getStderr();

        if (workerStderr) {
          workerStderr.on('data', (chunk: any) => process.stderr.write(chunk));
        }

        return initializedWorker;
      };
    }

    const { SourceMapSource, ConcatSource, RawSource } = compiler.webpack.sources;

    const allExtractedComments = new Map();
    const scheduledTasks = [];

    for (const asset of assetsForMinify) {
      scheduledTasks.push(async () => {
        const { name, inputSource, info, cacheItem } = asset;
        let { output } = asset as any;

        if (!output) {
          let input;
          let inputSourceMap: any;

          const { source: sourceFromInputSource, map } = inputSource.sourceAndMap();

          input = sourceFromInputSource;

          if (map) {
            if (!TerserPlugin.isSourceMap(map)) {
              compilation.warnings.push(new Error(`${name} contains invalid source map`) as any);
            } else {
              inputSourceMap = /** @type {SourceMapInput} */ map;
            }
          }

          if (Buffer.isBuffer(input)) {
            input = input.toString();
          }

          /**
           * @type {InternalOptions<T>}
           */
          const options = {
            name,
            input,
            inputSourceMap,
            minimizer: {
              implementation: this.options.minimizer.implementation,
              // @ts-ignore https://github.com/Microsoft/TypeScript/issues/10727
              options: { ...this.options.minimizer.options },
            },
            extractComments: this.options.extractComments,
          };

          if (typeof options.minimizer.options.module === 'undefined') {
            if (typeof info.javascriptModule !== 'undefined') {
              options.minimizer.options.module = info.javascriptModule;
            } else if (/\.mjs(\?.*)?$/i.test(name)) {
              options.minimizer.options.module = true;
            } else if (/\.cjs(\?.*)?$/i.test(name)) {
              options.minimizer.options.module = false;
            }
          }

          if (typeof options.minimizer.options.ecma === 'undefined') {
            options.minimizer.options.ecma = TerserPlugin.getEcmaVersion(
              compiler.options.output.environment || {},
            );
          }

          try {
            output = await (getWorker
              ? getWorker().transform(serialize(options))
              : minify.minify(options));
          } catch (error) {
            const hasSourceMap = inputSourceMap && TerserPlugin.isSourceMap(inputSourceMap);

            compilation.errors.push(
              /** @type {WebpackError} */
              TerserPlugin.buildError(
                error,
                name,
                hasSourceMap
                  ? new TraceMap(/** @type {SourceMapInput} */ inputSourceMap)
                  : // eslint-disable-next-line no-undefined
                    undefined,
                // eslint-disable-next-line no-undefined
                hasSourceMap ? compilation.requestShortener : undefined,
              ),
            );

            return;
          }

          if (typeof output.code === 'undefined') {
            compilation.errors.push(
              new Error(`${name} from Terser plugin\nMinimizer doesn't return result`) as any,
            );

            return;
          }

          if (output.warnings && output.warnings.length > 0) {
            output.warnings = output.warnings.map((item: any) =>
              TerserPlugin.buildWarning(item, name),
            );
          }

          if (output.errors && output.errors.length > 0) {
            const hasSourceMap = inputSourceMap && TerserPlugin.isSourceMap(inputSourceMap);

            output.errors = output.errors.map((item: any) =>
              TerserPlugin.buildError(
                item,
                name,
                hasSourceMap
                  ? new TraceMap(/** @type {SourceMapInput} */ inputSourceMap)
                  : // eslint-disable-next-line no-undefined
                    undefined,
                // eslint-disable-next-line no-undefined
                hasSourceMap ? compilation.requestShortener : undefined,
              ),
            );
          }

          let shebang;

          if (
            this.options.extractComments.banner !== false &&
            output.extractedComments &&
            output.extractedComments.length > 0 &&
            output.code.startsWith('#!')
          ) {
            const firstNewlinePosition = output.code.indexOf('\n');

            shebang = output.code.substring(0, firstNewlinePosition);
            output.code = output.code.substring(firstNewlinePosition + 1);
          }

          if (output.map) {
            output.source = new SourceMapSource(
              output.code,
              name,
              output.map,
              input,
              inputSourceMap,
              true,
            );
          } else {
            output.source = new RawSource(output.code);
          }

          if (output.extractedComments && output.extractedComments.length > 0) {
            const commentsFilename =
              /** @type {ExtractCommentsObject} */
              this.options.extractComments.filename || '[file].LICENSE.txt[query]';

            let query = '';
            let filename = name;

            const querySplit = filename.indexOf('?');

            if (querySplit >= 0) {
              query = filename.slice(querySplit);
              filename = filename.slice(0, querySplit);
            }

            const lastSlashIndex = filename.lastIndexOf('/');
            const basename = lastSlashIndex === -1 ? filename : filename.slice(lastSlashIndex + 1);
            const data = { filename, basename, query };

            output.commentsFilename = compilation.getPath(commentsFilename, data);

            let banner;

            // Add a banner to the original file
            if (
              /** @type {ExtractCommentsObject} */
              this.options.extractComments.banner !== false
            ) {
              banner =
                /** @type {ExtractCommentsObject} */
                this.options.extractComments.banner ||
                `For license information please see ${path
                  .relative(path.dirname(name), output.commentsFilename)
                  .replace(/\\/g, '/')}`;

              if (typeof banner === 'function') {
                banner = banner(output.commentsFilename);
              }

              if (banner) {
                output.source = new ConcatSource(
                  shebang ? `${shebang}\n` : '',
                  `/*! ${banner} */\n`,
                  output.source,
                );
              }
            }

            const extractedCommentsString = output.extractedComments.sort().join('\n\n');

            output.extractedCommentsSource = new RawSource(`${extractedCommentsString}\n`);
          }

          await cacheItem.storePromise({
            source: output.source,
            errors: output.errors,
            warnings: output.warnings,
            commentsFilename: output.commentsFilename,
            extractedCommentsSource: output.extractedCommentsSource,
          });
        }

        if (output.warnings && output.warnings.length > 0) {
          for (const warning of output.warnings) {
            compilation.warnings.push(/** @type {WebpackError} */ warning);
          }
        }

        if (output.errors && output.errors.length > 0) {
          for (const error of output.errors) {
            compilation.errors.push(/** @type {WebpackError} */ error);
          }
        }

        const newInfo: any = { minimized: true };
        const { source, extractedCommentsSource } = output;

        // Write extracted comments to commentsFilename
        if (extractedCommentsSource) {
          const { commentsFilename } = output;

          newInfo.related = { license: commentsFilename };

          allExtractedComments.set(name, {
            extractedCommentsSource,
            commentsFilename,
          });
        }

        compilation.updateAsset(name, source, newInfo);
      });
    }

    const limit =
      getWorker && numberOfAssets > 0
        ? /** @type {number} */ numberOfWorkers
        : scheduledTasks.length;
    await throttleAll(limit, scheduledTasks);

    if (initializedWorker) {
      await initializedWorker.end();
    }

    await Array.from(allExtractedComments)
      .sort()
      .reduce<any>(async (previousPromise, [from, value]) => {
        const previous =
          /** @type {ExtractedCommentsInfoWIthFrom | undefined} **/ await previousPromise;
        const { commentsFilename, extractedCommentsSource } = value;

        if (previous && previous.commentsFilename === commentsFilename) {
          const { from: previousFrom, source: prevSource } = previous;
          const mergedName = `${previousFrom}|${from}`;
          const name = `${commentsFilename}|${mergedName}`;
          const eTag = [prevSource, extractedCommentsSource]
            .map(item => cache.getLazyHashedEtag(item))
            .reduce((previousValue, currentValue) => cache.mergeEtags(previousValue, currentValue));

          let source = await cache.getPromise(name, eTag);

          if (!source) {
            source = new ConcatSource(
              Array.from(
                new Set([
                  .../** @type {string}*/ prevSource.source().split('\n\n'),
                  .../** @type {string}*/ extractedCommentsSource.source().split('\n\n'),
                ]),
              ).join('\n\n'),
            );

            await cache.storePromise(name, eTag, source);
          }

          compilation.updateAsset(commentsFilename, source as any);

          return { source, commentsFilename, from: mergedName };
        }

        const existingAsset = compilation.getAsset(commentsFilename);

        if (existingAsset) {
          return {
            source: existingAsset.source,
            commentsFilename,
            from: commentsFilename,
          };
        }

        compilation.emitAsset(commentsFilename, extractedCommentsSource, {
          extractedComments: true,
        });

        return { source: extractedCommentsSource, commentsFilename, from };
      }, Promise.resolve());
  }

  private static getEcmaVersion(environment: any) {
    // ES 6th
    if (
      environment.arrowFunction ||
      environment.const ||
      environment.destructuring ||
      environment.forOf ||
      environment.module
    ) {
      return 2015;
    }

    // ES 11th
    if (environment.bigIntLiteral || environment.dynamicImport) {
      return 2020;
    }

    return 5;
  }

  public apply(compiler: webpack.Compiler) {
    const pluginName = this.constructor.name;
    const availableNumberOfCores = TerserPlugin.getAvailableNumberOfCores(this.options.parallel);

    compiler.hooks.compilation.tap(pluginName, compilation => {
      const hooks =
        compiler.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(compilation);
      const data = serialize({
        minimizer:
          typeof this.options.minimizer.implementation.getMinimizerVersion !== 'undefined'
            ? this.options.minimizer.implementation.getMinimizerVersion() || '0.0.0'
            : '0.0.0',
        options: this.options.minimizer.options,
      });

      hooks.chunkHash.tap(pluginName, (_chunk, hash) => {
        hash.update('TerserPlugin');
        hash.update(data);
      });

      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
          additionalAssets: true,
        },
        assets =>
          this.optimize(compiler, compilation, assets, {
            availableNumberOfCores,
          }),
      );

      compilation.hooks.statsPrinter.tap(pluginName, stats => {
        stats.hooks.print
          .for('asset.info.minimized')
          .tap('terser-webpack-plugin', (minimized, { green = i => i, formatFlag = i => i }) =>
            minimized ? green(formatFlag('minimized')) : '',
          );
      });
    });
  }
}

const notSettled = Symbol(`not-settled`);

function throttleAll(limit: any, tasks: any) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError(
      `Expected \`limit\` to be a finite number > 0, got \`${limit}\` (${typeof limit})`,
    );
  }

  if (!Array.isArray(tasks) || !tasks.every(task => typeof task === `function`)) {
    throw new TypeError(`Expected \`tasks\` to be a list of functions returning a promise`);
  }

  return new Promise((resolve, reject) => {
    const result = Array(tasks.length).fill(notSettled);

    const entries = tasks.entries();

    const next = () => {
      const { done, value } = entries.next();

      if (done) {
        const isLast = !result.includes(notSettled);

        if (isLast) resolve(/** @type{T[]} **/ result);

        return;
      }

      const [index, task] = value;

      const onFulfilled = (x: any) => {
        result[index] = x;
        next();
      };

      task().then(onFulfilled, reject);
    };

    Array(limit).fill(0).forEach(next);
  });
}

async function terserMinify(
  input: any,
  sourceMap: any,
  minimizerOptions: any,
  extractComments: any,
) {
  /**
   * @param {any} value
   * @returns {boolean}
   */
  const isObject = (value: any) => {
    const type = typeof value;

    return value != null && (type === 'object' || type === 'function');
  };

  /**
   * @param {TerserOptions & { sourceMap: undefined } & ({ output: TerserFormatOptions & { beautify: boolean } } | { format: TerserFormatOptions & { beautify: boolean } })} terserOptions
   * @param {ExtractedComments} extractedComments
   * @returns {ExtractCommentsFunction}
   */
  const buildComments = (terserOptions: any, extractedComments: any) => {
    const condition: any = {};

    let comments;

    if (terserOptions.format) {
      ({ comments } = terserOptions.format);
    } else if (terserOptions.output) {
      ({ comments } = terserOptions.output);
    }

    condition.preserve = typeof comments !== 'undefined' ? comments : false;

    if (typeof extractComments === 'boolean' && extractComments) {
      condition.extract = 'some';
    } else if (typeof extractComments === 'string' || extractComments instanceof RegExp) {
      condition.extract = extractComments;
    } else if (typeof extractComments === 'function') {
      condition.extract = extractComments;
    } else if (extractComments && isObject(extractComments)) {
      condition.extract =
        typeof extractComments.condition === 'boolean' && extractComments.condition
          ? 'some'
          : typeof extractComments.condition !== 'undefined'
          ? extractComments.condition
          : 'some';
    } else {
      // No extract
      // Preserve using "commentsOpts" or "some"
      condition.preserve = typeof comments !== 'undefined' ? comments : 'some';
      condition.extract = false;
    }

    // Ensure that both conditions are functions
    ['preserve', 'extract'].forEach(key => {
      let regexStr: any;
      let regex: any;

      switch (typeof condition[key]) {
        case 'boolean':
          condition[key] = condition[key] ? () => true : () => false;

          break;
        case 'function':
          break;
        case 'string':
          if (condition[key] === 'all') {
            condition[key] = () => true;

            break;
          }

          if (condition[key] === 'some') {
            condition[key] = (_astNode: any, comment: any) =>
              (comment.type === 'comment2' || comment.type === 'comment1') &&
              /@preserve|@lic|@cc_on|^\**!/i.test(comment.value);

            break;
          }

          regexStr = /** @type {string} */ condition[key];

          condition[key] = (_astNode: any, comment: any) =>
            new RegExp(/** @type {string} */ regexStr).test(comment.value);

          break;
        default:
          regex = /** @type {RegExp} */ condition[key];

          condition[key] = (_astNode: any, comment: any) =>
            /** @type {RegExp} */ regex.test(comment.value);
      }
    });

    // Redefine the comments function to extract and preserve
    // comments according to the two conditions
    return (astNode: any, comment: any) => {
      if (condition.extract(astNode, comment)) {
        const commentText =
          comment.type === 'comment2' ? `/*${comment.value}*/` : `//${comment.value}`;

        // Don't include duplicate comments
        if (!extractedComments.includes(commentText)) {
          extractedComments.push(commentText);
        }
      }

      return /** @type {{ preserve: ExtractCommentsFunction }} */ condition.preserve(
        astNode,
        comment,
      );
    };
  };

  /**
   * @param {PredefinedOptions & TerserOptions} [terserOptions={}]
   * @returns {TerserOptions & { sourceMap: undefined } & { compress: TerserCompressOptions } & ({ output: TerserFormatOptions & { beautify: boolean } } | { format: TerserFormatOptions & { beautify: boolean } })}
   */
  const buildTerserOptions = (terserOptions: any = {}) => {
    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    return {
      ...terserOptions,
      compress:
        typeof terserOptions.compress === 'boolean'
          ? terserOptions.compress
            ? {}
            : false
          : { ...terserOptions.compress },
      // ecma: terserOptions.ecma,
      // ie8: terserOptions.ie8,
      // keep_classnames: terserOptions.keep_classnames,
      // keep_fnames: terserOptions.keep_fnames,
      mangle:
        terserOptions.mangle == null
          ? true
          : typeof terserOptions.mangle === 'boolean'
          ? terserOptions.mangle
          : { ...terserOptions.mangle },
      // module: terserOptions.module,
      // nameCache: { ...terserOptions.toplevel },
      // the `output` option is deprecated
      ...(terserOptions.format
        ? { format: { beautify: false, ...terserOptions.format } }
        : { output: { beautify: false, ...terserOptions.output } }),
      parse: { ...terserOptions.parse },
      // safari10: terserOptions.safari10,
      // Ignoring sourceMap from options
      // eslint-disable-next-line no-undefined
      sourceMap: undefined,
      // toplevel: terserOptions.toplevel
    };
  };

  const { minify } = terser;
  // Copy `terser` options
  const terserOptions = buildTerserOptions(minimizerOptions);

  // Let terser generate a SourceMap
  if (sourceMap) {
    // @ts-ignore
    terserOptions.sourceMap = { asObject: true };
  }

  const extractedComments: any[] = [];

  if (terserOptions.output) {
    terserOptions.output.comments = buildComments(terserOptions, extractedComments);
  } else if (terserOptions.format) {
    terserOptions.format.comments = buildComments(terserOptions, extractedComments);
  }

  if (terserOptions.compress) {
    // More optimizations
    if (typeof terserOptions.compress.ecma === 'undefined') {
      terserOptions.compress.ecma = terserOptions.ecma;
    }

    // https://github.com/webpack/webpack/issues/16135
    if (terserOptions.ecma === 5 && typeof terserOptions.compress.arrows === 'undefined') {
      terserOptions.compress.arrows = false;
    }
  }

  const [[filename, code]] = Object.entries(input) as any;
  const result = await minify({ [filename]: code }, terserOptions);

  return {
    code: /** @type {string} **/ result.code,
    // @ts-ignore
    // eslint-disable-next-line no-undefined
    map: result.map ? /** @type {SourceMapInput} **/ result.map : undefined,
    extractedComments,
  };
}

terserMinify.getMinimizerVersion = () => terserPackageJSON.version;

function schema(): Parameters<typeof validate>[0] {
  return {
    definitions: {
      Rule: {
        description: 'Filtering rule as regex or string.',
        anyOf: [
          {
            instanceof: 'RegExp',
            tsType: 'RegExp',
          },
          {
            type: 'string',
            minLength: 1,
          },
        ],
      },
      Rules: {
        description: 'Filtering rules.',
        anyOf: [
          {
            type: 'array',
            items: {
              description: 'A rule condition.',
              oneOf: [
                {
                  $ref: '#/definitions/Rule',
                },
              ],
            },
          },
          {
            $ref: '#/definitions/Rule',
          },
        ],
      },
    },
    title: 'TerserPluginOptions',
    type: 'object',
    additionalProperties: false,
    properties: {
      test: {
        description: 'Include all modules that pass test assertion.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#test',
        oneOf: [
          {
            $ref: '#/definitions/Rules',
          },
        ],
      },
      include: {
        description: 'Include all modules matching any of these conditions.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#include',
        oneOf: [
          {
            $ref: '#/definitions/Rules',
          },
        ],
      },
      exclude: {
        description: 'Exclude all modules matching any of these conditions.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#exclude',
        oneOf: [
          {
            $ref: '#/definitions/Rules',
          },
        ],
      },
      terserOptions: {
        description: 'Options for `terser` (by default) or custom `minify` function.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions',
        additionalProperties: true,
        type: 'object',
      },
      extractComments: {
        description: 'Whether comments shall be extracted to a separate file.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#extractcomments',
        anyOf: [
          {
            type: 'boolean',
          },
          {
            type: 'string',
            minLength: 1,
          },
          {
            instanceof: 'RegExp',
          },
          {
            instanceof: 'Function',
          },
          {
            additionalProperties: false,
            properties: {
              condition: {
                anyOf: [
                  {
                    type: 'boolean',
                  },
                  {
                    type: 'string',
                    minLength: 1,
                  },
                  {
                    instanceof: 'RegExp',
                  },
                  {
                    instanceof: 'Function',
                  },
                ],
                description: 'Condition what comments you need extract.',
                link: 'https://github.com/webpack-contrib/terser-webpack-plugin#condition',
              },
              filename: {
                anyOf: [
                  {
                    type: 'string',
                    minLength: 1,
                  },
                  {
                    instanceof: 'Function',
                  },
                ],
                description:
                  'The file where the extracted comments will be stored. Default is to append the suffix .LICENSE.txt to the original filename.',
                link: 'https://github.com/webpack-contrib/terser-webpack-plugin#filename',
              },
              banner: {
                anyOf: [
                  {
                    type: 'boolean',
                  },
                  {
                    type: 'string',
                    minLength: 1,
                  },
                  {
                    instanceof: 'Function',
                  },
                ],
                description:
                  'The banner text that points to the extracted file and will be added on top of the original file',
                link: 'https://github.com/webpack-contrib/terser-webpack-plugin#banner',
              },
            },
            type: 'object',
          },
        ],
      },
      parallel: {
        description: 'Use multi-process parallel running to improve the build speed.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#parallel',
        anyOf: [
          {
            type: 'boolean',
          },
          {
            type: 'integer',
          },
        ],
      },
      minify: {
        description: 'Allows you to override default minify function.',
        link: 'https://github.com/webpack-contrib/terser-webpack-plugin#number',
        instanceof: 'Function',
      },
    },
  };
}
