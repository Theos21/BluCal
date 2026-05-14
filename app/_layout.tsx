import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useTheme } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RootLayout ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            backgroundColor: '#F4F4F6',
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              marginBottom: 12,
              color: '#0B0B0F',
            }}
          >
            Something went wrong
          </Text>
          <Text style={{ fontSize: 13, color: '#5C5C63', textAlign: 'center' }}>
            {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootNavigator() {
  const t = useTheme();
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    setTimeout(() => {
      if (!session) {
        router.replace('/(auth)/welcome');
        return;
      }
      // New social-auth users get a profile row (via the new-user trigger)
      // but no onboarding data — route them to onboarding until `goal` is
      // set. Email/password signup already routes via that flow itself.
      if (profile && !profile.goal) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    }, 0);
  }, [session, profile, loading]);

  // Deep-link handler for OAuth callbacks and password-recovery links. The
  // primary OAuth success path is handled inline by signInWithGoogle via
  // WebBrowser.openAuthSessionAsync; this is the fallback for cases where
  // the user lands in the app via a fresh deep link (e.g., tapping a magic
  // link or a password-reset email).
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        if (url.includes('type=recovery')) {
          await supabase.auth.exchangeCodeForSession(url);
          // TODO: create app/(auth)/reset-password.tsx — this route does
          // not exist yet, so password recovery links currently land on a
          // missing screen.
          router.replace('/(auth)/reset-password' as never);
          return;
        }
        if (url.includes('code=') || url.includes('access_token=')) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(url);
          if (!error && data.session) router.replace('/(tabs)');
        }
      } catch (e) {
        console.error('Deep link handler error:', e);
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void handleDeepLink(url);
    });

    return () => sub.remove();
  }, [router]);

  if (loading) {
    // theme context may not be ready on cold boot, so the spinner uses
    // hardcoded brand colors instead of useTheme().
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#F4F4F6',
        }}
      >
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="log-food"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="barcode-scanner"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="bluai"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="entry-detail"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="edit-macros" options={{ headerShown: false }} />
        <Stack.Screen name="partner" options={{ headerShown: false }} />
        <Stack.Screen
          name="log-weight"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="feeling"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="custom-food"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="recipe-builder"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="body-measurements"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="edit-goals"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="add-to-plan"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
