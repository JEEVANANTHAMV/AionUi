---
name: pr-review
description: |
  PR Code Review (Local): perform a thorough local code review with full project context.
  Use when: (1) User asks to review a PR, (2) User says "/pr-review", (3) User wants to review code changes before merging.
---

# PR Code Review (Local)

Perform a thorough local code review with full project context — reads source files directly, no API truncation limits.

**Announce at start:** "I'm using pr-review skill to review the pull request."

## Usage

```
/pr-review [pr_number]
```

`$ARGUMENTS` may contain an optional PR number and/or `--automation` flag.

- Without `--automation`: interactive mode (prompts for confirmation, comment, cleanup)
- With `--automation`: non-interactive mode (auto-post comment, auto-delete branch, output machine-readable result)

---

## Steps

### Step 1 — Determine PR Number

If `$ARGUMENTS` is non-empty, use it as the PR number.

Otherwise run:

```bash
gh pr view --json number -q .number
```

If this also fails (not on a PR branch), abort with:

> No PR number provided and cannot detect one from the current branch. Usage: `/pr-review <pr_number>`

Also parse `--automation` from `$ARGUMENTS`:

```bash
AUTOMATION_MODE=false
if echo "$ARGUMENTS" | grep -q -- '--automation'; then
  AUTOMATION_MODE=true
fi
```

### Step 2 — Check CI Status

```bash
gh pr view <PR_NUMBER> --json statusCheckRollup \
  --jq '.statusCheckRollup[] | {name: .name, status: .status, conclusion: .conclusion}'
```

**Required jobs:**

- `Code Quality`
- `Unit Tests (ubuntu-latest)`
- `Unit Tests (macos-14)`
- `Unit Tests (windows-2022)`
- `Coverage Test`
- `i18n-check`

(`build-test` is an optional job, not included in required checks.)

**Special cases:** Skip this step and continue directly if ANY of the following conditions are met:

- `statusCheckRollup` is empty (CI never triggered)
- `statusCheckRollup` is non-empty, but none of the required jobs are in the list (indicates pr-checks.yml workflow did not trigger at all, such as PRs that only modify docs/md files)

**Parsing logic:** Handle three scenarios:

**Informational checks exclusion:** `codecov/patch` and `codecov/project` are configured as `informational: true` in `codecov.yml` — they never block merging and must be **excluded** from all failure checks below. Treat them as non-existent when evaluating CI status.

**Scenario 1 — All passed** (all required jobs satisfy `status == COMPLETED && conclusion == SUCCESS`, **and** no **non-informational** job in `statusCheckRollup` has `conclusion` of `FAILURE` or `CANCELLED`; `codecov/*` failures do not affect this determination)

Continue directly to subsequent steps, no prompt needed.

**Scenario 2 — Some still running** (there are required jobs with `status` of `QUEUED` or `IN_PROGRESS`; non-required jobs still running do not affect this determination)

Display warning and ask:

> ⏳ The following CI jobs are not yet complete: [job list]
> PR CI is not fully complete, it is recommended to wait before reviewing. Do you still want to continue? (yes/no)

- User selects **no** → terminate
- User selects **yes** → continue to subsequent steps

- **Automation mode:** do not prompt. Output signal and stop:
  ```
  <!-- automation-result -->
  CONCLUSION: CI_NOT_READY
  IS_CRITICAL_PATH: false
  CRITICAL_PATH_FILES: (none)
  PR_NUMBER: <PR_NUMBER>
  <!-- /automation-result -->
  ```
  Then exit.

**Scenario 3 — Some failed** (there is **any non-informational** job in `statusCheckRollup` with `conclusion` of `FAILURE` or `CANCELLED`, not limited to required list; `codecov/*` always excluded)

Display warning and ask:

> ❌ The following CI jobs failed: [job list and conclusions]
> PR CI has failures, review conclusion may be inaccurate. Do you still want to continue? (yes/no)

- User selects **yes** → continue, and append CI status warning at the end of the final report's "Change Overview" section (format see "Report Enhancement" section)
- User selects **no** → terminate review, then ask:

  > Post a comment on PR #<PR_NUMBER> to remind the author to fix the failed CI jobs? (yes/no)
  - User selects **yes** → post CI failure reminder comment (format see below "CI Failure Reminder Comment" section), then exit
  - User selects **no** → exit directly

- **Automation mode:** do not prompt. Post CI failure comment automatically (same format as "CI Failure Reminder Comment"), then output signal and stop:
  ```
  <!-- automation-result -->
  CONCLUSION: CI_FAILED
  IS_CRITICAL_PATH: false
  CRITICAL_PATH_FILES: (none)
  PR_NUMBER: <PR_NUMBER>
  <!-- /automation-result -->
  ```
  Then exit.

