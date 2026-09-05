import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Clipboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/contexts/LanguageContext';

// Payments are completed manually inside the user's own UPI app.
// Intent-based payments (upi://pay links) to a personal UPI ID are rejected by
// banks/NPCI with "bank limit exceeded" regardless of amount, so this screen
// never launches a payment intent. It only provides the UPI ID + exact amount.

export default function AddCashPaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { amount, upiId } = useLocalSearchParams<{ amount?: string; upiId?: string }>();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const amountValue = Number(amount);
  const trimmedUpiId = upiId?.trim() ?? '';
  const hasValidPayment = Number.isFinite(amountValue) && amountValue >= 200 && trimmedUpiId.length > 0;
  const amountText = hasValidPayment ? amountValue.toFixed(2) : '—';
  const s = styles(colors, insets);

  const returnToPaymentProof = useCallback(() => {
    router.replace({
      pathname: '/(tabs)/wallet',
      params: {
        open: 'deposit',
        request: Date.now().toString(),
      },
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToPaymentProof();
      return true;
    });
    return () => subscription.remove();
  }, [returnToPaymentProof]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const copyUpiId = () => {
    if (!hasValidPayment) {
      Alert.alert(t('wallet_error_title'), 'Payment details are unavailable. Please return to Add Cash and try again.');
      return;
    }
    Clipboard.setString(trimmedUpiId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2500);
  };

  const steps = [
    { icon: 'copy-outline' as const, text: 'Tap "Copy UPI ID" above.' },
    { icon: 'phone-portrait-outline' as const, text: 'Open PhonePe, Google Pay, Paytm or any UPI app and choose "To UPI ID" / "Pay to UPI ID".' },
    { icon: 'cash-outline' as const, text: `Paste the UPI ID, enter exactly ₹${amountText} and complete the payment.` },
    { icon: 'cloud-upload-outline' as const, text: 'Come back to Jazment and upload the payment screenshot.' },
  ];

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backButton}
          onPress={returnToPaymentProof}
          accessibilityLabel="Back to payment proof"
          testID="add-cash-payment-back"
        >
          <Ionicons name="arrow-back" size={23} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Cash</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.secureIcon}>
          <Ionicons name="shield-checkmark" size={34} color={colors.primary} />
        </View>
        <Text style={s.title}>Pay from your UPI app</Text>
        <Text style={s.subtitle}>
          Send the exact amount to the UPI ID below directly from your UPI app, then upload the screenshot.
        </Text>

        <View style={s.amountCard}>
          <Text style={s.amountLabel}>AMOUNT TO PAY</Text>
          <Text style={s.amount}>₹{amountText}</Text>
          {trimmedUpiId ? (
            <View style={s.upiBlock}>
              <Text style={s.upiLabel}>PAY TO UPI ID</Text>
              <Text style={s.upiValue} selectable testID="add-cash-upi-id">{trimmedUpiId}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[s.payButton, copied && s.copiedButton, !hasValidPayment && s.disabledButton]}
          onPress={copyUpiId}
          disabled={!hasValidPayment}
          activeOpacity={0.85}
          accessibilityLabel="Copy UPI ID"
          testID="add-cash-copy-upi"
        >
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={22}
            color={colors.primaryForeground}
          />
          <Text style={s.payButtonText}>{copied ? 'UPI ID Copied' : 'Copy UPI ID'}</Text>
        </TouchableOpacity>

        <View style={s.stepsCard}>
          <Text style={s.stepsTitle}>How to pay</Text>
          {steps.map((step, index) => (
            <View key={step.icon} style={[s.stepRow, index === steps.length - 1 && s.stepRowLast]}>
              <View style={s.stepBadge}>
                <Text style={s.stepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={s.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        <View style={s.notice}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={s.noticeText}>
            Pay only by entering the UPI ID inside your UPI app. Payment links opened from other apps are blocked by banks for this UPI ID and show a "bank limit exceeded" error even for small amounts.
          </Text>
        </View>

        <TouchableOpacity
          style={s.proofButton}
          onPress={returnToPaymentProof}
          activeOpacity={0.8}
          testID="add-cash-return-to-proof"
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
          <Text style={s.proofButtonText}>I have paid — Upload Screenshot</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={s.footer}>Wallet credit is not automatic. Every deposit is verified from the screenshot and approved by admin.</Text>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  secureIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 320,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  amountCard: {
    alignSelf: 'stretch',
    marginTop: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
  },
  amount: {
    marginTop: 8,
    fontSize: 40,
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
  },
  upiBlock: {
    alignSelf: 'stretch',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  upiLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
  },
  upiValue: {
    marginTop: 6,
    fontSize: 20,
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  payButton: {
    alignSelf: 'stretch',
    minHeight: 54,
    marginTop: 16,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  copiedButton: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
  },
  disabledButton: {
    opacity: 0.55,
  },
  payButtonText: {
    fontSize: 17,
    color: colors.primaryForeground,
    fontFamily: 'Inter_700Bold',
  },
  stepsCard: {
    alignSelf: 'stretch',
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  stepsTitle: {
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    fontSize: 12,
    color: colors.primaryForeground,
    fontFamily: 'Inter_700Bold',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
    fontFamily: 'Inter_400Regular',
  },
  notice: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.warning + '1A',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.foreground,
    fontFamily: 'Inter_400Regular',
  },
  proofButton: {
    alignSelf: 'stretch',
    minHeight: 50,
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proofButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    fontSize: 11,
    lineHeight: 16,
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
