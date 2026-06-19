/**
 * Diagnostic: dumps what lawn task rows exist in Supabase and their
 * is_completed / last_completed_date values, plus the user_logs from lawn_app_state.
 *
 * Run from the project root:
 *   node scripts/check-lawn-tasks.mjs
 *
 * You'll be prompted for your Supabase anon key if VITE_SUPABASE_ANON_KEY
 * isn't found in a .env.local file.
 */

import { createInterface } from 'readline';
import { readFileSync, existsSync } from 'fs';

const SUPABASE_URL = 'https://sbcpszlqycaynyurqfws.supabase.co';

// Try to read the anon key from .env.local
let anonKey = '';
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    const lines = readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);
      if (m) { anonKey = m[1].trim(); break; }
    }
    if (anonKey) break;
  }
}

// Also accept as CLI arg: node check-lawn-tasks.mjs eyJhbG...
if (!anonKey && process.argv[2]) {
  anonKey = process.argv[2].trim();
}

if (!anonKey) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  anonKey = await new Promise(resolve =>
    rl.question('Paste your Supabase anon key: ', ans => { rl.close(); resolve(ans.trim()); })
  );
}

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

console.log('\n--- lawn_app_state user_logs ---');
try {
  const state = await supabaseGet(`lawn_app_state?id=eq.default&select=user_logs`);
  const logs = state[0]?.user_logs ?? {};
  const springKeys = Object.entries(logs)
    .filter(([k]) => k.startsWith('SPRING:') || k.startsWith('SUMMER:') || k.startsWith('AUTUMN:'));
  if (springKeys.length === 0) {
    console.log('No pack step logs found in user_logs.');
  } else {
    for (const [k, v] of springKeys.sort()) {
      console.log(`  ${k} = ${v}`);
    }
  }
} catch (e) {
  console.error('Error reading lawn_app_state:', e.message);
}

console.log('\n--- tasks table (lawn, all rows) ---');
try {
  const tasks = await supabaseGet(
    `tasks?app_source=eq.lawn&select=task_name,due_date,is_completed,last_completed_date&order=due_date.asc&limit=100`
  );
  if (tasks.length === 0) {
    console.log('No rows found.');
  } else {
    for (const t of tasks) {
      const lcd = t.last_completed_date ?? '(null)';
      const done = t.is_completed ? '✓' : '○';
      console.log(`  ${done}  last_completed=${lcd.padEnd(12)}  due=${t.due_date}  ${t.task_name}`);
    }
  }
} catch (e) {
  console.error('Error reading tasks:', e.message);
}

console.log('\nDone. If Spring pack rows are missing, open the Lawn Care App and press Sync.');
