import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from './supabase';

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

export const signInWithGoogle = async (): Promise<void> => {
  // Dynamic import keeps Google Sign-In code out of bundles where it isn't
  // exercised (e.g. tests, web preview) — the native module is only present
  // in dev/production builds.
  const { GoogleSignin } = await import(
    '@react-native-google-signin/google-signin'
  );

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;
  if (!idToken) throw new Error('No ID token from Google');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
};
