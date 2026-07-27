import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetNotifications,
  getGetNotificationsQueryKey,
} from '@workspace/api-client-react';

function UnreadBadge() {
  const { token } = useAuth();
  const colors = useColors();
  const { data } = useGetNotifications(
    { limit: 30 },
    { query: { enabled: !!token, queryKey: getGetNotificationsQueryKey({ limit: 30 }), refetchInterval: 30000 } }
  );
  const count = data?.unreadCount ?? 0;
  if (count === 0) return null;
  return (
    <View style={{
      position: 'absolute', top: -4, right: -6,
      backgroundColor: colors.destructive, borderRadius: 8,
      minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 3,
    }}>
      <View style={{ /* badge content */ }} />
    </View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'cricket.ball', selected: 'cricket.ball.fill' }} />
        <Label>मैच</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="predictions">
        <Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
        <Label>भविष्यवाणी</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <Icon sf={{ default: 'wallet.pass', selected: 'wallet.pass.fill' }} />
        <Label>वॉलेट</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
        <Label>सूचनाएं</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>प्रोफाइल</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function NotificationsTabIcon({ color, size }: { color: string; size: number }) {
  const { token } = useAuth();
  const colors = useColors();
  const { data } = useGetNotifications(
    { limit: 1 },
    { query: { enabled: !!token, queryKey: getGetNotificationsQueryKey({ limit: 1 }), refetchInterval: 30000 } }
  );
  const unread = data?.unreadCount ?? 0;

  return (
    <View>
      {Platform.OS === 'ios'
        ? <SymbolView name={unread > 0 ? 'bell.badge' : 'bell'} tintColor={color} size={size} />
        : <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={22} color={color} />
      }
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: -3, right: -6,
          backgroundColor: colors.destructive, borderRadius: 7,
          minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' }} />
        </View>
      )}
    </View>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_500Medium',
          marginBottom: isWeb ? 0 : 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'मैच',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="sportscourt" tintColor={color} size={size} /> : <Ionicons name="trophy-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'भविष्यवाणी',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="chart.bar.fill" tintColor={color} size={size} /> : <Ionicons name="analytics-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'वॉलेट',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="wallet.pass" tintColor={color} size={size} /> : <Ionicons name="wallet-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'सूचनाएं',
          tabBarIcon: ({ color, size }) => <NotificationsTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'प्रोफाइल',
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="person" tintColor={color} size={size} /> : <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  if (!token) return <Redirect href="/login" />;

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
