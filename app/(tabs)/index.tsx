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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRecordStatsAsync } from '@/services/database';
import { STANDARD_REFERENCE_PATCHES } from '@/services/colorCalibration';

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
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

  // Responsive Breakpoints
  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 360;

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

      <ScrollView 
        contentContainerStyle={[styles.container, isMobile && styles.containerMobile]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Card / Hero */}
        <View style={[styles.welcome, isMobile && styles.welcomeMobile]}>
          <Text style={styles.eyebrow}>FIELD DRUG-TESTING COMPANION</Text>
          <Text style={[styles.heading, isMobile && styles.headingMobile]}>
            Objective Colorimetric Evidence
          </Text>
          <Text style={[styles.description, isMobile && styles.descriptionMobile]}>
            Capture field-test reactions with in-frame reference colour card lighting calibration, automated classification, and tamper-evident cryptographic digital signatures.
          </Text>

          <View style={[styles.welcomeButtonsRow, isMobile && styles.welcomeButtonsRowMobile]}>
            <Pressable
              style={[styles.primaryButton, isMobile ? styles.buttonFullMobile : styles.primaryButtonDesktop]}
              onPress={() => router.push('/capture')}
              accessibilityRole="button"
              accessibilityLabel="Start New Test"
            >
              <Text style={styles.buttonText}>＋  Start New Test</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryHeaderButton, isMobile && styles.buttonFullMobile]}
              onPress={() => setIsCardModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Show Reference Colour Card"
            >
              <Text style={styles.secondaryHeaderButtonText}>📄 Show Reference Card</Text>
            </Pressable>
          </View>
        </View>

        {/* Core 5-Step Forensic Pipeline Strip */}
        <View style={[styles.pipelineStrip, isMobile && styles.pipelineStripMobile]}>
          <Text style={styles.pipelineTitle}>CORE 5-STEP FORENSIC WORKFLOW</Text>
          <View style={[styles.pipelineRow, isMobile && styles.pipelineGridMobile]}>
            {[
              { num: '1', title: 'Capture', icon: '📸' },
              { num: '2', title: 'Calibrate', icon: '🎯' },
              { num: '3', title: 'Classify', icon: '🔬' },
              { num: '4', title: 'Verify', icon: '🛡️' },
              { num: '5', title: 'Store', icon: '💾' },
            ].map((step, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.pipelineStepItem,
                  isMobile ? styles.pipelineStepItemMobile : styles.pipelineStepItemDesktop,
                  isSmallMobile && styles.pipelineStepItemSmallMobile,
                  isMobile && idx === 4 && styles.pipelineStepItemFifth,
                ]}
              >
                <View style={[styles.pipelineStepBadge, isSmallMobile && styles.pipelineStepBadgeSmall]}>
                  <Text style={[styles.pipelineStepIcon, isSmallMobile && styles.pipelineStepIconSmall]}>
                    {step.icon}
                  </Text>
                </View>
                <Text style={[styles.pipelineStepText, isSmallMobile && styles.pipelineStepTextSmall]}>
                  {step.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Outcome Breakdown Statistics */}
        <Text style={styles.sectionTitle}>Field Test Outbreak Telemetry</Text>

        <View style={[styles.statsRow, isMobile && styles.statsGridMobile]}>
          <Pressable
            style={[styles.statCard, isMobile ? styles.statCardMobile : styles.statCardDesktop]}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Total Tests</Text>
            <Text style={styles.statNumber}>{stats.totalCount}</Text>
            <Text style={styles.statHint}>Logged on device</Text>
          </Pressable>

          <Pressable
            style={[
              styles.statCard, 
              { borderTopColor: '#DC2626', borderTopWidth: 3 },
              isMobile ? styles.statCardMobile : styles.statCardDesktop,
            ]}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Positive</Text>
            <Text style={[styles.statNumber, { color: '#DC2626' }]}>{stats.positiveCount}</Text>
            <Text style={styles.statHint}>Presumptive matches</Text>
          </Pressable>

          <Pressable
            style={[
              styles.statCard, 
              { borderTopColor: '#059669', borderTopWidth: 3 },
              isMobile ? styles.statCardMobile : styles.statCardDesktop,
            ]}
            onPress={() => router.push('/records')}
          >
            <Text style={styles.statLabel}>Negative</Text>
            <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.negativeCount}</Text>
            <Text style={styles.statHint}>Non-reactive</Text>
          </Pressable>

          <Pressable
            style={[
              styles.statCard, 
              { borderTopColor: '#D97706', borderTopWidth: 3 },
              isMobile ? styles.statCardMobile : styles.statCardDesktop,
            ]}
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
          style={[styles.listItem, isSmallMobile && styles.listItemSmallMobile]}
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
          style={[styles.listItem, isSmallMobile && styles.listItemSmallMobile]}
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
          style={[styles.listItem, isSmallMobile && styles.listItemSmallMobile]}
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
        animationType="fade"
        onRequestClose={() => setIsCardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
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
                  <Text style={styles.referenceCardVersion}>18% NEUTRAL GRAY / REFERENCE</Text>
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 24, paddingBottom: 40, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  containerMobile: { padding: 16, paddingBottom: 32 },

  /* Top Welcome Card */
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
    width: '100%',
  },
  welcomeMobile: {
    padding: 16,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D5D8F',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  headingMobile: {
    fontSize: 18,
    lineHeight: 24,
  },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  descriptionMobile: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  welcomeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  welcomeButtonsRowMobile: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonDesktop: {
    flex: 1,
  },
  buttonFullMobile: {
    width: '100%',
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
    minHeight: 44,
  },
  secondaryHeaderButtonText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 5-Step Forensic Pipeline Strip */
  pipelineStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  pipelineStripMobile: {
    padding: 12,
    marginBottom: 16,
  },
  pipelineTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  pipelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pipelineGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  pipelineStepItem: {
    alignItems: 'center',
  },
  pipelineStepItemDesktop: {
    flex: 1,
  },
  pipelineStepItemMobile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 8,
  },
  pipelineStepItemSmallMobile: {
    padding: 6,
    gap: 6,
  },
  pipelineStepItemFifth: {
    width: '100%',
    justifyContent: 'center',
  },
  pipelineStepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pipelineStepBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 0,
  },
  pipelineStepIcon: {
    fontSize: 16,
  },
  pipelineStepIconSmall: {
    fontSize: 13,
  },
  pipelineStepText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  pipelineStepTextSmall: {
    fontSize: 10,
  },

  /* Section Title */
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
    marginBottom: 10,
    marginTop: 4,
  },

  /* Telemetry Stats: 4-col desktop, 2x2 grid mobile */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    width: '100%',
  },
  statsGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statCardDesktop: {
    flex: 1,
  },
  statCardMobile: {
    width: '48%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 74,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statHint: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },

  /* Evidentiary Chain of Custody */
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    width: '100%',
  },
  listItemSmallMobile: {
    padding: 10,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 16,
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
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

  /* Notice */
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
    width: '100%',
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
    marginTop: 4,
    marginBottom: 12,
  },

  /* Reference Card Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  modalCardMobile: {
    padding: 14,
    maxWidth: '100%',
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
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
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  referenceCardRender: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 14,
  },
  referenceCardBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  referenceCardBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  referenceCardVersion: {
    fontSize: 8,
    fontWeight: '600',
    color: '#64748B',
  },
  patchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  patchItem: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 6,
  },
  patchColorBox: {
    width: '100%',
    height: 42,
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
    fontSize: 8,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  primaryModalButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
});