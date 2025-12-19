# Unified Type & Lint Fixer

You are orchestrating an intelligent error-fixing workflow that analyzes TypeScript type errors, ESLint/Prettier errors AND warnings, creates concrete fix plans, and executes them in parallel using specialized agents.

This workflow runs in an **iterative loop** until all errors and warnings are resolved.

## 🎯 Key Workflow Features

**Phase 2 → Phase 4 Integration:**
- Phase 2 generates **detailed fix strategies** for each issue
- Strategies are saved to **`/tmp/fix-plans-round${ROUND}.json`** in structured format
- Phase 4 **loads the JSON** and includes detailed strategies in agent prompts
- Agents receive **specific, actionable instructions** for each fix, not generic descriptions

**Why This Matters:**
- ❌ **Before**: Agents received only "Fix TS2349 error" → agents guessed how to fix
- ✅ **After**: Agents receive "Import traverse as default export: `import traverse from '@babel/traverse'`" → agents know exactly what to do
- **Result**: Higher success rate, fewer errors remaining after agent execution

## 🚨 CRITICAL WORKFLOW RULE 🚨

**YOU MUST FOLLOW THIS EXACT SEQUENCE:**

1. **Phase 1**: Collect and analyze all errors/warnings
2. **Phase 2**: Generate detailed fix plans
3. **Phase 3**: Group files for parallel execution
4. **Phase 4**: Execute fixes with agents
5. **Phase 5**: Verify and loop if needed

## Execution Strategy

### Phase 1: Comprehensive Issue Collection

**1. Collect All Issues in Parallel**
```bash
yarn typecheck 2>&1 | tee /tmp/typecheck-round${ROUND}.txt &
yarn lint 2>&1 | tee /tmp/lint-round${ROUND}.txt &
wait
```

**2. Parse and Categorize All Issues**

Extract from each issue:
- File path
- Line number
- Severity (error or warning)
- Error code/rule (e.g., TS2322, @typescript-eslint/no-explicit-any)
- Error message

**3. Generate Summary**
```
Round ${ROUND} Summary:
- TypeScript errors: X files, Y errors
- ESLint errors: X files, Y errors
- ESLint warnings: X files, Y warnings
Total: N files, M errors, P warnings
```

**4. Check Completion**
- If errors = 0 AND warnings = 0: ✓ Done!
- If errors > 0 OR warnings > 0: Continue to Phase 2

### Phase 2: Generate Concrete Fix Plans

For each file with errors, create a **detailed fix plan** with specific strategies.

**🚨 MANDATORY**: You MUST save the plans in BOTH formats (if either is missing, Phase 4 will FAIL):
1. Human-readable markdown: `/tmp/fix-plans-round${ROUND}.md` (for user review)
2. **Machine-readable JSON: `/tmp/fix-plans-round${ROUND}.json` (for error-fixer agents - REQUIRED!)**

**CRITICAL**: Parse ALL errors from typecheck and lint outputs and create comprehensive JSON.

**⚠️ IMPORTANT**: This parser uses **pure Python** to avoid bash/sed issues with special characters in rule names (e.g., `@typescript-eslint/no-unsafe-*` contains `/` which breaks sed).

