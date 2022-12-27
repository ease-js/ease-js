/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
import { readFile } from 'node:fs';
import url from 'node:url';

class LoaderLoadingError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'LoaderRunnerError';
    Error.captureStackTrace(this, this.constructor);
  }
}

function loadLoader(loader: any, callback: any): any {
  // if(loader.type === "module") {
  try {
    const loaderUrl = url.pathToFileURL(loader.path);
    const modulePromise = eval('import(' + JSON.stringify(loaderUrl.toString()) + ')');
    modulePromise.then(function (module: any) {
      handleResult(loader, module, callback);
    }, callback);
    return;
  } catch (e) {
    callback(e);
  }
  // } else {
  // 	try {
  // 		var module = require(loader.path);
  // 	} catch(e) {
  // 		// it is possible for node to choke on a require if the FD descriptor
  // 		// limit has been reached. give it a chance to recover.
  // 		if(e instanceof Error && (e as any).code === "EMFILE") {
  // 			var retry = loadLoader.bind(null, loader, callback);
  // 			if(typeof setImmediate === "function") {
  // 				// node >= 0.9.0
  // 				return setImmediate(retry);
  // 			} else {
  // 				// node < 0.9.0
  // 				return process.nextTick(retry);
  // 			}
  // 		}
  // 		return callback(e);
  // 	}
  // 	return handleResult(loader, module, callback);
  // }
}

function handleResult(loader: any, module: any, callback: any) {
  if (typeof module !== 'function' && typeof module !== 'object') {
    return callback(
      new LoaderLoadingError(
        "Module '" + loader.path + "' is not a loader (export function or es6 module)",
      ),
    );
  }
  loader.normal = typeof module === 'function' ? module : module.default;
  loader.pitch = module.pitch;
  loader.raw = module.raw;
  if (typeof loader.normal !== 'function' && typeof loader.pitch !== 'function') {
    return callback(
      new LoaderLoadingError(
        "Module '" + loader.path + "' is not a loader (must have normal or pitch function)",
      ),
    );
  }
  callback();
}

function utf8BufferToString(buf: Buffer) {
  const str = buf.toString('utf-8');
  if (str.charCodeAt(0) === 0xfeff) {
    return str.slice(1);
  } else {
    return str;
  }
}

