import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useGetNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getGetNotificationsQueryKey,
} from '@workspace/api-client-react';

const TYPE_CONFIG: Record<string, { icon: string; color: (c: any) => string }> = {
  deposit_submitted:   { icon: 'time-outline',       color: (c) => c.warning },
  deposit_approved:    { icon: 'checkmark-circle',   color: (c) => c.success },
  deposit_rejected:    { icon: 'close-circle',       color: (c) => c.destructive },
  withdrawal_submitted:{ icon: 'time-outline',       color: (c) => c.warning },
  withdrawal_approved: { icon: 'checkmark-circle',   color: (c) => c.success },
  withdrawal_rejected: { icon: 'close-circle',       color: (c) => c.destructive },
  prediction_won:      { icon: 'trophy',             color: (c) => c.success },
  prediction_lost:     { icon: 'remove-circle',      color: (c) => c.destructive },
  wallet_credited:     { icon: 'wallet',             color: (c) => c.primary },
};

function NotifItem({ item, onRead }: { item: any; onRead: (id: string) => void }) {
  const colors = useColors();
  const { t } = useLanguage();
  const cfg = TYPE_CONFIG[item.type] ?? { icon: 'notifications-outline', color: (c: any) => c.primary };
  const iconColor = cfg.color(colors);
  const s = notifStyles(colors);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return t('notif_just_now');
    if (diff < 3600) return t('notif_min_ago', Math.floor(diff / 60));
    if (diff < 86400) return t('notif_hour_ago', Math.floor(diff / 3600));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <TouchableOpacity
      style={[s.row, !item.read && s.unread]}
      onPress={() => { if (!item.read) onRead(item.id); }}
      activeOpacity={0.7}
    >
      <View style={[s.iconCircle, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={cfg.icon as any} size={22} color={iconColor} />
      </View>
      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={1}>{item.title}</Text>
          {!item.read && <View style={s.dot} />}
        </View>
        <Text style={s.body} numberOfLines={2}>{item.body}</Text>
        <Text style={s.time}>{formatTime(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const notifStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  unread: { backgroundColor: colors.primary + '08' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  title: { fontSize: 14, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 18, marginBottom: 4 },
  time: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetNotifications(
    { limit: 50 },
    { query: { enabled: !!token, queryKey: getGetNotificationsQueryKey({ limit: 50 }) } }
  );
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey({ limit: 50 }) });

  const handleMarkAll = () => {
    if (unreadCount === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAll.mutate(undefined, { onSuccess: invalidate });
  };

  const handleMarkOne = (id: string) => {
    markOne.mutate({ notificationId: id }, { onSuccess: invalidate });
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('notif_title')}</Text>
          {unreadCount > 0 && <Text style={s.subtitle}>{t('notif_unread', unreadCount)}</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll} style={s.readAllBtn} activeOpacity={0.7}>
            <Text style={s.readAllText}>{t('notif_mark_all')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NotifItem item={item} onRead={handleMarkOne} />}
          contentContainerStyle={notifications.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={52} color={colors.mutedForeground} />
              <Text style={s.emptyTitle}>{t('notif_empty_title')}</Text>
              <Text style={s.emptySub}>{t('notif_empty_sub')}</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, color: colors.primary, fontFamily: 'Inter_500Medium', marginTop: 2 },
  readAllBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary + '20', borderRadius: 8 },
  readAllText: { fontSize: 13, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' as const, lineHeight: 20 },
});
