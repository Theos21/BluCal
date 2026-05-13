import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/AuthContext';

function RootNavigator() {
  const t = useTheme();
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    setTimeout(() => {
      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
    }, 0);
  }, [session, loading]);

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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
