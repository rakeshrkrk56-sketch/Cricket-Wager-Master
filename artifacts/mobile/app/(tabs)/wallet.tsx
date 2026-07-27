import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
  Platform, Linking, Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetWallet, getGetWalletQueryKey,
  useGetTransactions, getGetTransactionsQueryKey,
  useGetMyDeposits, getGetMyDepositsQueryKey,
  useGetMyWithdrawals, getGetMyWithdrawalsQueryKey,
  useCreateDeposit, useCreateWithdrawal,
} from '@workspace/api-client-react';

const PLATFORM_UPI = 'jazment@upi';
const PLATFORM_NAME = 'Jazment';

const TX_CONFIG: Record<string, { label: string; icon: string; positive: boolean }> = {
  deposit: { label: 'जमा', icon: 'arrow-down-circle', positive: true },
  withdraw: { label: 'निकासी', icon: 'arrow-up-circle', positive: false },
  win: { label: 'जीत', icon: 'trophy', positive: true },
  loss: { label: 'लगाया', icon: 'remove-circle', positive: false },
  bonus: { label: 'बोनस', icon: 'gift', positive: true },
  refund: { label: 'वापसी', icon: 'refresh-circle', positive: true },
};

const STATUS_COLORS = (colors: any) => ({
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.destructive,
});
const STATUS_LABELS: Record<string, string> = {
  pending: 'प्रतीक्षारत', approved: 'स्वीकृत', rejected: 'अस्वीकृत',
};

