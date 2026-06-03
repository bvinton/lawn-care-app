import { runLawnCloudSync } from '../src/server/runLawnCloudSync.js';

function getBearerSecret(req) {
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }
  const header = req.headers?.['x-lawn-sync-secret'];
  return typeof header === 'string' ? header : null;
}

/**
 * POST /api/sync-lawn — runs the Lawn Care App sync pipeline on the server.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expected = process.env.LAWN_SYNC_SECRET || process.env.CRON_SECRET;
  const provided = getBearerSecret(req);

  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const result = await runLawnCloudSync();
    return res.status(result.ok ? 200 : 503).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lawn sync failed';
    console.error('[api/sync-lawn]', err);
    return res.status(500).json({ ok: false, taskCount: 0, message });
  }
}
