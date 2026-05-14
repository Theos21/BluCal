import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Closes the OAuth web browser session immediately when the redirect URI is
// hit. Without this the in-app browser stays open after Google returns the
// id_token.
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

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export const signInWithGoogle = async (): Promise<void> => {
  // OIDC nonce: client generates a random value, hashes it, sends the HASH
  // to Google as the request `nonce`; Google embeds that hash in the id_token
  // it returns. We then send the RAW value to Supabase, which hashes it
  // server-side and verifies the hash matches the token's nonce claim.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  // Web client ID, not iOS — iOS OAuth clients don't accept custom redirect
  // URIs in Google Cloud Console; only Web clients do. Supabase's Google
  // provider needs this client ID listed under "Authorized Client IDs" so
  // the id_token's `aud` verifies.
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set');
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'blucal' });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: false,
    extraParams: {
      nonce: hashedNonce,
    },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);

  if (result.type !== 'success') {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error('Google sign in was cancelled or failed');
  }

  const idToken = result.params?.id_token;
  if (!idToken) throw new Error('No ID token returned from Google');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
};
