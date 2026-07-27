import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Linking, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetMyTickets,
  useCreateSupportTicket,
} from '@workspace/api-client-react';

const WHATSAPP_NUMBER = '919876543210'; // Replace with real support number
const SUPPORT_EMAIL = 'support@jazment.com';
const SUPPORT_HOURS = 'Mon–Sat, 9 AM – 9 PM IST';

const CATEGORIES = [
  { value: 'deposit_issue', label: 'Deposit Issue', icon: 'arrow-down-circle-outline' },
  { value: 'withdrawal_issue', label: 'Withdrawal Issue', icon: 'arrow-up-circle-outline' },
  { value: 'prediction_issue', label: 'Prediction Issue', icon: 'trophy-outline' },
  { value: 'kyc_issue', label: 'KYC Issue', icon: 'person-outline' },
  { value: 'account_issue', label: 'Account Issue', icon: 'settings-outline' },
  { value: 'technical_problem', label: 'Technical Problem', icon: 'bug-outline' },
  { value: 'other', label: 'Other', icon: 'help-circle-outline' },
] as const;

type Category = typeof CATEGORIES[number]['value'];

const STATUS_COLOR: Record<string, string> = {
  open: '#F59E0B',
  in_progress: '#3B82F6',
  resolved: '#10B981',
  closed: '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const FAQS = [
  {
    q: 'How to Deposit?',
    a: 'Go to Wallet → Deposit. Enter the amount, select UPI/Bank, copy the UPI ID, send payment, and enter your UTR number to confirm. Deposits are credited within 30 minutes after admin approval.',
  },
  {
    q: 'How to Withdraw?',
    a: 'Go to Wallet → Withdraw. Enter the amount and your UPI ID. Withdrawals are processed within 24 hours after admin approval. Minimum withdrawal is ₹100.',
  },
  {
    q: 'How do Predictions Work?',
    a: 'Open any live or upcoming match, choose a market (e.g. Match Winner), pick your option, and confirm. If correct, winnings are credited to your wallet instantly after the match result.',
  },
  {
    q: 'Wallet Rules',
    a: 'Your wallet balance can be used to place predictions. Deposits require admin approval. Withdrawals are processed to your registered UPI ID only. Bonus credits cannot be withdrawn directly.',
  },
  {
    q: 'KYC Process',
    a: 'KYC (Know Your Customer) verification is required for withdrawals above ₹10,000. Submit your Aadhaar/PAN from the Profile section. Verification takes 24–48 hours.',
  },
  {
    q: 'Refund Policy',
    a: 'If a match is cancelled or abandoned, all bets are refunded automatically. For disputed transactions, raise a support ticket with your UTR number. Refunds take 3–5 business days.',
  },
];

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

