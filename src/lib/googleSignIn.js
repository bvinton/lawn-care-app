import {
  APP_OAUTH_LABEL,
  assertAuthorizeUrlRedirectsToApp,
  formatOAuthError,
  getOAuthRedirectUrl,
} from './oauthRedirect';

/** Start Google OAuth and always show the account chooser. */
export async function signInWithGoogleAccountPicker(supabase) {
  const redirectTo = getOAuthRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(formatOAuthError(APP_OAUTH_LABEL, redirectTo, error.message));
  }

  if (!data?.url) {
    throw new Error('Could not start Google sign-in.');
  }

  assertAuthorizeUrlRedirectsToApp(data.url, redirectTo, APP_OAUTH_LABEL);
  window.location.assign(data.url);
}