```python
#!/usr/bin/env python3
import json
import re
import os
import sys

# Configuration
ROUND = int(os.environ.get('ROUND', '1'))
TYPECHECK_FILE = f"/tmp/typecheck-round{ROUND}.txt"
LINT_FILE = f"/tmp/lint-round{ROUND}.txt"
OUTPUT_JSON = f"/tmp/fix-plans-round{ROUND}.json"

# TypeScript error code to strategy mapping
TS_STRATEGIES = {
    "TS6133": "Remove unused variable or prefix with underscore if intentionally unused",
    "TS2554": "Fix TypeScript error by addressing type incompatibility with proper types and refactoring",
    "TS2322": "Fix type definition to match expected type, add proper interface, or refactor assignment",
    "TS2349": "Import traverse as default export: `import traverse from '@babel/traverse'` instead of namespace import",
    "TS2339": "Add property to type definition or use type guard: `if ('property' in obj) { ... }`",
    "TS2532": "Add null/undefined check: `if (value !== undefined && value !== null) { ... }` or use optional chaining `value?.method()`",
    "TS2352": "Refactor to use compatible types, define proper type annotations, or use type guards for narrowing",
    "TS1361": "Change `import type` to regular `import` for decorator usage",
    "TS18048": "Add explicit undefined check before accessing property",
    "TS7006": "Add explicit type annotation for parameter",
    "TS2305": "Add missing export to module or fix import path",
    "TS2739": "Add missing properties to object literal to match expected type",
    "TS2304": "Import missing identifier or add to global types",
    "TS2206": "Fix TypeScript error by addressing type incompatibility with proper types and refactoring",
    "TS2551": "Fix TypeScript error by addressing type incompatibility with proper types and refactoring",
}

# ESLint rule to strategy mapping
ESLINT_STRATEGIES = {
    "import/no-duplicates": "Merge duplicate imports into single import statement",
    "import/order": "Reorder imports per ESLint config (type imports last, regular imports first, remove empty lines within groups)",
    "no-console": "Fix ESLint rule violation through code refactoring and improvement",
    "max-lines-per-function": "Fix ESLint rule violation through code refactoring and improvement",
    "complexity": "Extract nested logic into separate helper functions to reduce cyclomatic complexity",
    "max-depth": "Extract deeply nested blocks into separate named functions to reduce nesting depth below 5 levels",
}

# ESLint rule pattern matching (for rules with wildcards)
ESLINT_PATTERN_STRATEGIES = [
    (r".*consistent-type-assertions", "Remove ALL type assertions (`as` keyword), refactor using proper type definitions and type guards"),
    (r".*no-unsafe-.*", "Fix type definitions to make operations type-safe (add proper types, use type guards, avoid `any`)"),
    (r".*no-explicit-any", "Replace `any` with `unknown` and add type narrowing with type guards (typeof, instanceof, in)"),
    (r".*require-await", "Remove `async` keyword if no await is needed, or add missing await statement"),
    (r".*no-unnecessary-condition", "Remove unnecessary condition or refactor logic - value is already validated/non-nullable at this point"),
    (r".*no-non-null-assertion", "Replace non-null assertion `value!` with explicit null check or optional chaining `value?.method()`"),
    (r".*strict-boolean-expressions", "Make boolean checks explicit: `value !== null && value !== undefined` instead of just `if (value)`"),
]

def get_eslint_strategy(rule):
    """Get strategy for an ESLint rule using exact match or pattern matching."""
    # Try exact match first
    if rule in ESLINT_STRATEGIES:
        return ESLINT_STRATEGIES[rule]

    # Try pattern matching
    for pattern, strategy in ESLINT_PATTERN_STRATEGIES:
        if re.match(pattern, rule):
            return strategy

    # Default strategy
    return "Fix ESLint rule violation through code refactoring and improvement"

def parse_typescript_errors():
    """Parse TypeScript errors from typecheck output."""
    issues = []

    if not os.path.exists(TYPECHECK_FILE):
        return issues

    with open(TYPECHECK_FILE, 'r') as f:
        for line in f:
            # Match: src/file.ts(line,column): error TScode: message
            match = re.search(r'^(.+?)\((\d+),\d+\): error (TS\d+): (.+)', line)
            if match:
                filepath = match.group(1).replace('/Users/krenginelryan.y/Workspace/regrafter/', '')
                linenum = int(match.group(2))
                errcode = match.group(3)
                message = match.group(4).strip()

                strategy = TS_STRATEGIES.get(errcode, "Fix TypeScript error by addressing type incompatibility with proper types and refactoring")

                issues.append({
                    'file': filepath,
                    'line': linenum,
                    'severity': 'error',
                    'code': errcode,
                    'message': message,
                    'strategy': strategy
                })

    return issues

def parse_eslint_errors():
    """Parse ESLint errors and warnings from lint output."""
    issues = []

    if not os.path.exists(LINT_FILE):
        return issues

    current_file = None

    with open(LINT_FILE, 'r') as f:
        for line in f:
            # Match file path: /full/path/to/file.ts
            if line.startswith('/'):
                current_file = line.strip().replace('/Users/krenginelryan.y/Workspace/regrafter/', '')
                continue

            # Match error/warning: line:col  severity  message  rule
            match = re.match(r'^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z0-9/@-]+)$', line)
            if match and current_file:
                linenum = int(match.group(1))
                severity = match.group(3)
                message = match.group(4).strip()
                rule = match.group(5)

                strategy = get_eslint_strategy(rule)

                issues.append({
                    'file': current_file,
                    'line': linenum,
                    'severity': severity,
                    'code': rule,
                    'message': message,
                    'strategy': strategy
                })

    return issues

def group_by_strategy(issues):
    """Group issues by fix strategy within each file.

    Returns structure:
    {
      "src/file.ts": {
        "strategies": [
          {
            "strategy": "Import traverse as default export",
            "description": "Full strategy text",
            "typeErrors": [...],
            "lintErrors": [...],
            "lintWarnings": [...]
          }
        ]
      }
    }
    """
    files_by_strategy = {}

    for issue in issues:
        filepath = issue['file']
        strategy = issue['strategy']

        # Initialize file entry
        if filepath not in files_by_strategy:
            files_by_strategy[filepath] = {}

        # Initialize strategy entry
        if strategy not in files_by_strategy[filepath]:
            files_by_strategy[filepath][strategy] = {
                'strategy': strategy.split(':')[0].strip() if ':' in strategy else strategy[:50],
                'description': strategy,
                'typeErrors': [],
                'lintErrors': [],
                'lintWarnings': []
            }

        # Categorize issue
        issue_data = {
            'line': issue['line'],
            'code': issue['code'],
            'message': issue['message']
        }

        # Determine category
        if issue['code'].startswith('TS'):
            # TypeScript error
            files_by_strategy[filepath][strategy]['typeErrors'].append(issue_data)
        elif issue['severity'] == 'error':
            # ESLint error
            files_by_strategy[filepath][strategy]['lintErrors'].append(issue_data)
        else:
            # ESLint warning
            files_by_strategy[filepath][strategy]['lintWarnings'].append(issue_data)

    # Convert to final structure
    result = {}
    for filepath, strategies_dict in files_by_strategy.items():
        # Convert dict to list and sort by total issue count
        strategies_list = list(strategies_dict.values())
        for strategy_data in strategies_list:
            # Sort issues within each category by line number
            strategy_data['typeErrors'].sort(key=lambda x: x['line'])
            strategy_data['lintErrors'].sort(key=lambda x: x['line'])
            strategy_data['lintWarnings'].sort(key=lambda x: x['line'])

        # Sort strategies by total issue count (descending)
        strategies_list.sort(
            key=lambda s: len(s['typeErrors']) + len(s['lintErrors']) + len(s['lintWarnings']),
            reverse=True
        )

        result[filepath] = {'strategies': strategies_list}

    return result

def main():
    """Main parser function."""
    # Parse all issues
    all_issues = parse_typescript_errors() + parse_eslint_errors()

    # Group issues by strategy within each file
    files_data = group_by_strategy(all_issues)

    # Calculate totals
    total_files = len(files_data)
    total_issues = 0
    total_strategies = 0

    for file_data in files_data.values():
        total_strategies += len(file_data['strategies'])
        for strategy in file_data['strategies']:
            total_issues += len(strategy['typeErrors']) + len(strategy['lintErrors']) + len(strategy['lintWarnings'])

    # Build final JSON
    data = {
        'round': ROUND,
        'totalFiles': total_files,
        'totalStrategies': total_strategies,
        'totalIssues': total_issues,
        'files': files_data
    }

    # Write JSON
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(data, f, indent=2)

    # Verify and report
    print(f"✓ JSON fix plan created: {OUTPUT_JSON}")
    print(f"  - Files with issues: {data['totalFiles']}")
    print(f"  - Fix strategies: {data['totalStrategies']}")
    print(f"  - Total issues: {data['totalIssues']}")

    if data['totalFiles'] == 0:
        print("⚠️  WARNING: No issues found - check if error files exist and have content")

if __name__ == '__main__':
    main()
```

