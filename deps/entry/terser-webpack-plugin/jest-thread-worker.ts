import worker_threads from 'node:worker_threads';
import { createRequire } from 'node:module';
// @ts-expect-error
import * as types from '../../node_modules/jest-worker/build/types.js';

let file: any = null;
let setupArgs: any = [];
let initialized = false;

const require = createRequire(import.meta.url);

const messageListener = (request: any) => {
  switch (request[0]) {
    case types.CHILD_MESSAGE_INITIALIZE:
      const init = request;
      file = init[2];
      setupArgs = init[3];
      process.env.JEST_WORKER_ID = init[4];
      break;
    case types.CHILD_MESSAGE_CALL:
      const call = request;
      execMethod(call[2], call[3]);
      break;
    case types.CHILD_MESSAGE_END:
      end();
      break;
    case types.CHILD_MESSAGE_MEM_USAGE:
      reportMemoryUsage();
      break;
    default:
      throw new TypeError(`Unexpected request from parent process: ${request[0]}`);
  }
};
worker_threads.parentPort?.on('message', messageListener);

function reportMemoryUsage() {
  if (worker_threads.isMainThread) {
    throw new Error('Child can only be used on a forked process');
  }
  const msg = [types.PARENT_MESSAGE_MEM_USAGE, process.memoryUsage().heapUsed];
  worker_threads.parentPort?.postMessage(msg);
}

function reportSuccess(result: any) {
  if (worker_threads.isMainThread) {
    throw new Error('Child can only be used on a forked process');
  }
  worker_threads.parentPort?.postMessage([types.PARENT_MESSAGE_OK, result]);
}

function reportClientError(error: any) {
  return reportError(error, types.PARENT_MESSAGE_CLIENT_ERROR);
}

function reportInitializeError(error: any) {
  return reportError(error, types.PARENT_MESSAGE_SETUP_ERROR);
}

function reportError(error: any, type: any) {
  if (worker_threads.isMainThread) {
    throw new Error('Child can only be used on a forked process');
  }
  if (error == null) {
    error = new Error('"null" or "undefined" thrown');
  }
  worker_threads.parentPort?.postMessage([
    type,
    error.constructor && error.constructor.name,
    error.message,
    error.stack,
    typeof error === 'object'
      ? {
          ...error,
        }
      : error,
  ]);
}

function end() {
  const main = require(file);
  if (!main.teardown) {
    exitProcess();
    return;
  }
  execFunction(main.teardown, main, [], exitProcess, exitProcess);
}

function exitProcess() {
  // Clean up open handles so the worker ideally exits gracefully
  worker_threads.parentPort?.removeListener('message', messageListener);
}

function execMethod(method: any, args: any) {
  const main = require(file);
  let fn: any;
  if (method === 'default') {
    fn = main.__esModule ? main.default : main;
  } else {
    fn = main[method];
  }
  function execHelper() {
    execFunction(fn, main, args, reportSuccess, reportClientError);
  }
  if (initialized || !main.setup) {
    execHelper();
    return;
  }
  initialized = true;
  execFunction(main.setup, main, setupArgs, execHelper, reportInitializeError);
}

function execFunction(fn: any, ctx: any, args: any, onResult: any, onError: any) {
  let result;
  try {
    result = fn.apply(ctx, args);
  } catch (err) {
    onError(err);
    return;
  }
  if (
    (typeof result === 'object' || typeof result === 'function') &&
    typeof (result as any)?.then === 'function'
  ) {
    result.then(onResult, onError);
  } else {
    onResult(result);
  }
}
