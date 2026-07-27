import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetWallet, getGetWalletQueryKey,
  useGetTransactions, getGetTransactionsQueryKey,
  useDepositWallet, useWithdrawWallet,
} from '@workspace/api-client-react';

const TX_CONFIG: Record<string, { label: string; icon: string; positive: boolean }> = {
  deposit: { label: 'जमा', icon: 'arrow-down-circle', positive: true },
  withdraw: { label: 'निकासी', icon: 'arrow-up-circle', positive: false },
  win: { label: 'जीत', icon: 'trophy', positive: true },
  loss: { label: 'लगाया', icon: 'remove-circle', positive: false },
  bonus: { label: 'बोनस', icon: 'gift', positive: true },
  refund: { label: 'वापसी', icon: 'refresh-circle', positive: true },
};

function TxItem({ item }: { item: any }) {
  const colors = useColors();
  const cfg = TX_CONFIG[item.type] || { label: item.type, icon: 'ellipse', positive: true };
  const amt = Number(item.amount);
  return (
    <View style={txStyles(colors).row}>
      <View style={[txStyles(colors).icon, { backgroundColor: cfg.positive ? colors.success + '20' : colors.destructive + '20' }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.positive ? colors.success : colors.destructive} />
      </View>
      <View style={txStyles(colors).info}>
        <Text style={txStyles(colors).label}>{cfg.label}</Text>
        {item.note && <Text style={txStyles(colors).note} numberOfLines={1}>{item.note}</Text>}
        <Text style={txStyles(colors).time}>{new Date(item.createdAt).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
      </View>
      <View style={txStyles(colors).amtCol}>
        <Text style={[txStyles(colors).amt, { color: cfg.positive ? colors.success : colors.destructive }]}>
          {cfg.positive ? '+' : '-'}₹{amt.toFixed(0)}
        </Text>
        <Text style={txStyles(colors).balance}>₹{Number(item.balanceAfter).toFixed(0)}</Text>
      </View>
    </View>
  );
}

const txStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  note: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  time: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  amtCol: { alignItems: 'flex-end' },
  amt: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  balance: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
});

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');

  const { data: wallet, isLoading: walletLoading } = useGetWallet({ query: { enabled: !!token, queryKey: getGetWalletQueryKey() } });
  const { data: txData, isLoading: txLoading } = useGetTransactions({}, { query: { enabled: !!token, queryKey: getGetTransactionsQueryKey({}) } });
  const deposit = useDepositWallet();
  const withdraw = useWithdrawWallet();

  const handleTransaction = () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) { Alert.alert('अमान्य राशि', 'सही राशि दर्ज करें'); return; }
    const action = modal === 'deposit' ? deposit : withdraw;
    action.mutate({ data: { amount: amt } }, {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (user) updateUser({ ...user, walletBalance: data.balance });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey({}) });
        setModal(null);
        setAmount('');
      },
      onError: (err: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('त्रुटि', err?.data?.error ?? 'लेनदेन नहीं हो सका');
      },
    });
  };

  const s = styles(colors, insets);
  const balance = wallet?.balance ?? user?.walletBalance ?? 0;
  const transactions = txData?.transactions ?? [];

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>वॉलेट</Text>
      </View>

      {/* Balance Card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>कुल बैलेंस</Text>
        {walletLoading
          ? <ActivityIndicator color={colors.primaryForeground} />
          : <Text style={s.balance}>₹{balance.toFixed(2)}</Text>
        }
        <View style={s.cardActions}>
          <TouchableOpacity style={s.cardBtn} onPress={() => setModal('deposit')} activeOpacity={0.85}>
            <Ionicons name="arrow-down-circle" size={18} color={colors.primaryForeground} />
            <Text style={s.cardBtnText}>जमा करें</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.cardBtn} onPress={() => setModal('withdraw')} activeOpacity={0.85}>
            <Ionicons name="arrow-up-circle" size={18} color={colors.primaryForeground} />
            <Text style={s.cardBtnText}>निकालें</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats row */}
      {wallet && (
        <View style={s.statsRow}>
          {[
            { label: 'कुल जमा', value: wallet.depositTotal, icon: 'arrow-down', positive: true },
            { label: 'कुल निकासी', value: wallet.withdrawTotal, icon: 'arrow-up', positive: false },
            { label: 'जीत', value: wallet.winTotal, icon: 'trophy', positive: true },
          ].map((stat) => (
            <View key={stat.label} style={s.stat}>
              <Text style={s.statVal}>₹{stat.value.toFixed(0)}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Transactions */}
      <Text style={s.sectionTitle}>लेनदेन इतिहास</Text>
      {txLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TxItem item={item} />}
          contentContainerStyle={s.txList}
          scrollEnabled={!!transactions.length}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={44} color={colors.mutedForeground} />
              <Text style={s.emptyText}>कोई लेनदेन नहीं</Text>
            </View>
          }
        />
      )}

      {/* Deposit / Withdraw Modal */}
      <Modal visible={!!modal} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModal(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{modal === 'deposit' ? 'जमा करें' : 'निकालें'}</Text>
            <TextInput
              style={s.amountInput}
              placeholder="राशि दर्ज करें (₹)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
            <View style={s.quickAmounts}>
              {[100, 200, 500, 1000].map((a) => (
                <TouchableOpacity key={a} style={s.quickBtn} onPress={() => setAmount(String(a))}>
                  <Text style={s.quickText}>₹{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.confirmBtn, (deposit.isPending || withdraw.isPending) && s.btnDisabled]}
              onPress={handleTransaction}
              disabled={deposit.isPending || withdraw.isPending}
              activeOpacity={0.85}
            >
              {deposit.isPending || withdraw.isPending
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={s.confirmText}>{modal === 'deposit' ? 'जमा करें' : 'निकालें'}</Text>
              }
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  balanceCard: {
    marginHorizontal: 20, borderRadius: 16, padding: 24,
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 13, color: colors.primaryForeground + 'AA', fontFamily: 'Inter_500Medium', marginBottom: 4 },
  balance: { fontSize: 38, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  cardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  cardBtnText: { fontSize: 14, fontWeight: '600' as const, color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' },
  divider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  statVal: { fontSize: 15, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, marginBottom: 4 },
  txList: { paddingHorizontal: 20, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  amountInput: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickText: { fontSize: 13, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  confirmText: { fontSize: 16, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
});
