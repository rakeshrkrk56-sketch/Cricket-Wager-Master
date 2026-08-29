import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useGetWallet, getGetWalletQueryKey } from '@workspace/api-client-react';

type Choice = 'DRAGON' | 'TIGER' | 'TIE';
type Phase = 'BETTING' | 'REVEAL' | 'SETTLED' | 'WAITING' | 'PAUSED';
type Card = { rank?: string | number; suit?: string; value?: string | number } | string | number | null;

interface GameState {
  phase: Phase;
  roundId?: string;
  secondsRemaining: number;
  endsAt?: number;
  pools: Record<Choice, number>;
  dragonCard: Card;
  tigerCard: Card;
  result?: Choice;
}

const EMPTY_GAME: GameState = {
  phase: 'WAITING',
  secondsRemaining: 0,
  pools: { DRAGON: 0, TIGER: 0, TIE: 0 },
  dragonCard: null,
  tigerCard: null,
};
const CHIPS = [10, 50, 100, 500];

const numberFrom = (...values: unknown[]) => {
  const found = values.find((value) => value !== undefined && value !== null);
  const parsed = Number(found);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cardLabel = (card: Card) => {
  if (card === null || card === undefined) return '—';
  const rank = typeof card === 'object' ? card.rank ?? card.value : card;
  const face = rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
  return `${face}${typeof card === 'object' ? card.suit ?? '' : ''}`;
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [game, setGame] = useState<GameState>(EMPTY_GAME);
  const [connected, setConnected] = useState(false);
  const [stake, setStake] = useState('100');
  const [choice, setChoice] = useState<Choice>('DRAGON');
  const [privateBalance, setPrivateBalance] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);

  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const liveBalance = privateBalance ?? Number(walletData?.balance ?? user?.walletBalance ?? 0);

  useEffect(() => {
    if (!token) return;
    let disposed = false;

    const connect = () => {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (!domain) {
        setMessage('Game connection is not configured.');
        return;
      }
      const socket = new WebSocket(`wss://${domain}/ws/game`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        setConnected(true);
        reconnectAttempt.current = 0;
        setMessage(null);
        socket.send(JSON.stringify({ type: 'AUTH', token }));
      };
      socket.onmessage = (event) => {
        try {
          const incoming = JSON.parse(String(event.data));
          const payload = incoming.payload ?? incoming.data ?? incoming;
          const type = String(incoming.type ?? payload.type ?? '').toUpperCase();

          if (type === 'ERROR' || type === 'BET_REJECTED' || incoming.error) {
            setMessage(String(payload.message ?? incoming.error ?? 'The game request failed.'));
            setPlacing(false);
            return;
          }
          if (type === 'BALANCE' || type === 'BALANCE_UPDATE' || payload.balance !== undefined) {
            setPrivateBalance(numberFrom(payload.balance, payload.walletBalance));
          }
          if (type === 'BET_ACCEPTED' || type === 'BET_PLACED') {
            setMessage(payload.message ?? 'Bet accepted for this round.');
            setPlacing(false);
          }

          const state = payload.round ?? payload;
          const phaseValue = state.status;
          const hasGameState = [
            'GAME_STATE',
            'ROUND_STARTED',
            'BETTING_CLOSED',
            'ROUND_RESULT',
            'POOLS_UPDATED',
          ].includes(type);
          if (hasGameState) {
            setGame((previous) => {
              const poolEnvelope = payload.pools ?? {};
              const pools = poolEnvelope.pools ?? poolEnvelope;
              const nextPhase = String(phaseValue ?? previous.phase).toUpperCase() as Phase;
              const deadline = nextPhase === 'BETTING' ? state.bettingClosesAt : state.revealEndsAt;
              const serverTimestamp = payload.serverTime ? Date.parse(payload.serverTime) : Date.now();
              const deadlineTimestamp = deadline ? Date.parse(deadline) : NaN;
              const parsedEndsAt = Number.isFinite(deadlineTimestamp)
                ? Date.now() + Math.max(0, deadlineTimestamp - serverTimestamp)
                : previous.endsAt;
              const seconds = Number.isFinite(deadlineTimestamp)
                ? Math.max(0, Math.ceil((deadlineTimestamp - serverTimestamp) / 1000))
                : previous.secondsRemaining;
              const isNewBettingRound = nextPhase === 'BETTING'
                && !!state.id
                && state.id !== previous.roundId;
              return {
                phase: nextPhase,
                roundId: state.id ?? payload.roundId ?? previous.roundId,
                secondsRemaining: seconds,
                endsAt: Number.isFinite(parsedEndsAt) ? parsedEndsAt : undefined,
                pools: {
                  DRAGON: numberFrom(pools.DRAGON, previous.pools.DRAGON),
                  TIGER: numberFrom(pools.TIGER, previous.pools.TIGER),
                  TIE: numberFrom(pools.TIE, previous.pools.TIE),
                },
                dragonCard: state.dragonRank ?? (isNewBettingRound ? null : previous.dragonCard),
                tigerCard: state.tigerRank ?? (isNewBettingRound ? null : previous.tigerCard),
                result: state.result ?? (isNewBettingRound ? undefined : previous.result),
              };
            });
          }
        } catch {
          setMessage('Received an unreadable game update.');
        }
      };
      socket.onerror = () => setMessage('Live game connection interrupted.');
      socket.onclose = () => {
        if (disposed) return;
        setConnected(false);
        setPlacing(false);
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
        reconnectAttempt.current += 1;
        retryRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGame((current) => {
        if (!current.endsAt) return current;
        const remaining = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
        return remaining === current.secondsRemaining ? current : { ...current, secondsRemaining: remaining };
      });
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const placeBet = useCallback(() => {
    const amount = Number(stake);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid stake.');
      return;
    }
    if (game.phase !== 'BETTING') {
      setMessage('Betting is closed for this round.');
      return;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setMessage('Reconnecting to the live table. Please wait.');
      return;
    }
    setMessage(null);
    setPlacing(true);
    socket.send(JSON.stringify({
      type: 'BET',
      choice,
      amount,
    }));
  }, [choice, game.phase, game.roundId, stake]);

  const s = styles(colors, insets);
  const isBetting = game.phase === 'BETTING';

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>LIVE TABLE</Text>
          <Text style={s.title}>Dragon Tiger</Text>
        </View>
        <TouchableOpacity
          style={s.walletBadge}
          onPress={() => router.push('/(tabs)/wallet')}
          activeOpacity={0.8}
          testID="button-wallet-balance"
        >
          <Ionicons name="wallet-outline" size={15} color={colors.primary} />
          <Text style={s.walletText}>₹{liveBalance.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: connected ? colors.success : colors.warning }]} />
          <Text style={s.statusText}>{connected ? 'Connected' : 'Reconnecting…'}</Text>
          <Text style={[s.phase, isBetting && s.phaseOpen]}>{game.phase}</Text>
          <Text style={s.timer}>{game.secondsRemaining}s</Text>
        </View>

        <View style={s.table}>
          <View style={s.cardSide}>
            <Text style={s.sideLabel}>DRAGON</Text>
            <View style={[s.playingCard, game.result === 'DRAGON' && s.winnerCard]}>
              <Text style={s.cardText}>{cardLabel(game.dragonCard)}</Text>
            </View>
            <Text style={s.pool}>Pool ₹{game.pools.DRAGON.toFixed(0)}</Text>
          </View>
          <View style={s.versus}>
            <Text style={s.versusText}>VS</Text>
            {game.result && <Text style={s.result}>{game.result === 'TIE' ? 'TIE' : `${game.result} WINS`}</Text>}
          </View>
          <View style={s.cardSide}>
            <Text style={s.sideLabel}>TIGER</Text>
            <View style={[s.playingCard, game.result === 'TIGER' && s.winnerCard]}>
              <Text style={s.cardText}>{cardLabel(game.tigerCard)}</Text>
            </View>
            <Text style={s.pool}>Pool ₹{game.pools.TIGER.toFixed(0)}</Text>
          </View>
        </View>

        <View style={s.betPanel}>
          <Text style={s.sectionTitle}>YOUR BET</Text>
          <View style={s.choices}>
            {(['DRAGON', 'TIE', 'TIGER'] as Choice[]).map((item) => (
              <TouchableOpacity
                key={item}
                style={[s.choice, choice === item && s.choiceSelected]}
                onPress={() => setChoice(item)}
                disabled={!isBetting}
                testID={`button-choice-${item.toLowerCase()}`}
              >
                <Text style={[s.choiceText, choice === item && s.choiceTextSelected]}>{item}</Text>
                <Text style={s.choiceOdds}>{item === 'TIE' ? '8 : 1' : '1 : 1'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.stakeRow}>
            <Text style={s.currency}>₹</Text>
            <TextInput
              value={stake}
              onChangeText={setStake}
              keyboardType="decimal-pad"
              placeholder="Stake"
              placeholderTextColor={colors.mutedForeground}
              style={s.stakeInput}
              editable={isBetting}
              testID="input-stake"
            />
          </View>
          <View style={s.chips}>
            {CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={s.chip}
                onPress={() => setStake(String(numberFrom(stake) + chip))}
                disabled={!isBetting}
                testID={`button-chip-${chip}`}
              >
                <Text style={s.chipText}>+₹{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.betButton, (!isBetting || placing || !connected) && s.disabled]}
            onPress={placeBet}
            disabled={!isBetting || placing || !connected}
            activeOpacity={0.85}
            testID="button-place-bet"
          >
            {placing ? <ActivityIndicator color={colors.primaryForeground} /> : (
              <Text style={s.betButtonText}>{isBetting ? `BET ₹${numberFrom(stake).toFixed(0)} ON ${choice}` : 'BETTING CLOSED'}</Text>
            )}
          </TouchableOpacity>
          {!!message && (
            <View style={s.message}>
              <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
              <Text style={s.messageText}>{message}</Text>
            </View>
          )}
        </View>

        <View style={s.quickLinks}>
          <QuickLink icon="wallet-outline" label="Wallet" onPress={() => router.push('/(tabs)/wallet')} colors={colors} />
          <QuickLink icon="arrow-down-circle-outline" label="Deposit" onPress={() => router.push('/(tabs)/wallet')} colors={colors} />
          <QuickLink icon="arrow-up-circle-outline" label="Withdraw" onPress={() => router.push('/(tabs)/wallet')} colors={colors} />
          <QuickLink icon="headset-outline" label="Support" onPress={() => router.push('/(tabs)/support')} colors={colors} />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickLink({ icon, label, onPress, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity style={quickStyles(colors).item} onPress={onPress} testID={`button-${label.toLowerCase()}`}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={quickStyles(colors).label}>{label}</Text>
    </TouchableOpacity>
  );
}

const quickStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  item: { alignItems: 'center', gap: 6, width: '23%', paddingVertical: 12 },
  label: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});

const styles = (colors: ReturnType<typeof useColors>, insets: { top: number; bottom: number }) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 2, fontFamily: 'Inter_700Bold' },
  title: { color: colors.foreground, fontSize: 25, fontFamily: 'Inter_700Bold' },
  walletBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  walletText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_700Bold' },
  content: { paddingHorizontal: 16, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 110 : 95), gap: 12 },
  statusRow: {
    minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  statusText: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium', flex: 1 },
  phase: { color: colors.warning, fontSize: 11, fontFamily: 'Inter_700Bold', marginRight: 12 },
  phaseOpen: { color: colors.success },
  timer: { color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold', minWidth: 38, textAlign: 'right' },
  table: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  cardSide: { flex: 1, alignItems: 'center', gap: 8 },
  sideLabel: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  playingCard: {
    width: 74, height: 100, borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center',
  },
  winnerCard: { borderColor: colors.primary, backgroundColor: colors.accent },
  cardText: { color: colors.foreground, fontSize: 27, fontFamily: 'Inter_700Bold' },
  pool: { color: colors.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  versus: { width: 70, alignItems: 'center', gap: 8 },
  versusText: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_700Bold' },
  result: { color: colors.primary, fontSize: 10, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  betPanel: { padding: 15, gap: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.accent },
  choiceText: { color: colors.foreground, fontSize: 12, fontFamily: 'Inter_700Bold' },
  choiceTextSelected: { color: colors.primary },
  choiceOdds: { color: colors.mutedForeground, fontSize: 9, marginTop: 2, fontFamily: 'Inter_500Medium' },
  stakeRow: {
    height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background, paddingHorizontal: 13,
  },
  currency: { color: colors.primary, fontSize: 19, fontFamily: 'Inter_700Bold' },
  stakeInput: { flex: 1, color: colors.foreground, fontSize: 19, paddingHorizontal: 8, fontFamily: 'Inter_700Bold' },
  chips: { flexDirection: 'row', gap: 7 },
  chip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9, backgroundColor: colors.secondary },
  chipText: { color: colors.foreground, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  betButton: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.primary },
  disabled: { opacity: 0.45 },
  betButtonText: { color: colors.primaryForeground, fontSize: 13, fontFamily: 'Inter_700Bold' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  messageText: { flex: 1, color: colors.mutedForeground, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  quickLinks: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
  },
});