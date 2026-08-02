import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';

const DOC_TYPES = [
  { id: 'govt_id', label: 'Government ID', sublabel: 'Aadhaar, PAN, Voter ID, Passport', required: true },
  { id: 'selfie', label: 'Selfie', sublabel: 'Clear photo of your face', required: false },
  { id: 'address_proof', label: 'Address Proof', sublabel: 'Utility bill, bank statement', required: false },
  { id: 'other', label: 'Additional Document', sublabel: 'Any other document requested', required: false },
];

const STATUS_COLOR: Record<string, string> = {
  pending: '#F5A623',
  approved: '#4CAF50',
  rejected: '#E53935',
  more_info_requested: '#2196F3',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending Review',
  approved: 'Approved ✓',
  rejected: 'Rejected',
  more_info_requested: 'More Info Required',
};

export default function KycScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);
  const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const s = styles(colors, insets);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kyc-documents'],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/kyc/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load documents');
      return res.json();
    },
    enabled: !!token,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ docType, dataBase64, label }: { docType: string; dataBase64: string; label?: string }) => {
      const res = await fetch(`${apiBase}/api/kyc/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ docType, dataBase64, label }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      refetch();
      Alert.alert('Uploaded', 'Your document has been submitted for review.');
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const pickAndUpload = async (docType: string, label: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setUploading(docType);
      uploadMutation.mutate({
        docType,
        dataBase64: `data:image/jpeg;base64,${result.assets[0].base64}`,
        label,
      }, { onSettled: () => setUploading(null) });
    }
  };

  const takePhoto = async (docType: string, label: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setUploading(docType);
      uploadMutation.mutate({
        docType,
        dataBase64: `data:image/jpeg;base64,${result.assets[0].base64}`,
        label,
      }, { onSettled: () => setUploading(null) });
    }
  };

  const handleUpload = (docType: string, label: string) => {
    Alert.alert('Upload Document', 'Choose a source', [
      { text: 'Camera', onPress: () => takePhoto(docType, label) },
      { text: 'Photo Library', onPress: () => pickAndUpload(docType, label) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const docs = data?.documents ?? [];
  const docsByType = (type: string) => docs.filter((d: any) => d.docType === type);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>KYC Verification</Text>
          <Text style={s.subtitle}>Upload documents to verify your identity</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <View style={s.sections}>
          {DOC_TYPES.map((dt) => {
            const existing = docsByType(dt.id);
            const latest = existing[0];
            const isUploading = uploading === dt.id;

            return (
              <View key={dt.id} style={s.docCard}>
                <View style={s.docHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={s.docTitleRow}>
                      <Text style={s.docTitle}>{dt.label}</Text>
                      {dt.required && <View style={s.requiredBadge}><Text style={s.requiredText}>Required</Text></View>}
                    </View>
                    <Text style={s.docSublabel}>{dt.sublabel}</Text>
                  </View>
                  {latest && (
                    <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[latest.status] + '20' }]}>
                      <Text style={[s.statusText, { color: STATUS_COLOR[latest.status] }]}>
                        {STATUS_LABEL[latest.status] ?? latest.status}
                      </Text>
                    </View>
                  )}
                </View>

                {latest?.adminNote && (
                  <View style={s.adminNote}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
                    <Text style={s.adminNoteText}>{latest.adminNote}</Text>
                  </View>
                )}

                {existing.length > 1 && (
                  <Text style={s.docCount}>{existing.length} documents submitted</Text>
                )}

                <TouchableOpacity
                  style={[s.uploadBtn, isUploading && s.uploadBtnDisabled]}
                  onPress={() => handleUpload(dt.id, dt.label)}
                  disabled={isUploading || uploadMutation.isPending}
                  activeOpacity={0.7}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                      <Text style={s.uploadBtnText}>{latest ? 'Upload Again' : 'Upload Document'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
    paddingBottom: insets.bottom + 32,
    paddingHorizontal: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  sections: { gap: 16 },
  docCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: 16, gap: 12,
  },
  docHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  docTitle: { fontSize: 15, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  docSublabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  requiredBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  requiredText: { fontSize: 10, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  adminNote: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: colors.muted, borderRadius: 8, padding: 10 },
  adminNoteText: { flex: 1, fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  docCount: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '40',
    borderRadius: 12, paddingVertical: 12,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { fontSize: 14, color: colors.primary, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
});
