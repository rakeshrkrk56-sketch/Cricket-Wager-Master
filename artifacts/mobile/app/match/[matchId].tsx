import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetMatch, useGetMatchMarkets,
  getGetMatchMarketsQueryKey, usePlacePrediction,
  getGetMeQueryKey,
} from '@workspace/api-client-react';

const CATEGORY_LABELS: Record<string, string> = {
  toss: '🪙 टॉस', innings: '🏏 पारी', over: '⚡ ओवर',
  batsman: '🏏 बल्लेबाज', bowler: '🎯 गेंदबाज', match_winner: '🏆 विजेता',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'खुला', paused: 'रुका', closed: 'बंद', settled: 'तय हुआ', refunded: 'वापसी',
};
const STATUS_COLORS = (colors: any): Record<string, string> => ({
  open: colors.success, paused: colors.warning, closed: colors.mutedForeground,
  settled: colors.primary, refunded: colors.destructive,
});

function MarketCard({ market, onPredict }: { market: any; onPredict: (m: any) => void }) {
  const colors = useColors();
  const s = marketStyles(colors);
  const isOpen = market.status === 'open';
  const statusColors = STATUS_COLORS(colors);

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.question}>{market.questionHindi || market.question}</Text>
        <View style={[s.statusBadge, { backgroundColor: (statusColors[market.status] || colors.muted) + '22' }]}>
          <Text style={[s.statusText, { color: statusColors[market.status] || colors.mutedForeground }]}>
            {STATUS_LABELS[market.status] || market.status}
          </Text>
        </View>
      </View>
      <View style={s.stats}>
        <Text style={s.stat}>हाँ: {market.totalYes} | नहीं: {market.totalNo}</Text>
        {market.status === 'settled' && market.correctAnswer && (
          <Text style={[s.answer, { color: market.correctAnswer === 'YES' ? colors.success : colors.destructive }]}>
            उत्तर: {market.correctAnswer === 'YES' ? 'हाँ' : 'नहीं'}
          </Text>
        )}
      </View>
      {isOpen && (
        <View style={s.buttons}>
          <TouchableOpacity style={[s.btn, s.yesBtn]} onPress={() => onPredict({ ...market, preChoice: 'YES' })} activeOpacity={0.8}>
            <Text style={s.btnLabel}>हाँ</Text>
            <Text style={s.btnOdds}>×{market.yesPrice}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.noBtn]} onPress={() => onPredict({ ...market, preChoice: 'NO' })} activeOpacity={0.8}>
            <Text style={s.btnLabel}>नहीं</Text>
            <Text style={s.btnOdds}>×{market.noPrice}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const marketStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  question: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stat: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  answer: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
  yesBtn: { backgroundColor: '#22C55E22', borderWidth: 1.5, borderColor: '#22C55E' },
  noBtn: { backgroundColor: '#EF444422', borderWidth: 1.5, borderColor: '#EF4444' },
  btnLabel: { fontSize: 15, fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },
  btnOdds: { fontSize: 12, color: '#ffffff99', fontFamily: 'Inter_400Regular' },
});

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [predicted, setPredicted] = useState(false);

  const { data: match, isLoading: matchLoading } = useGetMatch(matchId!, { query: { enabled: !!matchId } });
  const { data: marketsData, isLoading: marketsLoading } = useGetMatchMarkets(
    matchId!,
    {},
    { query: { enabled: !!matchId, queryKey: getGetMatchMarketsQueryKey(matchId!, {}) } }
  );
  const placePrediction = usePlacePrediction();

  const markets = marketsData?.markets ?? [];

  // Group markets by category
  const grouped = markets.reduce((acc: Record<string, any[]>, m) => {
    const cat = m.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  const handleConfirmPrediction = () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 10) { Alert.alert('न्यूनतम राशि', 'कम से कम ₹10 का दांव लगाएं'); return; }
    if ((user?.walletBalance ?? 0) < amt) { Alert.alert('अपर्याप्त बैलेंस', 'पर्याप्त बैलेंस नहीं है'); return; }

    placePrediction.mutate(
      { marketId: selectedMarket.id, data: { choice: selectedMarket.preChoice, amount: amt } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (user) updateUser({ ...user, walletBalance: user.walletBalance - amt });
          queryClient.invalidateQueries({ queryKey: getGetMatchMarketsQueryKey(matchId!, {}) });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setSelectedMarket(null);
          setAmount('');
          setPredicted(true);
          setTimeout(() => setPredicted(false), 3000);
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('त्रुटि', err?.data?.error ?? 'भविष्यवाणी नहीं हो सकी');
        },
      }
    );
  };

  const s = styles(colors, insets);

  if (matchLoading) return <View style={s.root}><ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} /></View>;
  if (!match) return <View style={s.root}><Text style={{ color: colors.foreground, margin: 24 }}>मैच नहीं मिला</Text></View>;

  const potentialWin = selectedMarket && amount
    ? (parseFloat(amount) * (selectedMarket.preChoice === 'YES' ? selectedMarket.yesPrice : selectedMarket.noPrice)).toFixed(0)
    : '0';

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>{match.team1} vs {match.team2}</Text>
          <Text style={s.headerSub}>{match.tournament}</Text>
        </View>
      </View>

      {/* Match score banner if live */}
      {match.status === 'live' && (
        <View style={s.liveBanner}>
          <View style={s.liveDot} />
          <Text style={s.liveLabel}>लाइव</Text>
          {match.liveScore && (
            <Text style={s.liveScore}>{(match.liveScore as any).score}</Text>
          )}
        </View>
      )}

      {/* Success toast */}
      {predicted && (
        <View style={s.successToast}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={s.successText}>भविष्यवाणी हो गई!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.list}>
        {marketsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : markets.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="clipboard-outline" size={44} color={colors.mutedForeground} />
            <Text style={s.emptyText}>अभी कोई मार्केट नहीं है</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([cat, mktList]) => (
            <View key={cat}>
              <Text style={s.catLabel}>{CATEGORY_LABELS[cat] || cat}</Text>
              {mktList.map((m) => (
                <MarketCard key={m.id} market={m} onPredict={setSelectedMarket} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Prediction modal */}
      <Modal visible={!!selectedMarket} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelectedMarket(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>भविष्यवाणी करें</Text>
            <Text style={s.sheetQuestion}>{selectedMarket?.questionHindi || selectedMarket?.question}</Text>
            <View style={[s.choiceBadge, {
              backgroundColor: selectedMarket?.preChoice === 'YES' ? '#22C55E22' : '#EF444422',
              borderColor: selectedMarket?.preChoice === 'YES' ? '#22C55E' : '#EF4444',
            }]}>
              <Text style={[s.choiceText, { color: selectedMarket?.preChoice === 'YES' ? '#22C55E' : '#EF4444' }]}>
                {selectedMarket?.preChoice === 'YES' ? 'हाँ ✓' : 'नहीं ✗'}
              </Text>
            </View>
            <Text style={s.amountLabel}>राशि दर्ज करें</Text>
            <TextInput
              style={s.amountInput}
              placeholder="न्यूनतम ₹10"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
            <View style={s.quickAmounts}>
              {[50, 100, 200, 500].map((a) => (
                <TouchableOpacity key={a} style={s.quickBtn} onPress={() => setAmount(String(a))}>
                  <Text style={s.quickText}>₹{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {amount && parseFloat(amount) >= 10 && (
              <View style={s.winRow}>
                <Text style={s.winLabel}>जीतने की राशि:</Text>
                <Text style={s.winAmount}>₹{potentialWin}</Text>
              </View>
            )}
            <Text style={s.balanceText}>वॉलेट बैलेंस: ₹{user?.walletBalance?.toFixed(0)}</Text>
            <TouchableOpacity
              style={[s.confirmBtn, placePrediction.isPending && s.btnDisabled]}
              onPress={handleConfirmPrediction}
              disabled={placePrediction.isPending}
              activeOpacity={0.85}
            >
              {placePrediction.isPending
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={s.confirmText}>कन्फर्म करें</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.card },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  liveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.destructive + '15', paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.destructive + '30',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.destructive },
  liveLabel: { fontSize: 12, fontWeight: '700' as const, color: colors.destructive, fontFamily: 'Inter_700Bold' },
  liveScore: { fontSize: 12, color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 },
  successToast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success + '20', paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.success + '40',
  },
  successText: { color: colors.success, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 20, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
  catLabel: { fontSize: 13, fontWeight: '700' as const, color: colors.mutedForeground, fontFamily: 'Inter_700Bold', marginBottom: 8, marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: insets.bottom + 24,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  sheetQuestion: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 16, lineHeight: 20 },
  choiceBadge: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 20 },
  choiceText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  amountLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  amountInput: {
    backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, color: colors.foreground, fontFamily: 'Inter_600SemiBold',
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickText: { fontSize: 13, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  winRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  winLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  winAmount: { fontSize: 16, fontWeight: '700' as const, color: colors.success, fontFamily: 'Inter_700Bold' },
  balanceText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  confirmBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  confirmText: { fontSize: 16, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
});
