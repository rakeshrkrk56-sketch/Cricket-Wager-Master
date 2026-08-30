import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGetMyTickets, getGetMyTicketsQueryKey, useCreateSupportTicket } from '@workspace/api-client-react';

const STATUS_COLOR: Record<string, string> = {
  open: '#F59E0B', in_progress: '#3B82F6', resolved: '#10B981', closed: '#6B7280',
};

type Tab = 'home' | 'tickets' | 'new';

type Category =
  | 'deposit_issue' | 'withdrawal_issue'
  | 'account_issue' | 'technical_problem' | 'other';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const colors = useColors();
  return (
    <TouchableOpacity
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
      onPress={() => setOpen(!open)}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 }}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{q}</Text>
      </View>
      {open && (
        <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', paddingBottom: 14, paddingLeft: 26, lineHeight: 20 }}>{a}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('home');
  const [category, setCategory]       = useState<Category>('other');
  const [description, setDescription] = useState('');

  const CATEGORIES: { value: Category; labelKey: string; icon: string }[] = [
    { value: 'deposit_issue',    labelKey: 'support_cat_deposit',    icon: 'arrow-down-circle-outline' },
    { value: 'withdrawal_issue', labelKey: 'support_cat_withdraw',   icon: 'arrow-up-circle-outline' },
    { value: 'account_issue',    labelKey: 'support_cat_account',    icon: 'settings-outline' },
    { value: 'technical_problem',labelKey: 'support_cat_technical',  icon: 'bug-outline' },
    { value: 'other',            labelKey: 'support_cat_other',      icon: 'help-circle-outline' },
  ];

  const STATUS_LABEL: Record<string, string> = {
    open:        t('support_status_open'),
    in_progress: t('support_status_in_progress'),
    resolved:    t('support_status_resolved'),
    closed:      t('support_status_closed'),
  };

  const FAQS = [
    { q: t('support_faq_q1'), a: t('support_faq_a1') },
    { q: t('support_faq_q2'), a: t('support_faq_a2') },
    { q: t('support_faq_q3'), a: t('support_faq_a3') },
    { q: t('support_faq_q4'), a: t('support_faq_a4') },
    { q: t('support_faq_q6'), a: t('support_faq_a6') },
  ];

  const { data: ticketsData, isLoading: ticketsLoading, refetch } = useGetMyTickets(
    { page: 1, limit: 20 },
    { query: { enabled: !!token && tab === 'tickets', queryKey: getGetMyTicketsQueryKey({ page: 1, limit: 20 }) } }
  );
  const createTicket = useCreateSupportTicket();

  const s = styles(colors, insets);

  const handleSubmitTicket = async () => {
    if (!description.trim()) { Alert.alert(t('support_required'), t('support_enter_desc')); return; }
    const selectedCategory = CATEGORIES.find((item) => item.value === category);
    const subject = selectedCategory ? t(selectedCategory.labelKey as any) : t('support_cat_other');
    try {
      await createTicket.mutateAsync({ data: { subject, category, description } });
      Alert.alert(t('support_ticket_ok_title'), t('support_ticket_ok_msg'), [
        { text: t('support_view_tickets'), onPress: () => { setTab('tickets'); refetch(); } },
        { text: 'OK' },
      ]);
      setDescription(''); setCategory('other');
    } catch {
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    }
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('support_title')}</Text>
        <Text style={s.headerSub}>{t('support_subtitle')}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['home', 'tickets', 'new'] as Tab[]).map((tb) => (
          <TouchableOpacity key={tb} style={[s.tab, tab === tb && s.tabActive]} onPress={() => setTab(tb)} activeOpacity={0.7}>
            <Text style={[s.tabLabel, tab === tb && s.tabLabelActive]}>
              {tb === 'home' ? 'FAQ' : tb === 'tickets' ? 'Messages' : 'Live Chat'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── HOME TAB ── */}
      {tab === 'home' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Frequently asked questions</Text>
            <View style={s.categoryGrid}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={s.categoryCard}
                  onPress={() => { setCategory(c.value); setTab('new'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={c.icon as any} size={22} color={colors.primary} />
                  <Text style={s.categoryLabel}>{t(c.labelKey as any)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <View style={s.faqCard}>
              {FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
            </View>
          </View>

          <View style={s.liveChatCard}>
            <View style={s.liveChatIcon}>
              <Ionicons name="chatbubbles" size={25} color={colors.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.liveChatTitle}>Didn&apos;t find what you need?</Text>
              <Text style={s.liveChatText}>Write to Jazment Support. Your message goes directly to the admin team.</Text>
            </View>
            <TouchableOpacity style={s.liveChatBtn} onPress={() => setTab('new')} testID="support-start-chat">
              <Text style={s.liveChatBtnText}>LIVE CHAT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── MY TICKETS TAB ── */}
      {tab === 'tickets' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {ticketsLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}><ActivityIndicator color={colors.primary} /></View>
          ) : !ticketsData?.tickets?.length ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontFamily: 'Inter_400Regular' }}>{t('support_no_tickets')}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setTab('new')} activeOpacity={0.8}>
                <Text style={s.emptyBtnLabel}>{t('support_create_first')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
              {ticketsData.tickets.map((ticket) => (
                <TouchableOpacity
                  key={ticket.id}
                  style={s.ticketCard}
                  onPress={() => router.push(`/support/ticket/${ticket.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                    <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[ticket.status] }]} />
                    <Text style={[s.statusLabel, { color: STATUS_COLOR[ticket.status] }]}>{STATUS_LABEL[ticket.status]}</Text>
                    <Text style={s.ticketId}>#{ticket.id.slice(0, 8)}</Text>
                  </View>
                  <Text style={s.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
                  <Text style={s.ticketCat}>{CATEGORIES.find(c => c.value === ticket.category)?.labelKey ? t(CATEGORIES.find(c => c.value === ticket.category)!.labelKey as any) : ticket.category}</Text>
                  <Text style={s.ticketDate}>{new Date(ticket.updatedAt).toLocaleDateString('en-IN')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── NEW TICKET TAB ── */}
      {tab === 'new' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionTitle}>{t('support_create_ticket')}</Text>

          <Text style={[s.fieldLabel, { marginTop: 16 }]}>{t('support_category')}</Text>
          <View style={s.categorySelect}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c.value} style={[s.catChip, category === c.value && s.catChipActive]} onPress={() => setCategory(c.value)} activeOpacity={0.7}>
                <Text style={[s.catChipLabel, category === c.value && s.catChipLabelActive]}>{t(c.labelKey as any)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>{t('support_description')}</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('support_desc_ph')}
            placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={5} textAlignVertical="top"
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{t('support_screenshot')}</Text>
          <TouchableOpacity style={s.uploadBox} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 }}>{t('support_tap_attach')}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{t('support_file_size')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.submitBtn, createTicket.isPending && { opacity: 0.6 }]}
            onPress={handleSubmitTicket}
            disabled={createTicket.isPending}
            activeOpacity={0.8}
          >
            {createTicket.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.submitBtnLabel}>{t('support_submit')}</Text>
            }
          </TouchableOpacity>

          <Text style={s.submitHint}>Your message will appear in the Jazment admin Support panel. You can read and reply to the admin response under Messages.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  tabLabelActive: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  infoCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '30%', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center', gap: 6, minWidth: 90 },
  categoryLabel: { fontSize: 11, color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  faqCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  liveChatCard: {
    marginHorizontal: 16, marginBottom: 28, padding: 16, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  },
  liveChatIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  liveChatTitle: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_700Bold' },
  liveChatText: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  liveChatBtn: { width: '100%', borderRadius: 10, backgroundColor: colors.primary, paddingVertical: 12, alignItems: 'center' },
  liveChatBtnText: { color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  ticketCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  ticketId: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginLeft: 'auto' },
  ticketSubject: { fontSize: 15, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  ticketCat: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ticketDate: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'right' },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyBtnLabel: { color: colors.primaryForeground, fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular' },
  textarea: { height: 110, paddingTop: 12 },
  categorySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  catChipLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  catChipLabelActive: { color: colors.primary },
  uploadBox: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 10, padding: 20, alignItems: 'center', marginTop: 6, backgroundColor: colors.card },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnLabel: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  submitHint: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 12, fontFamily: 'Inter_400Regular' },
});
