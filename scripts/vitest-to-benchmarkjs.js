#!/usr/bin/env node
/**
 * Convert Vitest benchmark JSON output to benchmark.js format
 *
 * Reads vitest --outputJson format and converts it to the format expected
 * by benchmark-action/github-action-benchmark for the 'benchmarkjs' tool.
 *
 * Usage: node scripts/vitest-to-benchmarkjs.js <input.json> <output.json>
 */

import { readFileSync, writeFileSync } from 'fs';

const [,, inputFile, outputFile] = process.argv;

if (!inputFile || !outputFile) {
  console.error('Usage: node scripts/vitest-to-benchmarkjs.js <input.json> <output.json>');
  process.exit(1);
}

try {
  // Read vitest JSON output
  const vitestData = JSON.parse(readFileSync(inputFile, 'utf-8'));

  // Convert to benchmarkjs format
  const benchmarkjsData = [];

  for (const file of vitestData.files) {
    for (const group of file.groups) {
      const groupName = group.fullName || 'Benchmarks';

      for (const benchmark of group.benchmarks) {
        benchmarkjsData.push({
          name: `${groupName} > ${benchmark.name}`,
          value: benchmark.hz,          // ops/sec
          unit: 'ops/sec',
          range: `±${benchmark.rme.toFixed(2)}%`
        });
      }
    }
  }

  // Write benchmarkjs format
  writeFileSync(outputFile, JSON.stringify(benchmarkjsData, null, 2));

  console.log(`✅ Converted ${benchmarkjsData.length} benchmarks to ${outputFile}`);
} catch (error) {
  console.error('❌ Error converting benchmark data:', error.message);
  process.exit(1);
}
