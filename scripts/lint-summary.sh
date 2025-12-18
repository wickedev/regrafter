#!/bin/bash

# Run lint and show only summary
OUTPUT=$(yarn lint 2>&1)
SUMMARY=$(echo "$OUTPUT" | grep -E "✖|problems" | tail -1)

if [ -z "$SUMMARY" ]; then
  echo "✓ No lint errors or warnings found"
else
  echo "$SUMMARY"
fi
