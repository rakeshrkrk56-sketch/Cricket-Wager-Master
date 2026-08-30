import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGetWalletQueryKey, useGetWallet } from '@workspace/api-client-react';
import { useAvatar } from '@/contexts/AvatarContext';
import { AvatarChoice, UserAvatar } from '@/components/UserAvatar';

function MenuItem({ icon, label, onPress, destructive = false, sublabel }: {
  icon: string; label: string; sublabel?: string; onPress: () => void; destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={menuStyles(colors).row} onPress={onPress} activeOpacity={0.7}>
      <View style={[menuStyles(colors).icon, { backgroundColor: destructive ? colors.destructive + '20' : colors.muted }]}>
        <Ionicons name={icon as any} size={20} color={destructive ? colors.destructive : colors.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[menuStyles(colors).label, destructive && { color: colors.destructive }]}>{label}</Text>
        {sublabel ? <Text style={menuStyles(colors).sublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const menuStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '500' as const, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  sublabel: { fontSize: 11, color: '#8EA3BC', fontFamily: 'Inter_400Regular', marginTop: 1 },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, token } = useAuth();
  const { avatar, selectAvatar } = useAvatar();
  const { data: walletData } = useGetWallet({
    query: { enabled: !!token, queryKey: getGetWalletQueryKey() },
  });
  const liveBalance = Number(walletData?.balance ?? user?.walletBalance ?? 0);
  const { t } = useLanguage();
  const s = styles(colors, insets);
  const isGuest = user?.phone?.startsWith('guest:') ?? true;

  const handleLogout = () => {
    Alert.alert(t('profile_logout_title'), t('profile_logout_msg'), [
      { text: t('profile_cancel'), style: 'cancel' },
      { text: t('profile_logout'), style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const kycLabel: Record<string, string> = {
    pending:  t('profile_kyc_pending'),
    verified: t('profile_kyc_verified'),
    rejected: t('profile_kyc_rejected'),
  };
  const kycColor: Record<string, string> = {
    pending: colors.warning,
    verified: colors.success,
    rejected: colors.destructive,
  };

  const accountStatusColor: Record<string, string> = {
    active: colors.success,
    hold: colors.warning,
    suspended: colors.destructive,
  };
  const accountStatusLabel: Record<string, string> = {
    active: t('profile_status_active'),
    hold: 'On Hold',
    suspended: t('profile_status_suspended'),
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Profile</Text>
      <View style={s.avatarSection}>
        <Text style={s.sectionLabel}>CURRENT AVATAR</Text>
        <View style={s.currentAvatar}>
          <UserAvatar choice={avatar} size={92} />
        </View>
        <Text style={s.name}>{user?.name ?? 'Jazment User'}</Text>
        <Text style={s.phone}>{isGuest ? 'Guest account • Play instantly' : user?.phone}</Text>
        <View style={[s.kycBadge, { backgroundColor: kycColor[user?.kycStatus ?? 'pending'] + '20' }]}>
          <Ionicons name={user?.kycStatus === 'verified' ? 'checkmark-circle' : 'time-outline'} size={13} color={kycColor[user?.kycStatus ?? 'pending']} />
          <Text style={[s.kycText, { color: kycColor[user?.kycStatus ?? 'pending'] }]}>KYC: {kycLabel[user?.kycStatus ?? 'pending']}</Text>
        </View>
      </View>

      <View style={s.avatarPicker}>
        <Text style={s.pickerTitle}>Select Avatar</Text>
        <Text style={s.pickerSubtitle}>Choose the profile style shown in your wallet header.</Text>
        <View style={s.avatarChoices}>
          {(['male', 'female'] as AvatarChoice[]).map((choice) => {
            const selected = avatar === choice;
            return (
              <TouchableOpacity
                key={choice}
                style={[s.avatarChoice, selected && s.avatarChoiceSelected]}
                onPress={() => void selectAvatar(choice)}
                activeOpacity={0.82}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Select ${choice} avatar`}
                testID={`profile-avatar-${choice}`}
              >
                <View style={s.choiceArtwork}>
                  <UserAvatar choice={choice} size={68} />
                  {selected ? (
                    <View style={s.selectedCheck}>
                      <Ionicons name="checkmark" size={14} color="#4B0B18" />
                    </View>
                  ) : null}
                </View>
                <Text style={[s.choiceLabel, selected && s.choiceLabelSelected]}>
                  {choice === 'male' ? 'Male Avatar' : 'Female Avatar'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsCard}>
        <View style={s.stat}>
          <Text style={s.statVal}>₹{liveBalance.toFixed(2)}</Text>
          <Text style={s.statLabel}>{t('profile_balance')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statVal}>{user?.role === 'admin' ? t('profile_role_admin') : t('profile_role_user')}</Text>
          <Text style={s.statLabel}>{t('profile_role')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={[s.statVal, { color: accountStatusColor[user?.status ?? 'active'] }]}>
            {accountStatusLabel[user?.status ?? 'active'] ?? user?.status}
          </Text>
          <Text style={[s.statLabel, { color: accountStatusColor[user?.status ?? 'active'] }]}>{t('profile_status')}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={s.menuSection}>
        <MenuItem icon="wallet-outline"            label={t('profile_wallet')}          onPress={() => router.push('/(tabs)/wallet')} />
        <MenuItem icon="headset-outline"           label={t('profile_support')}         onPress={() => router.push('/(tabs)/support')} />

        {/* KYC Documents */}
        <MenuItem
          icon="document-text-outline"
          label="KYC Verification"
          sublabel={kycLabel[user?.kycStatus ?? 'pending']}
          onPress={() => router.push('/kyc')}
        />

        {user?.role === 'admin' && (
          <MenuItem
            icon="shield-checkmark-outline"
            label="Admin Workspace"
            sublabel="Manage users, deposits, withdrawals"
            onPress={() => router.push('/admin')}
          />
        )}
        <MenuItem
          icon="information-circle-outline"
          label={t('profile_about')}
          onPress={() => Alert.alert('Jazment', t('profile_about_msg'))}
        />
        <MenuItem icon="log-out-outline" label={t('profile_logout')} onPress={handleLogout} destructive />
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
  pageTitle: {
    color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 26,
    marginHorizontal: 20, marginTop: 6,
  },
  avatarSection: { alignItems: 'center', paddingTop: 22, paddingBottom: 24 },
  sectionLabel: {
    color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11,
    letterSpacing: 1.2, marginBottom: 10,
  },
  currentAvatar: {
    width: 96, height: 96, borderRadius: 48, overflow: 'hidden', marginBottom: 12,
    borderWidth: 2, borderColor: '#F7C957',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  name: { fontSize: 22, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  phone: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  kycBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  kycText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
  avatarPicker: {
    marginHorizontal: 20, marginBottom: 20, padding: 16, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  pickerTitle: { color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 },
  pickerSubtitle: {
    color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12,
    lineHeight: 18, marginTop: 3, marginBottom: 14,
  },
  avatarChoices: { flexDirection: 'row', gap: 12 },
  avatarChoice: {
    flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.background,
  },
  avatarChoiceSelected: { borderColor: '#F7C957', backgroundColor: '#F7C95714' },
  choiceArtwork: {
    width: 72, height: 72, borderRadius: 36, overflow: 'hidden', marginBottom: 9,
    borderWidth: 1, borderColor: colors.border,
  },
  selectedCheck: {
    position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7C957',
    borderWidth: 2, borderColor: colors.card,
  },
  choiceLabel: {
    color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12, textAlign: 'center',
  },
  choiceLabelSelected: { color: colors.foreground },
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
