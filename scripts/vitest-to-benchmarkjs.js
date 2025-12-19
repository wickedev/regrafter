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
  console.log(`📖 Reading Vitest output from ${inputFile}...`);
  const vitestData = JSON.parse(readFileSync(inputFile, 'utf-8'));

  // Validate structure
  if (!vitestData.files || !Array.isArray(vitestData.files)) {
    throw new Error('Invalid Vitest output: missing or invalid "files" array');
  }

  // Convert to benchmarkjs format
  const benchmarkjsData = [];

  for (const file of vitestData.files) {
    if (!file.groups || !Array.isArray(file.groups)) {
      console.warn(`⚠️  Skipping file ${file.filepath}: missing or invalid "groups" array`);
      continue;
    }

    for (const group of file.groups) {
      const groupName = group.fullName || 'Benchmarks';

      if (!group.benchmarks || !Array.isArray(group.benchmarks)) {
        console.warn(`⚠️  Skipping group ${groupName}: missing or invalid "benchmarks" array`);
        continue;
      }

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

  if (benchmarkjsData.length === 0) {
    throw new Error('No benchmarks found in Vitest output');
  }

  // Write benchmarkjs format
  console.log(`💾 Writing BenchmarkJS format to ${outputFile}...`);
  writeFileSync(outputFile, JSON.stringify(benchmarkjsData, null, 2));

  console.log(`✅ Converted ${benchmarkjsData.length} benchmarks to ${outputFile}`);
  console.log(`📊 Sample output:`);
  console.log(JSON.stringify(benchmarkjsData.slice(0, 2), null, 2));
} catch (error) {
  console.error('❌ Error converting benchmark data:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
