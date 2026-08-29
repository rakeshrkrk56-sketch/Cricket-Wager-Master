import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGetWallet, getGetWalletQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const liveBalance = Number(walletData?.balance ?? user?.walletBalance ?? 0);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{t('home_greeting', user?.name ?? '👋')}</Text>
          <Text style={s.subtitle}>Manage your account and wallet</Text>
        </View>
        <TouchableOpacity style={s.walletBadge} onPress={() => router.push('/(tabs)/wallet')} activeOpacity={0.8}>
          <Ionicons name="wallet-outline" size={14} color={colors.primary} />
          <Text style={s.walletText}>₹{liveBalance.toFixed(0)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Available wallet balance</Text>
          {walletData ? <Text style={s.balance}>₹{liveBalance.toFixed(2)}</Text> : <ActivityIndicator color={colors.primaryForeground} />}
          <TouchableOpacity style={s.primaryButton} onPress={() => router.push('/(tabs)/wallet')} activeOpacity={0.85}>
            <Ionicons name="wallet-outline" size={18} color={colors.primaryForeground} />
            <Text style={s.primaryButtonText}>Open wallet</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Account & payments</Text>
        <View style={s.actionGrid}>
          <QuickAction icon="arrow-down-circle-outline" label="Deposit" onPress={() => router.push('/(tabs)/wallet')} colors={colors} />
          <QuickAction icon="arrow-up-circle-outline" label="Withdraw" onPress={() => router.push('/(tabs)/wallet')} colors={colors} />
          <QuickAction icon="notifications-outline" label="Notifications" onPress={() => router.push('/(tabs)/notifications')} colors={colors} />
          <QuickAction icon="headset-outline" label="Support" onPress={() => router.push('/(tabs)/support')} colors={colors} />
        </View>

        <View style={s.notice}>
          <Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} />
          <Text style={s.noticeText}>
            Your account, wallet balance, deposits, withdrawals and verification history stay linked to this login.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon, label, onPress, colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const s = actionStyles(colors);
  return (
    <TouchableOpacity style={s.action} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={23} color={colors.primary} />
      <Text style={s.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const actionStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  action: {
    width: '47%',
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    justifyContent: 'space-between',
  },
  actionText: { fontSize: 13, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
});

const styles = (colors: ReturnType<typeof useColors>, insets: { top: number; bottom: number }) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 2, fontFamily: 'Inter_400Regular' },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletText: { fontSize: 14, fontWeight: '600' as const, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  content: {
    paddingHorizontal: 20,
    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
    gap: 18,
  },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 18, padding: 20, gap: 10 },
  balanceLabel: { color: colors.primaryForeground, fontSize: 13, fontFamily: 'Inter_500Medium' },
  balance: { color: colors.primaryForeground, fontSize: 30, fontFamily: 'Inter_700Bold' },
  primaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryForeground + '22',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: colors.primaryForeground, fontSize: 13, fontFamily: 'Inter_700Bold' },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  notice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
  },
  noticeText: { flex: 1, color: colors.mutedForeground, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
});