#### CI Failure Reminder Comment

When CI fails and user chooses not to continue review but chooses to post reminder, comment format:

```bash
gh pr comment <PR_NUMBER> --body "<!-- pr-review-bot -->

## CI Check Failed

The following jobs did not pass during this review. Please fix:

| Job | Conclusion |
|-----|------|
| <failed job name> | ❌ <FAILURE or CANCELLED> |

This code review is paused. It will be re-executed once all CI checks pass."
```

(Only list jobs that actually failed, skip those that passed.)

#### Report Enhancement

When CI has failures but user chooses to continue, append at the end of the final report's "Change Overview" section:

```
> ⚠️ **CI Status Warning**: The following jobs failed during review: `<job name>` (<conclusion>). This report's conclusion is for reference only. It is recommended to re-review after fixing CI.
```

---

### Step 3 — Create Worktree

Create an isolated worktree for this PR review. The main repo stays on its current branch.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
PR_NUMBER=<PR_NUMBER>
WORKTREE_DIR="/tmp/forjinn-desk-pr-${PR_NUMBER}"

# Clean up any stale worktree from a previous crash
git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true

# Fetch PR head AND base branch so the three-dot diff is accurate
git fetch origin pull/${PR_NUMBER}/head
BASE_REF=$(gh pr view ${PR_NUMBER} --json baseRefName --jq '.baseRefName')
git fetch origin "$BASE_REF"
git worktree add "$WORKTREE_DIR" FETCH_HEAD --detach

# Symlink node_modules so lint/tsc/test can run in the worktree
ln -s "$REPO_ROOT/node_modules" "$WORKTREE_DIR/node_modules"
```

Save `REPO_ROOT` and `WORKTREE_DIR` for use in subsequent steps. All file reads, lint, and diff commands from this point forward run inside `WORKTREE_DIR`.

Save the checked-out HEAD info:

```bash
cd "$WORKTREE_DIR"
git log --oneline -1
```

### Step 4 — Collect Context (Parallel)

Run the following in parallel:

**PR metadata:**

```bash
gh pr view <PR_NUMBER> --json title,body,author,labels,headRefName,baseRefName,state,createdAt,updatedAt
```

**Full diff (no truncation):**

```bash
cd "$WORKTREE_DIR"
git diff origin/<baseRefName>...HEAD
```

**Changed file list:**

```bash
cd "$WORKTREE_DIR"
git diff --name-status origin/<baseRefName>...HEAD
```

**PR discussion comments (excluding bot review comments):**

```bash
gh pr view <PR_NUMBER> --json comments \
  --jq '[.comments[] | select(.body | startswith("<!-- pr-review-bot -->") | not) | select(.body | startswith("<!-- pr-automation-bot -->") | not) | {author: .author.login, body: .body, createdAt: .createdAt}]'
