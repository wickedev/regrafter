window.BENCHMARK_DATA = {
  "lastUpdate": 1766171915495,
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
      },
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
          "id": "6d2b8afd387baa508a129b6fecd2cfe232890334",
          "message": "docs: add project status badges\n- Add npm, codecov, license, TypeScript, and Node.js badges to README\n- Configure codecov token in CI workflow for coverage uploads",
          "timestamp": "2025-12-20T04:16:57+09:00",
          "tree_id": "f006a5693119abf8f6106998bf2746a158f29d50",
          "url": "https://github.com/wickedev/regrafter/commit/6d2b8afd387baa508a129b6fecd2cfe232890334"
        },
        "date": 1766171914839,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Single File > regraft - 500 lines",
            "value": 39,
            "range": "±7.33%",
            "unit": "ops/sec",
            "extra": "20 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Single File > regraft - 1000 lines",
            "value": 23,
            "range": "±9.86%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Single File > canMove - 1000 lines",
            "value": 59,
            "range": "±14.62%",
            "unit": "ops/sec",
            "extra": "30 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Multi-File > regraft - 10 files, 1000 lines each",
            "value": 23,
            "range": "±10.55%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Multi-File > regraft - 10 files, cross-file move",
            "value": 14,
            "range": "±11.95%",
            "unit": "ops/sec",
            "extra": "10 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - canMove vs Full Operation > canMove only",
            "value": 58,
            "range": "±14.29%",
            "unit": "ops/sec",
            "extra": "29 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - canMove vs Full Operation > full regraft",
            "value": 23,
            "range": "±8.26%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Move Modes > Move.Before - 1000 lines",
            "value": 23,
            "range": "±7.31%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Move Modes > Move.After - 1000 lines",
            "value": 23,
            "range": "±10.02%",
            "unit": "ops/sec",
            "extra": "12 samples"
          },
          {
            "name": "src/__tests__/benchmarks/performance.bench.ts > Performance Benchmarks - Move Modes > Move.Inside - 1000 lines",
            "value": 24,
            "range": "±4.34%",
            "unit": "ops/sec",
            "extra": "13 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > ok() constructor",
            "value": 10770605,
            "range": "±0.10%",
            "unit": "ops/sec",
            "extra": "5385303 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > err() constructor",
            "value": 10200339,
            "range": "±0.11%",
            "unit": "ops/sec",
            "extra": "5100170 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > ok() with object",
            "value": 10652467,
            "range": "±0.10%",
            "unit": "ops/sec",
            "extra": "5326234 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Result Creation Performance > err() with object",
            "value": 9950558,
            "range": "±0.16%",
            "unit": "ops/sec",
            "extra": "4975280 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > map() on Ok",
            "value": 9155828,
            "range": "±0.24%",
            "unit": "ops/sec",
            "extra": "4577915 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > map() on Err (passthrough)",
            "value": 10684933,
            "range": "±0.09%",
            "unit": "ops/sec",
            "extra": "5342467 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > flatMap() on Ok",
            "value": 8412752,
            "range": "±0.10%",
            "unit": "ops/sec",
            "extra": "4206376 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > flatMap() on Err (passthrough)",
            "value": 10645824,
            "range": "±0.09%",
            "unit": "ops/sec",
            "extra": "5322913 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > mapErr() on Ok (passthrough)",
            "value": 10796928,
            "range": "±0.09%",
            "unit": "ops/sec",
            "extra": "5398464 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Mapping Operations Performance > mapErr() on Err",
            "value": 9044169,
            "range": "±0.19%",
            "unit": "ops/sec",
            "extra": "4522085 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Chained Operations Performance > map chain (3 operations)",
            "value": 4332118,
            "range": "±5.50%",
            "unit": "ops/sec",
            "extra": "2166060 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Chained Operations Performance > flatMap chain (3 operations)",
            "value": 4043768,
            "range": "±0.33%",
            "unit": "ops/sec",
            "extra": "2021885 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Chained Operations Performance > mixed chain (map + flatMap + mapErr)",
            "value": 4246633,
            "range": "±0.49%",
            "unit": "ops/sec",
            "extra": "2123317 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Result-based pipeline (success path)",
            "value": 5181687,
            "range": "±0.09%",
            "unit": "ops/sec",
            "extra": "2590844 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Try-catch pipeline (success path)",
            "value": 15126455,
            "range": "±0.09%",
            "unit": "ops/sec",
            "extra": "7563228 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Result-based pipeline (error path)",
            "value": 7972844,
            "range": "±0.21%",
            "unit": "ops/sec",
            "extra": "3986422 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > Try-catch pipeline (error path)",
            "value": 218980,
            "range": "±0.50%",
            "unit": "ops/sec",
            "extra": "109490 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > tryCatch wrapper",
            "value": 2573275,
            "range": "±4.28%",
            "unit": "ops/sec",
            "extra": "1286638 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > End-to-End Pipeline - Result vs Try-Catch > raw try-catch",
            "value": 3103365,
            "range": "±0.09%",
            "unit": "ops/sec",
            "extra": "1551683 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 10,000 ok() creations",
            "value": 4331,
            "range": "±0.18%",
            "unit": "ops/sec",
            "extra": "2166 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 10,000 map() operations",
            "value": 2757,
            "range": "±0.64%",
            "unit": "ops/sec",
            "extra": "1379 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 10,000 flatMap() operations",
            "value": 2105,
            "range": "±0.74%",
            "unit": "ops/sec",
            "extra": "1053 samples"
          },
          {
            "name": "src/result/__tests__/performance.bench.ts > Stress Test - High Volume > 1,000 chained operations",
            "value": 25630,
            "range": "±0.79%",
            "unit": "ops/sec",
            "extra": "12816 samples"
          }
        ]
      }
    ]
  }
}