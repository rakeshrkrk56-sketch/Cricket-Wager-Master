import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@/contexts/AuthContext';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'cricket.ball', selected: 'cricket.ball.fill' }} fallback={<Ionicons name="trophy-outline" size={22} color="#F47D1C" />} />
        <Label>मैच</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="predictions">
        <Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} fallback={<Ionicons name="analytics-outline" size={22} color="#F47D1C" />} />
        <Label>भविष्यवाणी</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <Icon sf={{ default: 'wallet.pass', selected: 'wallet.pass.fill' }} fallback={<Ionicons name="wallet-outline" size={22} color="#F47D1C" />} />
        <Label>वॉलेट</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} fallback={<Ionicons name="person-outline" size={22} color="#F47D1C" />} />
        <Label>प्रोफाइल</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
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
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'dark'}
              style={StyleSheet.absoluteFill}
            />
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
            isIOS ? (
              <SymbolView name="sportscourt" tintColor={color} size={size} />
            ) : (
              <Ionicons name="trophy-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'भविष्यवाणी',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="analytics-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'वॉलेट',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="wallet.pass" tintColor={color} size={size} />
            ) : (
              <Ionicons name="wallet-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'प्रोफाइल',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={size} />
            ) : (
              <Ionicons name="person-outline" size={22} color={color} />
            ),
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
