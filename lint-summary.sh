#!/bin/bash

# Run lint and show only summary
yarn lint 2>&1 | grep -E "✖|problems" | tail -1
