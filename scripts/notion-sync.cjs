#!/usr/bin/env node
/**
 * notion-sync.cjs — Notion ↔ MedVolunteer automation helper
 *
 * Two databases:
 *   Dev Tasks & QA   (NOTION_DEV_TASKS_DB_ID)         — bugs / dev tasks, IDs look like DEV-00010
 *   Feature Requests (NOTION_FEATURE_REQUESTS_DB_ID)  — features,         IDs look like AB-00009
 *
 * Uses:
 *   node scripts/notion-sync.cjs find    DEV-00010
 *   node scripts/notion-sync.cjs status  DEV-00010 "In Progress"
 *   node scripts/notion-sync.cjs pr      DEV-00010 "https://github.com/.../pull/42"
 *   node scripts/notion-sync.cjs gh      DEV-00010 "https://github.com/.../issues/10"
 *   node scripts/notion-sync.cjs deploy  DEV-00010 "https://medvolunteer-abc123.vercel.app"
 *   node scripts/notion-sync.cjs hook    (PostToolUse stdin mode — called by Claude Code)
 *   node scripts/notion-sync.cjs branch  (auto-detect branch, set "In Progress")
 *   node scripts/notion-sync.cjs list-ready          [--max 3]
 *   node scripts/notion-sync.cjs list-ready-features [--max 3]
 *   node scripts/notion-sync.cjs feature-status <AB-00009|pageId> "In Progress"
 *   node scripts/notion-sync.cjs feature-pr     <AB-00009|pageId> <url>
 *
 * Every "task selector" argument accepts either a human task ID (AB-00009) or a
 * raw Notion page ID (UUID). Prefer the page ID in automation: task IDs are free
 * text in Notion and are not guaranteed unique.
 *
 * Required env vars:
 *   NOTION_TOKEN                   — Notion integration secret
 *   NOTION_DEV_TASKS_DB_ID         — Dev Tasks & QA database ID
 *   NOTION_FEATURE_REQUESTS_DB_ID  — Feature Requests database ID (feature commands only)
 */
'use strict';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// ─── env / http ──────────────────────────────────────────────────────────────

function getToken() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error('[notion-sync] Missing NOTION_TOKEN env var.');
    process.exit(1);
  }
  return token;
}

function devDb() {
  const id = process.env.NOTION_DEV_TASKS_DB_ID;
  if (!id) {
    console.error('[notion-sync] Missing NOTION_DEV_TASKS_DB_ID env var.');
    process.exit(1);
  }
  return id;
}

function featureDb() {
  const id = process.env.NOTION_FEATURE_REQUESTS_DB_ID;
  if (!id) {
    console.error('[notion-sync] Missing NOTION_FEATURE_REQUESTS_DB_ID env var.');
    process.exit(1);
  }
  return id;
}

function headers() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// ─── schema introspection ────────────────────────────────────────────────────
//
// Notion has two visually identical property types — "select" and "status" — and
// they need different filter/update payloads. Same story for link fields, which
// may be either "url" or "rich_text". Guessing wrong is a hard 400, so read the
// schema once and build payloads from what is actually there.

const schemaCache = new Map();

