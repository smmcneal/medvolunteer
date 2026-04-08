#!/usr/bin/env node
/**
 * notion-sync.cjs — Notion ↔ MedVolunteer automation helper
 *
 * Uses:
 *   node scripts/notion-sync.cjs find    DEV-001
 *   node scripts/notion-sync.cjs status  DEV-001 "In Progress"
 *   node scripts/notion-sync.cjs pr      DEV-001 "https://github.com/smmcneal/medvolunteer/pull/42"
 *   node scripts/notion-sync.cjs gh      DEV-001 "https://github.com/smmcneal/medvolunteer/issues/10"
 *   node scripts/notion-sync.cjs deploy  DEV-001 "https://medvolunteer-abc123.vercel.app"
 *   node scripts/notion-sync.cjs hook    (PostToolUse stdin mode — called by Claude Code)
 *   node scripts/notion-sync.cjs branch  (auto-detect branch, set "In Progress")
 *
 * Required env vars:
 *   NOTION_TOKEN           — Notion integration secret
 *   NOTION_DEV_TASKS_DB_ID — Dev Tasks & QA database ID
 */
'use strict';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getEnv() {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DEV_TASKS_DB_ID;
  if (!token || !dbId) {
    console.error('[notion-sync] Missing NOTION_TOKEN or NOTION_DEV_TASKS_DB_ID env vars.');
    process.exit(1);
  }
  return { token, dbId };
}

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

/** Find a Notion page whose Task ID title contains taskId (e.g. "DEV-001") */
async function findTask(taskId) {
  const { token, dbId } = getEnv();
  const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      filter: {
        property: 'Task ID',
        title: { contains: taskId },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.results?.[0] || null;
}

/** Update the Status select on a Notion page */
async function setStatus(pageId, status) {
  const { token } = getEnv();
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({
      properties: {
        'Status': { select: { name: status } },
      },
    }),
  });
  if (!res.ok) throw new Error(`Notion status update failed (${res.status})`);
  return res.json();
}

/** Set a URL property on a Notion page */
async function setUrl(pageId, field, url) {
  const { token } = getEnv();
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({
      properties: { [field]: { url } },
    }),
  });
  if (!res.ok) throw new Error(`Notion URL update failed (${res.status})`);
  return res.json();
}

/** Extract DEV-### from a string (branch name, PR title, commit message) */
function extractTaskId(str = '') {
  const match = str.match(/DEV-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

/** Get current git branch name */
function getCurrentBranch() {
  const { execSync } = require('child_process');
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {

    case 'find': {
      const taskId = args[0];
      if (!taskId) { console.error('Usage: notion-sync.cjs find DEV-001'); process.exit(1); }
      const page = await findTask(taskId);
      if (!page) { console.log(`No task found for ${taskId}`); process.exit(0); }
      console.log(`Found: ${page.id} — ${page.properties['Task ID']?.title?.[0]?.plain_text}`);
      break;
    }

    case 'status': {
      const [taskId, status] = args;
      if (!taskId || !status) { console.error('Usage: notion-sync.cjs status DEV-001 "In Progress"'); process.exit(1); }
      const page = await findTask(taskId);
      if (!page) { console.error(`Task not found: ${taskId}`); process.exit(1); }
      await setStatus(page.id, status);
      console.log(`[notion-sync] ${taskId} → Status: ${status}`);
      break;
    }

    case 'pr': {
      const [taskId, url] = args;
      if (!taskId || !url) { console.error('Usage: notion-sync.cjs pr DEV-001 <url>'); process.exit(1); }
      const page = await findTask(taskId);
      if (!page) { console.error(`Task not found: ${taskId}`); process.exit(1); }
      await setUrl(page.id, 'PR Link', url);
      console.log(`[notion-sync] ${taskId} → PR Link: ${url}`);
      break;
    }

    case 'gh': {
      const [taskId, url] = args;
      if (!taskId || !url) { console.error('Usage: notion-sync.cjs gh DEV-001 <url>'); process.exit(1); }
      const page = await findTask(taskId);
      if (!page) { console.error(`Task not found: ${taskId}`); process.exit(1); }
      await setUrl(page.id, 'GitHub Link', url);
      console.log(`[notion-sync] ${taskId} → GitHub Link: ${url}`);
      break;
    }

    case 'deploy': {
      const [taskId, url] = args;
      if (!taskId || !url) { console.error('Usage: notion-sync.cjs deploy DEV-001 <url>'); process.exit(1); }
      const page = await findTask(taskId);
      if (!page) { console.error(`Task not found: ${taskId}`); process.exit(1); }
      // Store preview URL in GitHub Link field (reused for deploy links)
      await setUrl(page.id, 'GitHub Link', url);
      console.log(`[notion-sync] ${taskId} → Deploy URL: ${url}`);
      break;
    }

    case 'branch': {
      // Auto-detect branch, set In Progress if DEV-### found
      const branch = getCurrentBranch();
      if (!branch) { console.log('[notion-sync] Could not detect git branch.'); process.exit(0); }
      const taskId = extractTaskId(branch);
      if (!taskId) { console.log(`[notion-sync] No DEV-### in branch "${branch}", skipping.`); process.exit(0); }
      const page = await findTask(taskId);
      if (!page) { console.log(`[notion-sync] ${taskId} not found in Notion.`); process.exit(0); }
      const currentStatus = page.properties['Status']?.select?.name;
      // Only advance from Backlog or Ready → In Progress
      if (currentStatus === 'Backlog' || currentStatus === 'Ready') {
        await setStatus(page.id, 'In Progress');
        console.log(`[notion-sync] ${taskId} → In Progress (was ${currentStatus})`);
      } else {
        console.log(`[notion-sync] ${taskId} already at "${currentStatus}", no change.`);
      }
      break;
    }

    case 'hook': {
      // PostToolUse stdin mode: called by Claude Code after Bash tool runs
      let raw = '';
      process.stdin.setEncoding('utf8');
      for await (const chunk of process.stdin) raw += chunk;

      let payload;
      try { payload = JSON.parse(raw); } catch { process.exit(0); }

      const command = payload?.tool_input?.command || '';
      const exitCode = payload?.tool_response?.exit_code ?? payload?.tool_response?.exitCode ?? 0;

      // Only react to successful git commits or pushes
      const isGitCommit = /git\s+(commit|push)/.test(command);
      if (!isGitCommit || exitCode !== 0) process.exit(0);

      const branch = getCurrentBranch();
      if (!branch) process.exit(0);

      // Also check commit message for DEV-###
      const taskId = extractTaskId(branch) || extractTaskId(command);
      if (!taskId) process.exit(0);

      // Silently try — don't block Claude on Notion errors
      try {
        if (!process.env.NOTION_TOKEN || !process.env.NOTION_DEV_TASKS_DB_ID) process.exit(0);
        const page = await findTask(taskId);
        if (!page) process.exit(0);
        const currentStatus = page.properties['Status']?.select?.name;
        if (currentStatus === 'Backlog' || currentStatus === 'Ready') {
          await setStatus(page.id, 'In Progress');
          // Print to stderr so it shows in Claude Code without blocking
          process.stderr.write(`[notion-sync] ${taskId} → In Progress\n`);
        }
      } catch {
        // Silent — never block Claude Code on Notion failures
      }
      process.exit(0);
    }

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

    default:
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
      process.exit(0);
  }
}

main().catch(err => {
  console.error('[notion-sync] Error:', err.message);
  process.exit(1);
});
