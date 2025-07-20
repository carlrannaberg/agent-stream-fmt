import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Temporarily disabled due to TypeScript path issues
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  metafile: true,
});