import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  metafile: true,
  treeshake: true,
  splitting: false,
});