function TxItem({ item }: { item: any }) {
  const colors = useColors();
  const cfg = TX_CONFIG[item.type] || { label: item.type, icon: 'ellipse', positive: true };
  const amt = Number(item.amount);
  return (
    <View style={txS(colors).row}>
      <View style={[txS(colors).icon, { backgroundColor: cfg.positive ? colors.success + '20' : colors.destructive + '20' }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.positive ? colors.success : colors.destructive} />
      </View>
      <View style={txS(colors).info}>
        <Text style={txS(colors).label}>{cfg.label}</Text>
        {item.note && <Text style={txS(colors).note} numberOfLines={1}>{item.note}</Text>}
        <Text style={txS(colors).time}>{new Date(item.createdAt).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
      </View>
      <View style={txS(colors).amtCol}>
        <Text style={[txS(colors).amt, { color: cfg.positive ? colors.success : colors.destructive }]}>
          {cfg.positive ? '+' : '-'}₹{amt.toFixed(0)}
        </Text>
        {item.balanceBefore != null && (
          <Text style={txS(colors).balBefore}>₹{Number(item.balanceBefore).toFixed(0)}</Text>
        )}
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
  balAfter: { fontSize: 10, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
});

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const sc = STATUS_COLORS(colors);
  const color = (sc as any)[status] || colors.mutedForeground;
  return (
    <View style={{ backgroundColor: color + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
      <Text style={{ fontSize: 11, color, fontFamily: 'Inter_600SemiBold' }}>{STATUS_LABELS[status] || status}</Text>
    </View>
  );
}

type DepositTab = 'upi' | 'manual';
type WalletTab = 'transactions' | 'deposits' | 'withdrawals';

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const [walletTab, setWalletTab] = useState<WalletTab>('transactions');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositTab, setDepositTab] = useState<DepositTab>('upi');

  // Deposit form
  const [depAmount, setDepAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [upiCopied, setUpiCopied] = useState(false);

  // Withdrawal form
  const [wdAmount, setWdAmount] = useState('');
  const [wdUpiId, setWdUpiId] = useState('');

  const { data: wallet, isLoading: walletLoading } = useGetWallet({ query: { enabled: !!token, queryKey: getGetWalletQueryKey() } });
  const { data: txData, isLoading: txLoading } = useGetTransactions({}, { query: { enabled: !!token && walletTab === 'transactions', queryKey: getGetTransactionsQueryKey({}) } });
  const { data: depositsData, isLoading: depositsLoading } = useGetMyDeposits({}, { query: { enabled: !!token && walletTab === 'deposits', queryKey: getGetMyDepositsQueryKey({}) } });
  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useGetMyWithdrawals({}, { query: { enabled: !!token && walletTab === 'withdrawals', queryKey: getGetMyWithdrawalsQueryKey({}) } });

  const createDeposit = useCreateDeposit();
  const createWithdrawal = useCreateWithdrawal();

  const balance = wallet?.balance ?? user?.walletBalance ?? 0;

  const openUpiApp = (appScheme: string, name: string) => {
    const amt = parseFloat(depAmount);
    if (!amt || amt < 200) { Alert.alert('न्यूनतम जमा', 'कम से कम ₹200 दर्ज करें'); return; }
    const upiUrl = `upi://pay?pa=${PLATFORM_UPI}&pn=${PLATFORM_NAME}&am=${amt}&cu=INR&tn=Deposit+to+Jazment`;
    Linking.openURL(upiUrl).catch(() => {
      // fallback: open Play Store
      Alert.alert(`${name} नहीं मिला`, `${name} इंस्टॉल नहीं है। कृपया Manual जमा करें।`);
    });
    Alert.alert(
      'भुगतान के बाद',
      'UPI ऐप से भुगतान करने के बाद, Manual टैब पर जाकर UTR नंबर और स्क्रीनशॉट अपलोड करें।',
      [{ text: 'ठीक है' }]
    );
  };

  const copyUpiId = () => {
    Clipboard.setString(PLATFORM_UPI);
    setUpiCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setUpiCopied(false), 2000);
  };

  const pickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('अनुमति आवश्यक', 'गैलरी एक्सेस की अनुमति दें'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri);
      setScreenshotBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleManualDeposit = () => {
    const amt = parseFloat(depAmount);
    if (!amt || amt < 200) { Alert.alert('न्यूनतम जमा', 'कम से कम ₹200 दर्ज करें'); return; }
    if (!utrNumber.trim()) { Alert.alert('UTR आवश्यक', 'UTR नंबर दर्ज करें'); return; }

    createDeposit.mutate(
      { data: { amount: amt, method: 'manual', utrNumber: utrNumber.trim(), screenshotBase64: screenshotBase64 ?? undefined } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: getGetMyDepositsQueryKey({}) });
          setShowDeposit(false);
          setDepAmount(''); setUtrNumber(''); setScreenshotUri(null); setScreenshotBase64(null);
          setWalletTab('deposits');
          Alert.alert('जमा अनुरोध भेजा', 'आपका जमा अनुरोध समीक्षा में है। 24 घंटे में अपडेट मिलेगा।');
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('त्रुटि', err?.data?.error ?? 'जमा अनुरोध नहीं भेजा जा सका');
        },
      }
    );
  };

  const handleWithdrawal = () => {
    const amt = parseFloat(wdAmount);
    if (!amt || amt < 500) { Alert.alert('न्यूनतम निकासी', 'कम से कम ₹500 निकालें'); return; }
    if (!wdUpiId.trim()) { Alert.alert('UPI ID आवश्यक', 'अपना UPI ID दर्ज करें'); return; }

    createWithdrawal.mutate(
      { data: { amount: amt, upiId: wdUpiId.trim() } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          setShowWithdraw(false);
          setWdAmount(''); setWdUpiId('');
          setWalletTab('withdrawals');
          Alert.alert('निकासी अनुरोध भेजा', 'आपकी निकासी समीक्षा में है। स्वीकृत होने पर धनराशि आपके UPI में भेजी जाएगी।');
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('त्रुटि', err?.data?.error ?? 'निकासी अनुरोध नहीं भेजा जा सका');
        },
      }
    );
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>वॉलेट</Text>
      </View>

      {/* Balance Card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>उपलब्ध बैलेंस</Text>
        {walletLoading
          ? <ActivityIndicator color={colors.primaryForeground} />
          : <Text style={s.balance}>₹{balance.toFixed(2)}</Text>
        }
        <View style={s.cardActions}>
          <TouchableOpacity style={s.cardBtn} onPress={() => setShowDeposit(true)} activeOpacity={0.85}>
            <Ionicons name="arrow-down-circle" size={18} color={colors.primaryForeground} />
            <Text style={s.cardBtnText}>जमा करें</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.cardBtn} onPress={() => setShowWithdraw(true)} activeOpacity={0.85}>
            <Ionicons name="arrow-up-circle" size={18} color={colors.primaryForeground} />
            <Text style={s.cardBtnText}>निकालें</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {wallet && (
        <View style={s.statsRow}>
          {[
            { label: 'कुल जमा', value: wallet.depositTotal },
            { label: 'कुल निकासी', value: wallet.withdrawTotal },
            { label: 'जीत', value: wallet.winTotal },
          ].map((stat) => (
            <View key={stat.label} style={s.stat}>
              <Text style={s.statVal}>₹{stat.value.toFixed(0)}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ledger Tabs */}
      <View style={s.tabs}>
        {(['transactions', 'deposits', 'withdrawals'] as WalletTab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, walletTab === tab && s.tabActive]} onPress={() => setWalletTab(tab)}>
            <Text style={[s.tabText, walletTab === tab && s.tabTextActive]}>
              {tab === 'transactions' ? 'लेनदेन' : tab === 'deposits' ? 'जमा' : 'निकासी'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {walletTab === 'transactions' && (
        txLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : (
          <FlatList
            data={txData?.transactions ?? []}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => <TxItem item={item} />}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={<EmptyState icon="receipt-outline" text="कोई लेनदेन नहीं" />}
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
                  <Text style={s.depTime}>{new Date(item.createdAt).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
                <StatusBadge status={item.status} colors={colors} />
              </View>
            )}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={<EmptyState icon="arrow-down-circle-outline" text="कोई जमा नहीं" />}
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
                  <Text style={s.depTime}>{new Date(item.createdAt).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
                <StatusBadge status={item.status} colors={colors} />
              </View>
            )}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={<EmptyState icon="arrow-up-circle-outline" text="कोई निकासी नहीं" />}
          />
        )
      )}

      {/* ── Deposit Modal ── */}
      <Modal visible={showDeposit} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowDeposit(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>जमा करें</Text>

            {/* Deposit method tabs */}
            <View style={s.depTabs}>
              <TouchableOpacity style={[s.depTab, depositTab === 'upi' && s.depTabActive]} onPress={() => setDepositTab('upi')}>
                <Ionicons name="phone-portrait-outline" size={16} color={depositTab === 'upi' ? colors.primary : colors.mutedForeground} />
                <Text style={[s.depTabText, depositTab === 'upi' && { color: colors.primary }]}>UPI ऐप</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.depTab, depositTab === 'manual' && s.depTabActive]} onPress={() => setDepositTab('manual')}>
                <Ionicons name="document-text-outline" size={16} color={depositTab === 'manual' ? colors.primary : colors.mutedForeground} />
                <Text style={[s.depTabText, depositTab === 'manual' && { color: colors.primary }]}>Manual</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.amountLabel}>राशि (न्यूनतम ₹200)</Text>
              <TextInput
                style={s.amountInput}
                placeholder="₹200"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={depAmount}
                onChangeText={setDepAmount}
              />
              <View style={s.quickAmounts}>
                {[200, 500, 1000, 2000].map((a) => (
                  <TouchableOpacity key={a} style={s.quickBtn} onPress={() => setDepAmount(String(a))}>
                    <Text style={s.quickText}>₹{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {depositTab === 'upi' ? (
                <View style={s.upiSection}>
                  <Text style={s.upiHint}>नीचे दिए गए बटन से अपना UPI ऐप खोलें:</Text>
                  <View style={s.upiApps}>
                    {[
                      { name: 'PhonePe', icon: 'phone-portrait', scheme: 'phonepe://' },
                      { name: 'GPay', icon: 'logo-google', scheme: 'tez://' },
                      { name: 'Paytm', icon: 'wallet', scheme: 'paytmmp://' },
                    ].map((app) => (
                      <TouchableOpacity key={app.name} style={s.upiApp} onPress={() => openUpiApp(app.scheme, app.name)} activeOpacity={0.8}>
                        <Ionicons name={app.icon as any} size={28} color={colors.primary} />
                        <Text style={s.upiAppName}>{app.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={s.upiIdRow}>
                    <Text style={s.upiIdLabel}>या इस UPI ID पर भुगतान करें:</Text>
                    <TouchableOpacity style={s.copyRow} onPress={copyUpiId} activeOpacity={0.8}>
                      <Text style={s.upiId}>{PLATFORM_UPI}</Text>
                      <Ionicons name={upiCopied ? 'checkmark-circle' : 'copy-outline'} size={18} color={upiCopied ? colors.success : colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.infoBox}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                    <Text style={s.infoText}>भुगतान के बाद Manual टैब पर UTR नंबर और स्क्रीनशॉट अपलोड करें।</Text>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={s.upiIdRow}>
                    <Text style={s.upiIdLabel}>पहले इस UPI ID पर भुगतान करें:</Text>
                    <TouchableOpacity style={s.copyRow} onPress={copyUpiId} activeOpacity={0.8}>
                      <Text style={s.upiId}>{PLATFORM_UPI}</Text>
                      <Ionicons name={upiCopied ? 'checkmark-circle' : 'copy-outline'} size={18} color={upiCopied ? colors.success : colors.primary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={s.amountLabel}>UTR नंबर</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="12 अंकों का UTR नंबर"
                    placeholderTextColor={colors.mutedForeground}
                    value={utrNumber}
                    onChangeText={setUtrNumber}
                    keyboardType="numeric"
                  />

                  <Text style={s.amountLabel}>स्क्रीनशॉट (वैकल्पिक)</Text>
                  <TouchableOpacity style={s.screenshotBtn} onPress={pickScreenshot} activeOpacity={0.8}>
                    {screenshotUri ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={[s.screenshotText, { color: colors.success }]}>स्क्रीनशॉट अपलोड हुआ</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />
                        <Text style={s.screenshotText}>गैलरी से चुनें</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.confirmBtn, createDeposit.isPending && s.btnDisabled]}
                    onPress={handleManualDeposit}
                    disabled={createDeposit.isPending}
                    activeOpacity={0.85}
                  >
                    {createDeposit.isPending
                      ? <ActivityIndicator color={colors.primaryForeground} />
                      : <Text style={s.confirmText}>जमा अनुरोध भेजें</Text>
                    }
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
            <Text style={s.sheetTitle}>निकासी</Text>

            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
              <Text style={s.infoText}>निकासी स्वीकृत होने पर आपके UPI पर पैसे भेजे जाएंगे। स्वीकृति में 24 घंटे लग सकते हैं।</Text>
            </View>

            <Text style={s.amountLabel}>राशि (न्यूनतम ₹500)</Text>
            <TextInput
              style={s.amountInput}
              placeholder="₹500"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={wdAmount}
              onChangeText={setWdAmount}
              autoFocus
            />
            <View style={s.quickAmounts}>
              {[500, 1000, 2000, 5000].map((a) => (
                <TouchableOpacity key={a} style={s.quickBtn} onPress={() => setWdAmount(String(a))}>
                  <Text style={s.quickText}>₹{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.balHint}>उपलब्ध: ₹{balance.toFixed(0)}</Text>

            <Text style={s.amountLabel}>आपका UPI ID</Text>
            <TextInput
              style={s.textInput}
              placeholder="example@upi"
              placeholderTextColor={colors.mutedForeground}
              value={wdUpiId}
              onChangeText={setWdUpiId}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={[s.confirmBtn, createWithdrawal.isPending && s.btnDisabled]}
              onPress={handleWithdrawal}
              disabled={createWithdrawal.isPending}
              activeOpacity={0.85}
            >
              {createWithdrawal.isPending
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={s.confirmText}>निकासी अनुरोध भेजें</Text>
              }
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  balanceCard: {
    marginHorizontal: 20, borderRadius: 16, padding: 24, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8, marginBottom: 16,
  },
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
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  depTabs: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: 10, padding: 4, marginBottom: 20 },
  depTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  depTabActive: { backgroundColor: colors.card },
  depTabText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  amountLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  amountInput: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  textInput: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium', borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickText: { fontSize: 13, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  balHint: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  upiSection: { gap: 16 },
  upiHint: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  upiApps: { flexDirection: 'row', gap: 12 },
  upiApp: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: colors.muted, borderRadius: 12, paddingVertical: 16, borderWidth: 1, borderColor: colors.border },
  upiAppName: { fontSize: 12, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  upiIdRow: { gap: 8 },
  upiIdLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.primary + '40' },
  upiId: { flex: 1, fontSize: 15, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.warning + '15', borderRadius: 10, padding: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: colors.warning, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  screenshotBtn: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 20, alignItems: 'center' },
  screenshotText: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  confirmText: { fontSize: 16, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
});
