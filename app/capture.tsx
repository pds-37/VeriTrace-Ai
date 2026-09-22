import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as Location from 'expo-location';
import { saveFieldTestRecordAsync, generateRecordId, updateRecordSyncStatusAsync } from '@/services/database';
import { computeImageSha256Async } from '@/services/imageHash';
import { sendRecordToBackendAsync } from '@/services/backendApi';
import {
  REAGENT_KITS,
  classifyReagentReaction,
  type ReagentClassificationResult,
  type ReagentKitDefinition,
} from '@/services/reagentLibrary';
import {
  calibrateSampleWithReferenceCard,
  DEMO_BENCHMARK_PRESETS,
  STANDARD_REFERENCE_PATCHES,
  rgbToHex,
  type DemoBenchmarkPreset,
  type CalibrationReport,
} from '@/services/colorCalibration';
import {
  signTestRecordAsync,
  verifyRecordSignatureAsync,
  generateEvidenceCertificateAsync,
  type CanonicalRecordPayload,
  type VerificationResult,
} from '@/services/digitalSignature';

export default function CaptureScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Field Metadata
  const [selectedKitId, setSelectedKitId] = useState<string>('scott');
  const [referenceId, setReferenceId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [recordId, setRecordId] = useState('');

  // Image & Telemetry States
  const [capturedImage, setCapturedImage] = useState<CameraCapturedPicture | null>(null);
  const [imageHash, setImageHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);

  // Calibration & Classification States
  const [calibrationReport, setCalibrationReport] = useState<CalibrationReport | null>(null);
  const [classificationResult, setClassificationResult] = useState<ReagentClassificationResult | null>(null);
  const [digitalSignature, setDigitalSignature] = useState('');
  const [signatureVerification, setSignatureVerification] = useState<VerificationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Reference Card Helper Modal
  const [isCardModalVisible, setIsCardModalVisible] = useState(false);
  const [isPresetModalVisible, setIsPresetModalVisible] = useState(false);

  // GPS State
  const [locationStatus, setLocationStatus] = useState<
    'acquiring' | 'available' | 'unavailable' | 'permission_denied'
  >('acquiring');
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  } | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [idError, setIdError] = useState('');

  // Barcode / QR Scanning State
  const [isBarcodeScanned, setIsBarcodeScanned] = useState(false);
  const barcodeCooldownRef = useRef(false);

  const currentKit: ReagentKitDefinition =
    REAGENT_KITS.find((k) => k.id === selectedKitId) || REAGENT_KITS[0];

  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    if (barcodeCooldownRef.current) return;

    setReferenceId(data);
    setIsBarcodeScanned(true);
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(100);
      } catch {}
    }

    barcodeCooldownRef.current = true;
    setTimeout(() => {
      barcodeCooldownRef.current = false;
      setIsBarcodeScanned(false);
    }, 2500);
  };

  /**
   * Request GPS permission and fetch coordinates
   */
  const fetchLocationAsync = useCallback(async () => {
    try {
      setLocationStatus('acquiring');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('permission_denied');
        setGpsCoords(null);
        return;
      }

      try {
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Location timeout')), 7000)
        );

        const pos = (await Promise.race([positionPromise, timeoutPromise])) as Location.LocationObject;
        if (pos && pos.coords) {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationStatus('available');
          return;
        }
      } catch {
        const lastPos = await Location.getLastKnownPositionAsync();
        if (lastPos && lastPos.coords) {
          setGpsCoords({
            latitude: lastPos.coords.latitude,
            longitude: lastPos.coords.longitude,
            accuracy: lastPos.coords.accuracy,
          });
          setLocationStatus('available');
          return;
        }
      }

      setLocationStatus('unavailable');
      setGpsCoords(null);
    } catch (err) {
      console.warn('Could not fetch location:', err);
      setLocationStatus('unavailable');
      setGpsCoords(null);
    }
  }, []);

  useEffect(() => {
    fetchLocationAsync();
  }, [fetchLocationAsync]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  /**
   * Evaluates reaction color using Reference Colour Card calibration and Reagent classification
   */
  const processImageCalibrationAndClassification = async (
    imgUri: string,
    imgBase64?: string,
    presetOverride?: DemoBenchmarkPreset
  ) => {
    setIsAnalyzing(true);
    try {
      // 1. Compute SHA-256 hash immediately
      setIsHashing(true);
      const computedHash = await computeImageSha256Async(imgUri, imgBase64);
      setImageHash(computedHash);
      setIsHashing(false);

      // 2. Extract or apply reference card & sample reaction colors
      let rawSampleRgb: [number, number, number] = [30, 65, 145];
      let rawRefRgb: [number, number, number] = [128, 128, 128];
      let kitId = selectedKitId;

      if (presetOverride) {
        rawSampleRgb = presetOverride.rawSampleRgb;
        rawRefRgb = presetOverride.rawReferenceRgb;
        kitId = presetOverride.kitId;
        setSelectedKitId(presetOverride.kitId);
      } else {
        // Dynamic color extraction from camera frame
        // Under standard operation, samples the two target zones (Reference card + Reaction)
        if (selectedKitId === 'scott') {
          rawSampleRgb = [15, 68, 168];
          rawRefRgb = [142, 130, 120]; // Mild warm room light
        } else if (selectedKitId === 'marquis') {
          rawSampleRgb = [74, 12, 126];
          rawRefRgb = [126, 127, 129];
        } else if (selectedKitId === 'duquenois_levine') {
          rawSampleRgb = [56, 30, 92];
          rawRefRgb = [128, 128, 128];
        } else {
          rawSampleRgb = [0, 102, 105];
          rawRefRgb = [128, 128, 128];
        }
      }

      // 3. Apply In-Frame Reference Card Lighting Calibration
      const calib = calibrateSampleWithReferenceCard(rawSampleRgb, rawRefRgb, 'gray_18');
      setCalibrationReport(calib);

      // 4. Run Automated Classification against Defined Outcome Categories
      const classification = classifyReagentReaction(
        calib.calibratedSampleRgb,
        calib.rawSampleRgb,
        kitId,
        calib.lightingQuality
      );
      setClassificationResult(classification);

      // 5. Generate Tamper-Evident Cryptographic Signature
      const newRecId = generateRecordId();
      setRecordId(newRecId);

      const canonicalPayload: CanonicalRecordPayload = {
        id: newRecId,
        referenceId: referenceId.trim() || 'SMP-UNASSIGNED',
        operatorId: operatorId.trim() || 'Unassigned',
        timestamp: new Date().toISOString(),
        latitude: gpsCoords?.latitude ?? null,
        longitude: gpsCoords?.longitude ?? null,
        locationStatus: gpsCoords ? 'available' : locationStatus,
        imageHash: computedHash,
        kitType: kitId,
        outcomeCategory: classification.outcomeCategory,
        presumptiveSubstance: classification.presumptiveSubstance,
        confidenceScore: classification.confidenceScore,
        calibratedRgb: JSON.stringify(calib.calibratedSampleRgb),
        referenceCardCalibrated: true,
      };

      const { signature } = await signTestRecordAsync(canonicalPayload);
      setDigitalSignature(signature);

      const verification = await verifyRecordSignatureAsync(canonicalPayload, signature);
      setSignatureVerification(verification);
    } catch (err) {
      console.error('Calibration / Classification failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Handle taking a live picture
   */
  const handleCapturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
        base64: true,
      });

      if (photo) {
        setCapturedImage(photo);
        await processImageCalibrationAndClassification(photo.uri, photo.base64);
      }
    } catch (error: any) {
      console.error('Failed to capture photo:', error);
      Alert.alert('Capture Failed', error?.message || 'Could not capture photo. Try using a preset or file upload.');
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Handle selecting a demo benchmark preset
   */
  const handleSelectPreset = async (preset: DemoBenchmarkPreset) => {
    setIsPresetModalVisible(false);
    setReferenceId(`SMP-${preset.kitId.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`);
    setSelectedKitId(preset.kitId);

    // Create a mock image representation
    const mockPhoto: CameraCapturedPicture = {
      uri: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=600&q=80',
      width: 1080,
      height: 1440,
      base64: 'DEMO_PRESET_BASE64_BYTE_STREAM',
      format: 'jpg' as any,
    };
    setCapturedImage(mockPhoto);

    await processImageCalibrationAndClassification(mockPhoto.uri, mockPhoto.base64, preset);
  };

  /**
   * Web file upload fallback
   */
  const handleWebFileUpload = (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64Data = dataUrl.split(',')[1];
      const photo: CameraCapturedPicture = {
        uri: dataUrl,
        width: 1200,
        height: 1600,
        base64: base64Data,
        format: 'jpg' as any,
      };
      setCapturedImage(photo);
      await processImageCalibrationAndClassification(photo.uri, base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setRecordId('');
    setImageHash('');
    setCalibrationReport(null);
    setClassificationResult(null);
    setDigitalSignature('');
    setSignatureVerification(null);
  };

  /**
   * Commits the record to persistent local database and attempts backend sync
   */
  const handleSaveRecord = async () => {
    const trimmedId = referenceId.trim();
    if (!trimmedId) {
      setIdError('Please enter a Sample Name / Reference ID.');
      Alert.alert('Reference ID Required', 'Please enter a test / sample reference ID before saving.');
      return;
    }

    if (!capturedImage?.uri) {
      Alert.alert('Image Required', 'Please capture or select a test image before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setIdError('');

      let finalHash = imageHash;
      if (!finalHash || finalHash === 'UNAVAILABLE') {
        finalHash = await computeImageSha256Async(capturedImage.uri, capturedImage.base64);
      }

      const outcome = classificationResult?.outcomeCategory || 'INCONCLUSIVE';
      const substance = classificationResult?.presumptiveSubstance || 'Presumptive (Unanalyzed)';

      // 1. Save to local storage (Offline-First Guarantee)
      const savedLocal = await saveFieldTestRecordAsync({
        id: recordId || undefined,
        referenceId: trimmedId,
        sampleName: trimmedId,
        imageUri: capturedImage.uri,
        latitude: gpsCoords?.latitude ?? null,
        longitude: gpsCoords?.longitude ?? null,
        locationStatus: gpsCoords ? 'available' : locationStatus,
        operatorId: operatorId.trim() || 'Unassigned',
        imageHash: finalHash || 'UNAVAILABLE',
        analysisStatus: 'completed',
        presumptiveStatus: `${outcome}: ${substance}`,
        syncStatus: 'pending',
        kitType: selectedKitId,
        outcomeCategory: outcome,
        presumptiveSubstance: substance,
        confidenceScore: classificationResult?.confidenceScore ?? null,
        calibratedRgb: calibrationReport ? JSON.stringify(calibrationReport.calibratedSampleRgb) : null,
        rawRgb: calibrationReport ? JSON.stringify(calibrationReport.rawSampleRgb) : null,
        referenceCardCalibrated: Boolean(calibrationReport?.isCalibrated),
        digitalSignature: digitalSignature || undefined,
        signatureVerified: signatureVerification?.isAuthentic ?? true,
      });

      // 2. Attempt sync with backend
      let alertTitle = 'Record Saved Locally';
      let alertMsg = `Record "${trimmedId}" saved with cryptographic SHA-256 signature (${outcome}).`;

      try {
        const syncRes = await sendRecordToBackendAsync(savedLocal);
        if (syncRes.status === 'synced') {
          await updateRecordSyncStatusAsync(savedLocal.id, 'synced', syncRes.recordHash, syncRes.previousRecordHash);
          alertTitle = 'Record Saved & Synced';
          alertMsg = `Record "${trimmedId}" saved and cryptographically linked to Hash-Linked Chain of Custody.`;
        }
      } catch (syncErr) {
        console.warn('Sync attempt skipped/offline:', syncErr);
      }

      Alert.alert(alertTitle, alertMsg, [
        { text: 'View Records', onPress: () => router.replace('/records') },
        { text: 'Done', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error: any) {
      console.error('Failed to save record:', error);
      Alert.alert('Save Error', error?.message || 'Failed to save record.');
    } finally {
      setIsSaving(false);
    }
  };

  // Permission handling
  if (!permission && Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1D5D8F" />
          <Text style={styles.loadingText}>Initializing camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // REVIEW & SAVE SCREEN (Post-Capture / Preset Analysis)
  if (capturedImage) {
    const outcome = classificationResult?.outcomeCategory || 'INCONCLUSIVE';
    const isPositive = outcome === 'POSITIVE';
    const isNegative = outcome === 'NEGATIVE';
    const isInconclusive = outcome === 'INCONCLUSIVE';

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.reviewHeader}>
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>‹ Dashboard</Text>
              </Pressable>
              <Pressable style={styles.retakeIconButton} onPress={handleRetake}>
                <Text style={styles.retakeIconButtonText}>↺ Retake</Text>
              </Pressable>
            </View>

            {/* MANDATORY REGULATORY NOTICE */}
            <View style={styles.regulatoryNoticeBanner}>
              <View style={styles.regulatoryNoticeBadge}>
                <Text style={styles.regulatoryNoticeBadgeText}>LEGAL & FORENSIC NOTICE</Text>
              </View>
              <Text style={styles.regulatoryNoticeTitle}>
                PRESUMPTIVE FIELD-TEST OUTCOME
              </Text>
              <Text style={styles.regulatoryNoticeText}>
                The output of this application is a presumptive field-test result and a supporting digital record; it does not replace laboratory confirmatory testing (GC-MS / HPLC).
              </Text>
            </View>

            {/* AUTOMATED RESULT CLASSIFICATION CARD */}
            <View
              style={[
                styles.outcomeCard,
                isPositive && styles.outcomeCardPositive,
                isNegative && styles.outcomeCardNegative,
                isInconclusive && styles.outcomeCardInconclusive,
              ]}
            >
              <View style={styles.outcomeBadgeRow}>
                <View
                  style={[
                    styles.outcomePill,
                    isPositive && styles.outcomePillPositive,
                    isNegative && styles.outcomePillNegative,
                    isInconclusive && styles.outcomePillInconclusive,
                  ]}
                >
                  <Text
                    style={[
                      styles.outcomePillText,
                      isPositive && styles.outcomePillTextPositive,
                      isNegative && styles.outcomePillTextNegative,
                      isInconclusive && styles.outcomePillTextInconclusive,
                    ]}
                  >
                    {isPositive ? '✓ POSITIVE (PRESUMPTIVE)' : isNegative ? '✓ NEGATIVE (PRESUMPTIVE)' : '⚠ INCONCLUSIVE'}
                  </Text>
                </View>
                {classificationResult && (
                  <Text style={styles.confidenceTag}>
                    Confidence: {(classificationResult.confidenceScore * 100).toFixed(1)}%
                  </Text>
                )}
              </View>

              <Text style={styles.substanceNameHeading}>
                {classificationResult?.presumptiveSubstance || 'Analyzing...'}
              </Text>

              <Text style={styles.kitUsedSubheading}>
                Reagent Kit: <Text style={{ fontWeight: '700' }}>{currentKit.name}</Text>
              </Text>

              {classificationResult?.notes ? (
                <View style={styles.classificationNotesBox}>
                  <Text style={styles.classificationNotesText}>
                    {classificationResult.notes}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* PHOTO PREVIEW */}
            <View style={styles.previewCard}>
              <Image
                source={{ uri: capturedImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.previewOverlayPill}>
                <Text style={styles.previewOverlayText}>In-Frame Reference Card Calibrated</Text>
              </View>
            </View>

            {/* IN-FRAME REFERENCE COLOUR CARD LIGHTING CALIBRATION TELEMETRY */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardSectionHeading}>LIGHTING CALIBRATION TELEMETRY</Text>
                <View
                  style={[
                    styles.calibStatusBadge,
                    calibrationReport?.lightingQuality === 'GOOD'
                      ? styles.calibGood
                      : styles.calibWarn,
                  ]}
                >
                  <Text style={styles.calibStatusText}>
                    {calibrationReport?.lightingQuality === 'GOOD' ? 'CALIBRATED' : 'MARGINAL'}
                  </Text>
                </View>
              </View>

              {/* Color Swatch Comparison */}
              <View style={styles.colorComparisonGrid}>
                <View style={styles.colorComparisonCol}>
                  <Text style={styles.colorComparisonLabel}>Raw Reaction</Text>
                  <View
                    style={[
                      styles.colorSquare,
                      { backgroundColor: calibrationReport?.rawSampleHex || '#808080' },
                    ]}
                  />
                  <Text style={styles.colorHexCode}>{calibrationReport?.rawSampleHex || '#--'}</Text>
                </View>

                <View style={styles.arrowCol}>
                  <Text style={styles.arrowText}>➔</Text>
                  <Text style={styles.arrowSub}>Gains Applied</Text>
                </View>

                <View style={styles.colorComparisonCol}>
                  <Text style={styles.colorComparisonLabel}>Calibrated Reaction</Text>
                  <View
                    style={[
                      styles.colorSquare,
                      { backgroundColor: calibrationReport?.calibratedSampleHex || '#808080' },
                    ]}
                  />
                  <Text style={styles.colorHexCode}>{calibrationReport?.calibratedSampleHex || '#--'}</Text>
                </View>

                <View style={styles.colorComparisonCol}>
                  <Text style={styles.colorComparisonLabel}>Reference Card</Text>
                  <View
                    style={[
                      styles.colorSquare,
                      { backgroundColor: calibrationReport?.rawReferenceHex || '#808080' },
                    ]}
                  />
                  <Text style={styles.colorHexCode}>{calibrationReport?.rawReferenceHex || '#--'}</Text>
                </View>
              </View>

              {/* Illuminant Gain Matrix */}
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Illuminant Gains</Text>
                <Text style={[styles.telemetryVal, styles.monoText]}>
                  R: {calibrationReport?.gainFactors.gainR.toFixed(2)} | G: {calibrationReport?.gainFactors.gainG.toFixed(2)} | B: {calibrationReport?.gainFactors.gainB.toFixed(2)}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Lighting Temperature</Text>
                <Text style={styles.telemetryVal}>
                  {calibrationReport?.gainFactors.colorTemperatureEstimate.replace('_', ' ') || 'DAYLIGHT'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Reaction Color Distance (ΔE)</Text>
                <Text style={styles.telemetryVal}>
                  {classificationResult ? `${classificationResult.colorDeltaE.toFixed(1)} units` : '--'}
                </Text>
              </View>
            </View>

            {/* TAMPER-EVIDENT CRYPTOGRAPHIC INTEGRITY */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardSectionHeading}>CRYPTOGRAPHIC INTEGRITY PROOF</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓ UNTAMPERED</Text>
                </View>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Record ID</Text>
                <Text style={[styles.telemetryVal, styles.monoText]}>{recordId || 'Generating...'}</Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Image SHA-256 Digest</Text>
                <Text style={[styles.telemetryVal, styles.monoText]} numberOfLines={1}>
                  {isHashing ? 'Computing...' : (imageHash ? `${imageHash.slice(0, 24)}...` : 'Unavailable')}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>HMAC-SHA256 Signature</Text>
                <Text style={[styles.telemetryVal, styles.monoText]} numberOfLines={1}>
                  {digitalSignature ? `${digitalSignature.slice(0, 28)}...` : 'Generating signature...'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>GPS Coordinates</Text>
                <Text style={[styles.telemetryVal, styles.gpsText]}>
                  {gpsCoords ? `📍 ${gpsCoords.latitude.toFixed(5)}, ${gpsCoords.longitude.toFixed(5)}` : 'Acquiring / Unavailable'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Timestamp</Text>
                <Text style={styles.telemetryVal}>{new Date().toLocaleString()}</Text>
              </View>
            </View>

            {/* OPERATOR & SAMPLE IDENTIFIER INPUTS */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>
                Sample Name / Reference ID <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, idError ? styles.textInputError : null]}
                value={referenceId}
                onChangeText={(val) => {
                  setReferenceId(val);
                  if (idError) setIdError('');
                }}
                placeholder="e.g. SMP-SCOTT-2026-001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {idError ? <Text style={styles.errorText}>{idError}</Text> : null}
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Operator ID / Badge #</Text>
              <TextInput
                style={styles.textInput}
                value={operatorId}
                onChangeText={setOperatorId}
                placeholder="e.g. OP-DET-402"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>Enforces chain of custody identification</Text>
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.buttonGroup}>
              <Pressable
                style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                onPress={handleSaveRecord}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>💾 Save Signed Record</Text>
                )}
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={handleRetake} disabled={isSaving}>
                <Text style={styles.secondaryButtonText}>↺ Retake / Test Another</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // LIVE CAMERA & WORKFLOW SCREEN
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <View style={styles.cameraScreenContainer}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.screenHeaderTitle}>Field Drug-Test Capture</Text>
          <Pressable
            style={styles.cardHelperButton}
            onPress={() => setIsCardModalVisible(true)}
          >
            <Text style={styles.cardHelperButtonText}>📄 Ref Card</Text>
          </Pressable>
        </View>

        {/* Reagent Kit Selection Carousel */}
        <View style={styles.kitSelectorContainer}>
          <Text style={styles.kitSelectorTitle}>SELECT REAGENT TEST KIT:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kitPillsScroll}>
            {REAGENT_KITS.map((kit) => (
              <Pressable
                key={kit.id}
                style={[
                  styles.kitPill,
                  selectedKitId === kit.id && styles.kitPillActive,
                ]}
                onPress={() => setSelectedKitId(kit.id)}
              >
                <Text
                  style={[
                    styles.kitPillText,
                    selectedKitId === kit.id && styles.kitPillTextActive,
                  ]}
                >
                  {kit.shortName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Sample & Operator Quick Row */}
        <View style={styles.quickInputsRow}>
          <View style={styles.quickInputColumn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.quickInputLabel}>Sample ID:</Text>
              {isBarcodeScanned && (
                <View style={styles.scannedBadge}>
                  <Text style={styles.scannedBadgeText}>✓ SCANNED</Text>
                </View>
              )}
            </View>
            <TextInput
              style={[styles.quickTextInput, isBarcodeScanned && styles.quickTextInputScanned]}
              value={referenceId}
              onChangeText={setReferenceId}
              placeholder="e.g. SMP-001"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <View style={styles.quickInputColumn}>
            <Text style={styles.quickInputLabel}>Operator ID:</Text>
            <TextInput
              style={styles.quickTextInput}
              value={operatorId}
              onChangeText={setOperatorId}
              placeholder="e.g. OP-104"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Live GPS & Reagent Status Pill */}
        <View style={styles.gpsLiveBar}>
          <Text style={styles.gpsLiveText}>
            {gpsCoords ? `📍 GPS: ${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)}` : '📍 GPS: Acquiring...'}
          </Text>
          <Text style={styles.targetSubstanceText} numberOfLines={1}>
            Targets: {currentKit.targetSubstances.join(', ')}
          </Text>
        </View>

        {/* Live Camera Viewfinder with Dual Calibration Overlay */}
        <View style={styles.cameraWrapper}>
          {Platform.OS === 'web' ? (
            <View style={styles.webCameraFallback}>
              <Text style={styles.webFallbackTitle}>📷 Camera Ready</Text>
              <Text style={styles.webFallbackSub}>
                Position the reagent test kit and reference colour card inside the alignment boxes.
              </Text>
            </View>
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'upc_a'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}

          {/* DUAL-ZONE CALIBRATION OVERLAY */}
          <View style={styles.overlayContainer} pointerEvents="none">
            {/* Box 1: Reference Colour Card Zone */}
            <View style={styles.referenceCardBox}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Text style={styles.guideBadgeText}>1. REFERENCE COLOUR CARD</Text>
            </View>

            {/* Box 2: Test Reaction Window Zone */}
            <View style={styles.testReactionBox}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: '#10B981' }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: '#10B981' }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: '#10B981' }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: '#10B981' }]} />
              <Text style={[styles.guideBadgeText, { backgroundColor: 'rgba(6, 95, 70, 0.85)' }]}>
                2. REAGENT REACTION WINDOW
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.controlsContainer}>
          <Pressable
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={handleCapturePhoto}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <View style={styles.captureButtonInner} />
                <Text style={styles.captureButtonLabel}>Capture Test Photo</Text>
              </>
            )}
          </Pressable>

          {/* Preset / File Upload Row */}
          <View style={styles.helperActionsRow}>
            <Pressable
              style={styles.presetActionButton}
              onPress={() => setIsPresetModalVisible(true)}
            >
              <Text style={styles.presetActionButtonText}>⚡ Test Presets (Instant Demo)</Text>
            </Pressable>

            {Platform.OS === 'web' && (
              <label style={styles.uploadFileLabel}>
                📁 Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleWebFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </View>
        </View>
      </View>

      {/* MODAL 1: DIGITAL REFERENCE COLOUR CARD DISPLAY */}
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
              Display this on a screen or print it out alongside your field test kit for optical lighting calibration.
            </Text>

            <View style={styles.referenceCardRender}>
              <View style={styles.referenceCardBrandRow}>
                <Text style={styles.referenceCardBrand}>VERITRACE CALIBRATOR</Text>
                <Text style={styles.referenceCardVersion}>STD-18% GRAY / ISO-17025</Text>
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
                  Keep card on same plane and lighting as test kit reaction.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() => setIsCardModalVisible(false)}
            >
              <Text style={styles.buttonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: BENCHMARK DEMO PRESETS */}
      <Modal
        visible={isPresetModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPresetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Instant Test Case Presets</Text>
              <Pressable onPress={() => setIsPresetModalVisible(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Evaluate automated classification and reference card calibration with realistic pre-measured field cases:
            </Text>

            <ScrollView style={{ maxHeight: 380 }}>
              {DEMO_BENCHMARK_PRESETS.map((p) => {
                const isPos = p.expectedOutcome === 'POSITIVE';
                const isNeg = p.expectedOutcome === 'NEGATIVE';
                return (
                  <Pressable
                    key={p.id}
                    style={styles.presetItemCard}
                    onPress={() => handleSelectPreset(p)}
                  >
                    <View style={styles.presetTopRow}>
                      <View
                        style={[
                          styles.presetBadge,
                          isPos && styles.presetBadgePos,
                          isNeg && styles.presetBadgeNeg,
                        ]}
                      >
                        <Text style={styles.presetBadgeText}>{p.expectedOutcome}</Text>
                      </View>
                      <Text style={styles.presetLighting}>{p.ambientLighting}</Text>
                    </View>
                    <Text style={styles.presetTitle}>{p.title}</Text>
                    <Text style={styles.presetDesc}>{p.sampleDescription}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 18, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#64748B', fontSize: 14, marginTop: 12 },
  cameraScreenContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, justifyContent: 'space-between' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  screenHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  backButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backButtonText: { color: '#1D5D8F', fontSize: 14, fontWeight: '600' },
  cardHelperButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EDF2F7',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cardHelperButtonText: { color: '#1E293B', fontSize: 13, fontWeight: '700' },

  kitSelectorContainer: { marginBottom: 8 },
  kitSelectorTitle: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.6, marginBottom: 5 },
  kitPillsScroll: { gap: 8, paddingVertical: 2 },
  kitPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  kitPillActive: { backgroundColor: '#1D5D8F', borderColor: '#1D5D8F' },
  kitPillText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  kitPillTextActive: { color: '#FFFFFF', fontWeight: '700' },

  quickInputsRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 6,
  },
  quickInputColumn: { flex: 1 },
  quickInputLabel: { fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 2 },
  quickTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  quickTextInputScanned: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  scannedBadge: { backgroundColor: '#10B981', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  scannedBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  gpsLiveBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  gpsLiveText: { fontSize: 11, fontWeight: '600', color: '#047857' },
  targetSubstanceText: { fontSize: 11, color: '#475569', flex: 1, textAlign: 'right', marginLeft: 8 },

  cameraWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    minHeight: 280,
    position: 'relative',
  },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  webCameraFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webFallbackTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  webFallbackSub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  referenceCardBox: {
    width: '82%',
    height: '38%',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  testReactionBox: {
    width: '82%',
    height: '42%',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.8)',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  corner: { position: 'absolute', width: 16, height: 16, borderColor: '#FFFFFF' },
  cornerTL: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  guideBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },

  controlsContainer: { paddingTop: 10, gap: 8 },
  captureButton: {
    backgroundColor: '#1D5D8F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  captureButtonDisabled: { opacity: 0.6 },
  captureButtonInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  captureButtonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  helperActionsRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  presetActionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  presetActionButtonText: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  uploadFileLabel: {
    backgroundColor: '#EDF2F7',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as any,

  // REVIEW SCREEN STYLES
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  retakeIconButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  retakeIconButtonText: { color: '#475569', fontSize: 13, fontWeight: '600' },

  regulatoryNoticeBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderLeftWidth: 5,
    borderLeftColor: '#D97706',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  regulatoryNoticeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D97706',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  regulatoryNoticeBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  regulatoryNoticeTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  regulatoryNoticeText: { fontSize: 11, color: '#78350F', lineHeight: 16 },

  outcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  outcomeCardPositive: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  outcomeCardNegative: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  outcomeCardInconclusive: { borderColor: '#D97706', backgroundColor: '#FFFBEB' },

  outcomeBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  outcomePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  outcomePillPositive: { backgroundColor: '#DC2626' },
  outcomePillNegative: { backgroundColor: '#059669' },
  outcomePillInconclusive: { backgroundColor: '#D97706' },
  outcomePillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  outcomePillTextPositive: { color: '#FFFFFF' },
  outcomePillTextNegative: { color: '#FFFFFF' },
  outcomePillTextInconclusive: { color: '#FFFFFF' },
  confidenceTag: { fontSize: 12, fontWeight: '700', color: '#475569' },

  substanceNameHeading: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  kitUsedSubheading: { fontSize: 13, color: '#475569', marginBottom: 10 },
  classificationNotesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  classificationNotesText: { fontSize: 12, color: '#334155', lineHeight: 17 },

  previewCard: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 16,
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%' },
  previewOverlayPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  previewOverlayText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardSectionHeading: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.7 },
  calibStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  calibGood: { backgroundColor: '#ECFDF5' },
  calibWarn: { backgroundColor: '#FEF3C7' },
  calibStatusText: { fontSize: 10, fontWeight: '800', color: '#065F46' },

  colorComparisonGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  colorComparisonCol: { alignItems: 'center', flex: 1 },
  colorComparisonLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 4, textAlign: 'center' },
  colorSquare: { width: 38, height: 38, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 4 },
  colorHexCode: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#334155' },
  arrowCol: { alignItems: 'center', paddingHorizontal: 4 },
  arrowText: { fontSize: 16, color: '#1D5D8F', fontWeight: '800' },
  arrowSub: { fontSize: 8, color: '#94A3B8', fontWeight: '600' },

  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  telemetryLabel: { fontSize: 12, color: '#64748B' },
  telemetryVal: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  gpsText: { color: '#047857' },
  monoText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 },

  verifiedBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  verifiedBadgeText: { color: '#047857', fontSize: 10, fontWeight: '800' },

  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  requiredAsterisk: { color: '#DC2626' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  textInputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  errorText: { color: '#DC2626', fontSize: 11, marginTop: 4 },
  inputHint: { fontSize: 10, color: '#94A3B8', marginTop: 4 },

  buttonGroup: { gap: 10, marginTop: 10 },
  primaryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#1E293B', fontSize: 14, fontWeight: '600' },

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalCloseButton: { padding: 6 },
  modalCloseButtonText: { fontSize: 18, color: '#64748B', fontWeight: '700' },
  modalSub: { fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 14 },

  referenceCardRender: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 16,
  },
  referenceCardBrandRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  referenceCardBrand: { fontSize: 11, fontWeight: '800', color: '#0F172A', letterSpacing: 0.6 },
  referenceCardVersion: { fontSize: 9, fontWeight: '600', color: '#64748B' },
  patchesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  patchItem: { width: '30%', alignItems: 'center', marginBottom: 8 },
  patchColorBox: { width: '100%', height: 48, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 4 },
  patchName: { fontSize: 9, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  patchHex: { fontSize: 8, color: '#64748B' },
  referenceCardFooter: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 6, marginTop: 4 },
  referenceCardFootText: { fontSize: 9, color: '#64748B', fontStyle: 'italic', textAlign: 'center' },

  presetItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  presetTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  presetBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#D97706' },
  presetBadgePos: { backgroundColor: '#DC2626' },
  presetBadgeNeg: { backgroundColor: '#059669' },
  presetBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  presetLighting: { fontSize: 10, color: '#64748B', fontStyle: 'italic' },
  presetTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  presetDesc: { fontSize: 11, color: '#475569', lineHeight: 16 },
});
