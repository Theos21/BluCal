import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
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
  const redirectTo = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL returned from Supabase');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  // User dismissed/cancelled the browser — return silently. Other social
  // handlers follow the same convention.
  if (result.type !== 'success') return;

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    result.url,
  );
  if (exchangeError) throw exchangeError;
};
