import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useListMatches, getListMatchesQueryKey,
  useGetWallet, getGetWalletQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  const isLive = status === 'live';
  const isUpcoming = status === 'upcoming';
  const bg = isLive ? colors.destructive : isUpcoming ? colors.primary : colors.muted;
  const fg = isLive || isUpcoming ? colors.primaryForeground : colors.mutedForeground;
  const label = isLive ? t('home_live_badge') : isUpcoming ? t('home_upcoming') : t('home_completed');
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ color: fg, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </View>
  );
}

function MatchCard({ match }: { match: any }) {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const s = matchCardStyles(colors);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/match/${match.id}`)} activeOpacity={0.8}>
      <View style={s.header}>
        <Text style={s.tournament}>{match.tournament}</Text>
        <StatusBadge status={match.status} />
      </View>
      <View style={s.teams}>
        <View style={s.team}>
          <View style={[s.flagCircle, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[s.flagText, { color: colors.primary }]}>{match.team1.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={s.teamName}>{match.team1}</Text>
        </View>
        <View style={s.vs}>
          <Text style={s.vsText}>VS</Text>
        </View>
        <View style={[s.team, { alignItems: 'flex-end' }]}>
          <View style={[s.flagCircle, { backgroundColor: colors.border }]}>
            <Text style={[s.flagText, { color: colors.mutedForeground }]}>{match.team2.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={s.teamName}>{match.team2}</Text>
        </View>
      </View>
      {match.status === 'live' && (
        <View style={s.liveBar}>
          <Ionicons name="radio-button-on" size={12} color={colors.destructive} />
          <Text style={[s.liveText, { color: colors.destructive }]}> {t('home_live_predict')}</Text>
        </View>
      )}
      {match.status !== 'live' && (
        <Text style={s.time}>
          {new Date(match.startTime).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const matchCardStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tournament: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', flex: 1, marginRight: 8 },
  teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  team: { alignItems: 'flex-start', flex: 1 },
  flagCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  flagText: { fontSize: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  teamName: { fontSize: 15, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  vs: { alignItems: 'center', paddingHorizontal: 16 },
  vsText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  liveBar: { flexDirection: 'row', alignItems: 'center' },
  liveText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  time: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'completed'>('live');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useListMatches(
    { status: activeTab },
    { query: { queryKey: getListMatchesQueryKey({ status: activeTab }) } }
  );

  // Live wallet balance — replaces the stale AsyncStorage snapshot in AuthContext
  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const liveBalance = walletData?.balance ?? user?.walletBalance ?? 0;

  // Pull-to-refresh: reload matches + wallet together
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey({ status: activeTab }) }),
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() }),
    ]);
    setRefreshing(false);
  }, [queryClient, activeTab]);

  const s = styles(colors, insets);
  const matches = data?.matches ?? [];

  const TAB_LABELS = {
    live: t('home_live'),
    upcoming: t('home_upcoming'),
    completed: t('home_completed'),
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{t('home_greeting', user?.name ?? '👋')}</Text>
          <Text style={s.subtitle}>{t('home_subtitle')}</Text>
        </View>
        <TouchableOpacity style={s.walletBadge} onPress={() => router.push('/(tabs)/wallet')}>
          <Ionicons name="wallet-outline" size={14} color={colors.primary} />
          <Text style={s.walletText}>₹{liveBalance.toFixed(0)}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabBar}>
        {(['live', 'upcoming', 'completed'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchCard match={item} />}
          contentContainerStyle={s.list}
          scrollEnabled={!!matches.length}
          refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="trophy-outline" size={48} color={colors.mutedForeground} />
              <Text style={s.emptyText}>{t('home_no_matches')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 2, fontFamily: 'Inter_400Regular' },
  walletBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  walletText: { fontSize: 14, fontWeight: '600' as const, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  tabTextActive: { color: colors.primaryForeground },
  list: { paddingHorizontal: 20, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
});
