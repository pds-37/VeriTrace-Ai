import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'q1',
    category: 'Colorimetry & Physics',
    question: 'How does in-frame reference card calibration work?',
    answer:
      'Ambient lighting varies dramatically between warm incandescent streetlights (2700K), commercial fluorescent bulbs, daylight, and shadows. An in-frame 18% Neutral Spectrophotometric Reference Card provides a reference colour calibration standard ([128, 128, 128]). The system calculates dynamic channel gains (G_R = 128/R_ref, G_G = 128/G_ref, G_B = 128/B_ref) to adaptively normalize reaction colors before classification.',
  },
  {
    id: 'q2',
    category: 'Computer Vision & Classification',
    question: 'Is this deep learning or rule-based computer vision?',
    answer:
      'The active classification engine uses Computer Vision and Mathematical Colorimetry via calibrated Euclidean color distance (ΔE) in standardized 3D color space. Chemical reagent reactions produce known spectral profiles; comparing calibrated colors against pre-calibrated reaction libraries delivers sub-millisecond, 100% offline, deterministic classification without the latency, opacity, or unreliability of heavy neural networks on edge devices.',
  },
  {
    id: 'q3',
    category: 'AI Safety & Guardrails',
    question: 'What happens when lighting is poor or the image is ambiguous?',
    answer:
      'The engine enforces strict Lighting Quality Index (LQI) guardrails. If luminance is severely underexposed (I < 28) or oversaturated by glare (I > 248), classification immediately halts and safely flags "INCONCLUSIVE (Poor Lighting / Glare)". Similarly, if a reaction does not match expected positive or negative profiles within mathematical tolerance (ΔE > threshold), it is categorized as INCONCLUSIVE.',
  },
  {
    id: 'q4',
    category: 'Forensic Integrity',
    question: 'How does the digital record achieve tamper evidence?',
    answer:
      'The moment an image is captured, a hardware-accelerated SHA-256 hash is computed over the raw image bytes before storage. All metadata (Record ID, Reference ID, Operator ID, UTC timestamp, GPS coordinates, Kit Type, Outcome, Calibrated RGB) is canonicalized into deterministic JSON and signed with an HMAC-SHA256 signature. Any post-capture database modification or byte alteration immediately invalidates the signature and triggers an active "TAMPER DETECTED" alert.',
  },
  {
    id: 'q5',
    category: 'Legal & Regulatory Standards',
    question: 'Does this replace laboratory confirmatory testing?',
    answer:
      'NO. The output of VeriTrace AI is strictly a presumptive field-test result and supporting digital evidence record. Under forensic science standards, field screening assays cannot replace confirmatory laboratory testing such as Gas Chromatography-Mass Spectrometry (GC-MS) or High-Performance Liquid Chromatography (HPLC). VeriTrace AI establishes an unbroken, auditable chain of custody to protect evidence admissibility from roadside to courtroom.',
  },
  {
    id: 'q6',
    category: 'Operational Deployment',
    question: 'Can this operate in remote areas without cellular connectivity?',
    answer:
      'YES. VeriTrace AI is architected offline-first. Camera capture, reference-card calibration, ΔE color matching, SHA-256 hashing, HMAC signing, and local evidence storage execute 100% locally in SQLite with WAL mode on device. Backend synchronization to central audit servers occurs asynchronously when connectivity is restored.',
  },
];

const WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Camera Capture',
    desc: 'Capture liquid chemical reaction alongside an in-frame 18% neutral gray card.',
    badge: 'Edge Capture',
  },
  {
    num: '02',
    title: 'Lighting Calibration',
    desc: 'Extract channel gains (G_R, G_G, G_B) to eliminate ambient illuminant color casts.',
    badge: 'Colorimetry',
  },
  {
    num: '03',
    title: 'ΔE Classification',
    desc: 'Compare calibrated reaction against spectral profiles into Positive, Negative, or Inconclusive.',
    badge: 'Computer Vision',
  },
  {
    num: '04',
    title: 'Cryptographic Signing',
    desc: 'Bind raw SHA-256 image digest, GPS, timestamp, and operator into an HMAC-SHA256 signature.',
    badge: 'Integrity',
  },
  {
    num: '05',
    title: 'Offline Persistence',
    desc: 'Store self-authenticating evidence in local SQLite with instant audit verification and JSON export.',
    badge: 'Chain of Custody',
  },
];

