import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAdminListDepositsQueryKey,
  getAdminListWithdrawalsQueryKey,
  getGetAdminStatsQueryKey,
  useAdminListDeposits,
  useAdminListWithdrawals,
  useGetAdminStats,
} from '@workspace/api-client-react';

type AdminSection = 'overview' | 'deposits' | 'withdrawals';

function formatCurrency(value?: number) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function StatusPill({ status }: { status: string }) {
  const colors = useColors();
  const color = status === 'approved' ? colors.success : status === 'rejected' ? colors.destructive : colors.warning;
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.statusText, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function MetricCard({ label, value, icon, tone = 'primary' }: {
  label: string;
  value: string;
  icon: string;
  tone?: 'primary' | 'warning' | 'success';
}) {
  const colors = useColors();
  const color = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.primary;
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as never} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function AdminTestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<AdminSection>('overview');

  const isAdmin = user?.role === 'admin';
  const stats = useGetAdminStats({
    query: {
      enabled: !!token && isAdmin,
      queryKey: getGetAdminStatsQueryKey(),
      refetchInterval: 30_000,
    },
  });
  const deposits = useAdminListDeposits(
    { status: 'pending', page: 1, limit: 30 },
    {
      query: {
        enabled: !!token && isAdmin && section === 'deposits',
        queryKey: getAdminListDepositsQueryKey({ status: 'pending', page: 1, limit: 30 }),
        refetchInterval: 30_000,
      },
    },
  );
  const withdrawals = useAdminListWithdrawals(
    { status: 'pending', page: 1, limit: 30 },
    {
      query: {
        enabled: !!token && isAdmin && section === 'withdrawals',
        queryKey: getAdminListWithdrawalsQueryKey({ status: 'pending', page: 1, limit: 30 }),
        refetchInterval: 30_000,
      },
    },
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() }),
    ]);
  }, [queryClient]);

  const pendingDeposits = (deposits.data as any)?.deposits ?? [];
  const pendingWithdrawals = (withdrawals.data as any)?.withdrawals ?? [];
  const activeLoading = section === 'overview' ? stats.isLoading : section === 'deposits' ? deposits.isLoading : withdrawals.isLoading;
  const sectionData = section === 'deposits' ? pendingDeposits : pendingWithdrawals;

  const headerSubtitle = useMemo(() => {
    if (section === 'overview') return 'Read-only testing dashboard';
    if (section === 'deposits') return `${pendingDeposits.length} pending request${pendingDeposits.length === 1 ? '' : 's'}`;
    return `${pendingWithdrawals.length} pending request${pendingWithdrawals.length === 1 ? '' : 's'}`;
  }, [pendingDeposits.length, pendingWithdrawals.length, section]);

  if (authLoading) return null;
  if (!token) {
    router.replace('/login');
    return null;
  }
  if (!isAdmin) {
    return (
      <View style={[styles.accessRoot, { backgroundColor: colors.background, paddingTop: insets.top + 32 }]}>
        <Ionicons name="lock-closed-outline" size={42} color={colors.destructive} />
        <Text style={[styles.accessTitle, { color: colors.foreground }]}>Admin access only</Text>
        <Text style={[styles.accessBody, { color: colors.mutedForeground }]}>
          This test console is available only to accounts with the admin role.
        </Text>
        <TouchableOpacity style={[styles.backAction, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={[styles.backActionText, { color: colors.primaryForeground }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderRequest = ({ item }: { item: any }) => {
    const isDeposit = section === 'deposits';
    const destination = isDeposit
      ? item.utrNumber ? `UTR: ${item.utrNumber}` : item.method === 'manual' ? 'Manual deposit' : 'UPI deposit'
      : item.upiId ? `UPI: ${item.upiId}` : item.bankAccount ? `Bank: ${item.bankAccount.accountNumber} • ${item.bankAccount.ifsc}` : 'Payment method not supplied';
    return (
      <View style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.requestTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.requestAmount, { color: colors.foreground }]}>{formatCurrency(item.amount)}</Text>
            <Text style={[styles.requestUser, { color: colors.foreground }]}>{item.user?.name ?? item.user?.phone ?? item.userId}</Text>
          </View>
          <StatusPill status={item.status} />
        </View>
        <Text style={[styles.requestDetail, { color: colors.mutedForeground }]} numberOfLines={2}>{destination}</Text>
        <Text style={[styles.requestTime, { color: colors.mutedForeground }]}>
          {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>
        <View style={[styles.testingNotice, { backgroundColor: `${colors.warning}18` }]}>
          <Ionicons name="flask-outline" size={14} color={colors.warning} />
          <Text style={[styles.testingNoticeText, { color: colors.warning }]}>Testing mode — no approve or reject controls</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), borderBottomColor: colors.border }]}>
        <TouchableOpacity accessibilityLabel="Back to profile" style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Admin Test</Text>
            <View style={[styles.testBadge, { backgroundColor: `${colors.warning}22` }]}><Text style={[styles.testBadgeText, { color: colors.warning }]}>READ ONLY</Text></View>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{headerSubtitle}</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Refresh admin test data" style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={refresh}>
          <Ionicons name="refresh-outline" size={21} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([
          ['overview', 'Overview', 'grid-outline'],
          ['deposits', 'Deposits', 'arrow-down-circle-outline'],
          ['withdrawals', 'Withdrawals', 'arrow-up-circle-outline'],
        ] as const).map(([key, label, icon]) => (
          <TouchableOpacity key={key} style={[styles.tab, section === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setSection(key)}>
            <Ionicons name={icon} size={16} color={section === key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabText, { color: section === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {section === 'overview' ? (
        stats.isLoading ? (
          <ActivityIndicator style={{ marginTop: 64 }} color={colors.primary} />
        ) : (
          <FlatList
            data={[{ id: 'summary' }]}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={stats.isFetching} onRefresh={refresh} tintColor={colors.primary} />}
            contentContainerStyle={[styles.overviewContent, { paddingBottom: insets.bottom + 24 }]}
            renderItem={() => (
              <>
                <View style={[styles.testCard, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}4D` }]}>
                  <Ionicons name="flask-outline" size={22} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.testCardTitle, { color: colors.foreground }]}>Testing console</Text>
                    <Text style={[styles.testCardBody, { color: colors.mutedForeground }]}>Live admin data is visible here. Actions are intentionally disabled.</Text>
                  </View>
                </View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PENDING QUEUES</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard label="Deposits waiting" value={String(stats.data?.pendingDepositsCount ?? 0)} icon="arrow-down-circle-outline" tone="warning" />
                  <MetricCard label="Withdrawals waiting" value={String(stats.data?.pendingWithdrawalsCount ?? 0)} icon="arrow-up-circle-outline" tone="warning" />
                </View>
                <View style={styles.metricsGrid}>
                  <MetricCard label="Deposit value" value={formatCurrency(stats.data?.pendingDepositsAmount)} icon="cash-outline" tone="success" />
                  <MetricCard label="Withdrawal value" value={formatCurrency(stats.data?.pendingWithdrawalsAmount)} icon="wallet-outline" tone="warning" />
                </View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LIVE PLATFORM</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard label="Active users" value={String(stats.data?.activeUsers ?? 0)} icon="people-outline" />
                  <MetricCard label="Live matches" value={String(stats.data?.liveMatches ?? 0)} icon="radio-outline" tone="success" />
                </View>
                <View style={styles.metricsGrid}>
                  <MetricCard label="Today deposits" value={formatCurrency(stats.data?.todayDeposits)} icon="trending-down-outline" tone="success" />
                  <MetricCard label="Today withdrawals" value={formatCurrency(stats.data?.todayWithdrawals)} icon="trending-up-outline" />
                </View>
              </>
            )}
          />
        )
      ) : activeLoading ? (
        <ActivityIndicator style={{ marginTop: 64 }} color={colors.primary} />
      ) : (
        <FlatList
          data={sectionData}
          keyExtractor={(item: any) => item.id}
          renderItem={renderRequest}
          refreshControl={<RefreshControl refreshing={section === 'deposits' ? deposits.isFetching : withdrawals.isFetching} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={section === 'deposits' ? 'checkmark-done-circle-outline' : 'shield-checkmark-outline'} size={48} color={colors.success} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing pending</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>There are no pending {section} to review right now.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  iconButton: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 21, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  testBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  testBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: .5 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 13 },
  tabText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  overviewContent: { padding: 16 },
  testCard: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  testCardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', fontWeight: '700', marginBottom: 3 },
  testCardBody: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: 1, marginBottom: 9, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: { flex: 1, backgroundColor: '#131E2F', borderRadius: 12, padding: 13, minHeight: 122 },
  metricIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricValue: { fontSize: 19, fontFamily: 'Inter_700Bold', fontWeight: '700', color: '#F3F8FD' },
  metricLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#8EA3BC', marginTop: 4, lineHeight: 15 },
  listContent: { padding: 16, gap: 10 },
  requestCard: { borderWidth: 1, borderRadius: 14, padding: 15 },
  requestTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  requestAmount: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  requestUser: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  requestDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 11 },
  requestTime: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 5 },
  statusPill: { borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 9, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  testingNotice: { flexDirection: 'row', gap: 6, alignItems: 'center', padding: 9, borderRadius: 8, marginTop: 12 },
  testingNoticeText: { fontSize: 11, fontFamily: 'Inter_500Medium', flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 28, gap: 9 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  emptyBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  accessRoot: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  accessTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700', marginTop: 16 },
  accessBody: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  backAction: { marginTop: 24, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  backActionText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});