# Auto-Fix Bugs from Notion Dev Tasks & QA

**Date:** 2026-04-08  
**Status:** Approved  

## Overview

A nightly GitHub Actions workflow reads all `Ready` tasks from the Notion Dev Tasks & QA database (every task in that DB is a bug by definition — features live in a separate DB), attempts to fix each one autonomously using the Claude Code CLI, and opens a PR. The existing `notion-pr-sync.yml` workflow then moves the task to `Code Review` automatically. Human review happens at PR time before anything merges.

## Trigger

- **Scheduled:** nightly at 2am UTC (`cron: '0 2 * * *'`)
- **Manual:** `workflow_dispatch` with optional `max_tasks` input (default `3`)

## Per-Run Flow

1. Query Notion for up to 3 `Ready` tasks, sorted oldest-first
2. For each task (sequentially, not in parallel):
   a. Mark Notion → `In Progress`
   b. Create branch `fix/DEV-XXXXX-<slug>` from latest `main`
   c. Run `claude -p` with the bug prompt (see below), `--dangerouslySkipPermissions`
   d. Check `git status` — were any files modified?
   e. **If yes:** commit, push, `gh pr create` → existing automation moves Notion → `Code Review`
   f. **If no:** delete branch, revert Notion → `Ready`
3. Checkout `main` between tasks so branches don't stack

Nothing downstream changes: merge, deploy, and Notion → Done transitions are all handled by existing automation.

## What Gets Built

### 1. `scripts/notion-sync.cjs` — new `list-ready` command

```
node scripts/notion-sync.cjs list-ready [--max 3]
```

- Queries the Dev Tasks & QA DB with `filter: Status = Ready`
- Sorts by `created_time` ascending (oldest bugs first)
- Limits to `--max` results (default 3)
- Prints a JSON array to stdout:

```json
[
  {
    "pageId": "abc123",
    "taskId": "DEV-00007",
    "title": "Messages > Individual search provides no results",
    "description": "when sending an email, if you select \"Individuals\" and search for a name - no results are found"
  }
]
```

The `description` is read from the `Component/File` rich_text property (that field is used as bug description in practice).

### 2. `.github/workflows/auto-fix-bugs.yml` — new workflow

```yaml
name: Auto Fix Bugs

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      max_tasks:
        description: 'Max tasks to fix this run (default: 3)'
        default: '3'

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    steps:
      - Checkout main (full history)
      - Setup Node.js 20
      - Install Claude Code CLI (npm install -g @anthropic-ai/claude-code)
      - Install repo deps (cd web && npm ci)
      - Run fix loop (bash script, sequential per task)
```

**Required new GitHub secret:** `ANTHROPIC_API_KEY`

Existing secrets already needed: `NOTION_TOKEN`, `NOTION_DEV_TASKS_DB_ID`

### 3. No changes to `web/`

This is purely CI/automation infrastructure.

## The Claude Prompt

Passed to `claude -p` for each task, run from the repo root:

```
You are fixing a bug in the MedVolunteer codebase.
Working directory: web/

Bug ID: {taskId}
Title: {title}
Description: {description}

Instructions:
1. Read CLAUDE.md first for project patterns and conventions
2. Find and fix this specific bug — search the codebase as needed
3. Make the minimal change that fixes the bug — no refactoring, no unrelated changes
4. Do NOT run git or npm commands — only edit source files
```

`--dangerouslySkipPermissions` is used so the CLI doesn't pause for approval prompts in CI. This is safe because changes go through PR review before any merge.

## Branch & PR Naming

- **Branch:** `fix/DEV-00007-messages-individual-search-no-results`
  - slug = title lowercased, non-alphanumeric → hyphens, truncated to 50 chars
- **PR title:** `fix: DEV-00007 Messages > Individual search provides no results`
- **Commit message:** `fix(DEV-00007): messages individual search provides no results`

## Error Handling

| Scenario | Behavior |
|---|---|
| Claude makes no file changes | Delete branch, revert Notion → `Ready`. Task stays in queue for next night. |
| Claude exits non-zero | Same as above. |
| `gh pr create` fails after changes are made | Delete branch, revert Notion → `Ready`. Log error to workflow output. |
| Branch already exists from a prior stalled run | Delete the stale branch before creating a new one. |
| All tasks in a run fail | Workflow exits 0 — soft failures, cron continues. |

## Sequence Diagram

```
nightly cron
  → list-ready (Notion)
    → [DEV-00007, DEV-00008, DEV-00009]
      → for each:
          notion-sync status DEV-XXXXX "In Progress"
          git checkout -b fix/DEV-XXXXX-<slug>
          claude -p "<prompt>" --dangerouslySkipPermissions
          git status → changed?
            yes → git commit + push + gh pr create
                   → notion-pr-sync.yml fires → Status: Code Review
            no  → git checkout main + git branch -D fix/...
                   → notion-sync status DEV-XXXXX "Ready"
```

## Out of Scope

- Merging PRs (human reviews first)
- Auto-deploying after merge (existing Vercel + webhook handles it)
- Fixing feature requests (separate Notion DB, separate future automation)
- Parallel task processing (sequential is simpler and cheaper for v1)
