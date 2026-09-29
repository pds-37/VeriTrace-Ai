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
    desc: 'Dual-zone camera frames liquid chemical reaction kit alongside in-frame 18% neutral gray card.',
    badge: 'Dual-Zone Sensor',
  },
  {
    num: '02',
    title: 'Lighting Calibration',
    desc: 'Extracts dynamic channel gains (G_R, G_G, G_B) to cancel out ambient illumination color casts.',
    badge: 'Color Normalization',
  },
  {
    num: '03',
    title: 'ΔE Classification',
    desc: 'Matches calibrated color against validated reagent spectral libraries into Positive, Negative, or Inconclusive.',
    badge: 'Mathematical Colorimetry',
  },
  {
    num: '04',
    title: 'Cryptographic Signing',
    desc: 'Binds raw SHA-256 image digest, GPS, timestamp, and operator ID into an HMAC-SHA256 signature.',
    badge: 'Integrity Seal',
  },
  {
    num: '05',
    title: 'Offline Persistence',
    desc: 'Stores self-authenticating record in local SQLite, attaches to hash-linked audit chain, and exports PDF.',
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
          <View style={styles.heroRow}>
            {/* Left Column: Mission & Identity */}
            <View style={styles.heroLeftCol}>
              <View style={styles.badgePill}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>SIH 2026 • SIH26231 • TEAM DOOMDAY</Text>
              </View>

              <Text style={styles.heroEyebrow}>OBJECTIVE OPTICAL TELEMETRY & DIGITAL CHAIN OF CUSTODY</Text>
              <Text style={styles.heroTitleMain}>FIELD TEST.</Text>
              <Text style={styles.heroTitleAccent}>DIGITAL EVIDENCE.</Text>
              <Text style={styles.heroBrandName}>VeriTrace AI</Text>

              <Text style={styles.heroSubtitle}>
                A verifiable digital evidence companion for existing colorimetric field drug-testing kits.
              </Text>

              <Text style={styles.heroDescription}>
                Transforms everyday smartphones into calibrated optical spectrophotometers and tamper-evident digital evidence recorders. Works alongside existing field-test kits without proprietary hardware, eliminating subjective visual guesswork, standardizing ambient light, and cryptographically sealing test results.
              </Text>

              {/* Primary Call to Actions */}
              <View style={styles.heroCtaRow}>
                <Pressable
                  style={styles.primaryCta}
                  onPress={() => router.push('/capture')}
                  accessibilityRole="button"
                  accessibilityLabel="Launch Field Test"
                >
                  <Text style={styles.primaryCtaText}>Launch Field Test →</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryCta}
                  onPress={() => router.push('/two')}
                  accessibilityRole="button"
                  accessibilityLabel="Explore Records"
                >
                  <Text style={styles.secondaryCtaText}>Explore Records</Text>
                </Pressable>
              </View>

              {/* Trust Micro-Pills */}
              <View style={styles.microPillsRow}>
                <View style={styles.microPill}>
                  <Text style={styles.microPillCheck}>✓</Text>
                  <Text style={styles.microPillText}>100% Offline Core</Text>
                </View>
                <View style={styles.microPill}>
                  <Text style={styles.microPillCheck}>✓</Text>
                  <Text style={styles.microPillText}>No Proprietary Hardware</Text>
                </View>
                <View style={styles.microPill}>
                  <Text style={styles.microPillCheck}>✓</Text>
                  <Text style={styles.microPillText}>Presumptive Field Screening</Text>
                </View>
              </View>
            </View>

            {/* Right Column: Visual Optical Evidence Preview */}
            <View style={styles.heroRightCol}>
              <View style={styles.previewEvidenceCard}>
                {/* Preview Header */}
                <View style={styles.previewHeaderRow}>
                  <View style={styles.previewHeaderLeft}>
                    <Text style={styles.previewCardTitle}>OPTICAL SCAN TELEMETRY</Text>
                    <Text style={styles.previewCardSub}>DUAL-ZONE IN-FRAME SENSING</Text>
                  </View>
                  <View style={styles.previewLiveBadge}>
                    <View style={styles.previewLiveDot} />
                    <Text style={styles.previewLiveText}>SENSOR LIVE</Text>
                  </View>
                </View>

                {/* Simulated Viewfinder */}
                <View style={styles.simulatedViewfinder}>
                  <View style={styles.viewfinderCornerTL} />
                  <View style={styles.viewfinderCornerTR} />
                  <View style={styles.viewfinderCornerBL} />
                  <View style={styles.viewfinderCornerBR} />

                  {/* Dual Zones */}
                  <View style={styles.simulatedZoneRef}>
                    <View style={styles.simulatedZoneColorRef} />
                    <View style={styles.simulatedZoneMeta}>
                      <Text style={styles.simulatedZoneTagRef}>01 · REFERENCE CARD</Text>
                      <Text style={styles.simulatedZoneVal}>18% Neutral Gray · RGB [128, 128, 128]</Text>
                      <Text style={styles.simulatedGainVal}>Gain: R=0.83 · G=1.02 · B=1.31</Text>
                    </View>
                  </View>

                  <View style={styles.simulatedZoneDivider}>
                    <Text style={styles.simulatedZoneDividerText}>▼ DYNAMIC ILLUMINATION NORMALIZATION ▼</Text>
                  </View>

                  <View style={styles.simulatedZoneSample}>
                    <View style={styles.simulatedZoneColorSample} />
                    <View style={styles.simulatedZoneMeta}>
                      <Text style={styles.simulatedZoneTagSample}>02 · REAGENT REACTION</Text>
                      <Text style={styles.simulatedZoneVal}>Scott Reagent · RGB [29, 63, 183]</Text>
                      <Text style={styles.simulatedDeltaVal}>ΔE: 32.4 (Cobalt Blue Precipitate)</Text>
                    </View>
                  </View>
                </View>

                {/* Simulated Presumptive Result */}
                <View style={styles.simulatedResultRow}>
                  <View style={styles.simulatedResultPill}>
                    <Text style={styles.simulatedResultPillText}>POSITIVE</Text>
                  </View>
                  <View style={styles.simulatedResultSubstance}>
                    <Text style={styles.simulatedSubstanceName}>Cocaine (HCl / Base)</Text>
                    <Text style={styles.simulatedSubstanceKit}>Scott Reagent · Match 94.2%</Text>
                  </View>
                </View>

                {/* Simulated Cryptographic Integrity Footer */}
                <View style={styles.simulatedCryptoFooter}>
                  <View style={styles.simulatedCryptoTop}>
                    <Text style={styles.simulatedCryptoLabel}>SHA-256 DIGEST:</Text>
                    <Text style={styles.simulatedCryptoHash}>7f83b165...e2f9d12a</Text>
                  </View>
                  <View style={styles.simulatedSignatureRow}>
                    <Text style={styles.simulatedVerifiedBadge}>✓ HMAC-SHA256 SIGNED & AUDITED</Text>
                    <Text style={styles.simulatedOfflineBadge}>OFFLINE-PERSISTED</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* PRODUCT TRUST BAR */}
        <View style={styles.trustBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trustBarScroll}>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🔒</Text>
              <Text style={styles.trustLabel}>Offline-First Core</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🎯</Text>
              <Text style={styles.trustLabel}>18% Gray Card Normalization</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>📐</Text>
              <Text style={styles.trustLabel}>Calibrated ΔE Colorimetry</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🛡️</Text>
              <Text style={styles.trustLabel}>SHA-256 Image Integrity</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>✍️</Text>
              <Text style={styles.trustLabel}>HMAC-SHA256 Signatures</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🔗</Text>
              <Text style={styles.trustLabel}>Hash-Linked Audit Chain</Text>
            </View>
          </ScrollView>
        </View>

        {/* PROBLEM & SOLUTION SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>EVIDENTIARY PARADIGM SHIFT</Text>
          <Text style={styles.sectionTitle}>The Field Challenge vs. The VeriTrace Approach</Text>
        </View>

        <View style={styles.twoColGrid}>
          {/* PROBLEM CARD */}
          <View style={[styles.infoCard, styles.problemCard]}>
            <View style={styles.cardHeaderWithIcon}>
              <Text style={styles.cardIconRed}>⚠️</Text>
              <View>
                <Text style={styles.cardEyebrowProblem}>THE FIELD CHALLENGE</Text>
                <Text style={styles.cardHeading}>Why Traditional Field Screening Fails Evidentiary Scrutiny</Text>
              </View>
            </View>

            <View style={styles.problemItemsList}>
              <View style={styles.challengeItem}>
                <Text style={styles.challengeBulletNum}>01</Text>
                <View style={styles.challengeContent}>
                  <Text style={styles.challengeItemTitle}>Subjective Visual Interpretation</Text>
                  <Text style={styles.challengeItemDesc}>
                    Ambient lighting (tungsten streetlights, fluorescent bulbs, low-light shadows) distorts perceived colors. Human eye perception is variable, creating false positives or disputed outcomes.
                  </Text>
                </View>
              </View>

              <View style={styles.challengeItem}>
                <Text style={styles.challengeBulletNum}>02</Text>
                <View style={styles.challengeContent}>
                  <Text style={styles.challengeItemTitle}>No Auditable Digital Trace</Text>
                  <Text style={styles.challengeItemDesc}>
                    Naked-eye testing leaves zero objective, verifiable proof of who performed the test, the exact GPS coordinates, timestamp, or what color actually developed.
                  </Text>
                </View>
              </View>

              <View style={styles.challengeItem}>
                <Text style={styles.challengeBulletNum}>03</Text>
                <View style={styles.challengeContent}>
                  <Text style={styles.challengeItemTitle}>Evidentiary Integrity Gap</Text>
                  <Text style={styles.challengeItemDesc}>
                    Uncalibrated smartphone snapshots lack raw cryptographic hashes and digital signatures, making evidence vulnerable to courtroom suppression by defense counsel.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SOLUTION CARD */}
          <View style={[styles.infoCard, styles.solutionCard]}>
            <View style={styles.cardHeaderWithIcon}>
              <Text style={styles.cardIconGreen}>✓</Text>
              <View>
                <Text style={styles.cardEyebrowSolution}>THE VERITRACE APPROACH</Text>
                <Text style={styles.cardHeading}>Standardized Optical Telemetry & Cryptographic Custody</Text>
              </View>
            </View>

            <View style={styles.problemItemsList}>
              <View style={styles.challengeItem}>
                <Text style={styles.solutionBulletNum}>01</Text>
                <View style={styles.challengeContent}>
                  <Text style={styles.challengeItemTitle}>In-Frame Optical Normalization</Text>
                  <Text style={styles.challengeItemDesc}>
                    An in-frame 18% spectrophotometric neutral gray card dynamically calculates channel gains (G_R, G_G, G_B) to cancel out ambient illumination color casts before analysis.
                  </Text>
                </View>
              </View>

              <View style={styles.challengeItem}>
                <Text style={styles.solutionBulletNum}>02</Text>
                <View style={styles.challengeContent}>
                  <Text style={styles.challengeItemTitle}>Calibrated ΔE Colorimetry</Text>
                  <Text style={styles.challengeItemDesc}>
                    Sub-millisecond Euclidean distance matching in standardized 3D color space categorizes reactions into POSITIVE, NEGATIVE, or INCONCLUSIVE with strict Lighting Quality Index (LQI) guardrails.
                  </Text>
                </View>
              </View>

              <View style={styles.challengeItem}>
                <Text style={styles.solutionBulletNum}>03</Text>
                <View style={styles.challengeContent}>
                  <Text style={styles.challengeItemTitle}>Immutable Tamper-Evident Custody</Text>
                  <Text style={styles.challengeItemDesc}>
                    Instant SHA-256 raw image hashing and HMAC-SHA256 metadata signing bind evidence into an immutable chain. Post-capture database tampering triggers instant alerts.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* VISUAL CONNECTOR BAR */}
        <View style={styles.visualConnectorCard}>
          <Text style={styles.connectorTitle}>THE OBJECTIVE EVIDENCE PIPELINE</Text>
          <View style={styles.connectorRow}>
            <View style={styles.connectorNode}>
              <Text style={styles.connectorNodeIcon}>🧪</Text>
              <Text style={styles.connectorNodeTitle}>FIELD OBSERVATION</Text>
              <Text style={styles.connectorNodeSub}>Reagent Chemical Reaction</Text>
            </View>

            <View style={styles.connectorArrow}>
              <Text style={styles.connectorArrowText}>➔</Text>
            </View>

            <View style={[styles.connectorNode, styles.connectorNodeActive]}>
              <Text style={styles.connectorNodeIcon}>🔬</Text>
              <Text style={styles.connectorNodeTitle}>VERITRACE AI</Text>
              <Text style={styles.connectorNodeSub}>Optical Normalization & ΔE Match</Text>
            </View>

            <View style={styles.connectorArrow}>
              <Text style={styles.connectorArrowText}>➔</Text>
            </View>

            <View style={styles.connectorNode}>
              <Text style={styles.connectorNodeIcon}>🛡️</Text>
              <Text style={styles.connectorNodeTitle}>DIGITAL EVIDENCE</Text>
              <Text style={styles.connectorNodeSub}>SHA-256 / HMAC-SHA256 Sealed</Text>
            </View>
          </View>
        </View>

        {/* 5-STEP FORENSIC WORKFLOW */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>SYSTEM ARCHITECTURE</Text>
          <Text style={styles.sectionTitle}>The 5-Step Forensic Evidence Workflow</Text>
          <Text style={styles.sectionSubtitle}>
            End-to-end execution path operating 100% locally on standard edge mobile devices
          </Text>
        </View>

        <View style={styles.workflowContainer}>
          <View style={styles.workflowProgressLine} />
          <View style={styles.workflowGrid}>
            {WORKFLOW_STEPS.map((step, idx) => (
              <View key={idx} style={styles.workflowCard}>
                <View style={styles.workflowTopRow}>
                  <View style={styles.workflowNumBadge}>
                    <Text style={styles.workflowNum}>{step.num}</Text>
                  </View>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step.badge}</Text>
                  </View>
                </View>
                <Text style={styles.workflowTitle}>{step.title}</Text>
                <Text style={styles.workflowDesc}>{step.desc}</Text>
              </View>
            ))}
          </View>
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
          <Text style={styles.sectionTitle}>Under the Hood - Technical Q&A</Text>
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
          <Text style={styles.footerText}>VeriTrace AI - SIH 2026 Edition | Problem Statement SIH26231</Text>
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

  // HERO SECTION
  heroSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Platform.OS === 'web' ? 36 : 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  heroRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 32,
    alignItems: 'center',
  },
  heroLeftCol: {
    flex: 1.1,
  },
  heroRightCol: {
    flex: 0.9,
    width: '100%',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 12,
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
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitleMain: {
    fontSize: Platform.OS === 'web' ? 40 : 30,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    lineHeight: Platform.OS === 'web' ? 44 : 34,
  },
  heroTitleAccent: {
    fontSize: Platform.OS === 'web' ? 40 : 30,
    fontWeight: '900',
    color: '#FF7F50',
    letterSpacing: -0.5,
    lineHeight: Platform.OS === 'web' ? 44 : 34,
    marginBottom: 4,
  },
  heroBrandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 22,
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
  },
  heroCtaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 18,
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
  microPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  microPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microPillCheck: {
    color: '#16A34A',
    fontWeight: '800',
    fontSize: 12,
  },
  microPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },

  // HERO PREVIEW EVIDENCE CARD
  previewEvidenceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 5,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 10,
  },
  previewHeaderLeft: {
    flex: 1,
  },
  previewCardTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  previewCardSub: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  previewLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  previewLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  previewLiveText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // SIMULATED VIEWFINDER
  simulatedViewfinder: {
    backgroundColor: '#090D16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    position: 'relative',
    marginBottom: 12,
  },
  viewfinderCornerTL: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#38BDF8',
  },
  viewfinderCornerTR: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#38BDF8',
  },
  viewfinderCornerBL: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#10B981',
  },
  viewfinderCornerBR: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#10B981',
  },
  simulatedZoneRef: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 8,
    gap: 10,
  },
  simulatedZoneColorRef: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#808080',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  simulatedZoneMeta: {
    flex: 1,
  },
  simulatedZoneTagRef: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  simulatedZoneVal: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  simulatedGainVal: {
    color: '#94A3B8',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  simulatedZoneDivider: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  simulatedZoneDividerText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  simulatedZoneSample: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 8,
    gap: 10,
  },
  simulatedZoneColorSample: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#1D4ED8', // Cobalt Blue
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  simulatedZoneTagSample: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  simulatedDeltaVal: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },

  simulatedResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    gap: 10,
  },
  simulatedResultPill: {
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  simulatedResultPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  simulatedResultSubstance: {
    flex: 1,
  },
  simulatedSubstanceName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  simulatedSubstanceKit: {
    color: '#94A3B8',
    fontSize: 10,
  },

  simulatedCryptoFooter: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simulatedCryptoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  simulatedCryptoLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
  },
  simulatedCryptoHash: {
    color: '#CBD5E1',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  simulatedSignatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simulatedVerifiedBadge: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  simulatedOfflineBadge: {
    color: '#38BDF8',
    fontSize: 8,
    fontWeight: '700',
  },

  // PRODUCT TRUST BAR
  trustBarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  trustBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustIcon: {
    fontSize: 13,
  },
  trustLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  trustDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
  },

  // SECTION HEADERS
  sectionHeader: {
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D5D8F',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },

  // PROBLEM & SOLUTION GRID
  twoColGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  problemCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF8F8',
  },
  solutionCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F7FCF9',
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  cardIconRed: {
    fontSize: 22,
  },
  cardIconGreen: {
    fontSize: 22,
    color: '#16A34A',
    fontWeight: '900',
  },
  cardEyebrowProblem: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardEyebrowSolution: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
  },
  problemItemsList: {
    gap: 14,
  },
  challengeItem: {
    flexDirection: 'row',
    gap: 12,
  },
  challengeBulletNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
  },
  solutionBulletNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
  },
  challengeContent: {
    flex: 1,
  },
  challengeItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  challengeItemDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },

  // VISUAL CONNECTOR
  visualConnectorCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  connectorTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  connectorRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
  },
  connectorNode: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#334155',
  },
  connectorNodeActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  connectorNodeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  connectorNodeTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'center',
  },
  connectorNodeSub: {
    color: '#94A3B8',
    fontSize: 10,
    textAlign: 'center',
  },
  connectorArrow: {
    paddingHorizontal: 6,
  },
  connectorArrowText: {
    color: '#FF7F50',
    fontSize: 20,
    fontWeight: '900',
  },

  // WORKFLOW CONTAINER & GRID
  workflowContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  workflowProgressLine: {
    position: 'absolute',
    top: 36,
    left: 40,
    right: 40,
    height: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 0,
    display: Platform.OS === 'web' ? 'flex' : 'none',
  },
  workflowGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    zIndex: 1,
  },
  workflowCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
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
    marginBottom: 10,
  },
  workflowNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowNum: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  stepBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepBadgeText: {
    fontSize: 9,
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

  // SUPPORTED REAGENTS
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

  // REGULATORY NOTICE
  disclaimerBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
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

  // FAQS
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

  // FOOTER
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
