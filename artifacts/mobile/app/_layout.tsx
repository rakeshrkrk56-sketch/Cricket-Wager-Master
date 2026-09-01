import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getGetWalletQueryKey, setBaseUrl } from '@workspace/api-client-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { AvatarProvider } from '@/contexts/AvatarContext';

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
queryClient.setQueryDefaults(getGetWalletQueryKey(), {
  retry: 1,
  staleTime: 0,
  refetchInterval: 5_000,
  refetchOnMount: 'always',
  refetchOnReconnect: true,
});

function RootLayoutNav() {
  const { isLoading: authLoading } = useAuth();
  const { isReady: langReady } = useLanguage();
  const [authStartupTimedOut, setAuthStartupTimedOut] = React.useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setAuthStartupTimedOut(true), 12_000);
    return () => clearTimeout(timeout);
  }, []);

  if ((authLoading && !authStartupTimedOut) || !langReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fb' }}>
        <ActivityIndicator color="#ff7a00" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="support/ticket/[ticketId]" options={{ headerShown: false, presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
    ...Feather.font,
  });
  const [startupTimedOut, setStartupTimedOut] = React.useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStartupTimedOut(true), 3_000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || startupTimedOut) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, startupTimedOut]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError && !startupTimedOut) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AvatarProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AvatarProvider>
            </AuthProvider>
          </QueryClientProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