const SUPPORTED_KITS = [
  {
    name: 'Scott Reagent',
    target: 'Cocaine HCl / Base',
    color: '#0047AB',
    outcome: 'Cobalt Blue precipitate',
  },
  {
    name: 'Marquis Reagent',
    target: 'Opiates (Heroin/Morphine)',
    color: '#4B0082',
    outcome: 'Deep Violet / Purple',
  },
  {
    name: 'Marquis Reagent',
    target: 'Amphetamine / Meth',
    color: '#C84B1E',
    outcome: 'Orange / Red-Brown',
  },
  {
    name: 'Duquenois-Levine',
    target: 'Cannabis / THC',
    color: '#3B1F5E',
    outcome: 'Violet-Indigo in chloroform',
  },
  {
    name: 'Mecke Reagent',
    target: 'Heroin / Morphine',
    color: '#006A6B',
    outcome: 'Deep Blue-Green / Teal',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<string | null>('q1');

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.badgePill}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>SIH 2026 | PROBLEM STATEMENT SIH26231 | TEAM DOOMDAY</Text>
          </View>
          <Text style={styles.heroTitle}>VeriTrace AI</Text>
          <Text style={styles.heroSubtitle}>
            Field Evidence Companion for Colorimetric Drug-Testing Kits
          </Text>
          <Text style={styles.heroDescription}>
            Transforming ordinary smartphones into calibrated optical spectrophotometers and tamper-evident digital evidence recorders — works alongside existing field-test kits without requiring proprietary hardware.
          </Text>

          <View style={styles.heroCtaRow}>
            <Pressable
              style={styles.primaryCta}
              onPress={() => router.push('/capture')}
              accessibilityRole="button"
              accessibilityLabel="Launch Live Test"
            >
              <Text style={styles.primaryCtaText}>Launch Field Test →</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => router.push('/two')}
              accessibilityRole="button"
              accessibilityLabel="View Records"
            >
              <Text style={styles.secondaryCtaText}>Searchable Records</Text>
            </Pressable>
          </View>
        </View>

        {/* PROBLEM & SOLUTION SECTION */}
        <View style={styles.twoColGrid}>
          <View style={[styles.infoCard, styles.problemCard]}>
            <Text style={styles.cardEyebrowProblem}>THE FIELD CHALLENGE</Text>
            <Text style={styles.cardHeading}>Subjective Interpretation & Evidentiary Vulnerability</Text>
            <Text style={styles.cardBody}>
              • Ambient lighting (tungsten streetlights, fluorescent bulbs, shadows) distorts perceived reaction colors.{'\n'}
              • Naked-eye visual readings leave zero auditable proof of when, where, and by whom a test was conducted.{'\n'}
              • Uncalibrated smartphone photos lack cryptographic chain of custody, rendering field evidence vulnerable to legal suppression.
            </Text>
          </View>

          <View style={[styles.infoCard, styles.solutionCard]}>
            <Text style={styles.cardEyebrowSolution}>THE VERITRACE SOLUTION</Text>
            <Text style={styles.cardHeading}>Standardized Optical Telemetry & Cryptographic Custody</Text>
            <Text style={styles.cardBody}>
              • In-frame 18% neutral gray card dynamically normalizes lighting discrepancies before classification.{'\n'}
              • Automated Euclidean color distance (ΔE) classifies reactions into POSITIVE, NEGATIVE, or INCONCLUSIVE.{'\n'}
              • Immediate SHA-256 image hashing and HMAC-SHA256 signing seal records against post-capture tampering.
            </Text>
          </View>
        </View>

        {/* 5-STEP FORENSIC WORKFLOW */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>ARCHITECTURE & FLOW</Text>
          <Text style={styles.sectionTitle}>The 5-Step Digital Evidence Workflow</Text>
        </View>

        <View style={styles.workflowGrid}>
          {WORKFLOW_STEPS.map((step, idx) => (
            <View key={idx} style={styles.workflowCard}>
              <View style={styles.workflowTopRow}>
                <Text style={styles.workflowNum}>{step.num}</Text>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.badge}</Text>
                </View>
              </View>
              <Text style={styles.workflowTitle}>{step.title}</Text>
              <Text style={styles.workflowDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>

        {/* SUPPORTED REAGENTS MATRIX */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>CHEMICAL COLORIMETRY</Text>
          <Text style={styles.sectionTitle}>Supported Field-Test Reagents & Defined Outcomes</Text>
        </View>

        <View style={styles.reagentCard}>
          {SUPPORTED_KITS.map((kit, idx) => (
            <View key={idx} style={styles.reagentRow}>
              <View style={styles.reagentMeta}>
                <Text style={styles.reagentName}>{kit.name}</Text>
                <Text style={styles.reagentTarget}>{kit.target}</Text>
              </View>
              <View style={styles.reagentResultCol}>
                <View style={[styles.colorChip, { backgroundColor: kit.color }]} />
                <Text style={styles.reagentOutcomeText}>{kit.outcome}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* MANDATORY REGULATORY GUARDRAIL */}
        <View style={styles.disclaimerBanner}>
          <Text style={styles.disclaimerHeading}>⚖️ MANDATORY REGULATORY GUARDRAIL (PRESUMPTIVE LIMITATION)</Text>
          <Text style={styles.disclaimerParagraph}>
            The output of this application is a <Text style={{ fontWeight: '800' }}>PRESUMPTIVE FIELD-TEST RESULT</Text> and supporting digital evidence record. In strict accordance with forensic science and legal evidentiary protocols, presumptive colorimetric assays provide mathematical screening documentation only; they do <Text style={{ fontWeight: '800' }}>NOT</Text> replace confirmatory laboratory testing (GC-MS / HPLC).
          </Text>
        </View>

        {/* JUDGE Q&A / TECHNICAL FAQS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>EVALUATION & DEFENSE</Text>
          <Text style={styles.sectionTitle}>Grand Jury Technical Questions & Answers</Text>
        </View>

        <View style={styles.faqContainer}>
          {FAQS.map((faq) => {
            const isExpanded = expandedFaq === faq.id;
            return (
              <View key={faq.id} style={styles.faqCard}>
                <Pressable
                  style={styles.faqHeader}
                  onPress={() => toggleFaq(faq.id)}
                  accessibilityRole="button"
                  accessibilityLabel={faq.question}
                >
                  <View style={styles.faqHeaderLeft}>
                    <Text style={styles.faqCategory}>{faq.category.toUpperCase()}</Text>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                  </View>
                  <Text style={styles.faqToggleIcon}>{isExpanded ? '−' : '+'}</Text>
                </Pressable>
                {isExpanded && (
                  <View style={styles.faqBody}>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>VeriTrace AI — SIH 2026 Edition | Problem Statement SIH26231</Text>
          <Text style={styles.footerSubText}>Developed by Team DOOMDAY | Objective Optical Telemetry & Evidentiary Chain of Custody</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    paddingHorizontal: Platform.OS === 'web' ? 36 : 16,
    paddingVertical: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Platform.OS === 'web' ? 36 : 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
    textAlign: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    gap: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: Platform.OS === 'web' ? 38 : 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: Platform.OS === 'web' ? 18 : 15,
    fontWeight: '700',
    color: '#FF7F50',
    textAlign: 'center',
    marginTop: 6,
  },
  heroDescription: {
    fontSize: Platform.OS === 'web' ? 15 : 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 800,
    marginTop: 12,
  },
  heroCtaRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryCta: {
    backgroundColor: '#FF7F50',
    borderRadius: 25,
    paddingHorizontal: 22,
    paddingVertical: 12,
    shadowColor: '#FF7F50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryCta: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryCtaText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  twoColGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    marginBottom: 28,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  problemCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF8F8',
  },
  solutionCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F7FCF9',
  },
  cardEyebrowProblem: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  cardEyebrowSolution: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  cardBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 20,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  workflowGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    marginBottom: 28,
  },
  workflowCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  workflowTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workflowNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1D5D8F',
  },
  stepBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  workflowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  workflowDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  reagentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 28,
  },
  reagentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reagentMeta: {
    flex: 1,
  },
  reagentName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  reagentTarget: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  reagentResultCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorChip: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reagentOutcomeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  disclaimerBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 18,
    marginBottom: 28,
  },
  disclaimerHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  disclaimerParagraph: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  faqContainer: {
    gap: 10,
    marginBottom: 36,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  faqCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  faqToggleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748B',
  },
  faqBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  faqAnswer: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  footer: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  footerSubText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});
