window.BENCHMARK_DATA = {
  "lastUpdate": 1766171135614,
  "repoUrl": "https://github.com/wickedev/regrafter",
  "entries": {
    "Benchmark": [
      {
        "commit": {
          "author": {
            "email": "orange881217@gmail.com",
            "name": "wickedev",
            "username": "wickedev"
          },
          "committer": {
            "email": "orange881217@gmail.com",
            "name": "wickedev",
            "username": "wickedev"
          },
          "distinct": true,
          "id": "7a5cf7af59d654798d278b956a5aca3f9bd349f1",
          "message": "fix(ci): add write permissions for benchmark results push\n\n- Add 'contents: write' permission for gh-pages push\n- Add 'deployments: write' for GitHub Pages deployment\n- Fixes '403 Permission denied' error from github-actions[bot]",
          "timestamp": "2025-12-20T04:03:49+09:00",
          "tree_id": "5460b2753c19682b139093644c47b612dd59403b",
          "url": "https://github.com/wickedev/regrafter/commit/7a5cf7af59d654798d278b956a5aca3f9bd349f1"
        },
        "date": 1766171135000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Single File > regraft - 500 lines",
            "value": 41,
            "range": "±5.84%",
            "unit": "ops/sec",
            "extra": "21 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Single File > regraft - 1000 lines",
            "value": 23,
            "range": "±12.74%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Single File > canMove - 1000 lines",
            "value": 61,
            "range": "±12.65%",
            "unit": "ops/sec",
            "extra": "31 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Multi-File > regraft - 10 files, 1000 lines each",
            "value": 22,
            "range": "±11.26%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Multi-File > regraft - 10 files, cross-file move",
            "value": 15,
            "range": "±7.26%",
            "unit": "ops/sec",
            "extra": "10 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - canMove vs Full Operation > canMove only",
            "value": 63,
            "range": "±5.99%",
            "unit": "ops/sec",
            "extra": "32 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - canMove vs Full Operation > full regraft",
            "value": 23,
            "range": "±13.84%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Move Modes > Move.Before - 1000 lines",
            "value": 23,
            "range": "±10.78%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Move Modes > Move.After - 1000 lines",
            "value": 23,
            "range": "±9.89%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Move Modes > Move.Inside - 1000 lines",
            "value": 23,
            "range": "±8.59%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > ok() constructor",
            "value": 10966663,
            "range": "±0.71%",
            "unit": "ops/sec",
            "extra": "5483332 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > err() constructor",
            "value": 11327478,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "5663739 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > ok() with object",
            "value": 10912590,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "5456295 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > err() with object",
            "value": 11057782,
            "range": "±0.10%",
            "unit": "ops/sec",
            "extra": "5528891 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > map() on Ok",
            "value": 9290968,
            "range": "±0.26%",
            "unit": "ops/sec",
            "extra": "4645484 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > map() on Err (passthrough)",
            "value": 10996725,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "5498363 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > flatMap() on Ok",
            "value": 8811241,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "4405621 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > flatMap() on Err (passthrough)",
            "value": 10963745,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "5481873 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > mapErr() on Ok (passthrough)",
            "value": 10529397,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "5264699 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > mapErr() on Err",
            "value": 9295034,
            "range": "±0.19%",
            "unit": "ops/sec",
            "extra": "4647517 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Chained Operations Performance > map chain (3 operations)",
            "value": 4700181,
            "range": "±0.59%",
            "unit": "ops/sec",
            "extra": "2350091 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Chained Operations Performance > flatMap chain (3 operations)",
            "value": 4047205,
            "range": "±0.61%",
            "unit": "ops/sec",
            "extra": "2023603 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Chained Operations Performance > mixed chain (map + flatMap + mapErr)",
            "value": 4512549,
            "range": "±0.78%",
            "unit": "ops/sec",
            "extra": "2256275 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Result-based pipeline (success path)",
            "value": 5313455,
            "range": "±0.11%",
            "unit": "ops/sec",
            "extra": "2656728 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Try-catch pipeline (success path)",
            "value": 15239755,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "7619878 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Result-based pipeline (error path)",
            "value": 8586582,
            "range": "±0.27%",
            "unit": "ops/sec",
            "extra": "4293291 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Try-catch pipeline (error path)",
            "value": 216496,
            "range": "±0.34%",
            "unit": "ops/sec",
            "extra": "108249 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > tryCatch wrapper",
            "value": 2673183,
            "range": "±0.19%",
            "unit": "ops/sec",
            "extra": "1336592 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > raw try-catch",
            "value": 3349562,
            "range": "±0.08%",
            "unit": "ops/sec",
            "extra": "1674781 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 10,000 ok() creations",
            "value": 4864,
            "range": "±0.11%",
            "unit": "ops/sec",
            "extra": "2433 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 10,000 map() operations",
            "value": 2857,
            "range": "±1.00%",
            "unit": "ops/sec",
            "extra": "1429 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 10,000 flatMap() operations",
            "value": 2125,
            "range": "±0.93%",
            "unit": "ops/sec",
            "extra": "1063 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 1,000 chained operations",
            "value": 26601,
            "range": "±0.81%",
            "unit": "ops/sec",
            "extra": "13301 samples"
          }
        ]
      }
    ]
  }
}