Run with:
```bash
ROUND=1 python3 /path/to/parser.py
```

The JSON format will be **strategy-centric** (strategies at top level, categorized issues below):
```json
{
  "round": 1,
  "totalFiles": 26,
  "totalStrategies": 45,
  "totalIssues": 352,
  "files": {
    "src/example.ts": {
      "strategies": [
        {
          "strategy": "Import traverse as default export",
          "description": "Import traverse as default export: `import traverse from '@babel/traverse'` instead of namespace import",
          "typeErrors": [
            {
              "line": 257,
              "code": "TS2349",
              "message": "This expression is not callable"
            },
            {
              "line": 346,
              "code": "TS2349",
              "message": "This expression is not callable"
            }
          ],
          "lintErrors": [],
          "lintWarnings": []
        },
        {
          "strategy": "Remove ALL type assertions",
          "description": "Remove ALL type assertions (`as` keyword), refactor using proper type definitions and type guards",
          "typeErrors": [],
          "lintErrors": [
            {
              "line": 259,
              "code": "@typescript-eslint/consistent-type-assertions",
              "message": "Do not use any type assertions"
            },
            {
              "line": 274,
              "code": "@typescript-eslint/consistent-type-assertions",
              "message": "Do not use any type assertions"
            }
          ],
          "lintWarnings": []
        },
        {
          "strategy": "Replace non-null assertion",
          "description": "Replace non-null assertion `value!` with explicit null check or optional chaining `value?.method()`",
          "typeErrors": [],
          "lintErrors": [],
          "lintWarnings": [
            {
              "line": 252,
              "code": "@typescript-eslint/no-non-null-assertion",
              "message": "Forbidden non-null assertion"
            }
          ]
        }
      ]
    }
  }
}
```

