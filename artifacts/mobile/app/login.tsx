import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSendOtp, useVerifyOtp } from '@workspace/api-client-react';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, login, logout } = useAuth();
  const { t } = useLanguage();

  // If already logged in, go to tabs. But stay if user was explicitly sent here to re-login.
  const [forcedLogout, setForcedLogout] = useState(false);
  useEffect(() => {
    if (token && !forcedLogout) {
      router.replace('/(tabs)');
    }
  }, [token, forcedLogout]);

  const handleForceLogout = async () => {
    await logout();
    setForcedLogout(true);
  };
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const handleSendOtp = () => {
    const cleaned = phone.trim();
    if (!cleaned) { Alert.alert(t('login_empty_number_title'), t('login_empty_number_msg')); return; }
    const full = cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    sendOtp.mutate({ data: { phone: full } }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('otp');
      },
      onError: () => Alert.alert('Error', t('login_send_failed')),
    });
  };

  const handleVerifyOtp = () => {
    if (!otp.trim()) { Alert.alert(t('login_empty_otp_title'), t('login_empty_otp_msg')); return; }
    const cleaned = phone.trim();
    const full = cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    verifyOtp.mutate({ data: { phone: full, otp: otp.trim() } }, {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        login(data.token, {
          id: data.user.id,
          phone: data.user.phone,
          name: data.user.name,
          walletBalance: data.user.walletBalance,
          kycStatus: data.user.kycStatus,
          status: data.user.status,
          role: data.user.role,
        }).then(() => router.replace('/(tabs)'));
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('login_wrong_otp_title'), t('login_wrong_otp_msg'));
      },
    });
  };

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView style={s.root} behavior="padding">
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={s.brand}>
          <View style={s.logoCircle}>
            <Text style={s.logoLetter}>J</Text>
          </View>
          <Text style={s.appName}>Jazment</Text>
          <Text style={s.tagline}>Live Dragon Tiger</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>
            {step === 'phone' ? t('login_enter_mobile') : t('login_enter_otp')}
          </Text>
          <Text style={s.cardSubtitle}>
            {step === 'phone'
              ? 'A 4-digit verification code will be sent to your WhatsApp.'
              : t('login_otp_sent_to', phone)}
          </Text>

          {step === 'phone' ? (
            <View style={s.inputRow}>
              <View style={s.prefix}><Text style={s.prefixText}>+91</Text></View>
              <TextInput
                style={s.input}
                placeholder={t('login_mobile_placeholder')}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>
          ) : (
            <TextInput
              style={[s.input, s.otpInput]}
              placeholder={t('login_enter_otp')}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={setOtp}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={handleVerifyOtp}
            />
          )}

          <TouchableOpacity
            style={[s.btn, (sendOtp.isPending || verifyOtp.isPending) && s.btnDisabled]}
            onPress={step === 'phone' ? handleSendOtp : handleVerifyOtp}
            disabled={sendOtp.isPending || verifyOtp.isPending}
            activeOpacity={0.85}
          >
            {(sendOtp.isPending || verifyOtp.isPending) ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={s.btnText}>
                {step === 'phone' ? t('login_send_otp') : t('login_verify_login')}
              </Text>
            )}
          </TouchableOpacity>

          {step === 'otp' && (
            <TouchableOpacity onPress={() => setStep('phone')} style={s.backBtn}>
              <Text style={s.backText}>{t('login_change_number')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Already logged in banner — tap to clear session and test OTP */}
        {token && !forcedLogout && (
          <TouchableOpacity style={s.alreadyLoggedIn} onPress={handleForceLogout} activeOpacity={0.8}>
            <Text style={s.alreadyLoggedInText}>Already logged in — tap here to log out and test OTP</Text>
          </TouchableOpacity>
        )}

        <View style={s.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1, paddingHorizontal: 24,
    paddingTop: insets.top + 32,
    paddingBottom: insets.bottom + 24,
    justifyContent: 'flex-end',
  },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  logoLetter: { fontSize: 34, fontWeight: '800' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
  appName: { fontSize: 30, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, fontFamily: 'Inter_400Regular' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 20, lineHeight: 20 },
  inputRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'center' },
  prefix: { backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  prefixText: { color: colors.foreground, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  input: {
    flex: 1, backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border, color: colors.foreground,
    fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 16,
  },
  otpInput: { letterSpacing: 6, fontSize: 22, textAlign: 'center' as const, fontFamily: 'Inter_600SemiBold' },
  btn: {
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backText: { color: colors.primary, fontSize: 14, fontFamily: 'Inter_500Medium' },
  bottomSpacer: { height: 16 },
  alreadyLoggedIn: {
    marginTop: 20, padding: 14, borderRadius: 12,
    backgroundColor: colors.warning + '20', borderWidth: 1, borderColor: colors.warning + '60',
    alignItems: 'center',
  },
  alreadyLoggedInText: {
    color: colors.warning, fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' as const,
  },
});
