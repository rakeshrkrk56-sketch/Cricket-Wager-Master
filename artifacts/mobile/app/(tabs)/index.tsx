import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAuth } from '@/contexts/AuthContext';
import { useGameAudio } from '@/hooks/useGameAudio';
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
  const { game } = useLocalSearchParams<{ game?: string }>();
  return game === 'dragon-tiger' ? <DragonTigerGame /> : <GameLobby />;
}

function GameLobby() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, token } = useAuth();
  const isPortrait = height > width;
  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const balance = Number(walletData?.balance ?? user?.walletBalance ?? 0);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    }
  }, []));

  const openWallet = (action: 'deposit' | 'withdraw') => {
    router.push({ pathname: '/(tabs)/wallet', params: { open: action, request: Date.now().toString() } });
  };

  const openDragonTiger = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/(tabs)', params: { game: 'dragon-tiger' } });
  };

  return (
    <LinearGradient
      colors={['#6B1020', '#A51D25', '#E24A19']}
      locations={[0, 0.58, 1]}
      style={lobbyStyles.root}
    >
      <View style={[
        lobbyStyles.safeContent,
        {
          paddingTop: Math.max(insets.top, 8),
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
          paddingBottom: Math.max(insets.bottom, 8) + (Platform.OS === 'web' ? 84 : 56),
        },
      ]}>
        <View style={[lobbyStyles.header, isPortrait && lobbyStyles.headerPortrait]}>
          <View style={lobbyStyles.profileBlock}>
            <LinearGradient colors={['#FFE58A', '#F59E0B']} style={lobbyStyles.avatar}>
              <Ionicons name="person" size={24} color="#7C2D12" />
            </LinearGradient>
            <View>
              <Text style={lobbyStyles.eyebrow}>JAZMENT WALLET</Text>
              <Text style={lobbyStyles.balance}>₹{balance.toFixed(2)}</Text>
            </View>
          </View>

          <View style={lobbyStyles.cashActions}>
            <TouchableOpacity style={lobbyStyles.cashButton} onPress={() => openWallet('deposit')} testID="lobby-deposit">
              <Ionicons name="add-circle" size={17} color="#7C2D12" />
              <Text style={lobbyStyles.cashButtonText}>ADD CASH</Text>
            </TouchableOpacity>
            <TouchableOpacity style={lobbyStyles.withdrawButton} onPress={() => openWallet('withdraw')} testID="lobby-withdraw">
              <Ionicons name="cash-outline" size={17} color="#FFE8A3" />
              <Text style={lobbyStyles.withdrawText}>WITHDRAW</Text>
            </TouchableOpacity>
          </View>

          <View style={[lobbyStyles.headerTools, isPortrait && lobbyStyles.headerToolsPortrait]}>
            <View style={lobbyStyles.livePill}>
              <View style={lobbyStyles.liveDot} />
              <Text style={lobbyStyles.liveText}>LIVE GAMES</Text>
            </View>
            <TouchableOpacity style={lobbyStyles.toolButton} onPress={() => router.push('/(tabs)/notifications')}>
              <Ionicons name="notifications" size={18} color="#FFF2C7" />
            </TouchableOpacity>
            <TouchableOpacity style={lobbyStyles.toolButton} onPress={() => router.push('/(tabs)/support')} testID="lobby-support">
              <Ionicons name="headset" size={19} color="#FFF2C7" />
            </TouchableOpacity>
            <TouchableOpacity style={lobbyStyles.toolButton} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person-circle" size={20} color="#FFF2C7" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[lobbyStyles.body, isPortrait && lobbyStyles.bodyPortrait]}>
          <TouchableOpacity style={[lobbyStyles.hero, isPortrait && lobbyStyles.heroPortrait]} onPress={openDragonTiger} activeOpacity={0.9} testID="lobby-featured-dragon-tiger">
            <Image source={require('../../assets/images/dragon-tiger-casino-wide.png')} style={lobbyStyles.heroImage} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(45,6,12,0.92)']} style={StyleSheet.absoluteFill} />
            <View style={lobbyStyles.featuredBadge}>
              <Ionicons name="flash" size={11} color="#7C2D12" />
              <Text style={lobbyStyles.featuredBadgeText}>LIVE NOW</Text>
            </View>
            <View style={lobbyStyles.heroCopy}>
              <Text style={lobbyStyles.heroTitle}>DRAGON TIGER</Text>
              <Text style={lobbyStyles.heroSubtitle}>Fast rounds • Real wallet</Text>
              <View style={lobbyStyles.playNow}>
                <Text style={lobbyStyles.playNowText}>PLAY NOW</Text>
                <Ionicons name="play" size={12} color="#7C2D12" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={lobbyStyles.catalog}>
            <View style={lobbyStyles.sectionHeading}>
              <View>
                <Text style={lobbyStyles.sectionTitle}>CHOOSE A GAME</Text>
                <Text style={lobbyStyles.sectionSubtitle}>More games will appear here</Text>
              </View>
              <Text style={lobbyStyles.gameCount}>1 LIVE</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={lobbyStyles.gameRow}>
              <TouchableOpacity style={lobbyStyles.gameCard} onPress={openDragonTiger} testID="lobby-game-dragon-tiger">
                <Image source={require('../../assets/images/icon.png')} style={lobbyStyles.gameImage} />
                <View style={lobbyStyles.hotBadge}><Text style={lobbyStyles.hotText}>HOT</Text></View>
                <View style={lobbyStyles.gameCardFooter}>
                  <Text style={lobbyStyles.gameTitle}>Dragon Tiger</Text>
                  <Text style={lobbyStyles.gameMeta}>Live table</Text>
                </View>
              </TouchableOpacity>

              <View style={lobbyStyles.comingCard}>
                <Ionicons name="game-controller" size={30} color="#FFD76A" />
                <Text style={lobbyStyles.comingTitle}>MORE GAMES</Text>
                <Text style={lobbyStyles.comingText}>Coming soon</Text>
              </View>
              <View style={lobbyStyles.comingCard}>
                <Ionicons name="dice" size={30} color="#FFD76A" />
                <Text style={lobbyStyles.comingTitle}>NEW TABLE</Text>
                <Text style={lobbyStyles.comingText}>Coming soon</Text>
              </View>
            </ScrollView>

            <View style={lobbyStyles.recentRow}>
              <Ionicons name="time" size={14} color="#FFD76A" />
              <Text style={lobbyStyles.recentLabel}>RECENTLY PLAYED</Text>
              <TouchableOpacity style={lobbyStyles.recentChip} onPress={openDragonTiger}>
                <Image source={require('../../assets/images/icon.png')} style={lobbyStyles.recentIcon} />
                <Text style={lobbyStyles.recentName}>Dragon Tiger</Text>
                <Ionicons name="chevron-forward" size={13} color="#7C2D12" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

// --- GAME LOGIC ---

function useGameLayout(width: number, height: number) {
  return useMemo(() => {
    const TOP_RAIL_H = 44;
    const HEADER_AREA_H = 90;
    const BOTTOM_BAR_H = 70;
    
    const boardSpaceY = TOP_RAIL_H + HEADER_AREA_H;
    const boardSpaceH = height - boardSpaceY - BOTTOM_BAR_H;
    
    const BOARD_MARGIN = 16;
    const BOARD_W = width - BOARD_MARGIN * 2;
    const ZONE_W = Math.floor(BOARD_W / 3);
    const BOARD_H = boardSpaceH;
    
    const BOARD_X = BOARD_MARGIN;
    const BOARD_Y = boardSpaceY;

    const DRAGON_ZONE = { x: BOARD_X, y: BOARD_Y, w: ZONE_W - 4, h: BOARD_H };
    const TIE_ZONE = { x: BOARD_X + ZONE_W + 2, y: BOARD_Y, w: ZONE_W - 4, h: BOARD_H };
    const TIGER_ZONE = { x: BOARD_X + ZONE_W * 2 + 4, y: BOARD_Y, w: ZONE_W - 4, h: BOARD_H };

    const CHIP_SPACING = 56;
    const CHIP_SELECTOR_W = CHIPS.length * CHIP_SPACING;
    const CHIP_SELECTOR_X = (width - CHIP_SELECTOR_W) / 2;
    const CHIP_SELECTOR_Y = height - BOTTOM_BAR_H + 12;
    
    const CARDS_Y = TOP_RAIL_H + 10;
    const CARD_W = 56;
    const CARD_H = 78;
    const DRAGON_CARD_X = width / 2 - CARD_W - 35;
    const TIGER_CARD_X = width / 2 + 35;
    const SHOE_X = width / 2 - CARD_W / 2;
    const SHOE_Y = -CARD_H;

    return {
      TOP_RAIL_H, BOTTOM_BAR_H, BOARD_W, BOARD_H, BOARD_X, BOARD_Y,
      DRAGON_ZONE, TIE_ZONE, TIGER_ZONE,
      CHIP_SPACING, CHIP_SELECTOR_W, CHIP_SELECTOR_X, CHIP_SELECTOR_Y,
      CARDS_Y, CARD_W, CARD_H, DRAGON_CARD_X, TIGER_CARD_X, SHOE_X, SHOE_Y
    };
  }, [width, height]);
}

interface RenderChip {
  id: string;
  amount: number;
  choice: Choice;
  anim: Animated.Value;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  isMine: boolean;
}

interface PendingBet {
  amount: number;
  choice: Choice;
  roundId: string;
  chipId?: string;
}

interface RecoveredBet {
  roundId: string;
  choice: Choice;
  amount: number;
}

function DragonTigerGame() {
  const insets = useSafeAreaInsets();
  const rawDim = useWindowDimensions();
  const width = rawDim.width;
  const height = rawDim.height;
  const isLandscape = width >= height;
  const layout = useGameLayout(width, height);

  const { user, token } = useAuth();
  const { muted, play: playSound, toggleMuted } = useGameAudio();
  const [game, setGame] = useState<GameState>(EMPTY_GAME);
  const [history, setHistory] = useState<{roundId: string, result: Choice}[]>([]);
  const [connected, setConnected] = useState(false);
  const [stake, setStake] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [selectedChip, setSelectedChip] = useState<number | null>(null);
  const [privateBalance, setPrivateBalance] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [presentedResult, setPresentedResult] = useState<Choice | null>(null);
  const [recoveredBets, setRecoveredBets] = useState<RecoveredBet[] | null>(null);
  
  const [chips, setChips] = useState<RenderChip[]>([]);
  
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const pendingBetsRef = useRef(new Map<string, PendingBet>());
  const activeRoundRef = useRef<string | undefined>(undefined);
  const lockedChoiceRef = useRef<Choice | null>(null);
  const selectedChipRef = useRef<number | null>(null);
  const prevPoolsRef = useRef(game.pools);
  const chipSerialRef = useRef(0);
  const betSequenceRef = useRef(0);
  const ownPoolDeltaRef = useRef<Record<Choice, number>>({ DRAGON: 0, TIGER: 0, TIE: 0 });
  const resultTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chipAnimationsRef = useRef(new Map<string, Animated.CompositeAnimation>());
  const previousPhaseRef = useRef<Phase>('WAITING');
  const countdownSoundRef = useRef('');
  
  const dragonCardAnim = useRef(new Animated.Value(0)).current;
  const tigerCardAnim = useRef(new Animated.Value(0)).current;

  const stopChipAnimations = useCallback((ids?: string[]) => {
    const selectedIds = ids ?? [...chipAnimationsRef.current.keys()];
    selectedIds.forEach((id) => {
      chipAnimationsRef.current.get(id)?.stop();
      chipAnimationsRef.current.delete(id);
    });
  }, []);

  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const liveBalance = privateBalance ?? Number(walletData?.balance ?? user?.walletBalance ?? 0);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
      }
    };
  }, []));

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
          const clientBetId = typeof payload.clientBetId === 'string' ? payload.clientBetId : '';
          
          if (type === 'ERROR' || type === 'BET_REJECTED' || incoming.error) {
            const rejectedBet = clientBetId ? pendingBetsRef.current.get(clientBetId) : undefined;
            if (clientBetId) pendingBetsRef.current.delete(clientBetId);
            if (rejectedBet?.chipId) {
              stopChipAnimations([rejectedBet.chipId]);
              setChips((current) => current.filter((chip) => chip.id !== rejectedBet.chipId));
            }
            setMessage(String(payload.message ?? incoming.error ?? 'The game request failed.'));
            setPlacing(pendingBetsRef.current.size > 0);
            void playSound('betRejected');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
          if (type === 'BALANCE' || type === 'BALANCE_UPDATE' || payload.balance !== undefined) {
            setPrivateBalance(numberFrom(payload.balance, payload.walletBalance));
          }
          if (type === 'BET_ACCEPTED' || type === 'BET_PLACED') {
            const acceptedBet = clientBetId ? pendingBetsRef.current.get(clientBetId) : undefined;
            if (clientBetId) pendingBetsRef.current.delete(clientBetId);
            const acceptedAmount = numberFrom(payload.bet?.amount, payload.amount, acceptedBet?.amount);
            const acceptedChoice = String(payload.bet?.choice ?? acceptedBet?.choice ?? '').toUpperCase() as Choice;
            const acceptedRoundId = String(payload.bet?.roundId ?? acceptedBet?.roundId ?? '');
            const belongsToCurrentRound = !acceptedRoundId || acceptedRoundId === activeRoundRef.current;
            if (acceptedBet?.chipId) {
              setChips((current) => belongsToCurrentRound
                ? current.map((chip) => (
                  chip.id === acceptedBet.chipId ? { ...chip, isMine: false } : chip
                ))
                : current.filter((chip) => chip.id !== acceptedBet.chipId));
            }
            if (belongsToCurrentRound && ['DRAGON', 'TIGER', 'TIE'].includes(acceptedChoice)) {
              ownPoolDeltaRef.current[acceptedChoice] += acceptedAmount;
            }
            if (belongsToCurrentRound && acceptedAmount > 0) {
              setStake((current) => current + acceptedAmount);
            }
            setPlacing(pendingBetsRef.current.size > 0);
            if (belongsToCurrentRound) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              void playSound('betAccepted');
            }
          }

          if (type === 'ROUND_RESULT') {
            const resultChoice = String(payload.round?.result ?? payload.result ?? '').toUpperCase() as Choice;
            const resultRoundId = String(payload.round?.id ?? payload.id ?? payload.roundId ?? '');
            if (['DRAGON', 'TIGER', 'TIE'].includes(resultChoice)) {
              resultTimersRef.current.forEach(clearTimeout);
              resultTimersRef.current = [];
              setPresentedResult(resultChoice);
              const lockedChoice = lockedChoiceRef.current;
              if (lockedChoice) {
                void playSound(lockedChoice === resultChoice ? 'resultWin' : 'resultLoss');
                Haptics.notificationAsync(
                  lockedChoice === resultChoice
                    ? Haptics.NotificationFeedbackType.Success
                    : Haptics.NotificationFeedbackType.Error,
                );
              }

              resultTimersRef.current.push(setTimeout(() => {
                void playSound('chipCollect');
                setChips((current) => {
                  current
                    .filter((chip) => (!resultRoundId || chip.id.startsWith(`${resultRoundId}-`)) && chip.choice !== resultChoice)
                    .forEach((chip, index) => {
                      const animation = Animated.timing(chip.anim, {
                        toValue: 2,
                        duration: 400 + (index % 5) * 40,
                        easing: Easing.in(Easing.cubic),
                        useNativeDriver: true,
                      });
                      chipAnimationsRef.current.set(chip.id, animation);
                      animation.start(() => chipAnimationsRef.current.delete(chip.id));
                    });
                  return current;
                });
              }, 400));

              resultTimersRef.current.push(setTimeout(() => {
                void playSound('chipCollect');
                setChips((current) => {
                  current
                    .filter((chip) => (!resultRoundId || chip.id.startsWith(`${resultRoundId}-`)) && chip.choice === resultChoice)
                    .forEach((chip, index) => {
                      const animation = Animated.timing(chip.anim, {
                        toValue: 3,
                        duration: 500 + (index % 5) * 40,
                        easing: Easing.in(Easing.cubic),
                        useNativeDriver: true,
                      });
                      chipAnimationsRef.current.set(chip.id, animation);
                      animation.start(() => chipAnimationsRef.current.delete(chip.id));
                    });
                  return current;
                });
              }, 1200));

              resultTimersRef.current.push(setTimeout(() => {
                setPresentedResult(null);
                if (resultRoundId) {
                  setChips((current) => {
                    const removedIds = current
                      .filter((chip) => chip.id.startsWith(`${resultRoundId}-`))
                      .map((chip) => chip.id);
                    stopChipAnimations(removedIds);
                    return current.filter((chip) => !chip.id.startsWith(`${resultRoundId}-`));
                  });
                }
              }, 2200));
            }
          }

          if (type === 'GAME_STATE' && payload.round === null) {
            stopChipAnimations();
            pendingBetsRef.current.clear();
            lockedChoiceRef.current = null;
            selectedChipRef.current = null;
            activeRoundRef.current = undefined;
            setGame({
              ...EMPTY_GAME,
              pools: {
                DRAGON: numberFrom(payload.pools?.DRAGON),
                TIGER: numberFrom(payload.pools?.TIGER),
                TIE: numberFrom(payload.pools?.TIE),
              },
            });
            setStake(0);
            setChoice(null);
            setSelectedChip(null);
            setPlacing(false);
            setRecoveredBets(null);
            setChips([]);
            return;
          }

          if (type === 'GAME_STATE' && Array.isArray(payload.myBets)) {
            const syncedBets = payload.myBets
              .map((bet: Record<string, unknown>) => ({
                roundId: String(bet.roundId ?? ''),
                choice: String(bet.choice ?? '').toUpperCase() as Choice,
                amount: numberFrom(bet.amount),
              }))
              .filter((bet: RecoveredBet) => (
                bet.roundId === payload.round?.id
                && ['DRAGON', 'TIGER', 'TIE'].includes(bet.choice)
                && bet.amount > 0
              ));
            setRecoveredBets(syncedBets);
            const syncedPools = payload.pools?.pools ?? payload.pools ?? {};
            prevPoolsRef.current = {
              DRAGON: numberFrom(syncedPools.DRAGON),
              TIGER: numberFrom(syncedPools.TIGER),
              TIE: numberFrom(syncedPools.TIE),
            };
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
      resultTimersRef.current.forEach(clearTimeout);
      resultTimersRef.current = [];
      stopChipAnimations();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [token, playSound, stopChipAnimations]);

  useEffect(() => {
    if (game.result && game.roundId) {
      setHistory(prev => {
        const last = prev[prev.length - 1];
        if (last?.roundId !== game.roundId) {
          return [...prev, { roundId: game.roundId!, result: game.result as Choice }].slice(-30);
        }
        if (last?.roundId === game.roundId && last.result !== game.result) {
          const copy = [...prev];
          copy[copy.length - 1] = { roundId: game.roundId!, result: game.result as Choice };
          return copy;
        }
        return prev;
      });
    }
  }, [game.result, game.roundId]);

  useEffect(() => {
    if (!game.roundId || activeRoundRef.current === game.roundId) return;
    activeRoundRef.current = game.roundId;
    pendingBetsRef.current.clear();
    lockedChoiceRef.current = null;
    selectedChipRef.current = null;
    setStake(0);
    setChoice(null);
    setSelectedChip(null);
    setPlacing(false);
    
    ownPoolDeltaRef.current = { DRAGON: 0, TIGER: 0, TIE: 0 };
    prevPoolsRef.current = { DRAGON: 0, TIGER: 0, TIE: 0 };
  }, [game.roundId]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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

  const spawnChip = useCallback((amount: number, targetChoice: Choice, isMine: boolean, requestedId?: string) => {
    const serial = chipSerialRef.current++;
    const id = requestedId ?? `${game.roundId ?? 'round'}-pool-${serial}`;
    const targetZone = targetChoice === 'DRAGON' ? layout.DRAGON_ZONE : targetChoice === 'TIGER' ? layout.TIGER_ZONE : layout.TIE_ZONE;
    
    const angle = ((serial * 137.508) % 360) * (Math.PI / 180);
    const radius = (((serial * 73) % 101) / 100) * (Math.min(targetZone.w, targetZone.h) * 0.3);
    const targetX = targetZone.x + targetZone.w / 2 + Math.cos(angle) * radius - 16;
    const targetY = targetZone.y + targetZone.h / 2 + Math.sin(angle) * radius - 16;
    
    let startX = width / 2;
    let startY = height;
    
    if (!isMine) {
      const edge = serial % 4;
      const edgeOffset = ((serial * 47) % 100) / 100;
      if (edge === 0) { startX = width * edgeOffset; startY = -40; }
      else if (edge === 1) { startX = width * edgeOffset; startY = height + 40; }
      else if (edge === 2) { startX = -40; startY = height * edgeOffset; }
      else { startX = width + 40; startY = height * edgeOffset; }
    } else {
      const index = Math.max(0, CHIPS.indexOf(amount));
      startX = layout.CHIP_SELECTOR_X + index * layout.CHIP_SPACING + layout.CHIP_SPACING / 2 - 16;
      startY = layout.CHIP_SELECTOR_Y;
    }
    
    const anim = new Animated.Value(0);
    setChips((previous) => {
      const sameChoice = previous.filter((chip) => chip.choice === targetChoice && !chip.isMine);
      const overflowIds = new Set(
        sameChoice.slice(0, Math.max(0, sameChoice.length - 23)).map((chip) => chip.id),
      );
      stopChipAnimations([...overflowIds]);
      const bounded = previous.filter((chip) => !overflowIds.has(chip.id));
      return [...bounded, { id, amount, choice: targetChoice, anim, startX, startY, targetX, targetY, isMine }];
    });
    
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: isMine ? 400 : 520 + (serial % 4) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    chipAnimationsRef.current.set(id, animation);
    animation.start(() => chipAnimationsRef.current.delete(id));
    return id;
  }, [game.roundId, width, height, layout, stopChipAnimations]);

  useEffect(() => {
    if (recoveredBets === null || !game.roundId) return;
    const currentRoundBets = recoveredBets.filter((bet) => bet.roundId === game.roundId);
    const recoveredChoice = currentRoundBets[0]?.choice ?? null;
    const recoveredStake = recoveredChoice
      ? currentRoundBets
          .filter((bet) => bet.choice === recoveredChoice)
          .reduce((sum, bet) => sum + bet.amount, 0)
      : 0;

    pendingBetsRef.current.clear();
    setPlacing(false);
    lockedChoiceRef.current = recoveredChoice;
    setChoice(recoveredChoice);
    setStake(recoveredStake);
    ownPoolDeltaRef.current = { DRAGON: 0, TIGER: 0, TIE: 0 };
    prevPoolsRef.current = { ...game.pools };
    setChips((current) => {
      const oldRoundChips = current
        .filter((chip) => chip.id.startsWith(`${game.roundId}-`))
        .map((chip) => chip.id);
      stopChipAnimations(oldRoundChips);
      return current.filter((chip) => !chip.id.startsWith(`${game.roundId}-`));
    });

    if (recoveredChoice && recoveredStake > 0) {
      let remaining = recoveredStake;
      let rendered = 0;
      while (remaining > 0 && rendered < 12) {
        const amount = remaining >= 500 ? 500 : remaining >= 100 ? 100 : remaining >= 50 ? 50 : 10;
        spawnChip(amount, recoveredChoice, false, `${game.roundId}-recovered-${rendered}`);
        remaining -= amount;
        rendered += 1;
      }
    }
    setRecoveredBets(null);
  }, [game.pools, game.roundId, recoveredBets, spawnChip, stopChipAnimations]);

  useEffect(() => {
    if (game.phase !== 'BETTING') return;
    const newChips: Array<{ amount: number, choice: Choice }> = [];
    
    (['DRAGON', 'TIGER', 'TIE'] as Choice[]).forEach(c => {
      const diff = game.pools[c] - prevPoolsRef.current[c];
      if (diff > 0) {
        const coveredByOwnBet = Math.min(diff, ownPoolDeltaRef.current[c]);
        ownPoolDeltaRef.current[c] -= coveredByOwnBet;
        let remaining = diff - coveredByOwnBet;
        let spawned = 0;
        while (remaining > 0 && spawned < 3) {
          const chipVal = remaining >= 500 ? 500 : remaining >= 100 ? 100 : remaining >= 50 ? 50 : 10;
          newChips.push({ amount: chipVal, choice: c });
          remaining -= chipVal;
          spawned++;
        }
      }
    });
    
    const timers = newChips.map((chip, index) => setTimeout(
      () => spawnChip(chip.amount, chip.choice, false),
      index * 150,
    ));
    
    prevPoolsRef.current = { ...game.pools };
    return () => timers.forEach(clearTimeout);
  }, [game.pools, game.phase, spawnChip]);

  useEffect(() => {
    if (game.phase !== 'BETTING' || game.secondsRemaining < 1 || game.secondsRemaining > 3) return;
    const countdownKey = `${game.roundId}:${game.secondsRemaining}`;
    if (countdownSoundRef.current === countdownKey) return;
    countdownSoundRef.current = countdownKey;
    void playSound('countdown');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [game.phase, game.roundId, game.secondsRemaining, playSound]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (previousPhase === game.phase) return;
    previousPhaseRef.current = game.phase;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (game.phase === 'BETTING') {
      void playSound('nextRound');
    } else if (game.phase === 'REVEAL') {
      void playSound('bettingClosed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      timers.push(setTimeout(() => void playSound('cardDeal'), 320));
      timers.push(setTimeout(() => void playSound('cardReveal'), 900));
    }

    return () => timers.forEach(clearTimeout);
  }, [game.phase, playSound]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    if (game.phase === 'REVEAL' || game.phase === 'SETTLED') {
      if (game.dragonCard && game.tigerCard) {
        animation = Animated.sequence([
          Animated.timing(dragonCardAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(tigerCardAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(dragonCardAnim, { toValue: 2, duration: 350, useNativeDriver: true }),
          Animated.timing(tigerCardAnim, { toValue: 2, duration: 350, useNativeDriver: true }),
        ]);
      } else {
        animation = Animated.parallel([
          Animated.timing(dragonCardAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(tigerCardAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]);
      }
    } else if (game.phase === 'WAITING' || game.phase === 'BETTING') {
      dragonCardAnim.stopAnimation();
      tigerCardAnim.stopAnimation();
      dragonCardAnim.setValue(0);
      tigerCardAnim.setValue(0);
    }
    animation?.start();
    return () => animation?.stop();
  }, [game.phase, game.dragonCard, game.tigerCard, dragonCardAnim, tigerCardAnim]);

  const isBetting = game.phase === 'BETTING';

  const placeBet = useCallback((amount: number, targetChoice: Choice) => {
    if (game.phase !== 'BETTING') {
      setMessage('Betting is closed for this round.');
      void playSound('betRejected');
      return;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setMessage('Reconnecting to the live table. Please wait.');
      void playSound('betRejected');
      return;
    }
    if (!game.roundId) {
      setMessage('Waiting for the next live round.');
      void playSound('betRejected');
      return;
    }
    setMessage(null);
    setPlacing(true);
    const clientBetId = `${game.roundId}-${Date.now()}-${betSequenceRef.current++}`;
    const chipId = pendingBetsRef.current.size < 24
      ? spawnChip(amount, targetChoice, true, `${game.roundId}-bet-${clientBetId}`)
      : undefined;
    pendingBetsRef.current.set(clientBetId, {
      amount,
      choice: targetChoice,
      roundId: game.roundId,
      chipId,
    });
    void playSound('betPlace');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket.send(JSON.stringify({
      type: 'BET',
      choice: targetChoice,
      amount,
      roundId: game.roundId,
      clientBetId,
    }));
  }, [game.phase, game.roundId, playSound, spawnChip]);

  const selectChoice = useCallback((targetChoice: Choice) => {
    if (!isBetting) return;
    const lockedChoice = lockedChoiceRef.current;
    if (lockedChoice && lockedChoice !== targetChoice) {
      setMessage(`${lockedChoice} is locked until this round finishes.`);
      void playSound('betRejected');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    lockedChoiceRef.current = targetChoice;
    setChoice(targetChoice);
    void playSound('chipSelect');
    Haptics.selectionAsync();
    const chip = selectedChipRef.current;
    if (chip) {
      placeBet(chip, targetChoice);
    } else {
      setMessage(`${targetChoice} selected. Tap a chip to place your bet.`);
    }
  }, [isBetting, placeBet, playSound]);

  const selectChip = useCallback((amount: number) => {
    if (!isBetting) return;
    selectedChipRef.current = amount;
    setSelectedChip(amount);
    void playSound('chipSelect');
    Haptics.selectionAsync();
    const lockedChoice = lockedChoiceRef.current;
    if (lockedChoice) {
      placeBet(amount, lockedChoice);
    }
  }, [isBetting, placeBet, playSound]);

  if (!isLandscape) {
    return (
      <LinearGradient colors={['#12030A', '#4A0918', '#12030A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Ionicons name="phone-landscape-outline" size={52} color="#FCD34D" />
        <Text style={{ color: '#FFF7D6', fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>TURN YOUR PHONE SIDEWAYS</Text>
        <Text style={{ color: '#D6B7A0', fontSize: 14, marginTop: 8, textAlign: 'center' }}>Dragon Tiger opens in landscape for the full table.</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ImageBackground
        source={require('../../assets/images/dragon-tiger-casino-wide.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Rail */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: layout.TOP_RAIL_H, backgroundColor: 'rgba(0,0,0,0.85)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Math.max(insets.left, 16), zIndex: 30, borderBottomWidth: 1, borderBottomColor: '#333' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={20} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>LOBBY</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Ionicons name="wallet" size={14} color="#FBBF24" />
            <Text style={{ color: '#FBBF24', fontWeight: 'bold', fontSize: 12 }}>₹{liveBalance.toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
           <Text style={{ color: isBetting ? '#10B981' : '#F59E0B', fontSize: 24, fontWeight: '900' }}>
             {isBetting ? `00:${String(game.secondsRemaining).padStart(2, '0')}` : 'BETS CLOSED'}
           </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {history.slice(-10).map((h, i) => (
              <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: h.result === 'DRAGON' ? '#2563EB' : h.result === 'TIGER' ? '#DC2626' : '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                 <Text style={{ fontSize: 8, color: '#FFF', fontWeight: 'bold' }}>{h.result.charAt(0)}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={toggleMuted} style={{ marginLeft: 8 }}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <RoundSweepOverlay roundId={game.roundId} />

      <View style={{ position: 'absolute', top: layout.TOP_RAIL_H + 26, left: '50%', transform: [{ translateX: -20 }], alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
         <Text style={{ color: '#FCD34D', fontSize: 28, fontWeight: '900', fontStyle: 'italic', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>VS</Text>
      </View>

      <PlayingCard 
        card={game.dragonCard} anim={dragonCardAnim} 
        startX={layout.SHOE_X} startY={layout.SHOE_Y} targetX={layout.DRAGON_CARD_X} targetY={layout.CARDS_Y} 
        isWinner={game.result === 'DRAGON'} width={layout.CARD_W} height={layout.CARD_H}
      />
      <PlayingCard 
        card={game.tigerCard} anim={tigerCardAnim} 
        startX={layout.SHOE_X} startY={layout.SHOE_Y} targetX={layout.TIGER_CARD_X} targetY={layout.CARDS_Y} 
        isWinner={game.result === 'TIGER'} width={layout.CARD_W} height={layout.CARD_H}
      />

      <BetZone title="DRAGON" odds="1:1" choice="DRAGON" layout={layout.DRAGON_ZONE} selected={choice === 'DRAGON'} pool={game.pools.DRAGON} myBet={lockedChoiceRef.current === 'DRAGON' ? stake : 0} isWinner={game.result === 'DRAGON'} onSelect={() => selectChoice('DRAGON')} disabled={!isBetting || (!!choice && choice !== 'DRAGON')} />
      <BetZone title="TIE" odds="8:1" choice="TIE" layout={layout.TIE_ZONE} selected={choice === 'TIE'} pool={game.pools.TIE} myBet={lockedChoiceRef.current === 'TIE' ? stake : 0} isWinner={game.result === 'TIE'} onSelect={() => selectChoice('TIE')} disabled={!isBetting || (!!choice && choice !== 'TIE')} />
      <BetZone title="TIGER" odds="1:1" choice="TIGER" layout={layout.TIGER_ZONE} selected={choice === 'TIGER'} pool={game.pools.TIGER} myBet={lockedChoiceRef.current === 'TIGER' ? stake : 0} isWinner={game.result === 'TIGER'} onSelect={() => selectChoice('TIGER')} disabled={!isBetting || (!!choice && choice !== 'TIGER')} />

      <WinBurst choice={presentedResult === 'DRAGON' ? 'DRAGON' : undefined} layout={layout.DRAGON_ZONE} />
      <WinBurst choice={presentedResult === 'TIE' ? 'TIE' : undefined} layout={layout.TIE_ZONE} />
      <WinBurst choice={presentedResult === 'TIGER' ? 'TIGER' : undefined} layout={layout.TIGER_ZONE} />

      {chips.map(c => <FlyingChip key={c.id} chip={c} layout={layout} width={width} height={height} />)}

      <View style={{ position: 'absolute', left: layout.CHIP_SELECTOR_X, top: layout.CHIP_SELECTOR_Y, flexDirection: 'row', width: layout.CHIP_SELECTOR_W, justifyContent: 'space-around', zIndex: 20 }}>
        {CHIPS.map((amount) => (
          <TouchableOpacity key={amount} onPress={() => selectChip(amount)} disabled={!isBetting} activeOpacity={0.8} testID={`button-chip-${amount}`}>
            <Chip amount={amount} selected={selectedChip === amount} />
          </TouchableOpacity>
        ))}
      </View>
      
      {message && (
        <View style={{ position: 'absolute', top: 90, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 8, paddingHorizontal: 16, borderRadius: 20, zIndex: 100 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{message}</Text>
        </View>
      )}

      {/* History view deleted because history is in top rail now */}
    </View>
  );
}

function PlayingCard({ 
  card, anim, startX, startY, targetX, targetY, isWinner, width, height 
}: { 
  card: Card, anim: Animated.Value, startX: number, startY: number, targetX: number, targetY: number, isWinner: boolean, width: number, height: number 
}) {
  const parts = cardParts(card);
  
  const translateX = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [startX, targetX, targetX], extrapolate: 'clamp' });
  const translateY = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [startY, targetY, targetY], extrapolate: 'clamp' });
  const scale = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.5, 1, 1], extrapolate: 'clamp' });
  const rotateYFront = anim.interpolate({ inputRange: [0, 1, 2], outputRange: ['180deg', '180deg', '0deg'], extrapolate: 'clamp' });
  const rotateYBack = anim.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '0deg', '-180deg'], extrapolate: 'clamp' });
  
  return (
    <Animated.View style={{
      position: 'absolute', left: 0, top: 0, width, height,
      transform: [{ perspective: 1000 }, { translateX }, { translateY }, { scale }],
      opacity: anim.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] }),
      zIndex: 10,
    }}>
      <Animated.View style={{
        ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden', transform: [{ perspective: 1000 }, { rotateY: rotateYFront }],
        backgroundColor: '#fff', borderRadius: 6, borderWidth: isWinner ? 3 : 1, borderColor: isWinner ? '#FBBF24' : '#ccc',
        padding: 4, shadowColor: isWinner ? '#FBBF24' : '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isWinner ? 0.8 : 0.3, shadowRadius: isWinner ? 10 : 4, alignItems: 'center'
      }}>
         <Text style={{ color: parts.red ? '#DC2626' : '#0f172a', fontSize: 18, fontWeight: 'bold', alignSelf: 'flex-start' }}>{parts.rank}</Text>
         <Text style={{ color: parts.red ? '#DC2626' : '#0f172a', fontSize: 26, marginTop: -2 }}>{parts.suit}</Text>
         <Text style={{ position: 'absolute', bottom: 2, right: 4, color: parts.red ? '#DC2626' : '#0f172a', fontSize: 18, fontWeight: 'bold', transform: [{rotate: '180deg'}] }}>{parts.rank}</Text>
      </Animated.View>

      <Animated.View style={{
        ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden', transform: [{ perspective: 1000 }, { rotateY: rotateYBack }],
        backgroundColor: '#1E293B', borderRadius: 6, borderWidth: 2, borderColor: '#475569', justifyContent: 'center', alignItems: 'center',
      }}>
        <Ionicons name="diamond" size={24} color="#334155" />
      </Animated.View>
    </Animated.View>
  );
}

function BetZone({ 
  title, odds, choice, layout, selected, pool, myBet, isWinner, onSelect, disabled 
}: { 
  title: string, odds: string, choice: Choice, layout: {x: number, y: number, w: number, h: number}, selected: boolean, pool: number, myBet: number, isWinner: boolean, onSelect: () => void, disabled: boolean 
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isWinner) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true })
        ])
      );
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1); };
    } else {
      pulseAnim.setValue(1);
    }
  }, [isWinner, pulseAnim]);

  const colors: readonly [string, string] = choice === 'DRAGON'
    ? ['#1E3A8A', '#2563EB']
    : choice === 'TIGER'
      ? ['#7F1D1D', '#DC2626']
      : ['#064E3B', '#10B981'];
  const borderColor = isWinner ? '#FCD34D' : choice === 'DRAGON' ? '#60A5FA' : choice === 'TIGER' ? '#FCA5A5' : '#34D399';
  
  return (
    <Animated.View style={{
      position: 'absolute', left: layout.x, top: layout.y, width: layout.w, height: layout.h,
      transform: [{ scale: pulseAnim }], zIndex: isWinner ? 10 : 1,
    }}>
      <TouchableOpacity 
        style={{ flex: 1 }} activeOpacity={disabled ? 1 : 0.8}
        onPress={() => !disabled && onSelect()} testID={`button-choice-${title.toLowerCase()}`}
      >
        <LinearGradient 
          colors={colors}
          style={{
            flex: 1, borderRadius: 8, borderWidth: isWinner ? 4 : 2, borderColor: selected ? '#FCD34D' : borderColor,
            alignItems: 'center', justifyContent: 'center', opacity: isWinner ? 1 : (disabled ? (selected ? 0.7 : 0.4) : 1),
            shadowColor: isWinner ? '#FCD34D' : '#000', shadowOffset: { width: 0, height: isWinner ? 0 : 4 },
            shadowOpacity: isWinner ? 0.8 : 0.4, shadowRadius: isWinner ? 12 : 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 }}>{title}</Text>
          <Text style={{ color: '#FBBF24', fontSize: 14, marginTop: 4, fontWeight: 'bold' }}>{odds}</Text>
          <View style={{ marginTop: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>₹{pool}</Text>
          </View>
          {myBet > 0 && (
            <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', padding: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: 10 }}>MY BET: ₹{myBet}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function Chip({ amount, selected = false }: { amount: number, selected?: boolean }) {
  const isHigh = amount >= 100;
  return (
    <View style={{
      width: 32, height: 32, borderRadius: 16, backgroundColor: isHigh ? '#111827' : '#F8FAFC',
      borderWidth: 2, borderColor: isHigh ? '#F59E0B' : '#3B82F6', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: selected ? 4 : 2 }, shadowOpacity: 0.5, shadowRadius: selected ? 6 : 2,
      transform: [{ scale: selected ? 1.2 : 1 }]
    }}>
      <View style={{
        width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: isHigh ? '#F59E0B' : '#3B82F6',
        alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed'
      }}>
        <Text style={{ color: isHigh ? '#F59E0B' : '#1E293B', fontWeight: 'bold', fontSize: 10 }}>{amount}</Text>
      </View>
    </View>
  );
}

function FlyingChip({ chip, layout, width, height }: { chip: RenderChip, layout: any, width: number, height: number }) {
  const loseX = width / 2;
  const loseY = -100;
  const winX = width / 2;
  const winY = height + 100;

  const translateX = chip.anim.interpolate({ 
    inputRange: [0, 1, 2, 3], 
    outputRange: [chip.startX, chip.targetX, loseX, chip.isMine ? width / 2 : winX] 
  });
  const translateY = chip.anim.interpolate({ 
    inputRange: [0, 1, 2, 3], 
    outputRange: [chip.startY, chip.targetY, loseY, chip.isMine ? height : winY] 
  });
  const scale = chip.anim.interpolate({ 
    inputRange: [0, 0.8, 1, 1.8, 2, 2.8, 3], 
    outputRange: [chip.isMine ? 1 : 0.5, 0.8, 1, 0.8, 0.5, 0.8, 0.5] 
  });
  const opacity = chip.anim.interpolate({ 
    inputRange: [0, 0.08, 1, 1.85, 2, 2.85, 3], 
    outputRange: [0, 1, 1, 1, 0, 1, 0] 
  });
  
  return (
    <Animated.View style={{ position: 'absolute', opacity, transform: [{ translateX }, { translateY }, { scale }], zIndex: chip.isMine ? 50 : 20 }}>
      <Chip amount={chip.amount} />
    </Animated.View>
  );
}

function WinBurst({ choice, layout }: { choice?: Choice, layout: any }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    if (choice) {
      anim.setValue(0);
      animation = Animated.spring(anim, {
        toValue: 1,
        speed: 12,
        bounciness: 12,
        useNativeDriver: true
      });
      animation.start();
    } else {
      anim.setValue(0);
    }
    return () => animation?.stop();
  }, [choice, anim]);

  if (!choice) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      left: layout.x, top: layout.y, width: layout.w, height: layout.h,
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 30,
      opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
      transform: [
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 1] }) },
        { rotate: '-10deg' }
      ]
    }}>
      <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 4, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }}>
        <Text style={{ color: '#000', fontSize: 32, fontWeight: '900', letterSpacing: 2 }}>WINNER!</Text>
      </View>
    </Animated.View>
  );
}

