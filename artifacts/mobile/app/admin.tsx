import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAdminListDepositsQueryKey, getAdminListSupportTicketsQueryKey,
  getAdminListWithdrawalsQueryKey, getGetAdminStatsQueryKey,
  getAdminGetSupportTicketQueryKey, getGetUserQueryKey, getListUsersQueryKey,
  useAdminAdjustWallet, useAdminGetSupportTicket, useAdminListDeposits,
  useAdminListSupportTickets, useAdminListWithdrawals, useAdminReplyToTicket,
  useAdminUpdateTicketStatus, useApproveDeposit, useApproveWithdrawal,
  useGetAdminStats, useGetUser, useListUsers, useRejectDeposit, useRejectWithdrawal,
} from '@workspace/api-client-react';

type Section = 'home' | 'deposits' | 'withdrawals' | 'users' | 'support';
const money = (value?: number) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
const shortDate = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const errorText = (error: any) => error?.data?.error ?? error?.message ?? 'Please try again.';

function Gate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !token) router.replace('/login');
  }, [isLoading, token]);
  if (isLoading || !token) return null;
  if (user?.role !== 'admin') {
    return (
      <View style={[s.gate, { backgroundColor: colors.background, paddingTop: insets.top + 50 }]}>
        <Ionicons name="lock-closed-outline" color={colors.destructive} size={44} />
        <Text style={[s.gateTitle, { color: colors.foreground }]}>Admin access only</Text>
        <Text style={[s.gateText, { color: colors.mutedForeground }]}>Your account is not authorized to access operations.</Text>
        <TouchableOpacity style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={[s.primaryText, { color: colors.primaryForeground }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <>{children}</>;
}

function Status({ value }: { value: string }) {
  const colors = useColors();
  const color = value === 'approved' || value === 'active' || value === 'open'
    ? colors.success
    : value === 'rejected' || value === 'cancelled' || value === 'closed'
      ? colors.destructive
      : colors.warning;
  return <View style={[s.pill, { backgroundColor: `${color}22` }]}><Text style={[s.pillText, { color }]}>{value.replace('_', ' ').toUpperCase()}</Text></View>;
}

function Empty({ icon, title, body }: { icon: any; title: string; body: string }) {
  const colors = useColors();
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={45} color={colors.success} />
      <Text style={[s.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[s.emptyText, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

export default function AdminWorkspace() {
  return <Gate><AdminWorkspaceContent /></Gate>;
}

function AdminWorkspaceContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [section, setSection] = useState<Section>('home');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [userSearch, setUserSearch] = useState('');
  const [remark, setRemark] = useState('');
  const [reply, setReply] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [walletType, setWalletType] = useState<'credit' | 'debit'>('credit');

  const stats = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), refetchInterval: 30000 } });
  const deposits = useAdminListDeposits(
    { status: 'pending', page: 1, limit: 30 } as any,
    { query: { enabled: section === 'deposits', queryKey: getAdminListDepositsQueryKey({ status: 'pending', page: 1, limit: 30 } as any), refetchInterval: 30000 } },
  );
  const withdrawals = useAdminListWithdrawals(
    { status: 'pending', page: 1, limit: 30 } as any,
    { query: { enabled: section === 'withdrawals', queryKey: getAdminListWithdrawalsQueryKey({ status: 'pending', page: 1, limit: 30 } as any), refetchInterval: 30000 } },
  );
  const users = useListUsers({ page: 1, limit: 30, search: userSearch || undefined });
  const userDetail = useGetUser(selectedUser?.id ?? '', { query: { enabled: !!selectedUser?.id, queryKey: getGetUserQueryKey(selectedUser?.id ?? '') } });
  const tickets = useAdminListSupportTickets(
    { page: 1, limit: 30 } as any,
    { query: { enabled: section === 'support', queryKey: getAdminListSupportTicketsQueryKey({ page: 1, limit: 30 } as any), refetchInterval: 30000 } },
  );
  const ticketDetail = useAdminGetSupportTicket(selectedTicket?.id ?? '', { query: { enabled: !!selectedTicket?.id, queryKey: getAdminGetSupportTicketQueryKey(selectedTicket?.id ?? '') } });

  const approveDeposit = useApproveDeposit();
  const rejectDeposit = useRejectDeposit();
  const approveWithdrawal = useApproveWithdrawal();
  const rejectWithdrawal = useRejectWithdrawal();
  const adjustWallet = useAdminAdjustWallet();
  const replyTicket = useAdminReplyToTicket();
  const updateTicket = useAdminUpdateTicketStatus();

  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }),
      client.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() }),
      client.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() }),
      client.invalidateQueries({ queryKey: getListUsersQueryKey() }),
      client.invalidateQueries({ queryKey: getAdminListSupportTicketsQueryKey() }),
    ]);
  }, [client]);
  const successRefresh = useCallback((message: string) => { refresh(); Alert.alert('Updated', message); }, [refresh]);
  const confirm = (title: string, body: string, action: () => void, destructive = false) => Alert.alert(
    title, body, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: destructive ? 'destructive' : 'default', onPress: action }],
  );

  const titles: Record<Section, [string, string]> = {
    home: ['Admin workspace', 'Account and payment operations'],
    deposits: ['Deposits', 'Pending requests'],
    withdrawals: ['Withdrawals', 'Pending requests'],
    users: ['Users', 'Search accounts and wallets'],
    support: ['Support', 'Open customer tickets'],
  };
  const nav: [Section, string, any][] = [
    ['home', 'Home', 'grid-outline'],
    ['deposits', 'Deposits', 'arrow-down-circle-outline'],
    ['withdrawals', 'Withdrawals', 'arrow-up-circle-outline'],
    ['users', 'Users', 'people-outline'],
    ['support', 'Support', 'chatbubbles-outline'],
  ];

  const queueAction = (kind: 'deposit' | 'withdrawal', item: any, outcome: 'approve' | 'reject') => {
    const mutation = kind === 'deposit'
      ? (outcome === 'approve' ? approveDeposit : rejectDeposit)
      : (outcome === 'approve' ? approveWithdrawal : rejectWithdrawal);
    const remarks = remark.trim();
    if (outcome === 'reject' && !remarks) {
      Alert.alert('Remark required', 'Add a reason before rejecting this request.');
      return;
    }
    confirm(
      `${outcome === 'approve' ? 'Approve' : 'Reject'} ${kind}?`,
      `${money(item.amount)} for ${item.user?.phone ?? item.userId}. This changes the request status${outcome === 'approve' && kind === 'deposit' ? ' and credits the wallet' : ''}.`,
      () => mutation.mutate(
        { [`${kind}Id`]: item.id, data: { remarks: remarks || undefined } } as any,
        {
          onSuccess: () => { setRemark(''); successRefresh(`${kind[0].toUpperCase() + kind.slice(1)} ${outcome}d.`); },
          onError: (e: any) => Alert.alert('Action failed', errorText(e)),
        },
      ),
      outcome === 'reject',
    );
  };

  const renderQueue = (kind: 'deposit' | 'withdrawal', data: any[], loading: boolean) => (
    <FlatList
      data={data}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 84 }]}
      ListHeaderComponent={<TextInput value={remark} onChangeText={setRemark} placeholder="Optional approval note · required to reject" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />}
      ListEmptyComponent={!loading ? <Empty icon="checkmark-done-circle-outline" title="Nothing pending" body={`There are no pending ${kind}s right now.`} /> : <ActivityIndicator color={colors.primary} />}
      renderItem={({ item }) => (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Text style={[s.amount, { color: colors.foreground }]}>{money(item.amount)}</Text><Text style={[s.cardTitle, { color: colors.foreground }]}>{item.user?.name ?? item.user?.phone ?? item.userId}</Text></View>
            <Status value={item.status} />
          </View>
          <Text style={[s.detail, { color: colors.mutedForeground }]}>{kind === 'deposit' ? item.utrNumber ? `UTR: ${item.utrNumber}` : item.method ?? 'Payment method not supplied' : item.upiId ? `UPI: ${item.upiId}` : item.bankAccount ? `Bank: ${item.bankAccount.accountNumber} · ${item.bankAccount.ifsc}` : 'Destination not supplied'}</Text>
          <Text style={[s.detail, { color: colors.mutedForeground }]}>{shortDate(item.createdAt)}</Text>
          <View style={s.actions}>
            <TouchableOpacity style={[s.action, { backgroundColor: `${colors.success}22` }]} onPress={() => queueAction(kind, item, 'approve')}><Text style={{ color: colors.success }}>Approve</Text></TouchableOpacity>
            <TouchableOpacity style={[s.action, { backgroundColor: `${colors.destructive}22` }]} onPress={() => queueAction(kind, item, 'reject')}><Text style={{ color: colors.destructive }}>Reject</Text></TouchableOpacity>
          </View>
        </View>
      )}
    />
  );

  const userView = selectedUser ? (
    <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 84 }]}>
      <TouchableOpacity onPress={() => setSelectedUser(null)}><Text style={[s.link, { color: colors.primary }]}>‹ All users</Text></TouchableOpacity>
      {userDetail.isLoading ? <ActivityIndicator color={colors.primary} /> : (
        <>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>{userDetail.data?.name || 'Unnamed user'}</Text>
            <Text style={[s.detail, { color: colors.mutedForeground }]}>{userDetail.data?.phone}</Text>
            <Text style={[s.amount, { color: colors.primary }]}>{money(userDetail.data?.walletBalance)}</Text>
            <Status value={userDetail.data?.status ?? 'active'} />
          </View>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Wallet adjustment</Text>
            <View style={s.actions}>
              <TouchableOpacity style={[s.action, walletType === 'credit' && { backgroundColor: `${colors.success}22` }]} onPress={() => setWalletType('credit')}><Text style={{ color: colors.success }}>Credit</Text></TouchableOpacity>
              <TouchableOpacity style={[s.action, walletType === 'debit' && { backgroundColor: `${colors.destructive}22` }]} onPress={() => setWalletType('debit')}><Text style={{ color: colors.destructive }}>Debit</Text></TouchableOpacity>
            </View>
            <TextInput value={walletAmount} keyboardType="decimal-pad" onChangeText={setWalletAmount} placeholder="Amount" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, borderColor: colors.border }]} />
            <TextInput value={walletReason} onChangeText={setWalletReason} placeholder="Reason (required)" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, borderColor: colors.border }]} />
            <TouchableOpacity style={[s.primaryButton, { backgroundColor: walletType === 'credit' ? colors.success : colors.destructive }]} onPress={() => {
              const amount = Number(walletAmount);
              if (!amount || amount < 1 || !walletReason.trim()) { Alert.alert('Enter amount and reason', 'A valid amount and a reason are required.'); return; }
              confirm(`Confirm ${walletType}`, `${walletType === 'credit' ? 'Credit' : 'Debit'} ${money(amount)} ${walletType === 'credit' ? 'to' : 'from'} ${userDetail.data?.phone}. This is logged and cannot be undone.`, () => adjustWallet.mutate(
                { userId: selectedUser.id, data: { type: walletType, amount, reason: walletReason.trim() } },
                { onSuccess: (result) => { setWalletAmount(''); setWalletReason(''); client.invalidateQueries({ queryKey: getGetUserQueryKey(selectedUser.id) }); Alert.alert('Wallet updated', `New balance: ${money(result.balanceAfter)}`); }, onError: (e: any) => Alert.alert('Adjustment failed', errorText(e)) },
              ), walletType === 'debit');
            }}><Text style={[s.primaryText, { color: colors.primaryForeground }]}>{walletType === 'credit' ? 'Credit wallet' : 'Debit wallet'}</Text></TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  ) : (
    <FlatList
      data={users.data?.users ?? []}
      keyExtractor={(i) => i.id}
      contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 84 }]}
      refreshControl={<RefreshControl refreshing={users.isFetching} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={<TextInput value={userSearch} onChangeText={setUserSearch} placeholder="Search phone number" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelectedUser(item)}>
          <View style={s.row}><View><Text style={[s.cardTitle, { color: colors.foreground }]}>{item.name || item.phone}</Text><Text style={[s.detail, { color: colors.mutedForeground }]}>{item.phone}</Text></View><Text style={[s.amountSmall, { color: colors.primary }]}>{money(item.walletBalance)}</Text></View>
          <Status value={item.status} />
        </TouchableOpacity>
      )}
    />
  );

  const supportView = selectedTicket ? (
    <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 84 }]}>
      <TouchableOpacity onPress={() => setSelectedTicket(null)}><Text style={[s.link, { color: colors.primary }]}>‹ All tickets</Text></TouchableOpacity>
      {ticketDetail.isLoading ? <ActivityIndicator color={colors.primary} /> : (
        <>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>{ticketDetail.data?.ticket.subject}</Text>
            <Text style={[s.detail, { color: colors.mutedForeground }]}>{ticketDetail.data?.ticket.description}</Text>
            <Status value={ticketDetail.data?.ticket.status ?? 'open'} />
          </View>
          {ticketDetail.data?.messages.map((m: any) => <View key={m.id} style={[s.message, { backgroundColor: m.isAdmin ? `${colors.primary}24` : colors.card, borderColor: colors.border }]}><Text style={[s.detail, { color: colors.foreground }]}>{m.message}</Text><Text style={[s.tiny, { color: colors.mutedForeground }]}>{m.isAdmin ? 'Admin' : 'Customer'} · {shortDate(m.createdAt)}</Text></View>)}
          <TextInput value={reply} onChangeText={setReply} multiline placeholder="Write a reply" placeholderTextColor={colors.mutedForeground} style={[s.input, s.multiline, { color: colors.foreground, borderColor: colors.border }]} />
          <TouchableOpacity style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={() => { if (!reply.trim()) return; replyTicket.mutate({ ticketId: selectedTicket.id, data: { message: reply.trim() } }, { onSuccess: () => { setReply(''); client.invalidateQueries({ queryKey: getAdminListSupportTicketsQueryKey() }); ticketDetail.refetch(); }, onError: (e: any) => Alert.alert('Reply failed', errorText(e)) }); }}><Text style={[s.primaryText, { color: colors.primaryForeground }]}>Send reply</Text></TouchableOpacity>
          <View style={s.actions}>{(['in_progress', 'resolved', 'closed'] as const).map(status => <TouchableOpacity key={status} style={[s.action, { backgroundColor: `${colors.primary}20` }]} onPress={() => confirm('Update ticket', `Mark this ticket as ${status.replace('_', ' ')}?`, () => updateTicket.mutate({ ticketId: selectedTicket.id, data: { status } }, { onSuccess: () => { ticketDetail.refetch(); refresh(); }, onError: (e: any) => Alert.alert('Update failed', errorText(e)) }))}><Text style={{ color: colors.primary }}>{status.replace('_', ' ')}</Text></TouchableOpacity>)}</View>
        </>
      )}
    </ScrollView>
  ) : (
    <FlatList data={tickets.data?.tickets ?? []} keyExtractor={(i) => i.id} contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 84 }]} refreshControl={<RefreshControl refreshing={tickets.isFetching} onRefresh={refresh} tintColor={colors.primary} />} renderItem={({ item }: any) => <TouchableOpacity style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelectedTicket(item)}><View style={s.row}><View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: colors.foreground }]}>{item.subject}</Text><Text style={[s.detail, { color: colors.mutedForeground }]}>{item.user?.phone ?? item.userId} · {item.category}</Text></View><Status value={item.status} /></View></TouchableOpacity>} />
  );

  const home = (
    <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 84 }]} refreshControl={<RefreshControl refreshing={stats.isFetching} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={[s.notice, { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}44` }]}><Ionicons name="shield-checkmark-outline" color={colors.primary} size={23} /><Text style={[s.detail, { color: colors.foreground, flex: 1 }]}>Every sensitive request is authorized by the server and requires a confirmation here.</Text></View>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PENDING QUEUES</Text>
      <View style={s.metrics}><Metric colors={colors} label="Deposits" value={String(stats.data?.pendingDepositsCount ?? 0)} onPress={() => setSection('deposits')} /><Metric colors={colors} label="Withdrawals" value={String(stats.data?.pendingWithdrawalsCount ?? 0)} onPress={() => setSection('withdrawals')} /></View>
      <View style={s.metrics}><Metric colors={colors} label="Deposit value" value={money(stats.data?.pendingDepositsAmount)} /><Metric colors={colors} label="Withdrawal value" value={money(stats.data?.pendingWithdrawalsAmount)} /></View>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PLATFORM</Text>
      <View style={s.metrics}><Metric colors={colors} label="Active users" value={String(stats.data?.activeUsers ?? 0)} onPress={() => setSection('users')} /><Metric colors={colors} label="Registered users" value={String(stats.data?.totalUsers ?? 0)} onPress={() => setSection('users')} /></View>
    </ScrollView>
  );

  const content = section === 'home'
    ? home
    : section === 'deposits'
      ? renderQueue('deposit', (deposits.data as any)?.deposits ?? [], deposits.isLoading)
      : section === 'withdrawals'
        ? renderQueue('withdrawal', (withdrawals.data as any)?.withdrawals ?? [], withdrawals.isLoading)
        : section === 'users' ? userView : supportView;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 65 : 12), borderBottomColor: colors.border }]}>
        <TouchableOpacity accessibilityLabel="Back to profile" style={[s.circle, { backgroundColor: colors.card }]} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={[s.headerTitle, { color: colors.foreground }]}>{titles[section][0]}</Text><Text style={[s.headerSub, { color: colors.mutedForeground }]}>{titles[section][1]}</Text></View>
        <TouchableOpacity accessibilityLabel="Refresh" style={[s.circle, { backgroundColor: colors.card }]} onPress={refresh}><Ionicons name="refresh-outline" size={20} color={colors.primary} /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.nav, { borderBottomColor: colors.border }]} contentContainerStyle={s.navInner}>
        {nav.map(([key, label, icon]) => <TouchableOpacity key={key} style={[s.navItem, section === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => { setSection(key); setSelectedUser(null); setSelectedTicket(null); }}><Ionicons name={icon} size={16} color={section === key ? colors.primary : colors.mutedForeground} /><Text style={[s.navLabel, { color: section === key ? colors.primary : colors.mutedForeground }]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
      {content}
    </View>
  );
}

function Metric({ colors, label, value, onPress }: { colors: any; label: string; value: string; onPress?: () => void }) {
  const inner = <><Text style={[s.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[s.metricLabel, { color: colors.mutedForeground }]}>{label}</Text></>;
  return onPress ? <TouchableOpacity style={[s.metric, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>{inner}</TouchableOpacity> : <View style={[s.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>{inner}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, gate: { flex: 1, alignItems: 'center', paddingHorizontal: 30 }, gateTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 15 }, gateText: { textAlign: 'center', lineHeight: 20, marginTop: 7, fontFamily: 'Inter_400Regular' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 13, borderBottomWidth: 1 }, circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' }, headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  nav: { maxHeight: 52, borderBottomWidth: 1 }, navInner: { paddingHorizontal: 8 }, navItem: { flexDirection: 'row', gap: 5, paddingHorizontal: 11, paddingVertical: 15, alignItems: 'center' }, navLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16, gap: 10 }, card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' }, amount: { fontSize: 22, fontFamily: 'Inter_700Bold' }, amountSmall: { fontSize: 15, fontFamily: 'Inter_700Bold' }, detail: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' }, tiny: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  pill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }, pillText: { fontSize: 9, fontFamily: 'Inter_700Bold' }, actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }, action: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter_400Regular' }, multiline: { minHeight: 82, textAlignVertical: 'top' }, primaryButton: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 10, paddingVertical: 13, marginTop: 8 }, primaryText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8, paddingHorizontal: 26 }, emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' }, emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' }, link: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 }, message: { borderWidth: 1, borderRadius: 11, padding: 11, gap: 5 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 12, padding: 13 }, sectionTitle: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginTop: 10 }, metrics: { flexDirection: 'row', gap: 10 }, metric: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 13, minHeight: 88, justifyContent: 'center' }, metricValue: { fontSize: 19, fontFamily: 'Inter_700Bold' }, metricLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 5 },
});