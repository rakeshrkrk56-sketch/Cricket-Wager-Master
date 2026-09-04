import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Clipboard,
  Linking,
  Platform,
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

export default function AddCashPaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { amount, upiId } = useLocalSearchParams<{ amount?: string; upiId?: string }>();
  const [isOpening, setIsOpening] = useState(false);
  const [paymentAppOpened, setPaymentAppOpened] = useState(false);

  const amountValue = Number(amount);
  const hasValidPayment = Number.isFinite(amountValue) && amountValue >= 200 && Boolean(upiId?.trim());
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

  const openUpiApp = async () => {
    if (!hasValidPayment || !upiId) {
      Alert.alert(t('wallet_error_title'), 'Payment details are unavailable. Please return to Add Cash and try again.');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        'Open Jazment on your phone',
        `UPI apps cannot open from the web preview. Continue this payment in the Jazment Android app.\n\nAmount: ₹${amountValue.toFixed(2)}\nUPI ID: ${upiId.trim()}`,
      );
      return;
    }

    setIsOpening(true);
    try {
      const deeplink = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&cu=INR`;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Linking.openURL(deeplink);
      setPaymentAppOpened(true);
    } catch {
      Alert.alert(t('wallet_no_upi_app_title'), t('wallet_no_upi_app_msg'));
    } finally {
      setIsOpening(false);
    }
  };

  const copyUpiId = () => {
    if (!upiId?.trim()) return;
    Clipboard.setString(upiId.trim());
    Alert.alert('UPI ID copied', `${upiId.trim()}\n\nEnter ₹${amountValue.toFixed(2)} in your UPI app.`);
  };

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

      <View style={s.content}>
        <View style={s.secureIcon}>
          <Ionicons name="shield-checkmark" size={34} color={colors.primary} />
        </View>
        <Text style={s.title}>Complete your payment</Text>
        <Text style={s.subtitle}>Open your UPI app, then enter the exact amount shown below.</Text>

        <View style={s.amountCard}>
          <Text style={s.amountLabel}>AMOUNT TO PAY</Text>
          <Text style={s.amount}>₹{hasValidPayment ? amountValue.toFixed(2) : '—'}</Text>
          {upiId?.trim() ? (
            <View style={s.upiRow}>
              <View style={s.upiDetails}>
                <Text style={s.upiLabel}>PAY TO UPI ID</Text>
                <Text style={s.upiValue}>{upiId.trim()}</Text>
              </View>
              <TouchableOpacity
                style={s.copyButton}
                onPress={copyUpiId}
                activeOpacity={0.75}
                accessibilityLabel="Copy UPI ID"
                testID="add-cash-copy-upi"
              >
                <Ionicons name="copy-outline" size={17} color={colors.primary} />
                <Text style={s.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={s.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={s.noticeText}>
            Enter ₹{hasValidPayment ? amountValue.toFixed(2) : '—'} inside your UPI app. Payment is not credited automatically; return and upload the screenshot for admin verification.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.payButton, (!hasValidPayment || isOpening) && s.disabledButton]}
          onPress={openUpiApp}
          disabled={!hasValidPayment || isOpening}
          activeOpacity={0.85}
          testID="add-cash-click-to-pay"
        >
          {isOpening ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="arrow-forward-circle" size={22} color={colors.primaryForeground} />
              <Text style={s.payButtonText}>Open UPI App</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.proofButton}
          onPress={returnToPaymentProof}
          activeOpacity={0.75}
          testID="add-cash-return-to-proof"
        >
          <Ionicons
            name={paymentAppOpened ? 'cloud-upload-outline' : 'arrow-back-circle-outline'}
            size={20}
            color={colors.primary}
          />
          <Text style={s.proofButtonText}>
            {paymentAppOpened ? 'Return to Payment Proof' : 'Back to Add Cash'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>Wallet credit requires screenshot review and admin approval.</Text>
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
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secureIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 25,
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
    marginTop: 30,
    paddingVertical: 24,
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
  upiRow: {
    alignSelf: 'stretch',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  upiDetails: {
    flex: 1,
  },
  upiLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
    fontFamily: 'Inter_600SemiBold',
  },
  upiValue: {
    marginTop: 4,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: 'Inter_600SemiBold',
  },
  copyButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  notice: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
  },
  payButton: {
    alignSelf: 'stretch',
    minHeight: 54,
    marginTop: 22,
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
  disabledButton: {
    opacity: 0.55,
  },
  payButtonText: {
    fontSize: 17,
    color: colors.primaryForeground,
    fontFamily: 'Inter_700Bold',
  },
  proofButton: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proofButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    fontSize: 11,
    lineHeight: 16,
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});