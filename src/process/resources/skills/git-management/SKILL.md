---
name: git-management
description: 'Manage Git repositories using direct shell commands. Guides the AI on structuring Git add, commit, diff, checkout, branch, and status calls confidently.'
---

# Git Management Skill

This skill allows the AI to manage a Git repository autonomously through raw shell operations (`run_shell_command`). Since no fragile middleware wrappers intercept the command, the AI has full interactive capability.

## When to Use This Skill

Use this guideline whenever the task involves:
* Staging, committing, or viewing file changes.
* Branching, merging, or cloning repositories.
* Reading commit history.

## Standard Workflows

### 1. Checking Repository Status
Always run this first before making edits to prevent dirty tree conflicts.
```bash
git status --short
```

### 2. Inspecting Changes
```bash
git diff
# or for staged changes
git diff --staged
```

### 3. Staging and Committing
Be granular. Do not run `git add .` indiscriminately if there are temporary files around.
```bash
git add <filename>
git commit -m "Commit message"
```

### 4. Branch Management
```bash
git checkout -b feature/your-feature-name
```

## Best Practices

* **Never prompt for credentials**: Ensure you only execute read/write actions on public URIs or pre-authenticated paths.
* **Avoid non-interactive hangs**: Do not run commands like `git pull` if they trigger standard editor prompts for merges. Use flags like `git pull --no-edit`.
* **Clean trees**: Always double-check tracking paths.
