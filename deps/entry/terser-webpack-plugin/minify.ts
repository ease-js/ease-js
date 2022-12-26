import path from 'node:path';

export async function minify(options: any) {
  const { name, input, inputSourceMap, extractComments } = options;
  const { implementation, options: minimizerOptions } = options.minimizer;

  return implementation({ [name]: input }, inputSourceMap, minimizerOptions, extractComments);
}

export async function transform(options: any) {
  // 'use strict' => this === undefined (Clean Scope)
  // Safer for possible security issues, albeit not critical at all here
  const __filename = import.meta.url.replace(/^[a-z0-9]+:\/\//, '');
  const __dirname = path.dirname(__filename);
  const evaluatedOptions = new Function(
    '__filename',
    '__dirname',
    `'use strict'\nreturn ${options}`,
  )(__filename, __dirname);

  return minify(evaluatedOptions);
}
