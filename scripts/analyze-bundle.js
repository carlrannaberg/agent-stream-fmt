import { analyzeMetafile } from 'esbuild';
import fs from 'fs';
import path from 'path';

async function analyzeBundles() {
  console.log('🔍 Bundle Size Analysis\n');

  try {
    // Check if metafiles exist
    const esmMetafilePath = 'dist/metafile-esm.json';
    const cjsMetafilePath = 'dist/metafile-cjs.json';

    if (!fs.existsSync(esmMetafilePath) && !fs.existsSync(cjsMetafilePath)) {
      console.error(
        '❌ Metafiles not found. Build with metafile generation first.',
      );
      process.exit(1);
    }

    // Analyze ESM metafile
    if (fs.existsSync(esmMetafilePath)) {
      const esmMetafile = JSON.parse(fs.readFileSync(esmMetafilePath, 'utf8'));
      const esmAnalysis = await analyzeMetafile(esmMetafile);

      console.log('📊 ESM Bundle Composition:');
      console.log(esmAnalysis);
      console.log('\n');
    }

    // Analyze CJS metafile
    if (fs.existsSync(cjsMetafilePath)) {
      const cjsMetafile = JSON.parse(fs.readFileSync(cjsMetafilePath, 'utf8'));
      const cjsAnalysis = await analyzeMetafile(cjsMetafile);

      console.log('📊 CJS Bundle Composition:');
      console.log(cjsAnalysis);
      console.log('\n');
    }

    // Analyze individual bundle sizes
    const bundleFiles = [
      'dist/index.js',
      'dist/index.cjs',
      'dist/cli.js',
      'dist/cli.cjs',
    ];
    const maxSize = 55 * 1024; // 55KB per bundle (adjusted for dual ESM/CJS builds)
    let totalSize = 0;
    let hasOversize = false;

    console.log('📦 Individual Bundle Sizes:');
    console.log('─'.repeat(60));

    for (const file of bundleFiles) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        const size = stats.size;
        totalSize += size;

        const sizeKB = (size / 1024).toFixed(2);
        const limitKB = (maxSize / 1024).toFixed(0);
        const status = size > maxSize ? '❌ OVER LIMIT' : '✅ OK';

        console.log(
          `${path.basename(file).padEnd(15)} ${sizeKB.padStart(8)} KB  ${status}`,
        );

        if (size > maxSize) {
          hasOversize = true;
        }
      }
    }

    console.log('─'.repeat(60));
    console.log(`Total Size:      ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`Per-Bundle Limit: ${(maxSize / 1024).toFixed(0)} KB`);

    // Check for dependency composition
    console.log('\n📋 Dependency Breakdown:');

    // Analyze ESM dependencies
    if (fs.existsSync(esmMetafilePath)) {
      const esmMetafile = JSON.parse(fs.readFileSync(esmMetafilePath, 'utf8'));
      if (esmMetafile.outputs) {
        console.log('\nESM Dependencies:');
        for (const [outputPath, output] of Object.entries(
          esmMetafile.outputs,
        )) {
          if (output.imports && output.imports.length > 0) {
            console.log(`  ${outputPath}:`);
            const imports = output.imports
              .filter(imp => !imp.path.startsWith('src/'))
              .slice(0, 5); // Top 5 external dependencies

            for (const imp of imports) {
              const depSize = imp.bytesInOutput
                ? (imp.bytesInOutput / 1024).toFixed(1) + ' KB'
                : 'external';
              console.log(`    ${imp.path}: ${depSize}`);
            }
          }
        }
      }
    }

    // Analyze CJS dependencies
    if (fs.existsSync(cjsMetafilePath)) {
      const cjsMetafile = JSON.parse(fs.readFileSync(cjsMetafilePath, 'utf8'));
      if (cjsMetafile.outputs) {
        console.log('\nCJS Dependencies:');
        for (const [outputPath, output] of Object.entries(
          cjsMetafile.outputs,
        )) {
          if (output.imports && output.imports.length > 0) {
            console.log(`  ${outputPath}:`);
            const imports = output.imports
              .filter(imp => !imp.path.startsWith('src/'))
              .slice(0, 5); // Top 5 external dependencies

            for (const imp of imports) {
              const depSize = imp.bytesInOutput
                ? (imp.bytesInOutput / 1024).toFixed(1) + ' KB'
                : 'external';
              console.log(`    ${imp.path}: ${depSize}`);
            }
          }
        }
      }
    }

    // Final status
    console.log('\n' + '='.repeat(60));
    if (hasOversize) {
      console.error('❌ BUNDLE SIZE CHECK FAILED');
      console.error(
        `One or more bundles exceed the ${(maxSize / 1024).toFixed(0)}KB limit.`,
      );
      console.error(
        'Consider optimizing bundle size or adjusting the limit for dual ESM/CJS builds.',
      );
      process.exit(1);
    } else {
      console.log('✅ BUNDLE SIZE CHECK PASSED');
      console.log('All bundles are within the size limit.');
    }
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message);
    process.exit(1);
  }
}

analyzeBundles();
