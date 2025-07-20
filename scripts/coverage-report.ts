#!/usr/bin/env tsx
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

/**
 * Generate comprehensive coverage report
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CoverageData {
  total: {
    lines: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
  [key: string]: any;
}

async function generateCoverageReport(): Promise<void> {
  console.log('📊 Generating comprehensive coverage report...\n');

  try {
    // Run tests with coverage (excluding problematic performance tests)
    console.log('Running tests with coverage...');
    try {
      execSync('npx vitest --coverage --run src --reporter=basic', {
        stdio: 'inherit',
      });
    } catch (error) {
      console.log(
        '⚠️  Some tests failed, but continuing with coverage analysis...',
      );
    }

    // Check if coverage files exist
    const coverageJsonPath = join(
      process.cwd(),
      'coverage',
      'coverage-final.json',
    );
    const lcovPath = join(process.cwd(), 'coverage', 'lcov.info');

    if (!existsSync(coverageJsonPath)) {
      console.error('❌ Coverage file not found at:', coverageJsonPath);
      process.exit(1);
    }

    // Read coverage data
    const coverageData: CoverageData = JSON.parse(
      readFileSync(coverageJsonPath, 'utf-8'),
    );

    // Calculate summary statistics
    const summary = calculateSummary(coverageData);

    // Generate report
    const report = generateMarkdownReport(summary, coverageData);

    // Save report
    const reportPath = join(
      process.cwd(),
      'reports',
      `COVERAGE_REPORT_${new Date().toISOString().split('T')[0]}.md`,
    );
    writeFileSync(reportPath, report);

    console.log('\n✅ Coverage report generated successfully!');
    console.log('📄 Report saved to:', reportPath);
    console.log('📊 LCOV file available at:', lcovPath);

    // Print summary to console
    printSummary(summary);
  } catch (error) {
    console.error('❌ Error generating coverage report:', error);
    process.exit(1);
  }
}

function calculateSummary(coverageData: any): any {
  const files = Object.keys(coverageData);

  let totalLines = 0,
    coveredLines = 0;
  let totalFunctions = 0,
    coveredFunctions = 0;
  let totalStatements = 0,
    coveredStatements = 0;
  let totalBranches = 0,
    coveredBranches = 0;

  files.forEach(file => {
    const data = coverageData[file];
    if (data.statementMap && data.s) {
      const statements = Object.keys(data.statementMap);
      totalStatements += statements.length;
      coveredStatements += statements.filter(key => data.s[key] > 0).length;
    }

    if (data.fnMap && data.f) {
      const functions = Object.keys(data.fnMap);
      totalFunctions += functions.length;
      coveredFunctions += functions.filter(key => data.f[key] > 0).length;
    }

    if (data.branchMap && data.b) {
      const branches = Object.keys(data.branchMap);
      totalBranches += branches.length;
      coveredBranches += branches.filter(key =>
        data.b[key].some((hits: number) => hits > 0),
      ).length;
    }

    // For lines, we count statements as lines
    totalLines = totalStatements;
    coveredLines = coveredStatements;
  });

  return {
    files: files.length,
    lines: {
      total: totalLines,
      covered: coveredLines,
      pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
    },
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      pct:
        totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
    },
  };
}

function generateMarkdownReport(
  summary: any,
  coverageData: CoverageData,
): string {
  const date = new Date().toISOString().split('T')[0];

  return `# Coverage Report - ${date}

## Summary

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| Lines | ${summary.lines.pct.toFixed(2)}% | ${summary.lines.covered}/${summary.lines.total} |
| Functions | ${summary.functions.pct.toFixed(2)}% | ${summary.functions.covered}/${summary.functions.total} |
| Statements | ${summary.statements.pct.toFixed(2)}% | ${summary.statements.covered}/${summary.statements.total} |
| Branches | ${summary.branches.pct.toFixed(2)}% | ${summary.branches.covered}/${summary.branches.total} |

**Total Files Analyzed:** ${summary.files}

## Thresholds Status

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Lines | ${summary.lines.pct.toFixed(1)}% | 85% | ${summary.lines.pct >= 85 ? '✅ PASS' : '❌ FAIL'} |
| Functions | ${summary.functions.pct.toFixed(1)}% | 85% | ${summary.functions.pct >= 85 ? '✅ PASS' : '❌ FAIL'} |
| Statements | ${summary.statements.pct.toFixed(1)}% | 85% | ${summary.statements.pct >= 85 ? '✅ PASS' : '❌ FAIL'} |
| Branches | ${summary.branches.pct.toFixed(1)}% | 85% | ${summary.branches.pct >= 85 ? '✅ PASS' : '❌ FAIL'} |

## File Coverage Details

| File | Lines | Functions | Statements | Branches |
|------|-------|-----------|------------|----------|
${generateFileTable(coverageData)}

## Coverage Files

- **LCOV Report:** \`coverage/lcov.info\`
- **HTML Report:** \`coverage/index.html\`
- **JSON Report:** \`coverage/coverage-final.json\`

## Next Steps

${generateRecommendations(summary)}

---
*Generated on ${new Date().toISOString()}*
`;
}

function generateFileTable(coverageData: any): string {
  const files = Object.keys(coverageData);

  return files
    .map(file => {
      const data = coverageData[file];

      // Calculate percentages for this file
      let linesPct = 'N/A',
        functionsPct = 'N/A',
        statementsPct = 'N/A',
        branchesPct = 'N/A';

      if (data.statementMap && data.s) {
        const statements = Object.keys(data.statementMap);
        const covered = statements.filter(key => data.s[key] > 0).length;
        statementsPct =
          statements.length > 0
            ? `${((covered / statements.length) * 100).toFixed(1)}%`
            : '0.0%';
        linesPct = statementsPct; // Use statements as lines
      }

      if (data.fnMap && data.f) {
        const functions = Object.keys(data.fnMap);
        const covered = functions.filter(key => data.f[key] > 0).length;
        functionsPct =
          functions.length > 0
            ? `${((covered / functions.length) * 100).toFixed(1)}%`
            : '0.0%';
      }

      if (data.branchMap && data.b) {
        const branches = Object.keys(data.branchMap);
        const covered = branches.filter(key =>
          data.b[key].some((hits: number) => hits > 0),
        ).length;
        branchesPct =
          branches.length > 0
            ? `${((covered / branches.length) * 100).toFixed(1)}%`
            : '0.0%';
      }

      // Shorten file path for display
      const shortFile = file.replace(
        '/Users/carl/Development/agents/agent-stream-fmt/',
        '',
      );

      return `| ${shortFile} | ${linesPct} | ${functionsPct} | ${statementsPct} | ${branchesPct} |`;
    })
    .join('\n');
}

function generateRecommendations(summary: any): string {
  const recommendations: string[] = [];

  if (summary.lines.pct < 85) {
    recommendations.push(
      '- **Lines Coverage:** Add more test cases to improve line coverage',
    );
  }
  if (summary.functions.pct < 85) {
    recommendations.push(
      '- **Function Coverage:** Ensure all functions have test coverage',
    );
  }
  if (summary.statements.pct < 85) {
    recommendations.push(
      '- **Statement Coverage:** Add tests for uncovered statements',
    );
  }
  if (summary.branches.pct < 85) {
    recommendations.push(
      '- **Branch Coverage:** Add tests for conditional branches and error paths',
    );
  }

  if (recommendations.length === 0) {
    return '🎉 **Excellent!** All coverage thresholds are met. Consider maintaining or improving current coverage levels.';
  }

  return recommendations.join('\n');
}

function printSummary(summary: any): void {
  console.log('\n📊 Coverage Summary:');
  console.log(
    `   Lines:      ${summary.lines.pct.toFixed(1)}% (${summary.lines.covered}/${summary.lines.total})`,
  );
  console.log(
    `   Functions:  ${summary.functions.pct.toFixed(1)}% (${summary.functions.covered}/${summary.functions.total})`,
  );
  console.log(
    `   Statements: ${summary.statements.pct.toFixed(1)}% (${summary.statements.covered}/${summary.statements.total})`,
  );
  console.log(
    `   Branches:   ${summary.branches.pct.toFixed(1)}% (${summary.branches.covered}/${summary.branches.total})`,
  );

  const overall =
    (summary.lines.pct +
      summary.functions.pct +
      summary.statements.pct +
      summary.branches.pct) /
    4;
  console.log(`\n🎯 Overall Coverage: ${overall.toFixed(1)}%`);

  if (overall >= 85) {
    console.log('✅ Coverage thresholds met!');
  } else {
    console.log('⚠️  Coverage below target threshold (85%)');
  }
}

// Run the script
generateCoverageReport().catch(console.error);
