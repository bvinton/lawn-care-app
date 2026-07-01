/** Start Google OAuth and always show the account chooser. */
export async function signInWithGoogleAccountPicker(supabase) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'consent select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Could not start Google sign-in.');
  }

  window.location.assign(data.url);
}