async function getSchema(dbId) {
  if (schemaCache.has(dbId)) return schemaCache.get(dbId);
  const res = await fetch(`${NOTION_BASE}/databases/${dbId}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Notion database fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const props = data.properties ?? {};
  schemaCache.set(dbId, props);
  return props;
}

async function propType(dbId, name) {
  const props = await getSchema(dbId);
  return props[name]?.type ?? null;
}

/** Build a Status filter that matches the property's real type. */
async function statusFilter(dbId, value) {
  const type = await propType(dbId, 'Status');
  if (type !== 'select' && type !== 'status') {
    throw new Error(`"Status" property is type "${type}" — expected select or status.`);
  }
  return { property: 'Status', [type]: { equals: value } };
}

/** True if `name` is a valid option for the Status property. */
async function statusOptionExists(dbId, name) {
  const props = await getSchema(dbId);
  const status = props['Status'];
  if (!status) return false;
  const options = status[status.type]?.options ?? [];
  return options.some(o => o.name === name);
}

// ─── page reads / writes ─────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** Find a page in `dbId` whose Task ID title contains taskId (e.g. "DEV-00010"). */
async function findTask(dbId, taskId) {
  const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      filter: { property: 'Task ID', title: { contains: taskId } },
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion query failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const results = data.results ?? [];
  if (results.length > 1) {
    console.error(
      `[notion-sync] WARNING: ${results.length} pages match "${taskId}" — using the first. ` +
      `Task IDs should be unique; pass a page ID instead to be unambiguous.`
    );
  }
  return results[0] || null;
}

/**
 * Resolve a task selector (page ID *or* task ID) to a Notion page ID.
 * Returns null when a task ID cannot be found.
 */
async function resolvePageId(dbId, selector) {
  if (UUID_RE.test(selector)) return selector;
  const page = await findTask(dbId, selector);
  return page ? page.id : null;
}

/** Update the Status property, adapting to select vs status typing. */
async function setStatus(dbId, pageId, status) {
  const type = await propType(dbId, 'Status');
  if (type !== 'select' && type !== 'status') {
    throw new Error(`"Status" property is type "${type}" — expected select or status.`);
  }
  // "status"-type options cannot be created via the API. Writing an unknown name
  // is a 400, which would fail the whole workflow run — warn and no-op instead.
  if (type === 'status' && !(await statusOptionExists(dbId, status))) {
    console.error(
      `[notion-sync] WARNING: "${status}" is not an option on the Status property ` +
      `(type: status). Add it in Notion. Skipping this update.`
    );
    return null;
  }
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: { 'Status': { [type]: { name: status } } },
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion status update failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Set a link-ish property, adapting to url vs rich_text typing. */
async function setLink(dbId, pageId, field, url) {
  const type = await propType(dbId, field);
  let value;
  if (type === 'url') {
    value = { url };
  } else if (type === 'rich_text') {
    value = { rich_text: [{ type: 'text', text: { content: url, link: { url } } }] };
  } else if (type === null) {
    console.error(`[notion-sync] WARNING: no "${field}" property on this database — skipping.`);
    return null;
  } else {
    console.error(`[notion-sync] WARNING: "${field}" is type "${type}" — cannot store a URL. Skipping.`);
    return null;
  }
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties: { [field]: value } }),
  });
  if (!res.ok) {
    throw new Error(`Notion "${field}" update failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Query a database for Ready tasks, priority-triaged, oldest first. */
async function listReady(dbId, max) {
  const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      filter: await statusFilter(dbId, 'Ready'),
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion query failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const pages = data.results ?? [];

  // Sort client-side by priority — Notion cannot order by select value.
  // created_time ties are already ascending from the sorts param above.
  const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  pages.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.properties['Priority']?.select?.name] ?? 4;
    const pb = PRIORITY_ORDER[b.properties['Priority']?.select?.name] ?? 4;
    return pa - pb;
  });

  return pages.slice(0, max).map(page => {
    const fullTitle = (page.properties['Task ID']?.title ?? [])
      .map(t => t.plain_text).join('');
    const taskId = extractTaskId(fullTitle) ?? '';
    const title = fullTitle.replace(/^(?:DEV|AB)-\d+:\s*/i, '').trim();
    const description = (page.properties['Component/File']?.rich_text ?? [])
      .map(t => t.plain_text).join('').trim();
    return { pageId: page.id, taskId, title, description };
  }).filter(t => t.taskId !== '' && t.title !== '');
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Extract DEV-### or AB-##### from a string (branch name, PR title, commit message) */
function extractTaskId(str = '') {
  const match = str.match(/(?:DEV|AB)-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

/** Which database does this task ID live in? */
function dbForTaskId(taskId) {
  return /^AB-/i.test(taskId) ? featureDb() : devDb();
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
      if (!taskId) { console.error('Usage: notion-sync.cjs find DEV-00010'); process.exit(1); }
      const page = await findTask(dbForTaskId(taskId), taskId);
      if (!page) { console.log(`No task found for ${taskId}`); process.exit(0); }
      console.log(`Found: ${page.id} — ${page.properties['Task ID']?.title?.[0]?.plain_text}`);
      break;
    }

    case 'status':
    case 'feature-status': {
      const [selector, status] = args;
      if (!selector || !status) {
        console.error('Usage: notion-sync.cjs status <DEV-00010|pageId> "In Progress"');
        process.exit(1);
      }
      // `status` defaults to Dev Tasks, `feature-status` to Feature Requests, but an
      // explicit DEV-/AB- prefix always wins so callers cannot route to the wrong DB.
      const dbId = UUID_RE.test(selector)
        ? (cmd === 'feature-status' ? featureDb() : devDb())
        : dbForTaskId(selector);
      const pageId = await resolvePageId(dbId, selector);
      if (!pageId) { console.error(`Task not found: ${selector}`); process.exit(1); }
      await setStatus(dbId, pageId, status);
      console.log(`[notion-sync] ${selector} → Status: ${status}`);
      break;
    }

    case 'pr':
    case 'feature-pr': {
      const [selector, url] = args;
      if (!selector || !url) { console.error('Usage: notion-sync.cjs pr <DEV-00010|pageId> <url>'); process.exit(1); }
      const dbId = UUID_RE.test(selector)
        ? (cmd === 'feature-pr' ? featureDb() : devDb())
        : dbForTaskId(selector);
      const pageId = await resolvePageId(dbId, selector);
      if (!pageId) { console.error(`Task not found: ${selector}`); process.exit(1); }
      await setLink(dbId, pageId, 'PR Link', url);
      console.log(`[notion-sync] ${selector} → PR Link: ${url}`);
      break;
    }

    case 'gh':
    case 'deploy': {
      // `deploy` reuses the GitHub Link field to store the Vercel preview URL.
      const [selector, url] = args;
      if (!selector || !url) { console.error(`Usage: notion-sync.cjs ${cmd} <DEV-00010|pageId> <url>`); process.exit(1); }
      const dbId = UUID_RE.test(selector) ? devDb() : dbForTaskId(selector);
      const pageId = await resolvePageId(dbId, selector);
      if (!pageId) { console.error(`Task not found: ${selector}`); process.exit(1); }
      await setLink(dbId, pageId, 'GitHub Link', url);
      console.log(`[notion-sync] ${selector} → GitHub Link: ${url}`);
      break;
    }

    case 'branch': {
      // Auto-detect branch, set In Progress if a task ID is found
      const branch = getCurrentBranch();
      if (!branch) { console.log('[notion-sync] Could not detect git branch.'); process.exit(0); }
      const taskId = extractTaskId(branch);
      if (!taskId) { console.log(`[notion-sync] No DEV-###/AB-### in branch "${branch}", skipping.`); process.exit(0); }
      const dbId = dbForTaskId(taskId);
      const page = await findTask(dbId, taskId);
      if (!page) { console.log(`[notion-sync] ${taskId} not found in Notion.`); process.exit(0); }
      const statusProp = page.properties['Status'];
      const currentStatus = statusProp?.select?.name ?? statusProp?.status?.name;
      // Only advance from Backlog or Ready → In Progress
      if (currentStatus === 'Backlog' || currentStatus === 'Ready') {
        await setStatus(dbId, page.id, 'In Progress');
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

      const taskId = extractTaskId(branch) || extractTaskId(command);
      if (!taskId) process.exit(0);

      // Silently try — never block Claude Code on Notion errors
      try {
        if (!process.env.NOTION_TOKEN) process.exit(0);
        const isFeature = /^AB-/i.test(taskId);
        if (isFeature && !process.env.NOTION_FEATURE_REQUESTS_DB_ID) process.exit(0);
        if (!isFeature && !process.env.NOTION_DEV_TASKS_DB_ID) process.exit(0);

        const dbId = dbForTaskId(taskId);
        const page = await findTask(dbId, taskId);
        if (!page) process.exit(0);
        const statusProp = page.properties['Status'];
        const currentStatus = statusProp?.select?.name ?? statusProp?.status?.name;
        if (currentStatus === 'Backlog' || currentStatus === 'Ready') {
          await setStatus(dbId, page.id, 'In Progress');
          // stderr so it shows in Claude Code without blocking
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
      console.log(JSON.stringify(await listReady(devDb(), max), null, 2));
      break;
    }

    case 'list-ready-features': {
      const maxIdx = args.indexOf('--max');
      const max = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : 3;
      console.log(JSON.stringify(await listReady(featureDb(), max), null, 2));
      break;
    }

    case 'bugs-clear': {
      // Manual/diagnostic only — no workflow gates on this any more.
      // Exit 0 if no dev task is in flight (Ready/In Progress/Code Review), else exit 1.
      const dbId = devDb();
      const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          filter: {
            or: [
              await statusFilter(dbId, 'Ready'),
              await statusFilter(dbId, 'In Progress'),
              await statusFilter(dbId, 'Code Review'),
            ],
          },
          page_size: 1,
        }),
      });
      if (!res.ok) {
        throw new Error(`Notion query failed (${res.status}): ${await res.text()}`);
      }
      const data = await res.json();
      const count = data.results?.length ?? 0;
      if (count > 0) {
        console.log(`[notion-sync] ${count}+ dev task(s) still in flight.`);
        process.exit(1);
      }
      console.log('[notion-sync] All dev tasks clear.');
      process.exit(0);
    }

    default:
      console.log(`
notion-sync.cjs — Notion ↔ MedVolunteer sync

Task selectors accept a task ID (DEV-00010 / AB-00009) or a Notion page ID (UUID).
Prefer page IDs in automation — task IDs are free text and may collide.

Commands:
  find    DEV-00010                       Find task in Notion
  status  <selector> "In Progress"        Update status (DB inferred from DEV-/AB- prefix)
  pr      <selector> <pr-url>             Set PR Link
  gh      <selector> <issue-url>          Set GitHub Link
  deploy  <selector> <preview-url>        Set deploy preview URL (GitHub Link field)
  branch                                  Auto-detect branch → set In Progress
  hook                                    PostToolUse stdin mode (Claude Code hook)
  list-ready [--max 3]                    Ready tasks from Dev Tasks DB, Priority-triaged, JSON
  list-ready-features [--max 3]           Ready tasks from Feature Requests DB, JSON
  feature-status <selector> <status>      Update status in Feature Requests DB
  feature-pr     <selector> <pr-url>      Set PR Link in Feature Requests DB
  bugs-clear                              Diagnostic: exit 1 if any dev task is in flight

Status values: Backlog | Ready | In Progress | Code Review | Testing | Done
      `.trim());
      process.exit(0);
  }
}

main().catch(err => {
  console.error('[notion-sync] Error:', err.message);
  process.exit(1);
});
