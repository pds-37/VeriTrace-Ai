import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRecordStatsAsync } from '@/services/database';
import { STANDARD_REFERENCE_PATCHES } from '@/services/colorCalibration';

export default function HomeScreen() {
  const router = useRouter();
  const [isCardModalVisible, setIsCardModalVisible] = useState(false);
  const [stats, setStats] = useState<{
    totalCount: number;
    pendingCount: number;
    syncedCount: number;
    conflictCount: number;
    positiveCount: number;
    negativeCount: number;
    inconclusiveCount: number;
  }>({
    totalCount: 0,
    pendingCount: 0,
    syncedCount: 0,
    conflictCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    inconclusiveCount: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const data = await getRecordStatsAsync();
      setStats(data);
    } catch (error) {
      console.warn('Could not refresh stats on Home:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header Card */}
        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>FIELD DRUG-TESTING COMPANION</Text>
          <Text style={styles.heading}>Objective Colorimetric Evidence</Text>
          <Text style={styles.description}>
            Capture field-test reactions with in-frame reference colour card lighting calibration, automated classification, and tamper-evident cryptographic digital signatures.
          </Text>

          <View style={styles.welcomeButtonsRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/capture')}
              accessibilityRole="button"
              accessibilityLabel="Start New Test"
            >
              <Text style={styles.buttonText}>＋  Start New Test</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryHeaderButton}
              onPress={() => setIsCardModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Show Reference Colour Card"
            >
              <Text style={styles.secondaryHeaderButtonText}>📄 Show Reference Card</Text>
            </Pressable>
          </View>
        </View>

        {/* Outcome Breakdown Statistics */}
        <Text style={styles.sectionTitle}>Field Test Outbreak Telemetry</Text>

        <View style={styles.statsRow}>
          <Pressable
            style={styles.statCard}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Total Tests</Text>
            <Text style={styles.statNumber}>{stats.totalCount}</Text>
            <Text style={styles.statHint}>Logged on device</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, { borderTopColor: '#DC2626', borderTopWidth: 3 }]}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Positive</Text>
            <Text style={[styles.statNumber, { color: '#DC2626' }]}>{stats.positiveCount}</Text>
            <Text style={styles.statHint}>Presumptive matches</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, { borderTopColor: '#059669', borderTopWidth: 3 }]}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Negative</Text>
            <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.negativeCount}</Text>
            <Text style={styles.statHint}>Non-reactive</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, { borderTopColor: '#D97706', borderTopWidth: 3 }]}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Inconclusive</Text>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.inconclusiveCount}</Text>
            <Text style={styles.statHint}>Lighting / Ambiguous</Text>
          </Pressable>
        </View>

        {/* Evidentiary Integrity Status */}
        <Text style={styles.sectionTitle}>Evidentiary Chain of Custody</Text>

        <Pressable
          style={styles.listItem}
          onPress={() => router.push('/records')}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>Cryptographic Evidence Signing</Text>
            <Text style={styles.itemDescription}>
              HMAC-SHA256 digital signatures with image hash binding
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Active</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.listItem}
          onPress={() => router.push('/records')}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.iconText}>🔗</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>Hash-Linked Audit Chain</Text>
            <Text style={styles.itemDescription}>
              {stats.syncedCount} records cryptographically synchronized to server
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: stats.pendingCount > 0 ? '#FEF3C7' : '#DCFCE7' }]}>
            <Text style={[styles.statusText, { color: stats.pendingCount > 0 ? '#B45309' : '#166534' }]}>
              {stats.pendingCount > 0 ? `${stats.pendingCount} Pending` : 'Synced'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.listItem}
          onPress={() => setIsCardModalVisible(true)}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.iconText}>🎯</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>Optical Lighting Calibration</Text>
            <Text style={styles.itemDescription}>
              18% Neutral Gray card dynamic gain compensation
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Ready</Text>
          </View>
        </Pressable>

        {/* Regulatory Mandated Notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Mandatory Presumptive Field-Test Notice</Text>
          <Text style={styles.noticeText}>
            The output of this application is a presumptive field-test result and a supporting digital record. It does not replace laboratory confirmatory testing (GC-MS / HPLC).
          </Text>
        </View>

        <Text style={styles.footer}>
          Field Test Companion · Evidentiary Documentation Standard
        </Text>
      </ScrollView>

      {/* REFERENCE COLOUR CARD MODAL */}
      <Modal
        visible={isCardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Standard Reference Colour Card</Text>
              <Pressable onPress={() => setIsCardModalVisible(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Display this standard card on a second phone or print it out to place in-frame with your field test kit:
            </Text>

            <View style={styles.referenceCardRender}>
              <View style={styles.referenceCardBrandRow}>
                <Text style={styles.referenceCardBrand}>VERITRACE CALIBRATOR</Text>
                <Text style={styles.referenceCardVersion}>18% NEUTRAL GRAY / ISO-17025</Text>
              </View>

              <View style={styles.patchesGrid}>
                {STANDARD_REFERENCE_PATCHES.map((patch, idx) => (
                  <View key={idx} style={styles.patchItem}>
                    <View style={[styles.patchColorBox, { backgroundColor: patch.nominalHex }]} />
                    <Text style={styles.patchName}>{patch.name}</Text>
                    <Text style={styles.patchHex}>{patch.nominalHex}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.referenceCardFooter}>
                <Text style={styles.referenceCardFootText}>
                  Align card within the "Reference Colour Card" box in the camera viewfinder.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.primaryModalButton}
              onPress={() => {
                setIsCardModalVisible(false);
                router.push('/capture');
              }}
            >
              <Text style={styles.buttonText}>Open Camera Viewfinder →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 18, paddingBottom: 40 },

  welcome: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D5D8F',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 16,
  },
  welcomeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryHeaderButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryHeaderButtonText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
    marginBottom: 10,
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statHint: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  statusBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },

  notice: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    marginTop: 8,
    marginBottom: 20,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },

  footer: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseButton: {
    padding: 6,
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  referenceCardRender: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 16,
  },
  referenceCardBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  referenceCardBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  referenceCardVersion: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  patchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  patchItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  patchColorBox: {
    width: '100%',
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 4,
  },
  patchName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  patchHex: {
    fontSize: 8,
    color: '#64748B',
  },
  referenceCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginTop: 4,
  },
  referenceCardFootText: {
    fontSize: 9,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  primaryModalButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
});