type Tab = 'home' | 'tickets' | 'new';

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('home');

  // Ticket form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [description, setDescription] = useState('');

  const { data: ticketsData, isLoading: ticketsLoading, refetch } = useGetMyTickets(
    { page: 1, limit: 20 },
    { query: { enabled: !!token && tab === 'tickets' } }
  );
  const createTicket = useCreateSupportTicket();

  const s = styles(colors, insets);

  const openWhatsApp = () => {
    const msg = encodeURIComponent('Hello, I need help regarding my account.');
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp. Please install WhatsApp and try again.'));
  };

  const handleSubmitTicket = async () => {
    if (!subject.trim()) { Alert.alert('Required', 'Please enter a subject.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Please describe your issue.'); return; }
    try {
      await createTicket.mutateAsync({ data: { subject, category, description } });
      Alert.alert('Ticket Submitted ✓', 'Your ticket has been created. Our team will respond within 24 hours.', [
        { text: 'View Tickets', onPress: () => { setTab('tickets'); refetch(); } },
        { text: 'OK' },
      ]);
      setSubject(''); setDescription(''); setCategory('other');
    } catch {
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    }
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Support</Text>
        <Text style={s.headerSub}>We're here to help</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['home', 'tickets', 'new'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.7}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'home' ? 'Help Center' : t === 'tickets' ? 'My Tickets' : 'New Ticket'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── HOME TAB ── */}
      {tab === 'home' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
          {/* WhatsApp CTA */}
          <View style={s.whatsappCard}>
            <View style={s.whatsappIconWrap}>
              <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.whatsappTitle}>WhatsApp Support</Text>
              <Text style={s.whatsappNum}>+91 98765 43210</Text>
              <Text style={s.whatsappHours}>{SUPPORT_HOURS}</Text>
            </View>
            <TouchableOpacity style={s.whatsappBtn} onPress={openWhatsApp} activeOpacity={0.8}>
              <Text style={s.whatsappBtnLabel}>Chat Now</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Info */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Contact Information</Text>
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={s.infoText}>+91 98765 43210</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
                <Text style={s.infoText}>{SUPPORT_EMAIL}</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={s.infoText}>{SUPPORT_HOURS}</Text>
              </View>
            </View>
          </View>

          {/* Support Categories */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Support Categories</Text>
            <View style={s.categoryGrid}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={s.categoryCard}
                  onPress={() => { setCategory(c.value); setTab('new'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={c.icon as any} size={22} color={colors.primary} />
                  <Text style={s.categoryLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* FAQs */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
            <View style={s.faqCard}>
              {FAQS.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── MY TICKETS TAB ── */}
      {tab === 'tickets' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {ticketsLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !ticketsData?.tickets?.length ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontFamily: 'Inter_400Regular' }}>No tickets yet</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setTab('new')} activeOpacity={0.8}>
                <Text style={s.emptyBtnLabel}>Create Your First Ticket</Text>
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
                  <Text style={s.ticketCat}>{CATEGORIES.find(c => c.value === ticket.category)?.label ?? ticket.category}</Text>
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
          <Text style={s.sectionTitle}>Create Support Ticket</Text>
          <Text style={[s.fieldLabel, { marginTop: 16 }]}>Subject *</Text>
          <TextInput
            style={s.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief description of your issue"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={s.fieldLabel}>Category *</Text>
          <View style={s.categorySelect}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[s.catChip, category === c.value && s.catChipActive]}
                onPress={() => setCategory(c.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.catChipLabel, category === c.value && s.catChipLabelActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>Description *</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your issue in detail. Include relevant IDs, amounts, dates."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Screenshot (optional)</Text>
          <TouchableOpacity style={s.uploadBox} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 }}>
              Tap to attach screenshot
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' }}>PNG, JPG up to 5MB</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.submitBtn, createTicket.isPending && { opacity: 0.6 }]}
            onPress={handleSubmitTicket}
            disabled={createTicket.isPending}
            activeOpacity={0.8}
          >
            {createTicket.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.submitBtnLabel}>Submit Ticket</Text>
            }
          </TouchableOpacity>

          <Text style={s.submitHint}>
            If urgent, use WhatsApp support for faster response.
          </Text>
          <TouchableOpacity style={s.whatsappSmall} onPress={openWhatsApp} activeOpacity={0.7}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            <Text style={s.whatsappSmallLabel}>Chat on WhatsApp</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },

  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  tabLabelActive: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },

  // WhatsApp card
  whatsappCard: {
    margin: 16, padding: 16, borderRadius: 14,
    backgroundColor: '#25D36618', borderWidth: 1, borderColor: '#25D36640',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  whatsappIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#25D36620',
    alignItems: 'center', justifyContent: 'center',
  },
  whatsappTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  whatsappNum: { fontSize: 13, color: colors.foreground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  whatsappHours: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  whatsappBtn: {
    backgroundColor: '#25D366', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
  },
  whatsappBtnLabel: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // Info card
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  infoCard: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 14, gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular' },

  // Category grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    width: '30%', backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 12,
    alignItems: 'center', gap: 6, minWidth: 90,
  },
  categoryLabel: { fontSize: 11, color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  // FAQ
  faqCard: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 14,
  },

  // Ticket cards
  ticketCard: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 14,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  ticketId: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginLeft: 'auto' },
  ticketSubject: { fontSize: 15, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  ticketCat: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  ticketDate: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'right' },

  emptyBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  emptyBtnLabel: { color: colors.primaryForeground, fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // New ticket form
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular',
  },
  textarea: { height: 110, paddingTop: 12 },
  categorySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  catChipLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  catChipLabelActive: { color: colors.primary },
  uploadBox: {
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 10, padding: 20, alignItems: 'center', marginTop: 6,
    backgroundColor: colors.card,
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnLabel: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  submitHint: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 12, fontFamily: 'Inter_400Regular' },
  whatsappSmall: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 8,
  },
  whatsappSmallLabel: { fontSize: 13, color: '#25D366', fontFamily: 'Inter_600SemiBold' },
});