function RoundSweepOverlay({ roundId }: { roundId?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const lastRoundId = useRef(roundId);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    if (roundId && roundId !== lastRoundId.current) {
      lastRoundId.current = roundId;
      anim.setValue(0);
      animation = Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 400, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(anim, { toValue: 2, duration: 400, easing: Easing.in(Easing.exp), useNativeDriver: true }),
      ]);
      animation.start();
    }
    return () => animation?.stop();
  }, [roundId, anim]);

  if (!roundId) return null;

  const dragonTranslate = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [-600, 0, 600]
  });

  const tigerTranslate = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [600, 0, -600]
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 1.9, 2],
    outputRange: [0, 1, 1, 0]
  });

  return (
    <Animated.View style={{ position: 'absolute', top: '35%', width: '100%', height: 100, flexDirection: 'row', zIndex: 100, opacity, pointerEvents: 'none', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ translateX: dragonTranslate }], flex: 1, backgroundColor: 'rgba(30,58,138,0.95)', height: 80, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 30 }}>
        <Text style={{ color: '#93C5FD', fontSize: 44, fontWeight: '900', fontStyle: 'italic', letterSpacing: 2 }}>DRAGON</Text>
      </Animated.View>
      <View style={{ width: 60, height: 80, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 2 }}>
        <Text style={{ color: '#FCD34D', fontSize: 32, fontWeight: '900', fontStyle: 'italic' }}>VS</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX: tigerTranslate }], flex: 1, backgroundColor: 'rgba(153,27,27,0.95)', height: 80, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 30 }}>
        <Text style={{ color: '#FCA5A5', fontSize: 44, fontWeight: '900', fontStyle: 'italic', letterSpacing: 2 }}>TIGER</Text>
      </Animated.View>
    </Animated.View>
  );
}

