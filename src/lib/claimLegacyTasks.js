const CLAIMED_KEY = 'lawn-app-legacy-claimed';

/** Assign orphaned tasks (user_id IS NULL) to the signed-in user — once per browser. */
export async function claimLegacyTasks(supabase) {
  try {
    if (localStorage.getItem(CLAIMED_KEY) === '1') {
      return;
    }

    const { data, error } = await supabase.rpc('claim_legacy_tasks');
    if (error) {
      console.warn('[Lawn] claim_legacy_tasks failed:', error.message);
      return;
    }

    if (typeof data === 'number' && data >= 0) {
      localStorage.setItem(CLAIMED_KEY, '1');
    }
  } catch (error) {
    console.warn('[Lawn] claim_legacy_tasks error:', error);
  }
}
