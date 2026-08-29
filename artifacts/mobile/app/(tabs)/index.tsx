import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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
  const { game } = useLocalSearchParams<{ game?: string }>();
  return game === 'dragon-tiger' ? <DragonTigerGame /> : <GameLobby />;
}

function GameLobby() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const balance = Number(walletData?.balance ?? user?.walletBalance ?? 0);

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
        <View style={lobbyStyles.header}>
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

          <View style={lobbyStyles.headerTools}>
            <View style={lobbyStyles.livePill}>
              <View style={lobbyStyles.liveDot} />
              <Text style={lobbyStyles.liveText}>LIVE GAMES</Text>
            </View>
            <TouchableOpacity style={lobbyStyles.toolButton} onPress={() => router.push('/(tabs)/notifications')}>
              <Ionicons name="notifications" size={18} color="#FFF2C7" />
            </TouchableOpacity>
            <TouchableOpacity style={lobbyStyles.toolButton} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person-circle" size={20} color="#FFF2C7" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={lobbyStyles.body}>
          <TouchableOpacity style={lobbyStyles.hero} onPress={openDragonTiger} activeOpacity={0.9} testID="lobby-featured-dragon-tiger">
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

function DragonTigerGame() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, token } = useAuth();
  const [game, setGame] = useState<GameState>(EMPTY_GAME);
  const [history, setHistory] = useState<{roundId: string, result: Choice}[]>([]);
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
  const vsScale = useRef(new Animated.Value(1)).current;

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

  // History tracking effect
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

  // Toast message auto-dismiss
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

  useEffect(() => {
    revealAnim.setValue(0.15);
    vsScale.setValue(0.5);
    Animated.parallel([
      Animated.spring(revealAnim, { toValue: 1, friction: 6, tension: 85, useNativeDriver: true }),
      Animated.spring(vsScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [game.dragonCard, game.tigerCard, game.result, revealAnim, vsScale]);

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

  const isBetting = game.phase === 'BETTING';

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../../assets/images/dragon-tiger-casino-wide.png')}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.arenaArtwork}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(126,34,8,0.42)', 'rgba(249,115,22,0.08)', 'rgba(127,29,29,0.68)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.safeContent, { 
        paddingLeft: Math.max(insets.left, 12), 
        paddingRight: Math.max(insets.right, 12), 
        paddingBottom: Math.max(insets.bottom, 8) + (Platform.OS === 'web' ? 84 : 56), 
        paddingTop: Math.max(insets.top, 8) 
      }]}>
        
        {message && (
          <View style={styles.messageBox}>
            <Ionicons name="information-circle" size={14} color="#000" />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.brand}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')} testID="game-back-to-lobby">
              <Ionicons name="chevron-back" size={18} color="#FFF7ED" />
            </TouchableOpacity>
            <Text style={styles.brandTitle}>JAZMENT</Text>
            <View style={styles.connectionBadge}>
              <View style={[styles.dot, { backgroundColor: connected ? '#10B981' : '#F43F5E' }]} />
              <Text style={styles.connectionText}>{connected ? 'LIVE' : 'CONNECTING'}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.balanceBox} onPress={() => openWallet('deposit')}>
              <Ionicons name="wallet" size={14} color="#FBBF24" />
              <Text style={styles.balanceText}>₹{liveBalance.toFixed(2)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerBtn} onPress={() => openWallet('deposit')}>
              <Text style={styles.headerBtnText}>DEPOSIT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, styles.headerBtnOutline]} onPress={() => openWallet('withdraw')}>
              <Text style={styles.headerBtnTextOutline}>WITHDRAW</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.topSection}>
            <View style={styles.statusBox}>
              <Text style={styles.roundText}>ROUND {game.roundId ? game.roundId.slice(-6).toUpperCase() : '------'}</Text>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                {isBetting ? (
                  <Text style={[styles.timerText, { color: '#10B981' }]}>{game.secondsRemaining}s</Text>
                ) : (
                  <Text style={[styles.timerText, { color: '#FBBF24', fontSize: 18, letterSpacing: 2, marginTop: 4 }]}>{game.phase}</Text>
                )}
              </Animated.View>
            </View>

            <View style={styles.battleArea}>
              <PlayerCard card={game.dragonCard} animation={revealAnim} winner={game.result === 'DRAGON'} />
              <Animated.View style={[styles.vsContainer, { transform: [{ scale: vsScale }] }]}>
                <Text style={styles.vsText}>VS</Text>
              </Animated.View>
              <PlayerCard card={game.tigerCard} animation={revealAnim} winner={game.result === 'TIGER'} />
            </View>
          </View>

          <View style={styles.bottomSection}>
            <View style={styles.beadRoad}>
              {history.slice(-25).map((h, i) => (
                <View key={i} style={[styles.bead, h.result === 'DRAGON' ? styles.beadDragon : h.result === 'TIGER' ? styles.beadTiger : styles.beadTie]}>
                  <Text style={styles.beadText}>{h.result === 'DRAGON' ? 'D' : h.result === 'TIGER' ? 'T' : 'T'}</Text>
                </View>
              ))}
              {history.length === 0 && <Text style={styles.beadEmpty}>Awaiting results...</Text>}
            </View>

            <View style={styles.bettingBoard}>
              <TouchableOpacity 
                style={[styles.betBlockWrap, choice === 'DRAGON' && styles.betSelected]}
                onPress={() => { setChoice('DRAGON'); Haptics.selectionAsync(); }}
                disabled={!isBetting}
                testID="button-choice-dragon"
              >
                <LinearGradient colors={['#1D4ED8', '#1E3A8A']} style={styles.betBlock}>
                  <Text style={styles.betBlockTitle}>DRAGON</Text>
                  <Text style={styles.betBlockOdds}>1:1</Text>
                  <View style={styles.betPoolBox}><Text style={styles.betPoolText}>₹{game.pools.DRAGON.toFixed(0)}</Text></View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.betBlockWrap, choice === 'TIE' && styles.betSelected]}
                onPress={() => { setChoice('TIE'); Haptics.selectionAsync(); }}
                disabled={!isBetting}
                testID="button-choice-tie"
              >
                <LinearGradient colors={['#15803D', '#064E3B']} style={styles.betBlock}>
                  <Text style={styles.betBlockTitle}>TIE</Text>
                  <Text style={styles.betBlockOdds}>8:1</Text>
                  <View style={styles.betPoolBox}><Text style={styles.betPoolText}>₹{game.pools.TIE.toFixed(0)}</Text></View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.betBlockWrap, choice === 'TIGER' && styles.betSelected]}
                onPress={() => { setChoice('TIGER'); Haptics.selectionAsync(); }}
                disabled={!isBetting}
                testID="button-choice-tiger"
              >
                <LinearGradient colors={['#B91C1C', '#7F1D1D']} style={styles.betBlock}>
                  <Text style={styles.betBlockTitle}>TIGER</Text>
                  <Text style={styles.betBlockOdds}>1:1</Text>
                  <View style={styles.betPoolBox}><Text style={styles.betPoolText}>₹{game.pools.TIGER.toFixed(0)}</Text></View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.clearBtn} onPress={() => setStake('')} disabled={!isBetting}>
                <Ionicons name="trash-outline" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.stakeInputBox}>
                <Text style={styles.stakeCurrency}>₹</Text>
                <TextInput
                  value={stake}
                  onChangeText={setStake}
                  keyboardType="decimal-pad"
                  style={styles.stakeInput}
                  editable={isBetting}
                  testID="input-stake"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.chipsStrip}>
                {CHIPS.map((chip) => (
                  <Chip 
                    key={chip} 
                    amount={chip} 
                    onPress={() => { setStake(String(numberFrom(stake) + chip)); Haptics.selectionAsync(); }} 
                    disabled={!isBetting} 
                    testID={`button-chip-${chip}`}
                  />
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.placeBetBtn, (!isBetting || placing || !connected) && styles.placeBetBtnDisabled]}
                onPress={placeBet}
                disabled={!isBetting || placing || !connected}
                testID="button-place-bet"
              >
                {placing ? <ActivityIndicator color="#000" /> : (
                  <Text style={[styles.placeBetText, (!isBetting || !connected) && { color: '#94A3B8' }]}>BET</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function PlayerCard({ card, animation, winner }: { card: Card; animation: Animated.Value; winner: boolean }) {
  const parts = cardParts(card);
  return (
    <Animated.View
      style={[
        styles.playingCard,
        parts.hidden && styles.hiddenCard,
        winner && styles.winnerCard,
        {
          opacity: animation,
          transform: [
            { scale: animation },
            { rotateY: animation.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
          ],
        },
      ]}
    >
      {parts.hidden ? (
        <View style={styles.cardBack}>
          <Ionicons name="diamond" size={24} color="#334155" />
        </View>
      ) : (
        <>
          <Text style={[styles.cardRank, parts.red && { color: '#DC2626' }]}>{parts.rank}</Text>
          <Text style={[styles.cardSuit, parts.red && { color: '#DC2626' }]}>{parts.suit}</Text>
        </>
      )}
    </Animated.View>
  );
}

const CHIP_COLORS = {
  10: '#2563EB',
  50: '#10B981',
  100: '#1F2937',
  500: '#8B5CF6',
};

function Chip({ amount, onPress, disabled, testID }: { amount: number, onPress: () => void, disabled: boolean, testID: string }) {
  const color = CHIP_COLORS[amount as keyof typeof CHIP_COLORS] || '#F59E0B';
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }} testID={testID}>
      <View style={[styles.chipOuter, { backgroundColor: color }]}>
        <View style={styles.chipInner}>
          <Text style={[styles.chipText, amount === 100 && { color: '#1F2937' }]}>{amount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F97316' },
  arenaArtwork: { opacity: 0.96 },
  safeContent: { flex: 1 },
  messageBox: {
    position: 'absolute', top: 56, alignSelf: 'center',
    backgroundColor: '#FBBF24', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
    zIndex: 20, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5,
  },
  messageText: { color: '#000', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 3, zIndex: 10,
    backgroundColor: 'rgba(124,45,18,0.76)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(253,186,116,0.75)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,247,237,0.14)', borderWidth: 1, borderColor: 'rgba(255,237,213,0.5)',
  },
  brandTitle: { color: '#FFF7ED', fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: 2 },
  connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { color: '#E2E8F0', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: '#FBBF24', gap: 6,
  },
  balanceText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 13 },
  headerBtn: { backgroundColor: '#FBBF24', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  headerBtnOutline: { backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: '#FBBF24' },
  headerBtnText: { color: '#000', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  headerBtnTextOutline: { color: '#FBBF24', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  
  content: { flex: 1, justifyContent: 'space-between' },
  
  topSection: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center' },
  statusBox: {
    position: 'absolute', top: 3, alignItems: 'center',
    backgroundColor: 'rgba(124,45,18,0.58)', paddingHorizontal: 12, paddingVertical: 2, borderRadius: 12,
  },
  roundText: { color: '#FFEDD5', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1 },
  timerText: { fontFamily: 'Inter_700Bold', fontSize: 28, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
  
  battleArea: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  playingCard: {
    width: 48, height: 64, backgroundColor: '#fff', borderRadius: 6, padding: 5,
    justifyContent: 'space-between', borderWidth: 1, borderColor: '#cbd5e1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  hiddenCard: { backgroundColor: '#1E293B', borderColor: '#475569' },
  winnerCard: { borderColor: '#FBBF24', borderWidth: 3, shadowColor: '#FBBF24', shadowOpacity: 0.8, shadowRadius: 10, transform: [{scale: 1.05}] },
  cardBack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardRank: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#0F1729' },
  cardSuit: { fontSize: 19, alignSelf: 'flex-end', color: '#0F1729' },
  
  vsContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 2, borderColor: '#FBBF24', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
  },
  vsText: { color: '#FBBF24', fontFamily: 'Inter_700Bold', fontSize: 18, fontStyle: 'italic' },
  
  bottomSection: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.28)', borderWidth: 1, borderColor: 'rgba(253,186,116,0.8)',
  },
  beadRoad: {
    flexDirection: 'row', height: 18, backgroundColor: 'rgba(255,247,237,0.92)', borderRadius: 9,
    paddingHorizontal: 7, alignItems: 'center', marginBottom: 4, gap: 3, overflow: 'hidden',
  },
  bead: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  beadDragon: { backgroundColor: '#3B82F6' },
  beadTie: { backgroundColor: '#10B981' },
  beadTiger: { backgroundColor: '#EF4444' },
  beadText: { color: '#FFF', fontSize: 8, fontFamily: 'Inter_700Bold' },
  beadEmpty: { color: '#9A3412', fontSize: 9, fontStyle: 'italic', marginLeft: 4 },
  
  bettingBoard: { flexDirection: 'row', gap: 7, height: 56, marginBottom: 4 },
  betBlockWrap: { flex: 1, borderRadius: 12 },
  betSelected: { borderWidth: 3, borderColor: '#FBBF24', transform: [{ scale: 1.02 }] },
  betBlock: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  betBlockTitle: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: 1 },
  betBlockOdds: { color: 'rgba(255,255,255,0.82)', fontSize: 8, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  betPoolBox: { backgroundColor: 'rgba(0,0,0,0.42)', paddingHorizontal: 9, paddingVertical: 1, borderRadius: 7 },
  betPoolText: { color: '#FDE68A', fontSize: 10, fontFamily: 'Inter_700Bold' },
  
  controlsRow: { flexDirection: 'row', height: 34, gap: 7, alignItems: 'center' },
  clearBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(124,45,18,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDBA74' },
  stakeInputBox: {
    width: 82, height: 34, backgroundColor: '#FFF7ED', borderRadius: 17, borderWidth: 1, borderColor: '#FDBA74',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
  },
  stakeCurrency: { color: '#FBBF24', fontFamily: 'Inter_700Bold', fontSize: 15, marginRight: 2 },
  stakeInput: { flex: 1, color: '#7C2D12', fontFamily: 'Inter_700Bold', fontSize: 14 },
  chipsStrip: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  placeBetBtn: {
    minWidth: 82, height: 34, borderRadius: 17, backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  placeBetBtnDisabled: { backgroundColor: '#334155', shadowOpacity: 0, borderWidth: 1, borderColor: '#475569' },
  placeBetText: { color: '#000', fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.5 },
  
  chipOuter: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2, elevation: 3,
  },
  chipInner: {
    width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed',
  },
  chipText: { color: '#000', fontFamily: 'Inter_700Bold', fontSize: 10 },
});

const lobbyStyles = StyleSheet.create({
  root: { flex: 1 },
  safeContent: { flex: 1 },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(65,8,18,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,106,0.65)',
  },
  profileBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 150 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF2C7',
  },
  eyebrow: { color: '#FBCB72', fontSize: 8, letterSpacing: 0.8, fontFamily: 'Inter_700Bold' },
  balance: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
  cashActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashButton: {
    height: 34,
    paddingHorizontal: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD348',
    borderWidth: 1,
    borderColor: '#FFF0A6',
  },
  cashButtonText: { color: '#6B1020', fontSize: 11, fontFamily: 'Inter_700Bold' },
  withdrawButton: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#A62B23',
    borderWidth: 1,
    borderColor: '#E8A943',
  },
  withdrawText: { color: '#FFE8A3', fontSize: 11, fontFamily: 'Inter_700Bold' },
  headerTools: { minWidth: 150, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 7 },
  livePill: {
    height: 25,
    paddingHorizontal: 9,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#40E685' },
  liveText: { color: '#FFF2C7', fontSize: 8, letterSpacing: 0.7, fontFamily: 'Inter_700Bold' },
  toolButton: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  body: { flex: 1, flexDirection: 'row', gap: 10, paddingTop: 8 },
  hero: {
    width: '35%',
    minWidth: 250,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F7C951',
    backgroundColor: '#4A0915',
  },
  heroImage: { width: '100%', height: '100%' },
  featuredBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FFD348',
  },
  featuredBadgeText: { color: '#6B1020', fontSize: 8, fontFamily: 'Inter_700Bold' },
  heroCopy: { position: 'absolute', left: 13, right: 13, bottom: 11 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
    textShadowColor: '#6B1020',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: { color: '#FFE8A3', fontSize: 10, marginTop: 1, fontFamily: 'Inter_500Medium' },
  playNow: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFD348',
  },
  playNowText: { color: '#6B1020', fontSize: 9, fontFamily: 'Inter_700Bold' },
  catalog: {
    flex: 1,
    borderRadius: 13,
    padding: 10,
    backgroundColor: 'rgba(80,8,17,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,106,0.5)',
  },
  sectionHeading: { height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFF8E1', fontSize: 14, letterSpacing: 0.8, fontFamily: 'Inter_700Bold' },
  sectionSubtitle: { color: '#E8B99E', fontSize: 8, marginTop: 1, fontFamily: 'Inter_500Medium' },
  gameCount: {
    color: '#6B1020',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FFD348',
  },
  gameRow: { gap: 8, paddingVertical: 3 },
  gameCard: {
    width: 116,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFF6DF',
    borderWidth: 2,
    borderColor: '#FFD348',
  },
  gameImage: { width: '100%', height: 78 },
  hotBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#E23921',
  },
  hotText: { color: '#FFFFFF', fontSize: 7, fontFamily: 'Inter_700Bold' },
  gameCardFooter: { flex: 1, justifyContent: 'center', paddingHorizontal: 7 },
  gameTitle: { color: '#6B1020', fontSize: 10, fontFamily: 'Inter_700Bold' },
  gameMeta: { color: '#A14C3A', fontSize: 7, fontFamily: 'Inter_500Medium' },
  comingCard: {
    width: 105,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E6A93E',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  comingTitle: { color: '#FFF2C7', fontSize: 9, marginTop: 5, fontFamily: 'Inter_700Bold' },
  comingText: { color: '#D99B83', fontSize: 7, marginTop: 1, fontFamily: 'Inter_500Medium' },
  recentRow: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  recentLabel: { color: '#F8C66A', fontSize: 8, letterSpacing: 0.5, fontFamily: 'Inter_700Bold' },
  recentChip: {
    height: 28,
    flex: 1,
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 5,
    borderRadius: 14,
    backgroundColor: '#FFF2C7',
  },
  recentIcon: { width: 22, height: 22, borderRadius: 11 },
  recentName: { flex: 1, color: '#6B1020', fontSize: 9, fontFamily: 'Inter_700Bold' },
});
