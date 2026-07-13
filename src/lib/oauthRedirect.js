export const APP_OAUTH_LABEL = 'Lawn Pack Companion';
export const DEFAULT_APP_URL = 'https://lawn-care-app-vert.vercel.app';

/** OAuth must redirect to a URL whitelisted in Supabase Auth → URL configuration. */
export function getOAuthRedirectUrl() {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return `${configured}/`;
  }

  if (import.meta.env.DEV) {
    return `${window.location.origin}/`;
  }

  return `${DEFAULT_APP_URL}/`;
}

function normalizeRedirectUrl(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value).replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

export function formatRedirectAllowListError(appLabel, redirectUrl, actualRedirectUrl) {
  const expected = normalizeRedirectUrl(redirectUrl);
  const allowListEntry = `${expected}/**`;
  const fallbackNote = actualRedirectUrl
    ? ` Supabase would send you to ${actualRedirectUrl} instead (usually the project Site URL).`
    : '';

  return [
    `${appLabel} cannot sign in: this app's URL is not registered in Supabase.${fallbackNote}`,
    `Add this redirect URL in Supabase Dashboard → Authentication → URL configuration:`,
    allowListEntry,
  ].join(' ');
}

export function extractRedirectToFromAuthorizeUrl(authorizeUrl) {
  try {
    return new URL(authorizeUrl).searchParams.get('redirect_to');
  } catch {
    return null;
  }
}

export function assertAuthorizeUrlRedirectsToApp(authorizeUrl, expectedRedirectUrl, appLabel) {
  const actual = extractRedirectToFromAuthorizeUrl(authorizeUrl);
  if (!actual) return;

  if (normalizeRedirectUrl(actual) !== normalizeRedirectUrl(expectedRedirectUrl)) {
    throw new Error(formatRedirectAllowListError(appLabel, expectedRedirectUrl, actual));
  }
}

export function readOAuthCallbackError() {
  const url = new URL(window.location.href);
  const queryError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (queryError) return queryError;

  if (url.hash.includes('error=')) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    return hashParams.get('error_description') || hashParams.get('error');
  }

  return null;
}

export function hasPendingOAuthCode() {
  return new URL(window.location.href).searchParams.has('code');
}

export function formatOAuthError(appLabel, redirectUrl, rawError) {
  if (/redirect|url|invalid.*redirect|not allowed/i.test(rawError)) {
    return formatRedirectAllowListError(appLabel, redirectUrl);
  }
  return rawError;
}

export function cleanAuthCallbackFromUrl() {
  const url = new URL(window.location.href);
  const hadAuthParams =
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_description') ||
    url.hash.includes('access_token=') ||
    url.hash.includes('error=');

  if (!hadAuthParams) return;

  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.hash = '';

  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  window.history.replaceState({}, document.title, nextUrl);
}

export function formatPendingOAuthCodeError(appLabel, redirectUrl) {
  return formatRedirectAllowListError(appLabel, redirectUrl);
}
