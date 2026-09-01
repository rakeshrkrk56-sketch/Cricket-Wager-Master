import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
  Platform, Clipboard, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BankIcon,
  CheckCircleIcon,
  CopyIcon,
  DepositIcon,
  DocumentIcon,
  ImageIcon,
  InfoIcon,
  WithdrawIcon,
} from '@/components/AppIcons';
import {
  useGetWallet, getGetWalletQueryKey,
  useGetTransactions, getGetTransactionsQueryKey,
  useGetMyDeposits, getGetMyDepositsQueryKey,
  useGetMyWithdrawals, getGetMyWithdrawalsQueryKey,
  useCreateDeposit, useCreateWithdrawal,
  useGetSettings,
} from '@workspace/api-client-react';

type DepositTab   = 'bank' | 'manual';
type WithdrawMethod = 'upi' | 'bank';
type WalletTab    = 'transactions' | 'deposits' | 'withdrawals';

function TxItem({ item }: { item: any }) {
  const colors  = useColors();
  const { t } = useLanguage();
  const locale  = 'en-IN';

  // `loss` is a balance-neutral settlement outcome: the stake was already
  // debited by the `bet_placed` entry, so it must NOT display as a second debit.
  const TX_CFG: Record<string, { labelKey: string; icon: string; positive: boolean; neutral?: boolean }> = {
    deposit:  { labelKey: 'wallet_tx_deposit',  icon: 'arrow-down-circle', positive: true  },
    withdraw: { labelKey: 'wallet_tx_withdraw', icon: 'arrow-up-circle',   positive: false },
    win:      { labelKey: 'wallet_tx_win',      icon: 'trophy',            positive: true  },
    loss:     { labelKey: 'wallet_tx_loss',     icon: 'remove-circle',     positive: false, neutral: true },
    bonus:    { labelKey: 'wallet_tx_bonus',    icon: 'gift',              positive: true  },
    refund:   { labelKey: 'wallet_tx_refund',   icon: 'refresh-circle',    positive: true  },
    bet_placed: { labelKey: 'wallet_tx_bet_placed', icon: 'ticket',        positive: false },
  };
  const cfg = TX_CFG[item.type] ?? { labelKey: 'wallet_tx_deposit', icon: 'ellipse', positive: true };
  const amt = Number(item.amount);
  const amtColor = cfg.neutral ? colors.mutedForeground : cfg.positive ? colors.success : colors.destructive;

  return (
    <View style={txS(colors).row}>
      <View style={[txS(colors).icon, { backgroundColor: amtColor + '20' }]}>
        <Ionicons name={cfg.icon as any} size={20} color={amtColor} />
      </View>
      <View style={txS(colors).info}>
        <Text style={txS(colors).label}>{t(cfg.labelKey as any)}</Text>
        {item.note && <Text style={txS(colors).note} numberOfLines={1}>{item.note}</Text>}
        <Text style={txS(colors).time}>{new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</Text>
      </View>
      <View style={txS(colors).amtCol}>
        <Text style={[txS(colors).amt, { color: amtColor }]}>
          {cfg.neutral ? '' : cfg.positive ? '+' : '-'}₹{amt.toFixed(0)}
        </Text>
        {item.balanceBefore != null && <Text style={txS(colors).balBefore}>₹{Number(item.balanceBefore).toFixed(0)}</Text>}
        <Text style={txS(colors).balAfter}>→ ₹{Number(item.balanceAfter).toFixed(0)}</Text>
      </View>
    </View>
  );
}

const txS = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  note: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  time: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  amtCol: { alignItems: 'flex-end' },
  amt: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  balBefore: { fontSize: 10, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  balAfter:  { fontSize: 10, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
});

function StatusBadge({ status, colors, t }: { status: string; colors: any; t: any }) {
  const STATUS_COLORS = { pending: colors.warning, approved: colors.success, rejected: colors.destructive };
  const STATUS_KEYS: Record<string, string> = {
    pending: 'wallet_status_pending', approved: 'wallet_status_approved', rejected: 'wallet_status_rejected',
  };
  const color = (STATUS_COLORS as any)[status] || colors.mutedForeground;
  return (
    <View style={{ backgroundColor: color + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
      <Text style={{ fontSize: 11, color, fontFamily: 'Inter_600SemiBold' }}>{t((STATUS_KEYS[status] ?? 'wallet_status_pending') as any)}</Text>
    </View>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
      <Ionicons name={icon as any} size={44} color={colors.mutedForeground} />
      <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }}>{text}</Text>
    </View>
  );
}

export default function WalletScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { token, user, updateUser } = useAuth();
  const { t } = useLanguage();
  const locale  = 'en-IN';
  const queryClient = useQueryClient();
  const { open, request } = useLocalSearchParams<{ open?: string; request?: string }>();

  const [walletTab,     setWalletTab]     = useState<WalletTab>('transactions');
  const [showDeposit,   setShowDeposit]   = useState(false);
  const [showWithdraw,  setShowWithdraw]  = useState(false);
  const [depositTab,    setDepositTab]    = useState<DepositTab>('manual');

  useEffect(() => {
    if (open === 'deposit') setShowDeposit(true);
    if (open === 'withdraw') setShowWithdraw(true);
  }, [open, request]);

  // Deposit form
  const [depAmount,        setDepAmount]        = useState('');
  const [utrNumber,        setUtrNumber]        = useState('');
  const [screenshotUri,    setScreenshotUri]    = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [bankFieldCopied,  setBankFieldCopied]  = useState<string | null>(null);

  // Withdrawal form
  const [wdAmount,             setWdAmount]             = useState('');
  const [wdMethod,             setWdMethod]             = useState<WithdrawMethod>('upi');
  const [wdUpiId,              setWdUpiId]              = useState('');
  const [wdBankName,           setWdBankName]           = useState('');
  const [wdHolderName,         setWdHolderName]         = useState('');
  const [wdAccountNumber,      setWdAccountNumber]      = useState('');
  const [wdConfirmAccountNumber,setWdConfirmAccountNumber] = useState('');
  const [wdIfsc,               setWdIfsc]               = useState('');

  const { data: platformSettings } = useGetSettings();

  const { data: wallet,         isLoading: walletLoading }      = useGetWallet({ query: { enabled: !!token, queryKey: getGetWalletQueryKey() } });
  const { data: txData,         isLoading: txLoading }          = useGetTransactions({}, { query: { enabled: !!token && walletTab === 'transactions', queryKey: getGetTransactionsQueryKey({}) } });
  const { data: depositsData,   isLoading: depositsLoading }    = useGetMyDeposits({}, { query: { enabled: !!token && walletTab === 'deposits',      queryKey: getGetMyDepositsQueryKey({}) } });
  const { data: withdrawalsData,isLoading: withdrawalsLoading } = useGetMyWithdrawals({}, { query: { enabled: !!token && walletTab === 'withdrawals', queryKey: getGetMyWithdrawalsQueryKey({}) } });

  const createDeposit    = useCreateDeposit();
  const createWithdrawal = useCreateWithdrawal();

  const balance = wallet?.balance ?? user?.walletBalance ?? 0;
  // Keep AuthContext in sync so the home-screen wallet badge reflects the latest balance
  useEffect(() => {
    if (wallet && user && wallet.balance !== user.walletBalance) {
      updateUser({ ...user, walletBalance: wallet.balance });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.balance]);

  // Pull-to-refresh: reload balance + active ledger tab
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey({}) }),
      queryClient.invalidateQueries({ queryKey: getGetMyDepositsQueryKey({}) }),
      queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey({}) }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const pickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t('wallet_permission_title'), t('wallet_permission_msg')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri);
      setScreenshotBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleManualDeposit = () => {
    const amt = parseFloat(depAmount);
    if (!amt || amt < 200) { Alert.alert(t('wallet_min_deposit_title'), t('wallet_min_deposit_msg')); return; }
    if (!screenshotBase64) {
      Alert.alert(t('wallet_screenshot_required_title'), t('wallet_screenshot_required_msg'));
      return;
    }
    createDeposit.mutate(
      { data: { amount: amt, method: 'manual', utrNumber: utrNumber.trim() || undefined, screenshotBase64 } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: getGetMyDepositsQueryKey({}) });
          setShowDeposit(false);
          setDepAmount(''); setUtrNumber(''); setScreenshotUri(null); setScreenshotBase64(null);
          setWalletTab('deposits');
          // Delay alert so the modal dismiss animation finishes first —
          // on iOS an alert fired during modal teardown is silently dropped.
          setTimeout(() => Alert.alert(t('wallet_deposit_success_title'), t('wallet_deposit_success_msg')), 400);
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('wallet_error_title'), err?.data?.error ?? 'Submission failed. Please try again.');
        },
      }
    );
  };

  const resetWithdrawForm = () => {
    setWdAmount(''); setWdUpiId('');
    setWdBankName(''); setWdHolderName('');
    setWdAccountNumber(''); setWdConfirmAccountNumber(''); setWdIfsc('');
  };

  const handleWithdrawal = () => {
    const amt = parseFloat(wdAmount);
    if (!amt || amt < 500) { Alert.alert(t('wallet_min_withdraw_title'), t('wallet_min_withdraw_msg')); return; }
    let payload: any;
    if (wdMethod === 'upi') {
      if (!wdUpiId.trim()) { Alert.alert(t('wallet_upi_required_title'), t('wallet_upi_required_msg')); return; }
      payload = { amount: amt, upiId: wdUpiId.trim() };
    } else {
      if (!wdBankName.trim())    { Alert.alert(t('wallet_bank_name_required'), t('wallet_bank_name_msg')); return; }
      if (!wdHolderName.trim())  { Alert.alert(t('wallet_holder_required'),    t('wallet_holder_msg'));    return; }
      if (!wdAccountNumber.trim()){ Alert.alert(t('wallet_account_required'),  t('wallet_account_msg'));   return; }
      if (wdAccountNumber.trim() !== wdConfirmAccountNumber.trim()) { Alert.alert(t('wallet_account_mismatch'), t('wallet_account_mismatch_msg')); return; }
      if (!wdIfsc.trim() || wdIfsc.trim().length < 11) { Alert.alert(t('wallet_ifsc_invalid'), t('wallet_ifsc_msg')); return; }
      payload = { amount: amt, bankAccount: { bankName: wdBankName.trim(), holderName: wdHolderName.trim(), accountNumber: wdAccountNumber.trim(), ifsc: wdIfsc.trim().toUpperCase() } };
    }
    createWithdrawal.mutate(
      { data: payload },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          setShowWithdraw(false);
          resetWithdrawForm();
          setWalletTab('withdrawals');
          setTimeout(() => Alert.alert(t('wallet_withdraw_success_title'), wdMethod === 'upi' ? t('wallet_withdraw_upi_msg') : t('wallet_withdraw_bank_msg')), 400);
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const code = err?.data?.code ?? err?.code;
          if (code === 'ACCOUNT_HOLD') {
            Alert.alert(
              'Withdrawal Unavailable',
              'Your account is currently under review. You can still deposit, but withdrawals are temporarily disabled. Please contact support for assistance.',
              [{ text: 'OK' }],
            );
          } else if (code === 'ACCOUNT_SUSPENDED') {
            Alert.alert(
              'Account Suspended',
              'Your account has been suspended. Please contact support.',
              [{ text: 'OK' }],
            );
          } else {
            Alert.alert(t('wallet_error_title'), err?.data?.error ?? t('wallet_withdraw_upi_msg'));
          }
        },
      }
    );
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <View style={s.header}><Text style={s.title}>{t('wallet_title')}</Text></View>

      {/* Balance Card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>{t('wallet_balance_label')}</Text>
        {walletLoading
          ? <ActivityIndicator color={colors.primaryForeground} />
          : <Text style={s.balance}>₹{balance.toFixed(2)}</Text>
        }
        <View style={s.cardActions}>
          <TouchableOpacity style={s.cardBtn} onPress={() => setShowDeposit(true)} activeOpacity={0.85}>
            <DepositIcon size={18} color={colors.primaryForeground} />
            <Text style={s.cardBtnText}>{t('wallet_deposit_btn')}</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.cardBtn} onPress={() => setShowWithdraw(true)} activeOpacity={0.85}>
            <WithdrawIcon size={18} color={colors.primaryForeground} />
            <Text style={s.cardBtnText}>{t('wallet_withdraw_btn')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {wallet && (
        <View style={s.statsRow}>
          {[
            { labelKey: 'wallet_stat_deposit',  value: wallet.depositTotal },
            { labelKey: 'wallet_stat_withdraw', value: wallet.withdrawTotal },
            { labelKey: 'wallet_stat_win',      value: wallet.winTotal },
          ].map((stat) => (
            <View key={stat.labelKey} style={s.stat}>
              <Text style={s.statVal}>₹{stat.value.toFixed(0)}</Text>
              <Text style={s.statLabel}>{t(stat.labelKey as any)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ledger Tabs */}
      <View style={s.tabs}>
        {(['transactions', 'deposits', 'withdrawals'] as WalletTab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, walletTab === tab && s.tabActive]} onPress={() => setWalletTab(tab)}>
            <Text style={[s.tabText, walletTab === tab && s.tabTextActive]}>
              {tab === 'transactions' ? t('wallet_tab_tx') : tab === 'deposits' ? t('wallet_tab_deposits') : t('wallet_tab_withdrawals')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {walletTab === 'transactions' && (
        txLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : (
          <FlatList
            data={txData?.transactions ?? []}
            keyExtractor={(tx) => tx.id}
            renderItem={({ item }) => <TxItem item={item} />}
            contentContainerStyle={s.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={<EmptyState icon="receipt-outline" text={t('wallet_empty_tx')} />}
          />
        )
      )}
      {walletTab === 'deposits' && (
        depositsLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : (
          <FlatList
            data={depositsData?.deposits ?? []}
            keyExtractor={(d: any) => d.id}
            renderItem={({ item }: { item: any }) => (
              <View style={s.depRow}>
                <View style={s.depInfo}>
                  <Text style={s.depAmt}>₹{Number(item.amount).toFixed(0)}</Text>
                  <Text style={s.depMethod}>{item.method === 'manual' ? 'Manual' : 'UPI'} • UTR: {item.utrNumber ?? '—'}</Text>
                  <Text style={s.depTime}>{new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
                <StatusBadge status={item.status} colors={colors} t={t} />
              </View>
            )}
            contentContainerStyle={s.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={<EmptyState icon="arrow-down-circle-outline" text={t('wallet_empty_deposits')} />}
          />
        )
      )}
      {walletTab === 'withdrawals' && (
        withdrawalsLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : (
          <FlatList
            data={withdrawalsData?.withdrawals ?? []}
            keyExtractor={(w: any) => w.id}
            renderItem={({ item }: { item: any }) => (
              <View style={s.depRow}>
                <View style={s.depInfo}>
                  <Text style={s.depAmt}>₹{Number(item.amount).toFixed(0)}</Text>
                  <Text style={s.depMethod}>{item.upiId ?? 'Bank Transfer'}</Text>
                  <Text style={s.depTime}>{new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
                <StatusBadge status={item.status} colors={colors} t={t} />
              </View>
            )}
            contentContainerStyle={s.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={<EmptyState icon="arrow-up-circle-outline" text={t('wallet_empty_withdrawals')} />}
          />
        )
      )}

      {/* ── Deposit Modal ── */}
      <Modal visible={showDeposit} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowDeposit(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{t('wallet_deposit_btn')}</Text>

            {!!(platformSettings?.bankName && platformSettings?.bankAccountNumber) && (
              <View style={s.depTabs}>
                <TouchableOpacity style={[s.depTab, depositTab === 'bank' && s.depTabActive]} onPress={() => setDepositTab('bank')}>
                  <BankIcon size={14} color={depositTab === 'bank' ? colors.primary : colors.mutedForeground} />
                  <Text style={[s.depTabText, depositTab === 'bank' && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>Bank</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.depTab, depositTab === 'manual' && s.depTabActive]} onPress={() => setDepositTab('manual')}>
                  <DocumentIcon size={14} color={depositTab === 'manual' ? colors.primary : colors.mutedForeground} />
                  <Text style={[s.depTabText, depositTab === 'manual' && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{t('wallet_utr_tab')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.amountLabel}>{t('wallet_amount_label')} (min ₹200)</Text>
              <TextInput style={s.amountInput} placeholder="₹200" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={depAmount} onChangeText={setDepAmount} />
              <View style={s.quickAmounts}>
                {[200, 500, 1000, 2000].map((a) => (
                  <TouchableOpacity key={a} style={s.quickBtn} onPress={() => setDepAmount(String(a))}>
                    <Text style={s.quickText}>₹{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bank Transfer tab */}
              {depositTab === 'bank' && (
                <View style={{ marginTop: 12 }}>
                  <View style={s.infoBox}>
                    <InfoIcon size={16} color={colors.warning} />
                         <Text style={s.infoText}>Transfer via NEFT/IMPS to the bank account below, then open Payment Proof.</Text>
                  </View>
                  {[
                    { label: 'Bank Name',              value: platformSettings?.bankName,          field: 'bankName' },
                    { label: 'Account Holder',         value: platformSettings?.bankHolderName,    field: 'bankHolder' },
                    { label: 'Account Number',         value: platformSettings?.bankAccountNumber, field: 'bankAccount', mono: true },
                    { label: 'IFSC',                                            value: platformSettings?.bankIfsc,          field: 'bankIfsc',    mono: true },
                  ].map(({ label, value, field, mono }) =>
                    value ? (
                      <View key={field} style={s.bankRow}>
                        <Text style={s.bankLabel}>{label}</Text>
                        <TouchableOpacity style={s.bankValueRow} onPress={() => { Clipboard.setString(value); setBankFieldCopied(field); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTimeout(() => setBankFieldCopied(null), 2000); }} activeOpacity={0.7}>
                          <Text style={[s.bankValue, mono && { fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }]}>{value}</Text>
                          {bankFieldCopied === field
                            ? <CheckCircleIcon size={16} color={colors.success} />
                            : <CopyIcon size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      </View>
                    ) : null
                  )}
                </View>
              )}

              {/* Payment Proof tab */}
              {depositTab === 'manual' && (
                <View>
                  <View style={s.proofHint}>
                    <DocumentIcon size={17} color={colors.primary} />
                    <Text style={s.proofHintText}>Upload your payment screenshot to submit. Reference number is optional.</Text>
                  </View>
                  <Text style={s.amountLabel}>{t('wallet_utr_label')}</Text>
                  <TextInput style={s.textInput} placeholder={t('wallet_utr_placeholder')} placeholderTextColor={colors.mutedForeground} value={utrNumber} onChangeText={setUtrNumber} keyboardType="numeric" />
                  <Text style={s.amountLabel}>{t('wallet_screenshot_label')}</Text>
                  <TouchableOpacity style={s.screenshotBtn} onPress={pickScreenshot} activeOpacity={0.8}>
                    {screenshotUri ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <CheckCircleIcon size={20} color={colors.success} />
                        <Text style={[s.screenshotText, { color: colors.success }]}>Screenshot uploaded</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ImageIcon size={20} color={colors.mutedForeground} />
                        <Text style={s.screenshotText}>Choose from gallery</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.confirmBtn, createDeposit.isPending && s.btnDisabled]} onPress={handleManualDeposit} disabled={createDeposit.isPending} activeOpacity={0.85}>
                    {createDeposit.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={s.confirmText}>{t('wallet_submit_deposit')}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Withdrawal Modal ── */}
      <Modal visible={showWithdraw} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowWithdraw(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{t('wallet_withdraw_btn')}</Text>

            <View style={s.depTabs}>
              <TouchableOpacity style={[s.depTab, wdMethod === 'upi' && s.depTabActive]} onPress={() => setWdMethod('upi')} activeOpacity={0.7}>
                <Ionicons name="phone-portrait-outline" size={16} color={wdMethod === 'upi' ? colors.primary : colors.mutedForeground} />
                <Text style={[s.depTabText, wdMethod === 'upi' && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{t('wallet_via_upi')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.depTab, wdMethod === 'bank' && s.depTabActive]} onPress={() => setWdMethod('bank')} activeOpacity={0.7}>
                <Ionicons name="business-outline" size={16} color={wdMethod === 'bank' ? colors.primary : colors.mutedForeground} />
                <Text style={[s.depTabText, wdMethod === 'bank' && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{t('wallet_via_bank')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.amountLabel}>{t('wallet_amount_label')} (min ₹500)</Text>
              <TextInput style={s.amountInput} placeholder="₹500" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={wdAmount} onChangeText={setWdAmount} />
              <View style={s.quickAmounts}>
                {[500, 1000, 2000, 5000].map((a) => (
                  <TouchableOpacity key={a} style={s.quickBtn} onPress={() => setWdAmount(String(a))}>
                    <Text style={s.quickText}>₹{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.balHint}>Available: ₹{balance.toFixed(0)}</Text>

              {wdMethod === 'upi' && (
                <View>
                  <View style={s.infoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                    <Text style={s.infoText}>On approval, amount will be sent to your UPI ID.</Text>
                  </View>
                  <Text style={[s.amountLabel, { marginTop: 12 }]}>{t('wallet_your_upi_id')} *</Text>
                  <TextInput style={s.textInput} placeholder={t('wallet_upi_placeholder')} placeholderTextColor={colors.mutedForeground} value={wdUpiId} onChangeText={setWdUpiId} autoCapitalize="none" keyboardType="email-address" />
                </View>
              )}

              {wdMethod === 'bank' && (
                <View>
                  <View style={s.infoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                    <Text style={s.infoText}>On approval, amount will be sent to your bank account via NEFT/IMPS.</Text>
                  </View>
                  <Text style={[s.amountLabel, { marginTop: 12 }]}>{t('wallet_bank_name')} *</Text>
                  <TextInput style={s.textInput} placeholder="e.g. State Bank of India" placeholderTextColor={colors.mutedForeground} value={wdBankName} onChangeText={setWdBankName} autoCapitalize="words" />
                  <Text style={s.amountLabel}>{t('wallet_holder_name')} *</Text>
                  <TextInput style={s.textInput} placeholder="e.g. Rahul Sharma" placeholderTextColor={colors.mutedForeground} value={wdHolderName} onChangeText={setWdHolderName} autoCapitalize="words" />
                  <Text style={s.amountLabel}>{t('wallet_account_number')} *</Text>
                  <TextInput style={s.textInput} placeholder="Enter bank account number" placeholderTextColor={colors.mutedForeground} value={wdAccountNumber} onChangeText={setWdAccountNumber} keyboardType="numeric" />
                  <Text style={s.amountLabel}>{t('wallet_confirm_account')} *</Text>
                  <TextInput
                    style={[s.textInput, wdConfirmAccountNumber.length > 0 && { borderColor: wdAccountNumber === wdConfirmAccountNumber ? colors.success : colors.destructive, borderWidth: 1.5 }]}
                    placeholder="Re-enter account number"
                    placeholderTextColor={colors.mutedForeground}
                    value={wdConfirmAccountNumber} onChangeText={setWdConfirmAccountNumber} keyboardType="numeric"
                  />
                  {wdConfirmAccountNumber.length > 0 && wdAccountNumber !== wdConfirmAccountNumber && (
                    <View style={s.validationMsg}><Ionicons name="close-circle" size={14} color={colors.destructive} /><Text style={[s.validationText, { color: colors.destructive }]}>{t('wallet_account_mismatch')}</Text></View>
                  )}
                  {wdConfirmAccountNumber.length > 0 && wdAccountNumber === wdConfirmAccountNumber && wdAccountNumber.length > 0 && (
                    <View style={s.validationMsg}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={[s.validationText, { color: colors.success }]}>Account numbers match</Text></View>
                  )}
                  <Text style={[s.amountLabel, { marginTop: 4 }]}>{t('wallet_ifsc')} *</Text>
                  <TextInput style={s.textInput} placeholder="e.g. SBIN0001234" placeholderTextColor={colors.mutedForeground} value={wdIfsc} onChangeText={(v) => setWdIfsc(v.toUpperCase())} autoCapitalize="characters" maxLength={11} />
                  <Text style={s.ifscHint}>IFSC code is on your bank passbook or cheque (11 characters)</Text>
                </View>
              )}

              <TouchableOpacity style={[s.confirmBtn, createWithdrawal.isPending && s.btnDisabled, { marginTop: 20, marginBottom: 8 }]} onPress={handleWithdrawal} disabled={createWithdrawal.isPending} activeOpacity={0.85}>
                {createWithdrawal.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={s.confirmText}>{t('wallet_submit_withdraw')}</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  balanceCard: { marginHorizontal: 20, borderRadius: 16, padding: 24, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8, marginBottom: 16 },
  balanceLabel: { fontSize: 13, color: colors.primaryForeground + 'AA', fontFamily: 'Inter_500Medium', marginBottom: 4 },
  balance: { fontSize: 38, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  cardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  cardBtnText: { fontSize: 14, fontWeight: '600' as const, color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' },
  divider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  statVal: { fontSize: 14, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  statLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.muted, borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.card },
  tabText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  tabTextActive: { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  listContent: { paddingHorizontal: 20, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
  depRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  depInfo: { flex: 1 },
  depAmt: { fontSize: 16, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  depMethod: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  depTime: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, maxHeight: '86%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  depTabs: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: 10, padding: 4, marginBottom: 14 },
  depTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  depTabActive: { backgroundColor: colors.card },
  depTabText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  amountLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  amountInput: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, fontSize: 19, color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  textInput: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minHeight: 46, fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  quickBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickText: { fontSize: 13, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  balHint: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  proofHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingVertical: 2 },
  proofHintText: { flex: 1, fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.warning + '15', borderRadius: 10, padding: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: colors.warning, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  screenshotBtn: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 14, alignItems: 'center', justifyContent: 'center' },
  screenshotText: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  confirmText: { fontSize: 16, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
  validationMsg: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -10, marginBottom: 12 },
  validationText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ifscHint: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: -10, marginBottom: 16 },
  bankRow: { marginBottom: 14 },
  bankLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  bankValueRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bankValue: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_400Regular', flex: 1, marginRight: 8 },
});
