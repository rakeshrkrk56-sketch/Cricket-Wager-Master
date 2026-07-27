import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGetMyPredictions, getGetMyPredictionsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'प्रतीक्षा', color: '#F59E0B', icon: 'time-outline' },
  won: { label: 'जीत', color: '#22C55E', icon: 'checkmark-circle' },
  lost: { label: 'हार', color: '#EF4444', icon: 'close-circle' },
  refunded: { label: 'वापसी', color: '#8EA3BC', icon: 'refresh-circle' },
};

function PredictionItem({ item }: { item: any }) {
  const colors = useColors();
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  return (
    <View style={predStyles(colors).card}>
      <View style={predStyles(colors).row}>
        <View style={predStyles(colors).left}>
          <Text style={predStyles(colors).question} numberOfLines={2}>{item.question}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <View style={[predStyles(colors).choiceBadge, {
              backgroundColor: item.choice === 'YES' ? '#22C55E22' : '#EF444422',
              borderColor: item.choice === 'YES' ? '#22C55E' : '#EF4444',
            }]}>
              <Text style={[predStyles(colors).choiceText, { color: item.choice === 'YES' ? '#22C55E' : '#EF4444' }]}>
                {item.choice === 'YES' ? 'हाँ' : 'नहीं'}
              </Text>
            </View>
            <Text style={predStyles(colors).meta}>₹{item.amount}</Text>
            <Text style={[predStyles(colors).meta, { color: colors.success }]}>→ ₹{Number(item.potentialWin).toFixed(0)}</Text>
          </View>
        </View>
        <View style={[predStyles(colors).statusBadge, { backgroundColor: cfg.color + '22' }]}>
          <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
          <Text style={[predStyles(colors).statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={predStyles(colors).time}>{new Date(item.createdAt).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
    </View>
  );
}

const predStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  left: { flex: 1 },
  question: { fontSize: 14, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  choiceBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  choiceText: { fontSize: 11, fontFamily: 'Inter_700Bold', fontWeight: '700' as const },
  meta: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  time: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 8 },
});

export default function PredictionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useGetMyPredictions(
    filter ? { status: filter as any } : {},
    { query: { enabled: !!token, queryKey: getGetMyPredictionsQueryKey(filter ? { status: filter as any } : {}) } }
  );

  const predictions = data?.predictions ?? [];
  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>मेरी भविष्यवाणियां</Text>
      </View>

      {/* Filter chips */}
      <View style={s.filters}>
        {[undefined, 'pending', 'won', 'lost'].map((f) => (
          <TouchableOpacity key={String(f)} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>
              {f === undefined ? 'सभी' : STATUS_CONFIG[f]?.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={predictions}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PredictionItem item={item} />}
          contentContainerStyle={s.list}
          scrollEnabled={!!predictions.length}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="analytics-outline" size={48} color={colors.mutedForeground} />
              <Text style={s.emptyText}>कोई भविष्यवाणी नहीं</Text>
              <Text style={s.emptySubtext}>मैच में जाकर भविष्यवाणी करें</Text>
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
    paddingHorizontal: 20,
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  filters: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: colors.primaryForeground },
  list: { paddingHorizontal: 20, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 16, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  emptySubtext: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});
