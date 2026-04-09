import { createHmac } from 'crypto';
import { headers } from 'next/headers';

/**
 * Vercel deployment webhook → Notion sync
 *
 * Receives deployment events from Vercel and updates the corresponding
 * Dev Tasks & QA Notion task with the preview URL.
 *
 * Setup:
 *   1. Vercel Dashboard → Project → Settings → Webhooks → Add
 *   2. URL: https://your-domain.com/api/webhooks/vercel
 *   3. Events: deployment.succeeded, deployment.failed
 *   4. Copy the signing secret → VERCEL_WEBHOOK_SECRET in .env.local
 *
 * Required env vars:
 *   VERCEL_WEBHOOK_SECRET  — Signing secret from Vercel webhook settings
 *   NOTION_TOKEN           — Notion integration secret
 *   NOTION_DEV_TASKS_DB_ID — Dev Tasks & QA database ID
 */

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function findNotionTask(taskId: string) {
  const res = await fetch(`${NOTION_BASE}/databases/${process.env.NOTION_DEV_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: 'Task ID',
        title: { contains: taskId },
      },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function updateNotionPage(pageId: string, props: Record<string, unknown>) {
  await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({ properties: props }),
  });
}

function extractTaskId(str: string): string | null {
  const match = str.match(/DEV-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

export async function POST(request: Request) {
  // ── 1. Verify signature ──────────────────────────────────────────────────
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: 'VERCEL_WEBHOOK_SECRET not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get('x-vercel-signature');

  if (signature) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (signature !== expected) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // ── 2. Parse payload ─────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = payload.type as string;

  // Only handle deployment events
  if (!type?.startsWith('deployment.')) {
    return Response.json({ skipped: true });
  }

  const deployment = (payload.payload as Record<string, unknown>)?.deployment as Record<string, unknown> | undefined;
  if (!deployment) return Response.json({ skipped: true });

  const branch = (deployment.meta as Record<string, string>)?.githubCommitRef ?? '';
  const previewUrl = (deployment.url as string) ?? '';
  const deployState = type; // deployment.succeeded | deployment.failed | deployment.created

  // ── 3. Extract DEV-### from branch name ──────────────────────────────────
  const taskId = extractTaskId(branch);
  if (!taskId) {
    return Response.json({ skipped: `No DEV-### in branch: ${branch}` });
  }

  // ── 4. Skip if Notion not configured ─────────────────────────────────────
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DEV_TASKS_DB_ID) {
    return Response.json({ skipped: 'Notion env vars not set' });
  }

  // ── 5. Find the Notion task ───────────────────────────────────────────────
  const page = await findNotionTask(taskId);
  if (!page) {
    return Response.json({ skipped: `${taskId} not found in Notion` });
  }

  console.log(`[vercel-webhook] ${deployState} | branch=${branch} | taskId=${taskId} | url=${previewUrl}`);

  // ── 6. Update Notion based on deployment state ───────────────────────────
  const updates: Record<string, unknown> = {};

  if (previewUrl) {
    // Store preview URL in the GitHub Link field (available in the schema)
    const url = previewUrl.startsWith('http') ? previewUrl : `https://${previewUrl}`;
    updates['GitHub Link'] = { url };
  }

  if (deployState === 'deployment.succeeded') {
    const currentStatus = (page.properties?.Status as Record<string, unknown>)
      ?.select as Record<string, string> | undefined;
    // Only advance to Testing if the task is in Code Review or In Progress
    if (currentStatus?.name === 'Code Review' || currentStatus?.name === 'In Progress') {
      updates['Status'] = { select: { name: 'Testing' } };
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateNotionPage(page.id, updates);
  }

  return Response.json({
    ok: true,
    taskId,
    event: deployState,
    branch,
    previewUrl,
    notionUpdated: Object.keys(updates),
  });
}
