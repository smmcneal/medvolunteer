# Auto-Fix Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nightly GitHub Actions workflow reads `Ready` bugs from the Notion Dev Tasks & QA database, triaged by Priority (Critical-first), and autonomously fixes up to 3 per run using the Claude Code CLI, opening a PR for each fix.

**Architecture:** Two changes — a new `list-ready` command in the existing `scripts/notion-sync.cjs` helper, and a new `.github/workflows/auto-fix-bugs.yml` workflow. The workflow runs the fix loop sequentially: mark In Progress → branch → `claude -p` → commit+PR or revert. Everything downstream (Code Review transition, deploy, Done) is handled by existing automation.

**Tech Stack:** Node.js (CJS), GitHub Actions, Notion API, Claude Code CLI (`@anthropic-ai/claude-code`), `gh` CLI (pre-installed on `ubuntu-latest`)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `scripts/notion-sync.cjs` | Add `list-ready` command |
| Create | `.github/workflows/auto-fix-bugs.yml` | Scheduled fix workflow |

---

## Task 1: Add `list-ready` command to `notion-sync.cjs`

**Files:**
- Modify: `scripts/notion-sync.cjs` (add one `case` block to the existing `switch`)

### What it does

Queries for all pages with `Status = Ready`, sorts them client-side by Priority (Critical=0, High=1, Medium=2, Low=3, unset=4), breaks ties by `created_time` ascending (Notion handles that via the `sorts` param), slices to `--max` results, and prints a JSON array to stdout.

---

- [ ] **Step 1: Add the `list-ready` case to the switch in `notion-sync.cjs`**

Insert this new case **before** the `default:` case at line ~224 of `scripts/notion-sync.cjs`:

```js
    case 'list-ready': {
      const maxIdx = args.indexOf('--max');
      const max = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : 3;
      const { token, dbId } = getEnv();

      const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({
          filter: {
            property: 'Status',
            select: { equals: 'Ready' },
          },
          sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Notion query failed (${res.status}): ${err}`);
      }
      const data = await res.json();
      const pages = data.results ?? [];

      // Sort client-side by priority — Notion API can't order by select value
      const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      pages.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.properties['Priority']?.select?.name] ?? 4;
        const pb = PRIORITY_ORDER[b.properties['Priority']?.select?.name] ?? 4;
        return pa - pb;
        // created_time ties already resolved ascending by Notion sorts param above
      });

      const tasks = pages.slice(0, max).map(page => {
        const titleParts = page.properties['Task ID']?.title ?? [];
        const fullTitle = titleParts.map(t => t.plain_text).join('');
        const taskId = extractTaskId(fullTitle) ?? '';
        const title = fullTitle.replace(/^DEV-\d+:\s*/i, '').trim();
        const descParts = page.properties['Component/File']?.rich_text ?? [];
        const description = descParts.map(t => t.plain_text).join('').trim();
        return { pageId: page.id, taskId, title, description };
      });

      console.log(JSON.stringify(tasks, null, 2));
      break;
    }
```

- [ ] **Step 2: Update the usage text in the `default:` case**

Find the usage string in the `default:` block (around line ~226) and add the new command:

```
  list-ready [--max 3]              List Ready tasks, Priority-triaged, as JSON
```

The updated `console.log` in the `default:` case should read:

```js
      console.log(`
notion-sync.cjs — Notion ↔ MedVolunteer sync

Commands:
  find    DEV-001                    Find task in Notion
  status  DEV-001 "In Progress"     Update task status
  pr      DEV-001 <pr-url>          Set PR Link
  gh      DEV-001 <issue-url>       Set GitHub Link
  deploy  DEV-001 <preview-url>     Set deploy preview URL
  branch                            Auto-detect branch → set In Progress
  hook                              PostToolUse stdin mode (Claude Code hook)
  list-ready [--max 3]              List Ready tasks, Priority-triaged, as JSON

Status values: Backlog | Ready | In Progress | Code Review | Testing | Done
      `.trim());