// --- LOBBY STYLES ---
const lobbyStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6B1020' },
  safeContent: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerPortrait: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  profileBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  eyebrow: { color: '#FFE8A3', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  balance: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: -2 },
  cashActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE58A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  cashButtonText: { color: '#7C2D12', fontWeight: '800', fontSize: 12 },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,229,138,0.3)',
    gap: 6,
  },
  withdrawText: { color: '#FFE8A3', fontWeight: '700', fontSize: 12 },
  headerTools: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerToolsPortrait: { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  liveText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  toolButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, flexDirection: 'row', gap: 16 },
  bodyPortrait: { flexDirection: 'column' },
  hero: { flex: 1, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minHeight: 220 },
  heroPortrait: { flex: 0, minHeight: 280 },
  heroImage: { width: '100%', height: '100%' },
  featuredBadge: {
    position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFD76A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  featuredBadgeText: { color: '#7C2D12', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroCopy: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  heroTitle: { color: '#FFF', fontSize: 42, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  heroSubtitle: { color: '#FFD76A', fontSize: 14, fontWeight: '600', marginBottom: 16 },
  playNow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD76A', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, gap: 8 },
  playNowText: { color: '#7C2D12', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  catalog: { flex: 1, gap: 16 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: '#FFD76A', fontSize: 12, opacity: 0.8 },
  gameCount: { color: '#10B981', fontSize: 12, fontWeight: 'bold' },
  gameRow: { gap: 12, paddingBottom: 8 },
  gameCard: {
    width: 140, height: 180, borderRadius: 20, backgroundColor: '#4C0519',
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  gameImage: { width: '100%', height: '100%', opacity: 0.6 },
  hotBadge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  hotText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  gameCardFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.8)' },
  gameTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  gameMeta: { color: '#10B981', fontSize: 10, marginTop: 2 },
  comingCard: {
    width: 140, height: 180, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.05)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  comingTitle: { color: '#FFD76A', fontWeight: 'bold', fontSize: 12 },
  comingText: { color: '#FFF', fontSize: 10, opacity: 0.5 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  recentLabel: { color: '#FFD76A', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD76A',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6,
  },
  recentIcon: { width: 16, height: 16, borderRadius: 8 },
  recentName: { color: '#7C2D12', fontSize: 12, fontWeight: 'bold' },
});
