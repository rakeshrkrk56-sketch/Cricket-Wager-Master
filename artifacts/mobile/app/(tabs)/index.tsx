import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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

const cardParts = (card: Card) => {
  if (card === null || card === undefined) return { rank: '?', suit: '◆', red: false, hidden: true };
  const rankValue = typeof card === 'object' ? card.rank ?? card.value : card;
  const rank = rankValue === 1 ? 'A' : rankValue === 11 ? 'J' : rankValue === 12 ? 'Q' : rankValue === 13 ? 'K' : String(rankValue);
  const rawSuit = typeof card === 'object' ? String(card.suit ?? '') : '';
  const suitMap: Record<string, string> = {
    HEARTS: '♥', HEART: '♥', H: '♥',
    DIAMONDS: '♦', DIAMOND: '♦', D: '♦',
    CLUBS: '♣', CLUB: '♣', C: '♣',
    SPADES: '♠', SPADE: '♠', S: '♠',
  };
  const suit = suitMap[rawSuit.toUpperCase()] ?? rawSuit ?? '◆';
  return { rank, suit: suit || '◆', red: suit === '♥' || suit === '♦', hidden: false };
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
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
  const revealAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          const state = payload.round ?? payload;
          const hasGameState = ['GAME_STATE', 'ROUND_STARTED', 'BETTING_CLOSED', 'ROUND_RESULT', 'POOLS_UPDATED'].includes(type);
          if (hasGameState) {
            setGame((previous) => {
              const poolEnvelope = payload.pools ?? {};
              const pools = poolEnvelope.pools ?? poolEnvelope;
              const nextPhase = String(state.status ?? previous.phase).toUpperCase() as Phase;
              const deadline = nextPhase === 'BETTING' ? state.bettingClosesAt : state.revealEndsAt;
              const serverTimestamp = payload.serverTime ? Date.parse(payload.serverTime) : Date.now();
              const deadlineTimestamp = deadline ? Date.parse(deadline) : NaN;
              const parsedEndsAt = Number.isFinite(deadlineTimestamp)
                ? Date.now() + Math.max(0, deadlineTimestamp - serverTimestamp)
                : previous.endsAt;
              const seconds = Number.isFinite(deadlineTimestamp)
                ? Math.max(0, Math.ceil((deadlineTimestamp - serverTimestamp) / 1000))
                : previous.secondsRemaining;
              const isNewRound = nextPhase === 'BETTING' && !!state.id && state.id !== previous.roundId;
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
                dragonCard: state.dragonRank ?? (isNewRound ? null : previous.dragonCard),
                tigerCard: state.tigerRank ?? (isNewRound ? null : previous.tigerCard),
                result: state.result ?? (isNewRound ? undefined : previous.result),
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

  useEffect(() => {
    revealAnim.setValue(0.15);
    Animated.spring(revealAnim, { toValue: 1, friction: 6, tension: 85, useNativeDriver: true }).start();
  }, [game.dragonCard, game.tigerCard, game.result, revealAnim]);

  useEffect(() => {
    if (game.phase !== 'BETTING' || game.secondsRemaining > 5) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 340, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [game.phase, game.secondsRemaining, pulseAnim]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket.send(JSON.stringify({ type: 'BET', choice, amount }));
  }, [choice, game.phase, stake]);

  const openWallet = (action: 'deposit' | 'withdraw') => {
    router.push({ pathname: '/(tabs)/wallet', params: { open: action, request: Date.now().toString() } });
  };

  const compact = height < 430;
  const s = styles(colors, insets, compact, width);
  const isBetting = game.phase === 'BETTING';

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.background, colors.card, colors.background]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <View style={s.brand}>
          <View style={s.brandMark}><Text style={s.brandMarkText}>JT</Text></View>
          <View>
            <Text style={s.eyebrow}>LIVE • DRAGON TIGER</Text>
            <Text style={s.title}>Jazment</Text>
          </View>
        </View>

        <TouchableOpacity style={s.balance} onPress={() => router.push('/(tabs)/wallet')} activeOpacity={0.8}>
          <Ionicons name="wallet" size={compact ? 15 : 18} color={colors.primary} />
          <View>
            <Text style={s.balanceLabel}>BALANCE</Text>
            <Text style={s.balanceValue}>₹{liveBalance.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>

        <View style={s.cashActions}>
          <CashButton icon="add-circle" label="Deposit" primary onPress={() => openWallet('deposit')} colors={colors} compact={compact} />
          <CashButton icon="arrow-up-circle" label="Withdraw" onPress={() => openWallet('withdraw')} colors={colors} compact={compact} />
        </View>

        <View style={s.connection}>
          <View style={[s.dot, { backgroundColor: connected ? colors.success : colors.warning }]} />
          <Text style={s.connectionText}>{connected ? 'LIVE' : 'CONNECTING'}</Text>
        </View>
      </View>

      <View style={s.gameArea}>
        <View style={s.tablePanel}>
          <View style={s.tableTop}>
            <Text style={s.roundText}>ROUND {game.roundId ? game.roundId.slice(-6).toUpperCase() : '------'}</Text>
            <View style={[s.phasePill, isBetting && s.phaseOpen]}>
              <Text style={[s.phaseText, isBetting && s.phaseTextOpen]}>{isBetting ? 'PLACE YOUR BETS' : game.phase}</Text>
            </View>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={s.timer}>{game.secondsRemaining}<Text style={s.timerUnit}>s</Text></Text>
            </Animated.View>
          </View>

          <ImageBackground
            source={require('../../assets/images/dragon-tiger-casino-wide.png')}
            style={s.tableFelt}
            imageStyle={s.tableArtwork}
            resizeMode="cover"
          >
            <View style={s.artworkVeil} />
            <PlayerSide
              label="DRAGON"
              card={game.dragonCard}
              pool={game.pools.DRAGON}
              winner={game.result === 'DRAGON'}
              colors={colors}
              compact={compact}
              animation={revealAnim}
            />
            <View style={s.centerResult}>
              <View style={s.vsDisc}><Text style={s.vsText}>VS</Text></View>
              <Text style={s.tiePool}>TIE POOL ₹{game.pools.TIE.toFixed(0)}</Text>
              {game.result && <Text style={s.resultText}>{game.result === 'TIE' ? 'TIE' : `${game.result} WINS`}</Text>}
            </View>
            <PlayerSide
              label="TIGER"
              card={game.tigerCard}
              pool={game.pools.TIGER}
              winner={game.result === 'TIGER'}
              colors={colors}
              compact={compact}
              animation={revealAnim}
            />
          </ImageBackground>
        </View>

        <View style={s.betPanel}>
          <View style={s.betHeading}>
            <View>
              <Text style={s.sectionEyebrow}>BET SLIP</Text>
              <Text style={s.sectionTitle}>Choose a side</Text>
            </View>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          </View>

          <View style={s.choices}>
            {(['DRAGON', 'TIE', 'TIGER'] as Choice[]).map((item) => (
              <TouchableOpacity
                key={item}
                style={[s.choice, choice === item && s.choiceSelected]}
                onPress={() => {
                  setChoice(item);
                  Haptics.selectionAsync();
                }}
                disabled={!isBetting}
                testID={`button-choice-${item.toLowerCase()}`}
              >
                <Text style={[s.choiceText, choice === item && s.choiceTextSelected]}>{item}</Text>
                <Text style={s.choiceOdds}>{item === 'TIE' ? '8 : 1' : '1 : 1'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.amountRow}>
            <View style={s.stakeRow}>
              <Text style={s.currency}>₹</Text>
              <TextInput
                value={stake}
                onChangeText={setStake}
                keyboardType="decimal-pad"
                placeholder="Amount"
                placeholderTextColor={colors.mutedForeground}
                style={s.stakeInput}
                editable={isBetting}
                testID="input-stake"
              />
            </View>
            <TouchableOpacity style={s.clearButton} onPress={() => setStake('')} disabled={!isBetting}>
              <Ionicons name="backspace-outline" size={19} color={colors.mutedForeground} />
            </TouchableOpacity>
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
                <Text style={s.chipText}>+{chip}</Text>
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
              <>
                <Ionicons name="flash" size={18} color={colors.primaryForeground} />
                <Text style={s.betButtonText}>{isBetting ? `BET ₹${numberFrom(stake).toFixed(0)} ON ${choice}` : 'BETTING CLOSED'}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.message}>
            <Ionicons
              name={message ? 'information-circle' : 'lock-closed'}
              size={15}
              color={message ? colors.primary : colors.mutedForeground}
            />
            <Text style={s.messageText} numberOfLines={2}>
              {message ?? 'Server-controlled results • Secure wallet settlement'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CashButton({ icon, label, primary, onPress, colors, compact }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  compact: boolean;
}) {
  const s = styles(colors, { top: 0, bottom: 0 }, compact, 800);
  return (
    <TouchableOpacity style={[s.cashButton, primary && s.cashButtonPrimary]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={compact ? 16 : 19} color={primary ? colors.primaryForeground : colors.foreground} />
      <Text style={[s.cashButtonText, primary && s.cashButtonTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PlayerSide({ label, card, pool, winner, colors, compact, animation }: {
  label: string;
  card: Card;
  pool: number;
  winner: boolean;
  colors: ReturnType<typeof useColors>;
  compact: boolean;
  animation: Animated.Value;
}) {
  const s = styles(colors, { top: 0, bottom: 0 }, compact, 800);
  const parts = cardParts(card);
  return (
    <View style={s.playerSide}>
      <View style={s.playerLabelRow}>
        <Text style={s.playerLabel}>{label}</Text>
        {winner && <Ionicons name="trophy" size={15} color={colors.primary} />}
      </View>
      <Animated.View
        style={[
          s.playingCard,
          parts.hidden && s.hiddenCard,
          winner && s.winnerCard,
          {
            opacity: animation,
            transform: [
              { scale: animation },
              { rotateY: animation.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
            ],
          },
        ]}
      >
        <Text style={[s.cardRank, parts.red && { color: colors.destructive }]}>{parts.rank}</Text>
        <Text style={[s.cardSuit, parts.red && { color: colors.destructive }]}>{parts.suit}</Text>
      </Animated.View>
      <Text style={s.poolText}>POOL ₹{pool.toFixed(0)}</Text>
    </View>
  );
}

const styles = (
  colors: ReturnType<typeof useColors>,
  insets: { top: number; bottom: number; left?: number; right?: number },
  compact: boolean,
  width: number,
) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: compact ? 58 : 72,
    paddingTop: insets.top + (Platform.OS === 'web' ? 8 : 4),
    paddingLeft: Math.max(insets.left ?? 0, 12),
    paddingRight: Math.max(insets.right ?? 0, 12),
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 8 : 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: width > 850 ? 160 : 120 },
  brandMark: {
    width: compact ? 34 : 42,
    height: compact ? 34 : 42,
    borderRadius: compact ? 17 : 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  brandMarkText: { color: colors.primaryForeground, fontSize: compact ? 12 : 14, fontFamily: 'Inter_700Bold' },
  eyebrow: { color: colors.primary, fontSize: compact ? 7 : 9, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  title: { color: colors.foreground, fontSize: compact ? 16 : 21, fontFamily: 'Inter_700Bold' },
  balance: {
    minWidth: compact ? 106 : 130,
    height: compact ? 38 : 46,
    paddingHorizontal: compact ? 9 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: colors.radius,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabel: { color: colors.mutedForeground, fontSize: 7, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  balanceValue: { color: colors.foreground, fontSize: compact ? 13 : 16, fontFamily: 'Inter_700Bold' },
  cashActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashButton: {
    height: compact ? 38 : 46,
    minWidth: compact ? 92 : 118,
    paddingHorizontal: compact ? 10 : 16,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  cashButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  cashButtonText: { color: colors.foreground, fontSize: compact ? 11 : 13, fontFamily: 'Inter_700Bold' },
  cashButtonTextPrimary: { color: colors.primaryForeground },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  gameArea: {
    flex: 1,
    flexDirection: 'row',
    gap: compact ? 8 : 12,
    paddingHorizontal: 12,
    paddingTop: compact ? 8 : 12,
    paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 84 : 58) + 6,
  },
  tablePanel: {
    flex: 1.55,
    borderRadius: colors.radius + 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  tableTop: {
    height: compact ? 38 : 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roundText: { flex: 1, color: colors.mutedForeground, fontSize: compact ? 8 : 10, letterSpacing: 1.1, fontFamily: 'Inter_600SemiBold' },
  phasePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.secondary },
  phaseOpen: { backgroundColor: colors.success + '24' },
  phaseText: { color: colors.warning, fontSize: compact ? 8 : 9, letterSpacing: 0.8, fontFamily: 'Inter_700Bold' },
  phaseTextOpen: { color: colors.success },
  timer: { color: colors.foreground, fontSize: compact ? 21 : 27, fontFamily: 'Inter_700Bold', minWidth: 42, textAlign: 'right' },
  timerUnit: { color: colors.mutedForeground, fontSize: 11 },
  tableFelt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: compact ? 10 : 18,
  },
  tableArtwork: { opacity: 0.72 },
  artworkVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background + '28',
  },
  playerSide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 7 },
  playerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  playerLabel: { color: colors.foreground, fontSize: compact ? 10 : 13, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
  playingCard: {
    width: compact ? 62 : 82,
    height: compact ? 84 : 112,
    padding: compact ? 7 : 9,
    borderRadius: colors.radius,
    backgroundColor: colors.foreground,
    borderWidth: 2,
    borderColor: colors.mutedForeground,
    justifyContent: 'space-between',
  },
  hiddenCard: { backgroundColor: colors.secondary, borderColor: colors.primary },
  winnerCard: { borderColor: colors.primary, borderWidth: 3 },
  cardRank: { color: colors.background, fontSize: compact ? 21 : 29, fontFamily: 'Inter_700Bold' },
  cardSuit: { color: colors.background, fontSize: compact ? 22 : 31, alignSelf: 'flex-end' },
  poolText: { color: colors.primary, fontSize: compact ? 8 : 10, letterSpacing: 0.7, fontFamily: 'Inter_700Bold' },
  centerResult: { width: compact ? 100 : 130, alignItems: 'center', gap: compact ? 5 : 9 },
  vsDisc: {
    width: compact ? 39 : 50,
    height: compact ? 39 : 50,
    borderRadius: compact ? 20 : 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  vsText: { color: colors.primary, fontSize: compact ? 13 : 16, fontFamily: 'Inter_700Bold' },
  tiePool: { color: colors.mutedForeground, fontSize: compact ? 7 : 9, fontFamily: 'Inter_600SemiBold' },
  resultText: { color: colors.success, fontSize: compact ? 9 : 11, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  betPanel: {
    flex: 1,
    minWidth: 260,
    padding: compact ? 10 : 14,
    gap: compact ? 7 : 10,
    borderRadius: colors.radius + 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  betHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionEyebrow: { color: colors.primary, fontSize: 8, letterSpacing: 1.4, fontFamily: 'Inter_700Bold' },
  sectionTitle: { color: colors.foreground, fontSize: compact ? 14 : 18, fontFamily: 'Inter_700Bold' },
  choices: { flexDirection: 'row', gap: 6 },
  choice: {
    flex: 1,
    minHeight: compact ? 40 : 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
  choiceText: { color: colors.foreground, fontSize: compact ? 9 : 11, fontFamily: 'Inter_700Bold' },
  choiceTextSelected: { color: colors.primary },
  choiceOdds: { color: colors.mutedForeground, fontSize: 8, marginTop: 1, fontFamily: 'Inter_500Medium' },
  amountRow: { flexDirection: 'row', gap: 6 },
  stakeRow: {
    flex: 1,
    height: compact ? 38 : 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
  },
  currency: { color: colors.primary, fontSize: compact ? 15 : 18, fontFamily: 'Inter_700Bold' },
  stakeInput: { flex: 1, color: colors.foreground, fontSize: compact ? 15 : 18, paddingHorizontal: 7, fontFamily: 'Inter_700Bold' },
  clearButton: {
    width: compact ? 38 : 46,
    height: compact ? 38 : 46,
    borderRadius: colors.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    paddingVertical: compact ? 7 : 9,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.foreground, fontSize: compact ? 9 : 11, fontFamily: 'Inter_700Bold' },
  betButton: {
    minHeight: compact ? 41 : 49,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: colors.radius,
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.45 },
  betButtonText: { color: colors.primaryForeground, fontSize: compact ? 10 : 12, fontFamily: 'Inter_700Bold' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 },
  messageText: { flex: 1, color: colors.mutedForeground, fontSize: compact ? 8 : 9, lineHeight: compact ? 11 : 13, fontFamily: 'Inter_400Regular' },
});