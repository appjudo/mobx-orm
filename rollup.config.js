import commonjs from 'rollup-plugin-commonjs';
import includePaths from 'rollup-plugin-includepaths';
// import multiInput from 'rollup-plugin-multi-input';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
    exports: 'named',
    sourcemap: true
  },
  plugins: [
    includePaths({
      include: {},
      paths: ['src/'],
      external: [],
      extensions: ['.js', '.json', '.ts']
    }),
    peerDepsExternal(),
    // multiInput(),
    resolve(),
    typescript({
      rollupCommonJSResolveHack: true,
      clean: true
    }),
    commonjs(),
  ],
};
