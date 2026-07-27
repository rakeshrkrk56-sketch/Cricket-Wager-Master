import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

function MenuItem({ icon, label, onPress, destructive = false }: { icon: string; label: string; onPress: () => void; destructive?: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={menuStyles(colors).row} onPress={onPress} activeOpacity={0.7}>
      <View style={[menuStyles(colors).icon, { backgroundColor: destructive ? colors.destructive + '20' : colors.muted }]}>
        <Ionicons name={icon as any} size={20} color={destructive ? colors.destructive : colors.foreground} />
      </View>
      <Text style={[menuStyles(colors).label, destructive && { color: colors.destructive }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const menuStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '500' as const, color: colors.foreground, fontFamily: 'Inter_500Medium' },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const s = styles(colors, insets);

  const handleLogout = () => {
    Alert.alert('लॉगआउट', 'क्या आप वाकई लॉगआउट करना चाहते हैं?', [
      { text: 'रद्द करें', style: 'cancel' },
      { text: 'लॉगआउट', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const kycLabel: Record<string, string> = { pending: 'लंबित', verified: 'सत्यापित', rejected: 'अस्वीकृत' };
  const kycColor: Record<string, string> = { pending: colors.warning, verified: colors.success, rejected: colors.destructive };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Avatar section */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.name?.[0]?.toUpperCase() ?? user?.phone?.slice(-2) ?? 'J'}</Text>
        </View>
        <Text style={s.name}>{user?.name ?? 'Jazment User'}</Text>
        <Text style={s.phone}>{user?.phone}</Text>
        <View style={[s.kycBadge, { backgroundColor: kycColor[user?.kycStatus ?? 'pending'] + '20' }]}>
          <Ionicons name={user?.kycStatus === 'verified' ? 'checkmark-circle' : 'time-outline'} size={13} color={kycColor[user?.kycStatus ?? 'pending']} />
          <Text style={[s.kycText, { color: kycColor[user?.kycStatus ?? 'pending'] }]}>KYC: {kycLabel[user?.kycStatus ?? 'pending']}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsCard}>
        <View style={s.stat}>
          <Text style={s.statVal}>₹{user?.walletBalance?.toFixed(0) ?? '0'}</Text>
          <Text style={s.statLabel}>बैलेंस</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statVal}>{user?.role === 'admin' ? 'एडमिन' : 'यूज़र'}</Text>
          <Text style={s.statLabel}>भूमिका</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statVal}>{user?.status === 'active' ? 'सक्रिय' : 'निलंबित'}</Text>
          <Text style={[s.statLabel, { color: user?.status === 'active' ? colors.success : colors.destructive }]}>स्थिति</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={s.menuSection}>
        <MenuItem icon="trophy-outline" label="मेरी भविष्यवाणियां" onPress={() => router.push('/(tabs)/predictions')} />
        <MenuItem icon="wallet-outline" label="वॉलेट" onPress={() => router.push('/(tabs)/wallet')} />
        <MenuItem icon="headset-outline" label="Support (सहायता)" onPress={() => router.push('/(tabs)/support')} />
        <MenuItem icon="information-circle-outline" label="Jazment के बारे में" onPress={() => Alert.alert('Jazment', 'Cricket Prediction Platform v1.0')} />
        <MenuItem icon="log-out-outline" label="लॉगआउट" onPress={handleLogout} destructive />
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
  },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  avatarText: { fontSize: 32, fontWeight: '700' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 22, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  phone: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  kycBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  kycText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  statsCard: {
    flexDirection: 'row', marginHorizontal: 20, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 24,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, backgroundColor: colors.border },
  menuSection: { paddingHorizontal: 20 },
});
