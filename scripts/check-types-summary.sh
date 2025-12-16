#!/bin/bash

# Run typecheck and show only summary
yarn typecheck 2>&1 | grep -E "^(src/.*\.ts|.*error TS)" > /tmp/typecheck-errors.txt

echo "=== Error Count by Type ==="
grep "error TS" /tmp/typecheck-errors.txt | sed 's/.*error \(TS[0-9]*\).*/\1/' | sort | uniq -c | sort -rn

echo ""
grep "error TS" /tmp/typecheck-errors.txt | wc -l | xargs echo "Total:"
