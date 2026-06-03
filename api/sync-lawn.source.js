import { runLawnCloudSync } from '../src/server/runLawnCloudSync.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://tasks-app-rho-lake.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function getAllowedOrigins() {
  const extra = process.env.LAWN_SYNC_ALLOWED_ORIGINS;
  if (typeof extra === 'string' && extra.trim()) {
    return [...DEFAULT_ALLOWED_ORIGINS, ...extra.split(',').map((o) => o.trim())];
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function applyCors(req, res) {
  const origin = req.headers?.origin;
  const allowed = getAllowedOrigins();
  if (typeof origin === 'string' && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Lawn-Sync-Secret');
}

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
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
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
