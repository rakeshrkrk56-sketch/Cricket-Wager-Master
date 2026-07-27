import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { Redirect, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TouchableOpacity, Linking, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Set base URL for all API calls (Expo bundles run outside the proxy)
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const WHATSAPP_NUMBER = '919876543210';

function FloatingWhatsAppButton() {
  const { token } = useAuth();
  const pathname = usePathname();
  // Don't show on login screen
  if (!token) return null;
  const openWhatsApp = () => {
    const msg = encodeURIComponent('Hello, I need help regarding my account.');
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`);
  };
  return (
    <TouchableOpacity style={fabStyles.fab} onPress={openWhatsApp} activeOpacity={0.85}>
      <Ionicons name="logo-whatsapp" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
});

function RootLayoutNav() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="match/[matchId]"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="support/ticket/[ticketId]"
          options={{ headerShown: false, presentation: 'card' }}
        />
      </Stack>
      <FloatingWhatsAppButton />
    </View>
  );
}

function AuthGate() {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  if (!token) return <Redirect href="/login" />;
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
