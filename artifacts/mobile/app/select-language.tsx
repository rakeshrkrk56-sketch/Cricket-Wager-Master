import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';
import { useColors } from '@/hooks/useColors';

const LANGUAGES: { code: Lang; name: string; native: string; flag: string }[] = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
];

export default function SelectLanguageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, setLang, markLanguageSelected } = useLanguage();
  const [selected, setSelected] = useState<Lang>(lang);

  const handleContinue = async () => {
    await setLang(selected);
    await markLanguageSelected();
    router.replace('/login');
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Brand */}
      <View style={s.brand}>
        <View style={s.logoCircle}>
          <Text style={s.logoLetter}>J</Text>
        </View>
        <Text style={s.appName}>Jazment</Text>
        <Text style={s.appTagline}>Cricket Prediction Platform</Text>
      </View>

      {/* Card */}
      <View style={s.card}>
        <Text style={s.title}>
          {selected === 'hi' ? 'भाषा चुनें' : 'Choose Language'}
        </Text>
        <Text style={s.subtitle}>
          {selected === 'hi'
            ? 'जारी रखने के लिए अपनी पसंदीदा भाषा चुनें'
            : 'Select your preferred language to continue'}
        </Text>

        <View style={s.options}>
          {LANGUAGES.map((l) => {
            const active = selected === l.code;
            return (
              <TouchableOpacity
                key={l.code}
                style={[s.option, active && s.optionActive]}
                onPress={() => setSelected(l.code)}
                activeOpacity={0.75}
              >
                <Text style={s.flag}>{l.flag}</Text>
                <View style={s.optionText}>
                  <Text style={[s.optionName, active && s.optionNameActive]}>{l.native}</Text>
                  {l.native !== l.name && (
                    <Text style={[s.optionSub, active && s.optionSubActive]}>{l.name}</Text>
                  )}
                </View>
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={s.btn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={s.btnText}>
            {selected === 'hi' ? 'जारी रखें' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: insets.top + 32,
      paddingBottom: insets.bottom + 24,
      justifyContent: 'flex-end',
    },
    brand: { alignItems: 'center', marginBottom: 36 },
    logoCircle: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    },
    logoLetter: { fontSize: 36, fontWeight: '800' as const, color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
    appName: { fontSize: 30, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
    appTagline: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, fontFamily: 'Inter_400Regular' },
    card: {
      backgroundColor: colors.card, borderRadius: 20,
      padding: 24, borderWidth: 1, borderColor: colors.border,
    },
    title: { fontSize: 22, fontWeight: '700' as const, color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 24, lineHeight: 20 },
    options: { gap: 12, marginBottom: 24 },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 16, borderRadius: 14,
      borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    flag: { fontSize: 28 },
    optionText: { flex: 1 },
    optionName: { fontSize: 18, fontWeight: '600' as const, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
    optionNameActive: { color: colors.primary },
    optionSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
    optionSubActive: { color: colors.primary + 'aa' },
    radio: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    btn: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    btnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  });
