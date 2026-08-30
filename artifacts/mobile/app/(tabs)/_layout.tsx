import React, { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { BlurView } from 'expo-blur';
import { Tabs, useGlobalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const { t } = useLanguage();
  const { game } = useGlobalSearchParams<{ game?: string }>();
  const isGameOpen = game === 'dragon-tiger';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          display: isGameOpen ? 'none' : 'flex',
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint={isDark ? 'dark' : 'dark'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: isWeb ? 0 : 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home'),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('tab_wallet'),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tab_notifications'),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: t('tab_support'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab_profile'),
        }}
      />
    </Tabs>
  );
}
export default function TabLayout() {
  const { isLoading, token } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !token) router.replace('/login');
  }, [isLoading, router, token]);
  if (isLoading || !token) return null;
  return <ClassicTabLayout />;
}
