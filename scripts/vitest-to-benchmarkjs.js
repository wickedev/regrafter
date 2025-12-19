#!/usr/bin/env node
/**
 * Convert Vitest benchmark JSON output to benchmark.js format
 *
 * Reads vitest --outputJson format and converts it to the format expected
 * by benchmark-action/github-action-benchmark for the 'benchmarkjs' tool.
 *
 * Generates both .txt file (for benchmark-action) and .json file (for PR comments)
 *
 * Usage: node scripts/vitest-to-benchmarkjs.js <input.json> <output.txt>
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

const [,, inputFile, outputFile] = process.argv;

if (!inputFile || !outputFile) {
  console.error('Usage: node scripts/vitest-to-benchmarkjs.js <input.json> <output.txt>');
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
          range: `±${benchmark.rme.toFixed(2)}%`,
          samples: benchmark.sampleCount || 1  // actual sample count from Vitest
        });
      }
    }
  }

  if (benchmarkjsData.length === 0) {
    throw new Error('No benchmarks found in Vitest output');
  }

  // Convert to BenchmarkJS text format
  // Format: "name x value ops/sec ±rme% (samples runs sampled)"
  const textOutput = benchmarkjsData.map(bench => {
    // Format the value with commas
    const formattedValue = bench.value.toLocaleString('en-US', {
      maximumFractionDigits: 0
    });

    // BenchmarkJS format: "name x ops/sec ±rme% (samples runs sampled)"
    const sampleText = bench.samples === 1 ? '1 run sampled' : `${bench.samples} runs sampled`;
    return `${bench.name} x ${formattedValue} ops/sec ${bench.range} (${sampleText})`;
  }).join('\n');

  // Determine output file names (generate both .txt and .json)
  const baseOutputFile = outputFile.replace(/\.(txt|json)$/, '');
  const textOutputFile = `${baseOutputFile}.txt`;
  const jsonOutputFile = `${baseOutputFile}.json`;

  // Write benchmarkjs text format (for github-action-benchmark)
  console.log(`💾 Writing BenchmarkJS text format to ${textOutputFile}...`);
  writeFileSync(textOutputFile, textOutput);

  // Write JSON format (for PR comments and regression checks)
  console.log(`💾 Writing JSON format to ${jsonOutputFile}...`);
  writeFileSync(jsonOutputFile, JSON.stringify(benchmarkjsData, null, 2));

  console.log(`✅ Converted ${benchmarkjsData.length} benchmarks`);
  console.log(`   - Text format: ${textOutputFile}`);
  console.log(`   - JSON format: ${jsonOutputFile}`);
  console.log(`📊 Sample output:`);
  console.log(textOutput.split('\n').slice(0, 2).join('\n'));
} catch (error) {
  console.error('❌ Error converting benchmark data:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
