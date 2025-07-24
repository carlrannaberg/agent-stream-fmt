import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  metafile: true,
  treeshake: true,
  splitting: false,
  // Add shims for better Node.js compatibility in CJS
  shims: true,
});
