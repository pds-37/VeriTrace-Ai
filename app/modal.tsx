import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Badge */}
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>SIH 2026 | GRAND FINALE</Text>
        </View>

        {/* Title */}
        <Text style={styles.mainTitle}>VeriTrace AI</Text>
        <Text style={styles.subTitle}>Field Evidence Companion for Colorimetric Test Kits</Text>

        <View style={styles.divider} />

        {/* Project Context Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PROJECT CONTEXT</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Team:</Text>
            <Text style={styles.metaValue}>DOOMDAY</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Problem Statement:</Text>
            <Text style={styles.metaValue}>SIH26231</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Deployment Model:</Text>
            <Text style={styles.metaValue}>Offline-First Smartphone Edge Computing</Text>
          </View>
        </View>

        {/* 5-Step Workflow Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>CORE 5-STEP FORENSIC WORKFLOW</Text>
          
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>Capture In-Frame</Text>
              <Text style={styles.stepDesc}>Smartphone camera frame captures test reaction alongside an 18% neutral gray card.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>Lighting Calibration</Text>
              <Text style={styles.stepDesc}>Dynamic illuminant gains (G_R, G_G, G_B) normalize warm tungsten or cold fluorescent casts.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>Automated Classification</Text>
              <Text style={styles.stepDesc}>Euclidean color distance (ΔE) classifies reaction into POSITIVE, NEGATIVE, or INCONCLUSIVE.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>4</Text></View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>Cryptographic Signing</Text>
              <Text style={styles.stepDesc}>Raw SHA-256 image fingerprint and canonical record are signed via HMAC-SHA256.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepCircle}><Text style={styles.stepNum}>5</Text></View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>Local Persistence & Verification</Text>
              <Text style={styles.stepDesc}>Permanent offline SQLite storage with instant active integrity checking and JSON/QR export.</Text>
            </View>
          </View>
        </View>

        {/* Mandatory Regulatory Guardrail */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>⚖️ MANDATORY REGULATORY GUARDRAIL</Text>
          <Text style={styles.disclaimerText}>
            The output of this application is a PRESUMPTIVE FIELD-TEST RESULT and supporting tamper-evident digital record. It provides objective optical telemetry and verifiable chain of custody, but does NOT replace laboratory confirmatory testing (GC-MS / HPLC).
          </Text>
        </View>

        {/* Close Button */}
        <Pressable 
          style={styles.closeBtn} 
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Modal"
        >
          <Text style={styles.closeBtnText}>Return to Application</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  headerBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  headerBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    width: '100%',
    marginVertical: 18,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1D5D8F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  disclaimerBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  disclaimerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  closeBtn: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