```

- [ ] **Step 3: Verify the command runs without error (dry-run with no env vars)**

Run from the repo root:

```bash
node scripts/notion-sync.cjs list-ready --max 3
```

Expected output if `NOTION_TOKEN` / `NOTION_DEV_TASKS_DB_ID` are not set in your shell:

```
[notion-sync] Missing NOTION_TOKEN or NOTION_DEV_TASKS_DB_ID env vars.
```

That error confirms the new case is wired in and `getEnv()` is being called correctly. ✓

- [ ] **Step 4: Verify with real env vars (optional — requires Notion token in .env.local)**

```bash
set -a && source web/.env.local && set +a
node scripts/notion-sync.cjs list-ready --max 3
```

Expected: a JSON array printed to stdout. If no Ready tasks exist, expect `[]`. Shape of each element:

```json
{
  "pageId": "...",
  "taskId": "DEV-00007",
  "title": "Messages > Individual search provides no results",
  "description": "when sending an email, if you select \"Individuals\" and search for a name - no results are found"
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/notion-sync.cjs
git commit -m "feat(notion-sync): add list-ready command with Priority triage"
```

---

## Task 2: Create `.github/workflows/auto-fix-bugs.yml`

**Files:**
- Create: `.github/workflows/auto-fix-bugs.yml`

This workflow runs on a nightly schedule (2am UTC) and on manual `workflow_dispatch`. It calls `list-ready`, then loops through each task sequentially.

---

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/auto-fix-bugs.yml` with this content:

```yaml
name: Auto Fix Bugs

on:
  schedule:
    - cron: '0 2 * * *'   # nightly 2am UTC
  workflow_dispatch:
    inputs:
      max_tasks:
        description: 'Max tasks to fix this run (default: 3)'
        default: '3'
        required: false

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Install repo dependencies
        run: cd web && npm ci

      - name: Configure git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Fix bugs
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DEV_TASKS_DB_ID: ${{ secrets.NOTION_DEV_TASKS_DB_ID }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          MAX_TASKS: ${{ github.event.inputs.max_tasks || '3' }}
        run: |
          set -euo pipefail

          # Fetch triaged task list
          node scripts/notion-sync.cjs list-ready --max "$MAX_TASKS" > /tmp/tasks.json
          TASK_COUNT=$(node -pe "JSON.parse(require('fs').readFileSync('/tmp/tasks.json','utf8')).length")
          echo "Tasks to process: $TASK_COUNT"

          if [ "$TASK_COUNT" -eq 0 ]; then
            echo "No Ready tasks — nothing to do."
            exit 0
          fi

          for i in $(seq 0 $((TASK_COUNT - 1))); do
            TASK_ID=$(node -pe    "JSON.parse(require('fs').readFileSync('/tmp/tasks.json','utf8'))[$i].taskId")
            TITLE=$(node -pe      "JSON.parse(require('fs').readFileSync('/tmp/tasks.json','utf8'))[$i].title")
            DESCRIPTION=$(node -pe "JSON.parse(require('fs').readFileSync('/tmp/tasks.json','utf8'))[$i].description")

            echo ""
            echo "=== [$((i+1))/$TASK_COUNT] $TASK_ID: $TITLE ==="

            # Build branch name: lowercase slug, special chars → hyphens, max 50 chars
            SLUG=$(echo "$TITLE" \
              | tr '[:upper:]' '[:lower:]' \
              | sed 's/[^a-z0-9]/-/g' \
              | sed 's/-\+/-/g' \
              | sed 's/^-\|-$//g' \
              | cut -c1-50)
            BRANCH="fix/${TASK_ID}-${SLUG}"

            # Ensure we're on latest main before each task
            git checkout main
            git pull origin main

            # Delete any stale branch from a prior run
            git push origin --delete "$BRANCH" 2>/dev/null || true
            git branch -D "$BRANCH" 2>/dev/null || true

            # Mark In Progress in Notion
            node scripts/notion-sync.cjs status "$TASK_ID" "In Progress"

            # Create branch
            git checkout -b "$BRANCH"

            # Build prompt (heredoc avoids quoting issues)
            PROMPT=$(cat <<PROMPT
You are fixing a bug in the MedVolunteer codebase.
Working directory: web/

Bug ID: $TASK_ID
Title: $TITLE
Description: $DESCRIPTION

Instructions:
1. Read CLAUDE.md first for project patterns and conventions
2. Find and fix this specific bug — search the codebase as needed
3. Make the minimal change that fixes the bug — no refactoring, no unrelated changes
4. Do NOT run git or npm commands — only edit source files
PROMPT
)

            # Run Claude Code — errors are soft (|| true so loop continues)
            claude -p "$PROMPT" --dangerouslySkipPermissions || true

            # Check for changes
            if git diff --quiet && git diff --cached --quiet; then
              echo "$TASK_ID: No changes made — reverting to Ready"
              git checkout main
              git branch -D "$BRANCH"
              node scripts/notion-sync.cjs status "$TASK_ID" "Ready"
              continue
            fi

            # Commit
            COMMIT_MSG="fix($TASK_ID): $(echo "$TITLE" | tr '[:upper:]' '[:lower:]')"
            git add -A
            git commit -m "$COMMIT_MSG"
            git push origin "$BRANCH"

            # Open PR — on failure, clean up and revert
            if ! gh pr create \
                --title "fix: $TASK_ID $TITLE" \
                --body "Automated fix for \`$TASK_ID\`: $TITLE" \
                --base main \
                --head "$BRANCH"; then
              echo "$TASK_ID: PR creation failed — reverting to Ready"
              git checkout main
              node scripts/notion-sync.cjs status "$TASK_ID" "Ready"
              continue
            fi

            echo "$TASK_ID: PR opened ✓"
            git checkout main
          done
```

- [ ] **Step 2: Verify YAML syntax locally**

```bash
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
try {
  yaml.load(fs.readFileSync('.github/workflows/auto-fix-bugs.yml', 'utf8'));
  console.log('YAML valid');
} catch (e) {
  console.error('YAML error:', e.message);
  process.exit(1);
}
"
```

If `js-yaml` is not installed: `npm install -g js-yaml` first, or skip this and rely on the next step.

Alternatively, use the GitHub CLI to validate:

```bash
gh workflow list
```

Expected: lists existing workflows without error (confirms YAML is parseable by the runner).

- [ ] **Step 3: Add `ANTHROPIC_API_KEY` to GitHub repository secrets**

Go to `https://github.com/smmcneal/medvolunteer/settings/secrets/actions` and add:

| Secret name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (starts with `sk-ant-`) |

`NOTION_TOKEN` and `NOTION_DEV_TASKS_DB_ID` should already be present from the existing `notion-pr-sync.yml` setup.

- [ ] **Step 4: Commit the workflow file**

```bash
git add .github/workflows/auto-fix-bugs.yml
git commit -m "feat: add nightly auto-fix-bugs GitHub Actions workflow"
```

- [ ] **Step 5: Push and do a manual smoke-test run**

```bash
git push origin main
```

Then trigger the workflow manually with `max_tasks = 1`:

```bash
gh workflow run auto-fix-bugs.yml --field max_tasks=1
```

Watch the run:

```bash
gh run watch
```

Expected outcomes:
- **If a Ready task exists:** workflow creates a branch, opens a PR, Notion task moves to `In Progress` → then `Code Review` (via `notion-pr-sync.yml`)
- **If no Ready tasks exist:** workflow prints `No Ready tasks — nothing to do.` and exits 0
- **If Claude makes no changes:** branch is deleted, task reverts to `Ready`

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Query Notion for ≤3 Ready tasks | Task 1 — `list-ready --max "$MAX_TASKS"` |
| Priority triage: Critical → High → Medium → Low → unset | Task 1 — `PRIORITY_ORDER` sort |
| Oldest-first tiebreaker | Task 1 — Notion `sorts: created_time ascending` |
| Mark In Progress before branching | Task 2 — `notion-sync status "$TASK_ID" "In Progress"` |
| Branch naming `fix/DEV-XXXXX-<slug>` | Task 2 — `SLUG` + `BRANCH` construction |
| Run `claude -p` with bug prompt | Task 2 — `claude -p "$PROMPT" --dangerouslySkipPermissions` |
| If no changes: delete branch, revert to Ready | Task 2 — `git diff --quiet` check |
| If changes: commit + push + open PR | Task 2 — `git commit` + `gh pr create` |
| If PR fails: revert to Ready | Task 2 — `|| { ... node notion-sync status "Ready" }` |
| Checkout main between tasks | Task 2 — `git checkout main` at top of loop and after each task |
| Delete stale branch before creating | Task 2 — `git push origin --delete` + `git branch -D` |
| Stale branch from prior run handled | Task 2 — same as above |
| `ANTHROPIC_API_KEY` secret documented | Task 2 Step 3 |
| Nightly 2am UTC schedule | Task 2 — `cron: '0 2 * * *'` |
| `workflow_dispatch` with max_tasks override | Task 2 — `inputs.max_tasks` |
| Workflow exits 0 on all-fail | Task 2 — failures use `continue`, outer `set -e` only catches hard errors |

All spec requirements covered. ✓