const PATH_QUERY_FRAGMENT_REGEXP = /^((?:\0.|[^?#\0])*)(\?(?:\0.|[^#\0])*)?(#.*)?$/;

/**
 * @param {string} str the path with query and fragment
 * @returns {{ path: string, query: string, fragment: string }} parsed parts
 */
function parsePathQueryFragment(str: string) {
  const match = PATH_QUERY_FRAGMENT_REGEXP.exec(str)!;
  return {
    path: match[1].replace(/\0(.)/g, '$1'),
    query: match[2] ? match[2].replace(/\0(.)/g, '$1') : '',
    fragment: match[3] || '',
  };
}

function dirname(path: string) {
  if (path === '/') return '/';
  const i = path.lastIndexOf('/');
  const j = path.lastIndexOf('\\');
  const i2 = path.indexOf('/');
  const j2 = path.indexOf('\\');
  const idx = i > j ? i : j;
  const idx2 = i > j ? i2 : j2;
  if (idx < 0) return path;
  if (idx === idx2) return path.slice(0, idx + 1);
  return path.slice(0, idx);
}

function createLoaderObject(loader: any) {
  const obj: any = {
    path: null,
    query: null,
    fragment: null,
    options: null,
    ident: null,
    normal: null,
    pitch: null,
    raw: null,
    data: null,
    pitchExecuted: false,
    normalExecuted: false,
  };
  Object.defineProperty(obj, 'request', {
    enumerable: true,
    get: function () {
      return obj.path.replace(/#/g, '\0#') + obj.query.replace(/#/g, '\0#') + obj.fragment;
    },
    set: function (value) {
      if (typeof value === 'string') {
        const splittedRequest = parsePathQueryFragment(value);
        obj.path = splittedRequest.path;
        obj.query = splittedRequest.query;
        obj.fragment = splittedRequest.fragment;
        obj.options = undefined;
        obj.ident = undefined;
      } else {
        if (!value.loader)
          throw new Error(
            'request should be a string or object with loader and options (' +
              JSON.stringify(value) +
              ')',
          );
        obj.path = value.loader;
        obj.fragment = value.fragment || '';
        obj.type = value.type;
        obj.options = value.options;
        obj.ident = value.ident;
        if (obj.options === null) obj.query = '';
        else if (obj.options === undefined) obj.query = '';
        else if (typeof obj.options === 'string') obj.query = '?' + obj.options;
        else if (obj.ident) obj.query = '??' + obj.ident;
        else if (typeof obj.options === 'object' && obj.options.ident)
          obj.query = '??' + obj.options.ident;
        else obj.query = '?' + JSON.stringify(obj.options);
      }
    },
  });
  obj.request = loader;
  if (Object.preventExtensions) {
    Object.preventExtensions(obj);
  }
  return obj;
}

function runSyncOrAsync(fn: any, context: any, args: any, callback: any) {
  let isSync = true;
  let isDone = false;
  let isError = false; // internal error
  let reportedError = false;
  context.async = function async() {
    if (isDone) {
      if (reportedError) return; // ignore
      throw new Error('async(): The callback was already called.');
    }
    isSync = false;
    return innerCallback;
  };
  const innerCallback = (context.callback = function () {
    if (isDone) {
      if (reportedError) return; // ignore
      throw new Error('callback(): The callback was already called.');
    }
    isDone = true;
    isSync = false;
    try {
      callback.apply(null, arguments);
    } catch (e) {
      isError = true;
      throw e;
    }
  });
  try {
    const result = (function LOADER_EXECUTION() {
      return fn.apply(context, args);
    })();
    if (isSync) {
      isDone = true;
      if (result === undefined) return callback();
      if (result && typeof result === 'object' && typeof result.then === 'function') {
        return result.then(function (r: any) {
          callback(null, r);
        }, callback);
      }
      return callback(null, result);
    }
  } catch (e) {
    if (isError) throw e;
    if (isDone) {
      // loader is already "done", so we cannot use the callback function
      // for better debugging we print the error on the console
      if (typeof e === 'object' && (e as any).stack) console.error((e as any).stack);
      else console.error(e);
      return;
    }
    isDone = true;
    reportedError = true;
    callback(e);
  }
}

function convertArgs(args: any, raw: boolean) {
  if (!raw && Buffer.isBuffer(args[0])) args[0] = utf8BufferToString(args[0]);
  else if (raw && typeof args[0] === 'string') args[0] = Buffer.from(args[0], 'utf-8');
}

function iteratePitchingLoaders(options: any, loaderContext: any, callback: any): any {
  // abort after last loader
  if (loaderContext.loaderIndex >= loaderContext.loaders.length)
    return processResource(options, loaderContext, callback);

  const currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

  // iterate
  if (currentLoaderObject.pitchExecuted) {
    loaderContext.loaderIndex++;
    return iteratePitchingLoaders(options, loaderContext, callback);
  }

  // load loader module
  loadLoader(currentLoaderObject, function (err: unknown) {
    if (err) {
      loaderContext.cacheable(false);
      return callback(err);
    }
    const fn = currentLoaderObject.pitch;
    currentLoaderObject.pitchExecuted = true;
    if (!fn) return iteratePitchingLoaders(options, loaderContext, callback);

    runSyncOrAsync(
      fn,
      loaderContext,
      [
        loaderContext.remainingRequest,
        loaderContext.previousRequest,
        (currentLoaderObject.data = {}),
      ],
      function (err: unknown) {
        if (err) return callback(err);
        const args = Array.prototype.slice.call(arguments, 1);
        // Determine whether to continue the pitching process based on
        // argument values (as opposed to argument presence) in order
        // to support synchronous and asynchronous usages.
        const hasArg = args.some(function (value) {
          return value !== undefined;
        });
        if (hasArg) {
          loaderContext.loaderIndex--;
          iterateNormalLoaders(options, loaderContext, args, callback);
        } else {
          iteratePitchingLoaders(options, loaderContext, callback);
        }
      },
    );
  });
}

function processResource(options: any, loaderContext: any, callback: any) {
  // set loader index to last loader
  loaderContext.loaderIndex = loaderContext.loaders.length - 1;

  const resourcePath = loaderContext.resourcePath;
  if (resourcePath) {
    options.processResource(loaderContext, resourcePath, function (err: unknown) {
      if (err) return callback(err);
      const args = Array.prototype.slice.call(arguments, 1);
      options.resourceBuffer = args[0];
      iterateNormalLoaders(options, loaderContext, args, callback);
    });
  } else {
    iterateNormalLoaders(options, loaderContext, [null], callback);
  }
}

function iterateNormalLoaders(options: any, loaderContext: any, args: any, callback: any): any {
  if (loaderContext.loaderIndex < 0) return callback(null, args);

  const currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

  // iterate
  if (currentLoaderObject.normalExecuted) {
    loaderContext.loaderIndex--;
    return iterateNormalLoaders(options, loaderContext, args, callback);
  }

  const fn = currentLoaderObject.normal;
  currentLoaderObject.normalExecuted = true;
  if (!fn) {
    return iterateNormalLoaders(options, loaderContext, args, callback);
  }

  convertArgs(args, currentLoaderObject.raw);

  runSyncOrAsync(fn, loaderContext, args, function (err: unknown) {
    if (err) return callback(err);

    const args = Array.prototype.slice.call(arguments, 1);
    iterateNormalLoaders(options, loaderContext, args, callback);
  });
}

export function getContext(resource: string) {
  const path = parsePathQueryFragment(resource).path;
  return dirname(path);
}

export function runLoaders(options: any, callback: any) {
  // read options
  const resource = options.resource || '';
  let loaders = options.loaders || [];
  const loaderContext = options.context || {};
  const processResource =
    options.processResource ||
    ((readResource: any, context: any, resource: any, callback: any) => {
      context.addDependency(resource);
      readResource(resource, callback);
    }).bind(null, options.readResource || readFile);

  //
  const splittedResource = resource && parsePathQueryFragment(resource);
  const resourcePath = splittedResource ? splittedResource.path : undefined;
  const resourceQuery = splittedResource ? splittedResource.query : undefined;
  const resourceFragment = splittedResource ? splittedResource.fragment : undefined;
  const contextDirectory = resourcePath ? dirname(resourcePath) : null;

  // execution state
  let requestCacheable = true;
  const fileDependencies: any[] = [];
  const contextDependencies: any[] = [];
  const missingDependencies: any[] = [];

  // prepare loader objects
  loaders = loaders.map(createLoaderObject);

  loaderContext.context = contextDirectory;
  loaderContext.loaderIndex = 0;
  loaderContext.loaders = loaders;
  loaderContext.resourcePath = resourcePath;
  loaderContext.resourceQuery = resourceQuery;
  loaderContext.resourceFragment = resourceFragment;
  loaderContext.async = null;
  loaderContext.callback = null;
  loaderContext.cacheable = function cacheable(flag: boolean) {
    if (flag === false) {
      requestCacheable = false;
    }
  };
  loaderContext.dependency = loaderContext.addDependency = function addDependency(file: string) {
    fileDependencies.push(file);
  };
  loaderContext.addContextDependency = function addContextDependency(context: string) {
    contextDependencies.push(context);
  };
  loaderContext.addMissingDependency = function addMissingDependency(context: string) {
    missingDependencies.push(context);
  };
  loaderContext.getDependencies = function getDependencies() {
    return fileDependencies.slice();
  };
  loaderContext.getContextDependencies = function getContextDependencies() {
    return contextDependencies.slice();
  };
  loaderContext.getMissingDependencies = function getMissingDependencies() {
    return missingDependencies.slice();
  };
  loaderContext.clearDependencies = function clearDependencies() {
    fileDependencies.length = 0;
    contextDependencies.length = 0;
    missingDependencies.length = 0;
    requestCacheable = true;
  };
  Object.defineProperty(loaderContext, 'resource', {
    enumerable: true,
    get: function () {
      if (loaderContext.resourcePath === undefined) return undefined;
      return (
        loaderContext.resourcePath.replace(/#/g, '\0#') +
        loaderContext.resourceQuery.replace(/#/g, '\0#') +
        loaderContext.resourceFragment
      );
    },
    set: function (value) {
      const splittedResource = value && parsePathQueryFragment(value);
      loaderContext.resourcePath = splittedResource ? splittedResource.path : undefined;
      loaderContext.resourceQuery = splittedResource ? splittedResource.query : undefined;
      loaderContext.resourceFragment = splittedResource ? splittedResource.fragment : undefined;
    },
  });
  Object.defineProperty(loaderContext, 'request', {
    enumerable: true,
    get: function () {
      return loaderContext.loaders
        .map(function (o: any) {
          return o.request;
        })
        .concat(loaderContext.resource || '')
        .join('!');
    },
  });
  Object.defineProperty(loaderContext, 'remainingRequest', {
    enumerable: true,
    get: function () {
      if (loaderContext.loaderIndex >= loaderContext.loaders.length - 1 && !loaderContext.resource)
        return '';
      return loaderContext.loaders
        .slice(loaderContext.loaderIndex + 1)
        .map(function (o: any) {
          return o.request;
        })
        .concat(loaderContext.resource || '')
        .join('!');
    },
  });
  Object.defineProperty(loaderContext, 'currentRequest', {
    enumerable: true,
    get: function () {
      return loaderContext.loaders
        .slice(loaderContext.loaderIndex)
        .map(function (o: any) {
          return o.request;
        })
        .concat(loaderContext.resource || '')
        .join('!');
    },
  });
  Object.defineProperty(loaderContext, 'previousRequest', {
    enumerable: true,
    get: function () {
      return loaderContext.loaders
        .slice(0, loaderContext.loaderIndex)
        .map(function (o: any) {
          return o.request;
        })
        .join('!');
    },
  });
  Object.defineProperty(loaderContext, 'query', {
    enumerable: true,
    get: function () {
      const entry = loaderContext.loaders[loaderContext.loaderIndex];
      return entry.options && typeof entry.options === 'object' ? entry.options : entry.query;
    },
  });
  Object.defineProperty(loaderContext, 'data', {
    enumerable: true,
    get: function () {
      return loaderContext.loaders[loaderContext.loaderIndex].data;
    },
  });

  // finish loader context
  if (Object.preventExtensions) {
    Object.preventExtensions(loaderContext);
  }

  const processOptions = {
    resourceBuffer: null,
    processResource: processResource,
  };
  iteratePitchingLoaders(processOptions, loaderContext, function (err: unknown, result: any) {
    if (err) {
      return callback(err, {
        cacheable: requestCacheable,
        fileDependencies: fileDependencies,
        contextDependencies: contextDependencies,
        missingDependencies: missingDependencies,
      });
    }
    callback(null, {
      result: result,
      resourceBuffer: processOptions.resourceBuffer,
      cacheable: requestCacheable,
      fileDependencies: fileDependencies,
      contextDependencies: contextDependencies,
      missingDependencies: missingDependencies,
    });
  });
}
