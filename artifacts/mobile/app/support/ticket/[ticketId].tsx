import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGetSupportTicket, useAddTicketMessage } from '@workspace/api-client-react';

const STATUS_COLOR: Record<string, string> = {
  open: '#F59E0B', in_progress: '#3B82F6', resolved: '#10B981', closed: '#6B7280',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
};

export default function TicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reply, setReply] = useState('');

  const { data, isLoading, refetch } = useGetSupportTicket(ticketId ?? '');
  const addMessage = useAddTicketMessage();

  const s = styles(colors, insets);

  const handleSend = async () => {
    if (!reply.trim()) return;
    try {
      await addMessage.mutateAsync({ ticketId: ticketId ?? '', data: { message: reply.trim() } });
      setReply('');
      refetch();
    } catch {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data) return null;
  const { ticket, messages } = data;
  const isClosed = ticket.status === 'closed';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>{ticket.subject}</Text>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[ticket.status] }]} />
              <Text style={[s.statusLabel, { color: STATUS_COLOR[ticket.status] }]}>{STATUS_LABEL[ticket.status]}</Text>
              <Text style={s.ticketId}>#{ticket.id.slice(0, 8)}</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[s.bubble, msg.isAdmin ? s.adminBubble : s.userBubble]}>
              {msg.isAdmin && (
                <Text style={s.senderLabel}>
                  {msg.senderId ? 'Support Agent' : 'Jazment Support'}
                </Text>
              )}
              <Text style={[s.bubbleText, msg.isAdmin && s.adminBubbleText]}>{msg.message}</Text>
              <Text style={[s.bubbleTime, msg.isAdmin && { color: 'rgba(255,255,255,0.6)' }]}>
                {new Date(msg.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
          {isClosed && (
            <View style={s.closedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={STATUS_COLOR.closed} />
              <Text style={s.closedText}>This ticket is closed. Create a new ticket for further assistance.</Text>
            </View>
          )}
        </ScrollView>

        {/* Reply input */}
        {!isClosed && (
          <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={s.input}
              value={reply}
              onChangeText={setReply}
              placeholder="Type your message…"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, (!reply.trim() || addMessage.isPending) && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={!reply.trim() || addMessage.isPending}
              activeOpacity={0.8}
            >
              {addMessage.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12),
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  ticketId: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginLeft: 4 },

  // Bubbles
  bubble: {
    maxWidth: '80%', padding: 12, borderRadius: 14,
    alignSelf: 'flex-start',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  adminBubble: {
    alignSelf: 'flex-start', backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userBubble: { alignSelf: 'flex-end' },
  senderLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_700Bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  bubbleText: { fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  adminBubbleText: { color: colors.primaryForeground },
  bubbleTime: { fontSize: 10, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 4, textAlign: 'right' },

  closedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.muted, borderRadius: 10, padding: 12,
  },
  closedText: { flex: 1, fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100, fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
