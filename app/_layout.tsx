import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useTheme } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

// Hold the native splash on screen until RootNavigator has resolved the
// cached auth state and is ready to render the real destination. This must
// run at module scope, before the splash would otherwise auto-hide.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
    // A crash before RootNavigator resolves would otherwise leave the native
    // splash stuck on top of this error screen.
    SplashScreen.hideAsync().catch(() => {});
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
  const { session, profile, isReady, refreshProfile } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      router.replace('/(auth)/welcome');
      return;
    }
    if (profile === undefined) return; // profile still loading in the background
    if (profile === null || !profile.goal) {
      router.replace('/(auth)/onboarding');
      return;
    }
    router.replace('/(tabs)');
  }, [session, profile, isReady, router]);

  // Hand the native splash off directly to the app once it can render its
  // real destination screen. A returning user with a cached session keeps the
  // splash up until the background profile fetch resolves, so they go straight
  // from splash to app with no white screen and no spinner. Logged-out users
  // hand off as soon as the cached session check resolves.
  useEffect(() => {
    if (isReady && (!session || profile !== undefined)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, session, profile]);

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
          router.replace('/(auth)/reset-password');
          return;
        }
        if (url.includes('code=') || url.includes('access_token=')) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(url);
          if (!error && data.session) {
            await refreshProfile();
            // routing handled by the useEffect above
          }
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
  }, [router, refreshProfile]);

  if (!isReady || (session && profile === undefined)) {
    // Cold-boot loading state. The theme context may not be ready yet, so it
    // uses the hardcoded dark app background — matching app.json's splash
    // backgroundColor — so the splash -> app handoff has no white flash.
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#18191D',
        }}
      >
        <ActivityIndicator size="large" color="#4F95DC" />
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
