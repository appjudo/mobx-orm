import { resolve } from 'path';
import ttypescript from 'ttypescript';

import commonjsPlugin from '@rollup/plugin-commonjs';
import resolvePlugin from '@rollup/plugin-node-resolve';

import includePathsPlugin from 'rollup-plugin-includepaths';
import peerDepsExternalPlugin from 'rollup-plugin-peer-deps-external';
import typescriptPlugin from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
    exports: 'named',
    interop: false,
    sourcemap: true,
  },
  plugins: [
    includePathsPlugin({
      include: {},
      paths: ['src/'],
      external: [],
      extensions: ['.js', '.json', '.ts'],
    }),
    peerDepsExternalPlugin({
      packageJsonPath: resolve(__dirname, 'package.json'),
    }),
    resolvePlugin(),
    typescriptPlugin({
      rollupCommonJSResolveHack: true,
      typescript: ttypescript,
      clean: true,
    }),
    commonjsPlugin(),
  ],
};
