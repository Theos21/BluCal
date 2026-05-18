import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { sessionState } from './sessionState';
import { supabase } from './supabase';

// Closes the OAuth web browser session immediately when the redirect URI is
// hit. Without this the in-app browser stays open after the callback.
WebBrowser.maybeCompleteAuthSession();

export const signInWithApple = async (): Promise<void> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign In is only available on iOS');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  // Apple only returns the name on first sign-in — persist it to profile if
  // present so the user isn't left with a blank name.
  if (credential.fullName?.givenName) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const name = [
        credential.fullName.givenName,
        credential.fullName.familyName,
      ]
        .filter(Boolean)
        .join(' ');
      await supabase.from('profiles').update({ name }).eq('id', user.id);
      // Record the name in session state so onboarding can hide the name
      // field immediately, without waiting for the profile row to reload.
      sessionState.setAppleSignInName(name);
    }
  }
};

// Google sign-in via Supabase-mediated OAuth.
//
// Google's Web OAuth client type only allows http(s) redirect URIs, so we
// can't redirect from Google directly to a `blucal://` scheme. Instead:
//   1. Supabase generates an authorization URL pointing at Google with
//      Supabase's HTTPS callback as the redirect.
//   2. We open that URL in the in-app browser.
//   3. Google redirects back to Supabase's HTTPS callback.
//   4. Supabase issues a session code and redirects to our `blucal://`
//      scheme (set in `options.redirectTo`).
//   5. We exchange the code for a session via PKCE.
//
// This sidesteps client-side nonce handling entirely — Supabase performs
// the nonce flow with Google on its end.
export const signInWithGoogle = async (): Promise<void> => {
  const redirectTo = 'blucal:///';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success' && result.url) {
    // With implicit flow tokens come in URL fragment
    const url = result.url;
    const { error: sessionError } =
      await supabase.auth.exchangeCodeForSession(url);
    if (sessionError) {
      // Try parsing fragment manually if exchangeCodeForSession fails
      const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        const { error: setError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (setError) throw setError;
      } else {
        throw sessionError;
      }
    }
  } else if (result.type === 'cancel' || result.type === 'dismiss') {
    return;
  }
};