```

Save as `pr_discussion`. Use in Step 7 as supplementary context for **方案合理性** evaluation — if participants have explained design decisions or flagged known trade-offs, factor that in. Code is always the authoritative source; comments are context only.

### Step 5 — Run Lint on Changed Files

Run oxlint on all changed `.ts` / `.tsx` files (skip deleted files):

```bash
cd "$WORKTREE_DIR"
bunx oxlint <changed_ts_tsx_files...>
```

Save the lint output as **lint baseline**. Use it when reviewing style and code quality in Step 6:

- If a pattern produces **no lint warning** → it is project-approved; do not flag it as a style issue.
- If a pattern produces **a lint warning/error** → it is a real violation; report it at the appropriate severity (ERROR → HIGH, WARNING → LOW).
- Do **not** suggest replacing a lint-clean pattern with an alternative based on general convention alone (e.g. do not suggest spread over `Object.assign` if `no-map-spread` is active).

### Step 6 — Read Changed File Contents

> Use the Read tool to read each changed file from the **worktree** path (`$WORKTREE_DIR/<relative_path>`), not from the main repo.

**Skip:**

- `*.lock` files
- Images, fonts
- `dist/`, `node_modules/`, `.cache/`
- `*.map`, `*.min.js`, `*.min.css`

**Priority order (read highest priority first):**

1. `src/process/`
2. `src/process/channels/`
3. `src/common/`
4. `src/process/worker/`
5. `src/renderer/`

Also read key interface/type definition files imported by the changed files when they provide important context.

### Step 7 — Perform Code Review

Write the code review report in **Chinese**.

Review dimensions:

- **Solution Rationality** — Does the overall solution correctly solve the problem; does it introduce unnecessary complexity; is it consistent with the project's existing architecture and patterns; are there simpler/more elegant implementation paths; does the solution itself have known defects or design blind spots. Specific evaluation points: Does the solution truly solve the problem described in the PR (rather than solving a different problem); does it bypass existing mechanisms provided by frameworks/libraries (reinventing the wheel); is it consistent with architectural boundaries such as `src/process/`, `src/renderer/`, IPC bridge; does it introduce unnecessary abstraction layers or over-engineering; does the solution have known edge cases or race conditions not considered at the design level
- **Correctness** — Is the logic correct, are edge conditions handled
- **Security** — Injection, XSS, key leaks, privilege escalation
- **Supply Chain Security** — Prevent malicious code injection, focus on: (1) dynamic code execution such as `eval()`, `new Function()`, `vm.runInNewContext()`; (2) suspicious base64/hex encoded strings or Unicode escape sequences (common backdoor obfuscation techniques); (3) new network requests such as `fetch`/`axios`/`http`/`net`, especially to external domains or dynamically concatenated URLs (data exfiltration risk); (4) unconventional reading or transmission of sensitive variables in `process.env`; (5) additional commands embedded in build scripts, postinstall hooks, or CI configurations. Mark the above patterns as **CRITICAL**
- **Immutability** — Are there direct mutations of objects/arrays (a key principle in this project)
- **Error Handling** — Are exceptions silently swallowed, are error messages reasonable
- **Performance** — Unnecessary re-renders, large loops, blocking calls
- **Code Quality** — Function length, nesting depth, naming clarity
- **Leftover console.log** — Are there debug logs remaining in production code
- **Database Changes** — If PR involves migration files or database schema: (1) is the migration correct (field types, constraints, indexes, defaults, rollback capability); (2) are changes reasonable and consistent with PR goals; (3) is there risk of data loss to existing data; (4) are migration order and dependencies correct. Incorrect migrations are marked as CRITICAL.
- **IPC bridge / preload** — If PR involves `src/preload.ts` or IPC channel definitions: (1) are unnecessary Node.js APIs exposed to renderer; (2) do all exposed APIs have input validation; (3) can renderer trigger privileged operations without authorization. Exposing unsafe APIs is marked as CRITICAL.
- **Electron Security Configuration** — If PR involves Electron configuration in `electron-builder.yml`, `entitlements.plist`, or `electron.vite.config.ts`: (1) are sandbox/nodeIntegration/contextIsolation settings weakened; (2) are entitlements over-authorized; (3) are signing and notarization compromised. Security regressions are marked as CRITICAL.
- **Testing** — Evaluate against [testing skill](../testing/SKILL.md) standards, point out any of the following:
  - New functionality without corresponding test cases
  - Logic modified but existing related tests not updated
  - New source files accidentally excluded by `vitest.config.ts` `coverage.exclude` (should be included in coverage but incorrectly excluded)
  - Existing tests do not meet testing skill Step 2 quality rules
  - `codecov/patch` CI check shows FAILURE (patch coverage below 50%): Although `codecov.yml` sets this check as `informational: true` (does not block merge), insufficient coverage indicates new code lacks tests and should be pointed out in review (level LOW, for author reference)
- **Testability** — Is the modified code still independently testable; can dependencies be mocked;
  does it maintain decoupling from existing modules; can unit tests run without depending on a full runtime environment.
  When coupling is found, distinguish the source:
  - **Coupling newly introduced by this change** — rate by impact (new features should be decoupled from design stage, listed as HIGH; if tests cannot run, list as CRITICAL)
  - **Existing historical coupling** — not a blocking point for this PR, suggest creating a separate issue to track

**Only report real problems.** If a dimension has no code problems, skip it. Do not fabricate issues to show "thorough review". Base on actual code — report if exists, state code is clean if not. Same for solution rationality — if the solution itself has no problems, simply write "solution is reasonable", do not deliberately nitpick to show "depth".

For each issue found:

1. Specify file path and line number(s)
2. Quote the problematic code
3. Explain why it is an issue
4. Provide a concrete fix with corrected code

Use the following report template:

---

````markdown
## Code Review: <PR Title> (#<PR_NUMBER>)

### Change Overview

[2-3 sentences explaining what this PR changes and which modules are affected.]

---

### Solution Assessment

**Conclusion**: ✅ Solution Reasonable / ⚠️ Solution Has Defects / ❌ Solution Fundamentally Wrong

[2-4 sentences explaining: whether the solution correctly solves the target problem; whether it is consistent with project architecture; whether there are more elegant alternative solutions (if any, briefly describe); whether there are design blind spots at the solution level.]

---

### Issue List

#### 🔴 CRITICAL — <Issue Title>

**File**: `path/to/file.ts`, line N

**Problematic Code**:

```ts
// problematic code
```
````

**Problem Description**: [explain why it's a problem]

**Fix Suggestion**:

```ts
// fixed code
```

---

#### 🟠 HIGH — <Issue Title>

(Same format as above)

---

#### 🟡 MEDIUM — <Issue Title>

(Same format as above)

---

#### 🔵 LOW — <Issue Title>

(Same format as above)

---

### Summary

| #   | Severity    | File        | Issue |
| --- | ----------- | ----------- | ---- |
| 1   | 🔴 CRITICAL | `file.ts:N` | ...  |
| 2   | 🟠 HIGH     | `file.ts:N` | ...  |

### Conclusion

[Choose one of the following three:]

- ✅ **Approved to Merge** — No blocking issues
- ⚠️ **Conditionally Approved** — Minor issues exist, can merge after handling
- ❌ **Needs Changes** — Blocking issues exist, must be resolved first

[One-sentence explanation]

---

_This report was generated by the local `pr-review` skill, includes full project context, no truncation limits._
```