**Common Fix Strategies:**

**Type Errors:**
- `TS6133` (unused variable): "Prefix with underscore `_var` or remove if unused"
- `TS2322` (type mismatch): "Fix the actual type definition, add type guard, or refactor to match expected type"
- `TS2349` (not callable): "Fix import statement to import default export correctly, or define proper function type"
- `TS2339` (property doesn't exist): "Add proper type definition with the property, or use type guard: `if ('property' in obj) { ... }`"
- `TS2532` (possibly undefined): "Add null check `if (value !== undefined)` or use optional chaining `value?.method()`"
- `TS2352` (conversion error): "Refactor to use compatible types, define proper types, or use type guards for narrowing"
- `TS1361` (import type in decorator): "Change `import type` to regular `import`"

**Lint Errors:**
- `import/no-duplicates`: "Merge duplicate imports into single statement"
- `import/order`: "Reorder imports per ESLint config (type imports last, regular imports first)"
- `@typescript-eslint/consistent-type-assertions`: "Remove ALL type assertions (`as` keyword), refactor using proper types and type guards"
- `@typescript-eslint/no-unsafe-*`: "Fix type definitions to make operations type-safe (add proper types, use type guards)"
- `@typescript-eslint/no-explicit-any`: "Replace `any` with `unknown` or specific type, then add proper type narrowing with type guards"
- `@typescript-eslint/require-await`: "Remove `async` keyword if no await needed, or add missing await"
- `complexity`: "Refactor complex functions by extracting helper functions to reduce cyclomatic complexity"

**Lint Warnings (also fix these):**
- `@typescript-eslint/no-unnecessary-condition`: "Remove the unnecessary condition or refactor logic to make it necessary"
- `@typescript-eslint/no-non-null-assertion`: "Replace `value!` with proper null check: `if (value) { ... }` or optional chaining `value?.method()`"
- `@typescript-eslint/strict-boolean-expressions`: "Make boolean checks explicit: `value !== null && value !== undefined` instead of just `if (value)`"
- `max-depth`: "Extract nested logic into separate functions to reduce nesting depth below 5 levels"
- All other warnings: "Fix the underlying code issue - refactor, add types, or improve logic rather than suppressing"

**CRITICAL POLICY:**
**❌ ABSOLUTELY FORBIDDEN:**
- `eslint-disable-next-line` or `eslint-disable` comments
- `@ts-nocheck` or `@ts-ignore` comments
- Any form of error/warning suppression

**✓ ALWAYS fix the actual code to satisfy TypeScript and ESLint rules**

Fix the root cause through:
- Proper type definitions and type guards
- Code refactoring and simplification
- Extract complex logic into smaller functions
- Add explicit null/undefined checks
- Use proper type narrowing with `unknown` type
- Improve code structure to meet complexity/depth limits

**NO EXCEPTIONS. Every error and warning must be fixed by improving the code, not by suppressing the rule.**

### Phase 3: Group Files for Parallel Execution

Divide ALL files with issues into manageable groups:
- **Small (< 20 files)**: 3-4 agents
- **Medium (20-50 files)**: 5-8 agents
- **Large (> 50 files)**: 10+ agents (max 10 per round)

**Grouping Strategy:**
- Group files by error/warning type similarity
- Balance total issue count across agents (aim for ~5-15 issues per agent)
- Keep files from same module together
- Each agent handles ALL issues in their assigned files (errors AND warnings)

### Phase 4: Execute Fixes in Parallel

**Before launching agents, verify:**
- ✅ Phase 3 grouping is complete
- ✅ **JSON fix plan file exists: `/tmp/fix-plans-round${ROUND}.json`**

---

**Important**: Use only the **typescript/fixer** agent for all issue types.

The typescript/fixer agent works with the new strategy-centric JSON format and applies fixes systematically:
- Processes each strategy in order
- Handles typeErrors, lintErrors, and lintWarnings together
- Applies the fix approach described in each strategy

Launch all agents in **a SINGLE message** with multiple Task calls:

```
Launching N typescript/fixer agents in parallel...
```

**🚨 MANDATORY: Building Agent Prompts with JSON**

**Step 0**: VERIFY JSON file exists:
```bash
# This MUST succeed - if it fails, GO BACK to Phase 2 to create JSON
ROUND=${ROUND:-1}
if [ ! -f /tmp/fix-plans-round${ROUND}.json ]; then
  echo "❌ CRITICAL ERROR: JSON fix plan not found!"
  echo "⚠️  Cannot proceed without detailed fix strategies"
  echo "🔙 GO BACK to Phase 2 and create /tmp/fix-plans-round${ROUND}.json"
  exit 1
fi
echo "✓ JSON fix plan found: /tmp/fix-plans-round${ROUND}.json"
```

**Step 1 & 2**: Build detailed agent prompts by extracting strategies from JSON:

**CRITICAL**: You MUST parse the JSON and extract detailed strategies for EACH file in EACH group.

For each agent group, use this bash script to build the prompt with actual strategies:

```bash
#!/bin/bash

ROUND=${ROUND:-1}
JSON_FILE="/tmp/fix-plans-round${ROUND}.json"

# Example: Build prompt for Agent 1 handling Group 1 files
# Group 1 files (replace with actual files from Phase 3 grouping)
GROUP_FILES=("src/file1.ts" "src/file2.ts" "src/file3.ts")

# Build the prompt by extracting strategies from JSON
PROMPT="Fix all TypeScript and ESLint issues in these files using the provided strategies.

"

for filepath in "${GROUP_FILES[@]}"; do
  PROMPT+="**${filepath}**"$'\n'

  # Extract strategies and categorized issues for this file using Python
  FILE_STRATEGIES=$(python3 << PYTHON_EOF
import json

with open('$JSON_FILE', 'r') as f:
    data = json.load(f)

filepath = '$filepath'
if filepath in data.get('files', {}):
    strategies = data['files'][filepath].get('strategies', [])

    for idx, strat in enumerate(strategies, 1):
        strategy_name = strat['strategy']
        description = strat['description']
        type_errors = strat.get('typeErrors', [])
        lint_errors = strat.get('lintErrors', [])
        lint_warnings = strat.get('lintWarnings', [])

        total = len(type_errors) + len(lint_errors) + len(lint_warnings)
        print(f"\n### Strategy {idx}: {strategy_name} ({total} issues)")
        print(f"**Description**: {description}")
        print()

        if type_errors:
            print("**TypeScript Errors:**")
            for err in type_errors:
                print(f"  - Line {err['line']} ({err['code']}): {err['message']}")

        if lint_errors:
            print("**ESLint Errors:**")
            for err in lint_errors:
                print(f"  - Line {err['line']} ({err['code']}): {err['message']}")

        if lint_warnings:
            print("**ESLint Warnings:**")
            for warn in lint_warnings:
                print(f"  - Line {warn['line']} ({warn['code']}): {warn['message']}")
PYTHON_EOF
)

  PROMPT+="$FILE_STRATEGIES"$'\n\n'
done

# Add critical rules to prompt
PROMPT+="**CRITICAL RULES - VIOLATION WILL FAIL THE TASK:**
❌ ABSOLUTELY FORBIDDEN - DO NOT ADD:
  - eslint-disable-next-line
  - eslint-disable
  - @ts-ignore
  - @ts-nocheck
  - @ts-expect-error
  - Type assertions with \` as \` keyword (e.g., \`value as Type\`, \`x as unknown as Y\`)
  - The \`any\` type (use \`unknown\` instead, then narrow with type guards)
  - ANY form of suppression comment

✓ REQUIRED APPROACH:
  - Fix the actual code with proper type definitions
  - Refactor to satisfy the rule
  - Add type guards for type narrowing (e.g., \`typeof\`, \`instanceof\`, \`in\`)
  - Import statements properly (use default imports where needed)
  - Improve code structure and extract helper functions
  - Use \`unknown\` + type guards instead of \`any\`
  - Follow the EXACT strategies provided above for each issue

Run \`yarn typecheck && yarn lint\` to verify all issues are resolved.
"

# Now use $PROMPT in the Task tool for error-fixer agent
echo "$PROMPT"
```

**Agent Prompt Format (generated from JSON):**

After running the above script, the prompt will look like:
```
Fix all TypeScript and ESLint issues in these files using the provided strategies.

**src/example.ts**

### Strategy 1: Import traverse as default export (2 issues)
**Description**: Import traverse as default export: `import traverse from '@babel/traverse'` instead of namespace import

**TypeScript Errors:**
  - Line 257 (TS2349): This expression is not callable
  - Line 346 (TS2349): This expression is not callable

### Strategy 2: Remove ALL type assertions (4 issues)
**Description**: Remove ALL type assertions (`as` keyword), refactor using proper type definitions and type guards

**ESLint Errors:**
  - Line 259 (@typescript-eslint/consistent-type-assertions): Do not use any type assertions
  - Line 274 (@typescript-eslint/consistent-type-assertions): Do not use any type assertions
  - Line 281 (@typescript-eslint/consistent-type-assertions): Do not use any type assertions
  - Line 305 (@typescript-eslint/consistent-type-assertions): Do not use any type assertions

### Strategy 3: Replace non-null assertion (2 issues)
**Description**: Replace non-null assertion `value!` with explicit null check or optional chaining `value?.method()`

**ESLint Warnings:**
  - Line 252 (@typescript-eslint/no-non-null-assertion): Forbidden non-null assertion
  - Line 252 (@typescript-eslint/no-non-null-assertion): Forbidden non-null assertion

**src/another.ts**

### Strategy 1: Extract deeply nested blocks (1 issue)
**Description**: Extract deeply nested blocks into separate named functions to reduce nesting depth below 5 levels

**ESLint Warnings:**
  - Line 706 (max-depth): Blocks are nested too deeply (6). Maximum allowed is 5

**CRITICAL RULES - VIOLATION WILL FAIL THE TASK:**
❌ ABSOLUTELY FORBIDDEN - DO NOT ADD:
  - eslint-disable-next-line
  - eslint-disable
  - @ts-ignore
  - @ts-nocheck
  - @ts-expect-error
  - Type assertions with ` as ` keyword (e.g., `value as Type`, `x as unknown as Y`)
  - The `any` type (use `unknown` instead, then narrow with type guards)
  - ANY form of suppression comment

✓ REQUIRED APPROACH:
  - Fix the actual code with proper type definitions
  - Refactor to satisfy the rule
  - Add type guards for type narrowing (e.g., `typeof`, `instanceof`, `in`)
  - Import statements properly (use default imports where needed)
  - Improve code structure and extract helper functions
  - Use `unknown` + type guards instead of `any`
  - Follow the EXACT strategies provided above for each issue

Run `yarn typecheck && yarn lint` to verify all issues are resolved.
```

**Implementation Example:**

When launching agents in Phase 4, you would:

1. **For each agent group**, build the prompt using the bash script above
2. **Pass the built prompt** (which contains extracted strategies) to the Task tool
3. **Launch all agents in parallel** in a single message with multiple Task calls

```
# Pseudo-code for Phase 4 execution
For each group in [Group1, Group2, Group3, ...]:
  1. Set GROUP_FILES to the files in this group
  2. Run the bash script to build PROMPT with extracted strategies
  3. Launch typescript/fixer agent with the built PROMPT

# Actual Task tool usage:
Task(
  subagent_type="general-purpose",
  description="TASK-GROUP1: Fix src/file1.ts, src/file2.ts",
  prompt="@.claude/agents/typescript/fixer.md\n\n" + PROMPT_FROM_BASH_SCRIPT,
  model="sonnet"
)
```

**CRITICAL**: Each agent receives a STRATEGY-BASED prompt with:
- **Fix strategies** as top-level concepts (Strategy 1, Strategy 2, ...)
- **Categorized issues** under each strategy (typeErrors, lintErrors, lintWarnings)
- **Detailed descriptions** explaining the fix approach
- Exact file paths and line numbers

This ensures agents:
1. **Think strategy-first** - Apply related fixes together
2. **Understand the "why"** - Not just what's wrong, but how to fix it
3. **Work systematically** - Process one strategy at a time
4. **Handle all severities** - TypeScript errors, ESLint errors, and warnings in one pass

### Phase 5: Verification & Loop

After all agents complete:

**Step 1: Verify No Forbidden Patterns Were Added**
```bash
# Check for forbidden suppression comments and type assertions
SUPPRESSION_COUNT=$(grep -r "eslint-disable\|@ts-ignore\|@ts-nocheck\|@ts-expect-error" src/ --include="*.ts" --include="*.tsx" | wc -l)
ASSERTION_COUNT=$(grep -r " as " src/ --include="*.ts" --include="*.tsx" | grep -v "// as " | grep -v "import.*as" | wc -l)
ANY_COUNT=$(grep -r ": any\|<any>\|any\[\]" src/ --include="*.ts" --include="*.tsx" | wc -l)

TOTAL_VIOLATIONS=$((SUPPRESSION_COUNT + ASSERTION_COUNT + ANY_COUNT))

if [ "$TOTAL_VIOLATIONS" -gt 0 ]; then
  echo "❌ CRITICAL FAILURE: Agents added forbidden patterns:"
  echo "  - Suppression comments: $SUPPRESSION_COUNT"
  echo "  - Type assertions (as): $ASSERTION_COUNT"
  echo "  - any types: $ANY_COUNT"
  echo ""
  echo "Forbidden patterns found:"
  grep -r "eslint-disable\|@ts-ignore\|@ts-nocheck\|@ts-expect-error" src/ --include="*.ts" --include="*.tsx" -n
  grep -r " as " src/ --include="*.ts" --include="*.tsx" -n | grep -v "// as " | grep -v "import.*as"
  grep -r ": any\|<any>\|any\[\]" src/ --include="*.ts" --include="*.tsx" -n
  echo ""
  echo "⚠️  REVERTING all changes and RESTARTING with stronger instructions"
  exit 1
fi

echo "✓ No forbidden patterns found - agents followed all rules"
```

**Step 2: Verify Fixes Work**
```bash
# Verify fixes
yarn typecheck 2>&1 | tee /tmp/typecheck-verify.txt
yarn lint 2>&1 | tee /tmp/lint-verify.txt
```

**Decision Tree:**
- ❌ If suppression comments found: **REVERT changes, restart with stronger agent instructions**
- ✓ If errors = 0 AND warnings = 0: **Done!** Report final results
- ↻ If errors > 0 OR warnings > 0: **Loop back to Phase 1** with next round

**Final Report Format:**
```
✓ All Issues Resolved!

Execution Summary:
- Total Rounds: N
- Round 1: X agents, Y issues fixed
- Round 2: X agents, Y issues fixed
- ...

Final Results:
- TypeScript errors: A → 0 ✓
- ESLint errors: B → 0 ✓
- ESLint warnings: C → 0 ✓
- Total files modified: D
- Total issues fixed: E
```

## Important Instructions

### Issue Analysis
- Parse ALL outputs carefully to extract exact line numbers and rules
- Distinguish between errors (must fix) and warnings (should fix)
- Identify patterns (same rule across multiple files)
- Track issues by severity: TypeScript errors > ESLint errors > ESLint warnings

### Fix Plan Generation
- Be **SPECIFIC**: Don't just say "fix the issue"
- Provide **concrete strategy**: "Define interface with X property and refactor to match", not "fix type"
- Include context: line number, severity, current state, target state
- Group similar fixes across files (e.g., all traverse import fixes)
- For warnings: **ALWAYS specify the refactoring strategy, NEVER suggest eslint-disable**
- Prefer code quality improvements over quick suppression
- **NEVER suggest type assertions (`as`)** - use type definitions and type guards instead
- **NEVER use `any`** - use `unknown` with type guards for proper narrowing

### Parallel Execution
- Use **a SINGLE message** with multiple Task tool calls for parallel execution
- Divide work evenly (balance file count AND total issue count)
- Each agent handles ALL issues (errors + warnings) in their assigned files
- Never launch more than 10 agents at once (system limitation)

### Agent Instructions
Provide clear, actionable prompts to agents with detailed strategies from the JSON file:

**Good Prompt (with detailed strategies from JSON):**
```
Fix all TypeScript and ESLint issues in these files:

**src/file.ts**
- Line 19 (TS2352 error): Import traverse as default: `import traverse from '@babel/traverse'`
  Strategy: Change `import * as traverse from '@babel/traverse'` to `import traverse from '@babel/traverse'`. Update all usages from `traverse.default()` to `traverse()`
- Line 165 (TS2349 error): Fix traverse import to use default export
  Strategy: The expression is not callable because traverse is imported as namespace. Import as default export instead: `import traverse from '@babel/traverse'`
- Line 200 (@typescript-eslint/no-unnecessary-condition warning): Remove the unnecessary null check
  Strategy: The value is already validated as non-null in line 195 with `if (value !== null)`. Remove the redundant check at line 200 or refactor to consolidate validation logic

**CRITICAL**: Do NOT use eslint-disable, @ts-ignore, @ts-nocheck, type assertions (`as`), or `any` type. Fix the actual code.

Run `yarn typecheck && yarn lint` to verify.
```

**How to build this prompt:**
1. Load `/tmp/fix-plans-round1.json`
2. For each file in agent's group, extract issues from JSON
3. Include BOTH the issue description AND the detailed strategy
4. Format as shown above with "Strategy:" lines

**Bad Prompt (no detailed strategies):**
```
Fix errors in src/file.ts
```

**Also Bad (suppression-based or using forbidden patterns):**
```
Add eslint-disable-next-line comments for all warnings
Add type assertions: value as TargetType
Use any type for quick fixes
```

## Example Workflow

```
=== ROUND 1 ===
Phase 1: Collection
✓ TypeScript errors: 23 (12 files)
✓ ESLint errors: 51 (15 files)
✓ ESLint warnings: 137 (18 files)
Total: 23 files, 189 issues

Phase 2: Fix Plans
✓ Generated specific strategies for all 189 issues
✓ Grouped by similarity: traverse imports, type definitions, unnecessary conditions
✓ Saved to /tmp/fix-plans-round1.json for agent use
✓ Validated all plans - No suppression strategies found

Phase 3: Grouping
✓ Group 1: 5 files (traverse imports: 15 issues)
✓ Group 2: 6 files (type definitions: 25 issues)
✓ Group 3: 7 files (unsafe operations: 30 issues)
✓ Group 4: 5 files (warnings: 119 issues)

Phase 4: Execution
✓ Loaded detailed strategies from /tmp/fix-plans-round1.json
✓ Built agent prompts with specific strategies for each issue
✓ Launched 4 error-fixer agents in parallel with detailed instructions
✓ All agents completed successfully

Phase 5: Verification
✓ Step 1: Suppression check - 0 forbidden comments found
✓ Step 2: TypeScript errors: 23 → 0
✓ Step 2: ESLint errors: 51 → 0
✓ Step 2: ESLint warnings: 137 → 20
→ Remaining: 20 warnings in 4 files, continue to Round 2

=== ROUND 2 ===
Phase 1: Collection
✓ TypeScript errors: 0
✓ ESLint errors: 0
✓ ESLint warnings: 20 (4 files)
Total: 4 files, 20 issues

Phase 2: Fix Plans
✓ Generated specific strategies for 20 issues
✓ Validated all plans - No suppression strategies found

Phase 3-4: Grouping & Execution
✓ Launched 2 error-fixer agents in parallel

Phase 5: Verification
✓ Step 1: Suppression check - 0 forbidden comments found
✓ Step 2: TypeScript errors: 0 → 0
✓ Step 2: ESLint errors: 0 → 0
✓ Step 2: ESLint warnings: 20 → 0
→ All issues resolved! ✓

=== FINAL SUMMARY ===
Total Rounds: 2
Total files modified: 23
Total issues fixed: 209 (23 TS errors + 51 ESLint errors + 135 warnings)
Success rate: 100%
```

## Troubleshooting

**If agents add suppression comments (CRITICAL FAILURE):**
- ❌ Agents violated the NO SUPPRESSION policy
- 🔄 Immediately run: `git checkout HEAD -- src/` to revert all changes
- ⚠️  This indicates the agent prompts were not clear enough
- 📝 Review the agent prompts in Phase 4 - ensure CRITICAL RULES section is included
- 🔁 Restart from Phase 1 with STRONGER agent instructions
- 📊 If this happens repeatedly, the agents may need more explicit examples of GOOD vs BAD fixes

**If agents fail:**
- Check if issue line numbers are still accurate (code may have shifted)
- Verify the fix strategy is appropriate for the issue type
- For traverse-related errors: ensure the import pattern matches existing codebase
- Re-read the file and retry with updated line numbers

**If issues remain after fixes:**
- This is NORMAL - some issues may cascade or new ones may appear
- Continue to next round automatically (loop back to Phase 1)
- Each round should reduce the total issue count
- If stuck on same issues after 2 rounds, investigate why agents failed

**If too many agents needed:**
- Reduce group size (fewer files per agent)
- Maximum 10 agents in parallel (split into multiple rounds if needed)
- Prioritize errors over warnings in early rounds if count is very high

**If warnings keep appearing:**
- Some warnings are legitimate code quality issues that require refactoring
- Analyze why the warning exists and what code improvement is needed
- Refactor the code to eliminate the root cause (extract functions, add types, simplify logic)
- NEVER suppress warnings - they indicate real code quality issues that must be fixed

---

## 🎯 START HERE

**Your first action should be:**

1. ✅ Begin with **Phase 1** - Collect all errors and warnings
2. ✅ Then proceed to **Phase 2** - Generate fix plans
3. ✅ Continue to **Phase 3** - Group files for parallel execution
4. ✅ Execute **Phase 4** - Launch agents to fix issues
5. ✅ Complete with **Phase 5** - Verify fixes and loop if needed

**Remember**: The workflow is:
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                                          ↓
                                    [Loop if needed]
```

Begin Round 1 by running Phase 1 (issue collection and categorization)!