---

If no issues are found across all dimensions, output:

> ✅ No obvious issues found, code quality is good, recommend approval to merge.

### Step 8 — Ask to Post Comment

Print the complete review report to the terminal.

**Automation mode:** skip the prompt — automatically proceed to post the comment.

**Non-automation mode:** ask the user:
> Review complete. Post this report as a comment on PR #<PR_NUMBER>? (yes/no)
If the user says **no**, skip posting.

To post:

1. Check for an existing review comment:
```bash
gh pr view <PR_NUMBER> --json comments --jq '.comments[] | select(.body | startswith("<!-- pr-review-bot -->")) | .databaseId'
````

2. If a previous comment exists, update it:

```bash
gh api repos/{owner}/{repo}/issues/comments/<comment_id> -X PATCH -f body="<!-- pr-review-bot -->

<review_report>"
```

3. If no previous comment exists, create a new one:

```bash
gh pr comment <PR_NUMBER> --body "<!-- pr-review-bot -->

<review_report>"
```

**Automation mode only — after posting the comment, output the machine-readable result block:**

Map the review conclusion to CONCLUSION value based on the **highest severity issue found**:

| Highest issue severity | Review Conclusion   | CONCLUSION  |
| ---------------------- | ------------- | ----------- |
| None / LOW only        | ✅ Approved to Merge   | APPROVED    |
| MEDIUM                 | ⚠️ Conditionally Approved | CONDITIONAL |
| HIGH                   | ⚠️ Conditionally Approved | CONDITIONAL |
| CRITICAL               | ❌ Needs Changes   | REJECTED    |

**Key rule:** If all issues are LOW (or there are no issues), emit `APPROVED` even when the human-facing verdict says "Conditionally Approved". `pr-fix` explicitly skips LOW issues, so triggering a fix session for LOW-only reviews wastes a round with no actionable outcome.

Determine `IS_CRITICAL_PATH` using the `CRITICAL_PATH_PATTERN` env var (defined in `scripts/pr-automation.conf`, passed by daemon at runtime).
When a pattern is defined, check and capture matched files:

```bash
# CRITICAL_PATH_PATTERN is an env var — set by pr-automation daemon or manually
if [ -n "$CRITICAL_PATH_PATTERN" ]; then
  cd "$WORKTREE_DIR"
  CRITICAL_FILES=$(git diff origin/<baseRefName>...HEAD --name-only | grep -E "$CRITICAL_PATH_PATTERN")
  if [ -n "$CRITICAL_FILES" ]; then
    IS_CRITICAL_PATH=true
  else
    IS_CRITICAL_PATH=false
  fi
else
  IS_CRITICAL_PATH=false
  CRITICAL_FILES=""
fi
```

Output:

```
<!-- automation-result -->
CONCLUSION: APPROVED
IS_CRITICAL_PATH: false
CRITICAL_PATH_FILES: (none)
PR_NUMBER: 123
<!-- /automation-result -->
```

When `IS_CRITICAL_PATH` is true, list matched files one per line:

```
<!-- automation-result -->
CONCLUSION: APPROVED
IS_CRITICAL_PATH: true
CRITICAL_PATH_FILES:
- docs/feature/extension-market/agent-hub-requirements.md
- docs/feature/extension-market/research/architecture.md
PR_NUMBER: 456
<!-- /automation-result -->
```

### Step 9 — Cleanup

Remove the worktree. No branch switching needed — the main repo was never touched.

```bash
cd "$REPO_ROOT"
git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
```

Both automation and non-automation modes use the same cleanup — no prompt needed since worktree removal has no side effects.
