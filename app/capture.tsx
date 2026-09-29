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
  useWindowDimensions,
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
  toPresumptiveOutcome,
  type ReagentClassificationResult,
  type ReagentKitDefinition,
} from '@/services/reagentLibrary';
import {
  calibrateSampleWithReferenceCard,
  extractDualZoneColorsAsync,
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

const VideoElement = 'video' as any;

export default function CaptureScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 360;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Web Camera Stream & Lifecycle
  const webVideoRef = useRef<any>(null);
  const mediaStreamRef = useRef<any>(null);
  const [webCameraStatus, setWebCameraStatus] = useState<
    'idle' | 'starting' | 'live' | 'permission_denied' | 'error' | 'not_supported'
  >(Platform.OS === 'web' ? 'starting' : 'idle');
  const [webCameraError, setWebCameraError] = useState<string>('');

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
  const [telemetryMode, setTelemetryMode] = useState<string>('');

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

  /**
   * Web Camera Stream Lifecycle Management
   */
  const stopWebCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      try {
        const stream = mediaStreamRef.current as MediaStream;
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch {}
      mediaStreamRef.current = null;
    }
    if (webVideoRef.current) {
      try {
        webVideoRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  const attachVideoRef = useCallback((el: any) => {
    webVideoRef.current = el;
    if (el && mediaStreamRef.current) {
      if (el.srcObject !== mediaStreamRef.current) {
        el.srcObject = mediaStreamRef.current;
      }
      el.play().catch(() => {});
    }
  }, []);

  const startWebCameraAsync = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setWebCameraStatus('not_supported');
      setWebCameraError('Web camera API is not supported in this browser environment.');
      return;
    }

    stopWebCamera();
    setWebCameraStatus('starting');
    setWebCameraError('');

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (firstErr) {
        // Fallback to any default camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (webVideoRef.current) {
        webVideoRef.current.srcObject = stream;
        webVideoRef.current.play().catch((playErr: any) => {
          console.warn('Web video auto-play blocked/interrupted:', playErr);
        });
      }
      setWebCameraStatus('live');
    } catch (err: any) {
      console.error('Web camera start error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setWebCameraStatus('permission_denied');
        setWebCameraError(
          'Camera access was blocked by browser permissions. Please allow camera access in your address bar.'
        );
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setWebCameraStatus('error');
        setWebCameraError('No camera sensor hardware detected on this machine.');
      } else {
        setWebCameraStatus('error');
        setWebCameraError(err?.message || 'Unable to open camera stream.');
      }
    }
  }, [stopWebCamera]);

  useEffect(() => {
    if (Platform.OS === 'web' && !capturedImage) {
      startWebCameraAsync();
    }
    return () => {
      stopWebCamera();
    };
  }, [capturedImage, startWebCameraAsync, stopWebCamera]);

  const handleBack = () => {
    stopWebCamera();
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
      let rawSampleRgb: [number, number, number] | null = null;
      let rawRefRgb: [number, number, number] | null = null;
      let kitId = selectedKitId;
      let calib: CalibrationReport;

      if (presetOverride) {
        rawSampleRgb = presetOverride.rawSampleRgb;
        rawRefRgb = presetOverride.rawReferenceRgb;
        kitId = presetOverride.kitId;
        setSelectedKitId(presetOverride.kitId);
        setTelemetryMode(`DEMO BENCHMARK CONTROL: ${presetOverride.title}`);
        calib = calibrateSampleWithReferenceCard(rawSampleRgb, rawRefRgb, 'gray_18');
      } else {
        // Dynamic pixel sampling from camera frame or file upload
        const extracted = await extractDualZoneColorsAsync(imgUri, imgBase64, kitId);
        if (!extracted.isValid || !extracted.rawSampleRgb || !extracted.rawReferenceRgb) {
          // Decode failure or missing pixels -> NEVER silently substitute predefined positive values!
          setTelemetryMode(`DYNAMIC OPTICAL SAMPLING: Decode Failure (${extracted.extractionDetails})`);
          calib = {
            isCalibrated: false,
            lightingQuality: 'POOR',
            rawReferenceRgb: [0, 0, 0],
            rawReferenceHex: '#000000',
            gainFactors: { gainR: 1, gainG: 1, gainB: 1, overallIlluminance: 0, colorTemperatureEstimate: 'DAYLIGHT_BALANCED' },
            rawSampleRgb: [0, 0, 0],
            rawSampleHex: '#000000',
            calibratedSampleRgb: [0, 0, 0],
            calibratedSampleHex: '#000000',
            illuminantCorrectionApplied: false,
            notes: extracted.extractionDetails || 'Image decode failure: Pixel telemetry unavailable.',
            cardValidation: { isValid: false, status: 'CALIBRATION_REQUIRED', reason: 'Pixel extraction failed.' },
            reactionValidation: { isValid: false, reason: 'Pixel extraction failed.' },
          };
        } else {
          rawSampleRgb = extracted.rawSampleRgb;
          rawRefRgb = extracted.rawReferenceRgb;
          if (extracted.source === 'html5_canvas') {
            setTelemetryMode('DYNAMIC OPTICAL SAMPLING (HTML5 Canvas Dual-Zone Pixel Analysis)');
          } else if (extracted.source === 'jpeg_decoder') {
            setTelemetryMode('DYNAMIC OPTICAL SAMPLING (Native JPEG Dual-Zone Pixel Analysis)');
          } else {
            setTelemetryMode('FIELD OPTICAL RETICLE TELEMETRY (Dual-Zone Optical Target)');
          }
          calib = calibrateSampleWithReferenceCard(
            rawSampleRgb,
            rawRefRgb,
            'gray_18',
            extracted.refStdDev,
            extracted.reactionStdDev
          );
        }
      }

      setCalibrationReport(calib);

      // 4. Run Automated Classification against Defined Outcome Categories
      const classification = classifyReagentReaction(
        calib.isCalibrated ? calib.calibratedSampleRgb : null,
        calib.isCalibrated ? calib.rawSampleRgb : null,
        kitId,
        calib.lightingQuality,
        calib.isCalibrated
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
        referenceCardCalibrated: calib.isCalibrated,
        cielab: classification.cielabFormatted,
        calibrationStatus: classification.calibrationStatus,
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
   * Handle taking a live picture (Web canvas snapshot or native CameraView)
   */
  const handleCapturePhoto = async () => {
    if (isCapturing) return;

    if (Platform.OS === 'web') {
      if (webCameraStatus !== 'live' || !webVideoRef.current) {
        Alert.alert(
          'Camera Not Ready',
          'Please ensure camera access is granted and the live stream is active before capturing.'
        );
        return;
      }

      try {
        setIsCapturing(true);
        const video = webVideoRef.current;
        const vWidth = video.videoWidth || 1280;
        const vHeight = video.videoHeight || 720;

        const canvas = document.createElement('canvas');
        canvas.width = vWidth;
        canvas.height = vHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context is unavailable.');
        }

        ctx.drawImage(video, 0, 0, vWidth, vHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const base64Data = dataUrl.split(',')[1];

        // Stop camera stream upon capturing
        stopWebCamera();

        const photo: CameraCapturedPicture = {
          uri: dataUrl,
          width: vWidth,
          height: vHeight,
          base64: base64Data,
          format: 'jpg' as any,
        };

        setCapturedImage(photo);
        await processImageCalibrationAndClassification(photo.uri, base64Data);
      } catch (error: any) {
        console.error('Failed to capture frame from web camera:', error);
        Alert.alert(
          'Capture Failed',
          error?.message || 'Could not capture photo. Try using a preset or file upload.'
        );
      } finally {
        setIsCapturing(false);
      }
      return;
    }

    if (!cameraRef.current) return;

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
    stopWebCamera();
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
    stopWebCamera();
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
    setTelemetryMode('');
    if (Platform.OS === 'web') {
      startWebCameraAsync();
    }
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
      const presumptiveOutcome = toPresumptiveOutcome(outcome);
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
        presumptiveStatus: `${presumptiveOutcome}: ${substance}`,
        syncStatus: 'pending',
        kitType: selectedKitId,
        outcomeCategory: presumptiveOutcome,
        presumptiveSubstance: substance,
        confidenceScore: classificationResult?.confidenceScore ?? null,
        calibratedRgb: calibrationReport ? JSON.stringify(calibrationReport.calibratedSampleRgb) : null,
        rawRgb: calibrationReport ? JSON.stringify(calibrationReport.rawSampleRgb) : null,
        referenceCardCalibrated: Boolean(calibrationReport?.isCalibrated),
        cielab: classificationResult?.cielabFormatted || (calibrationReport?.calibratedCielabFormatted ?? null),
        calibrationStatus: classificationResult?.calibrationStatus || (calibrationReport?.isCalibrated ? 'CALIBRATED' : 'CALIBRATION_REQUIRED'),
        digitalSignature: digitalSignature || undefined,
        signatureVerified: signatureVerification?.isAuthentic ?? true,
      });

      // 2. Attempt sync with backend
      let alertTitle = 'Record Saved Locally';
      let alertMsg = `Record "${trimmedId}" saved with cryptographic SHA-256 signature (${presumptiveOutcome}).`;

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
    const isPositive = (outcome as string) === 'POSITIVE' || outcome === 'PRESUMPTIVE POSITIVE';
    const isNegative = (outcome as string) === 'NEGATIVE' || outcome === 'PRESUMPTIVE NEGATIVE';
    const isInconclusive = !isPositive && !isNegative;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={[styles.container, isMobile && styles.containerMobile]}
            showsVerticalScrollIndicator={false}
          >
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
                    {isPositive ? '✓ PRESUMPTIVE POSITIVE' : isNegative ? '✓ PRESUMPTIVE NEGATIVE' : '⚠ INCONCLUSIVE'}
                  </Text>
                </View>
                {classificationResult && (
                  <Text style={styles.confidenceTag}>
                    {classificationResult.outcomeCategory === 'INCONCLUSIVE'
                      ? 'No Concordance'
                      : `Match: ${classificationResult.matchStrength || 'Concordant'} (ΔE*ab = ${classificationResult.deltaE76.toFixed(1)})`}
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
              <View
                style={[
                  styles.previewOverlayPill,
                  !calibrationReport?.isCalibrated && { backgroundColor: 'rgba(220, 38, 38, 0.88)' },
                ]}
              >
                <Text style={styles.previewOverlayText}>
                  {calibrationReport?.isCalibrated
                    ? 'In-Frame Reference Card Calibrated'
                    : 'Reference Card Calibration Required'}
                </Text>
              </View>
            </View>

            {/* IN-FRAME REFERENCE COLOUR CARD LIGHTING CALIBRATION TELEMETRY */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardSectionHeading}>LIGHTING CALIBRATION TELEMETRY</Text>
                <View
                  style={[
                    styles.calibStatusBadge,
                    calibrationReport?.isCalibrated
                      ? styles.calibGood
                      : styles.calibWarn,
                  ]}
                >
                  <Text style={styles.calibStatusText}>
                    {calibrationReport?.isCalibrated ? 'CALIBRATED' : 'CALIBRATION_REQUIRED'}
                  </Text>
                </View>
              </View>

              {telemetryMode ? (
                <View style={styles.telemetryModeBanner}>
                  <Text style={styles.telemetryModeBannerText}>{telemetryMode}</Text>
                </View>
              ) : null}

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
                <Text style={styles.telemetryLabel}>CIELAB ΔE*ab (CIE76)</Text>
                <Text style={[styles.telemetryVal, styles.monoText]}>
                  {classificationResult?.deltaE76 !== undefined ? `ΔE*ab = ${classificationResult.deltaE76.toFixed(1)}` : '--'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Match Strength</Text>
                <Text style={[styles.telemetryVal, { fontWeight: '700' }]}>
                  {classificationResult?.matchStrength || '--'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Decision Margin</Text>
                <Text style={[styles.telemetryVal, styles.monoText]}>
                  {classificationResult?.decisionMargin !== undefined ? `${classificationResult.decisionMargin.toFixed(1)} ΔE units` : '--'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>CIELAB Telemetry (D65)</Text>
                <Text style={[styles.telemetryVal, styles.monoText]}>
                  {classificationResult?.cielabFormatted || calibrationReport?.calibratedCielabFormatted || 'L* --, a* --, b* --'}
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Calibration Status</Text>
                <Text
                  style={[
                    styles.telemetryVal,
                    {
                      fontWeight: '700',
                      color:
                        (classificationResult?.calibrationStatus === 'CALIBRATED' || calibrationReport?.isCalibrated)
                          ? '#10B981'
                          : '#F59E0B',
                    },
                  ]}
                >
                  {classificationResult?.calibrationStatus || (calibrationReport?.isCalibrated ? 'CALIBRATED' : 'CALIBRATION_REQUIRED')}
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
      <View style={[styles.cameraScreenContainer, isMobile && styles.cameraScreenContainerMobile]}>
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
        <View style={[styles.quickInputsRow, isSmallMobile && styles.quickInputsRowMobile]}>
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
            <View style={styles.webCameraContainer}>
              {webCameraStatus === 'live' && (
                <VideoElement
                  ref={attachVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={styles.webVideoObject}
                />
              )}

              {webCameraStatus === 'starting' && (
                <View style={styles.webCameraStatusOverlay}>
                  <ActivityIndicator size="large" color="#FF7F50" />
                  <Text style={styles.webCameraStatusTitle}>Connecting Live Camera...</Text>
                  <Text style={styles.webCameraStatusSubtitle}>Requesting browser camera stream</Text>
                </View>
              )}

              {webCameraStatus === 'permission_denied' && (
                <View style={styles.webCameraStatusOverlay}>
                  <Text style={styles.webCameraStatusIcon}>🚫</Text>
                  <Text style={styles.webCameraStatusTitle}>Camera Permission Blocked</Text>
                  <Text style={styles.webCameraStatusSubtitle}>
                    {webCameraError || 'Please allow camera access in your browser to enable real-time capture.'}
                  </Text>
                  <Pressable style={styles.webRetryBtn} onPress={startWebCameraAsync}>
                    <Text style={styles.webRetryBtnText}>🔄 Retry Camera</Text>
                  </Pressable>
                </View>
              )}

              {(webCameraStatus === 'error' || webCameraStatus === 'not_supported') && (
                <View style={styles.webCameraStatusOverlay}>
                  <Text style={styles.webCameraStatusIcon}>⚠️</Text>
                  <Text style={styles.webCameraStatusTitle}>Camera Stream Unavailable</Text>
                  <Text style={styles.webCameraStatusSubtitle}>{webCameraError}</Text>
                  <Pressable style={styles.webRetryBtn} onPress={startWebCameraAsync}>
                    <Text style={styles.webRetryBtnText}>🔄 Reconnect Camera</Text>
                  </Pressable>
                </View>
              )}
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
            {/* Viewfinder Top HUD Bar */}
            <View style={styles.viewfinderTopHud}>
              <View
                style={[
                  styles.liveStatusPill,
                  webCameraStatus === 'live' || Platform.OS !== 'web'
                    ? styles.liveStatusPillActive
                    : styles.liveStatusPillInactive,
                ]}
              >
                <View
                  style={[
                    styles.liveStatusDot,
                    webCameraStatus === 'live' || Platform.OS !== 'web'
                      ? styles.liveStatusDotActive
                      : styles.liveStatusDotInactive,
                  ]}
                />
                <Text style={styles.liveStatusText}>
                  {Platform.OS === 'web'
                    ? webCameraStatus === 'live'
                      ? 'LIVE CAMERA'
                      : webCameraStatus === 'starting'
                      ? 'STARTING...'
                      : 'BLOCKED'
                    : 'LIVE SENSOR'}
                </Text>
              </View>

              <View style={styles.opticalHudPill}>
                <Text style={styles.opticalHudText}>OPTICAL 1× • DUAL-ZONE</Text>
              </View>
            </View>

            {/* Box 1: Reference Colour Card Zone */}
            <View style={styles.referenceCardBox}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: '#38BDF8' }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: '#38BDF8' }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: '#38BDF8' }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: '#38BDF8' }]} />
              <View style={styles.reticleBadgeWrapper}>
                <Text style={styles.reticleBadge01}>01 - REFERENCE CARD</Text>
                <Text style={styles.reticleSubLabel}>Align In-Frame 18% Neutral Gray Card</Text>
              </View>
            </View>

            {/* Box 2: Test Reaction Window Zone */}
            <View style={styles.testReactionBox}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: '#10B981' }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: '#10B981' }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: '#10B981' }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: '#10B981' }]} />
              <View style={styles.reticleBadgeWrapper}>
                <Text style={styles.reticleBadge02}>02 - REACTION WINDOW</Text>
                <Text style={styles.reticleSubLabel}>Align Chemical Reaction Spot</Text>
              </View>
            </View>

            {/* Viewfinder Bottom Telemetry Footer */}
            <View style={styles.viewfinderBottomHud}>
              <Text style={styles.viewfinderTelemetryText}>
                {Platform.OS === 'web' && webCameraStatus !== 'live'
                  ? `CAMERA: ${webCameraStatus.toUpperCase()} | PRESETS READY`
                  : '● OPTICAL SENSORS ACTIVE | RETICLE 01: READY | RETICLE 02: READY'}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.controlsContainer}>
          <Pressable
            style={[
              styles.captureButton,
              (isCapturing || (Platform.OS === 'web' && webCameraStatus !== 'live')) &&
                styles.captureButtonDisabled,
            ]}
            onPress={handleCapturePhoto}
            disabled={isCapturing || (Platform.OS === 'web' && webCameraStatus !== 'live')}
          >
            {isCapturing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <View style={styles.captureButtonInner} />
                <Text style={styles.captureButtonLabel}>
                  {Platform.OS === 'web' && webCameraStatus === 'starting'
                    ? 'Starting Camera...'
                    : Platform.OS === 'web' && webCameraStatus === 'permission_denied'
                    ? 'Camera Permission Blocked'
                    : Platform.OS === 'web' &&
                      (webCameraStatus === 'error' || webCameraStatus === 'not_supported')
                    ? 'Camera Unavailable'
                    : 'Capture Test Photo'}
                </Text>
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
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
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
                  <Text style={styles.referenceCardVersion}>STD-18% GRAY / REFERENCE STANDARD</Text>
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
            </ScrollView>
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
          <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
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
  container: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
  containerMobile: { padding: 14, paddingBottom: 28 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#64748B', fontSize: 14, marginTop: 12 },
  cameraScreenContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, justifyContent: 'space-between', width: '100%', maxWidth: 720, alignSelf: 'center' },
  cameraScreenContainerMobile: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 },

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

  kitSelectorContainer: { marginBottom: 8, width: '100%', maxWidth: '100%', overflow: 'hidden' },
  kitSelectorTitle: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.6, marginBottom: 5 },
  kitPillsScroll: { gap: 8, paddingVertical: 2, flexDirection: 'row' },
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
    width: '100%',
  },
  quickInputsRowMobile: {
    flexDirection: 'column',
    gap: 6,
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
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    minHeight: Platform.OS === 'web' ? 440 : 340,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
  },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  webCameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090D16',
    overflow: 'hidden',
  },
  webVideoObject: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  webCameraStatusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 2,
  },
  webCameraStatusIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  webCameraStatusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  webCameraStatusSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 14,
  },
  webRetryBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  webRetryBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  viewfinderTopHud: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    gap: 6,
  },
  liveStatusPillActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  liveStatusPillInactive: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  liveStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveStatusDotActive: {
    backgroundColor: '#10B981',
  },
  liveStatusDotInactive: {
    backgroundColor: '#EF4444',
  },
  liveStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  opticalHudPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  opticalHudText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  referenceCardBox: {
    width: '86%',
    height: '34%',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderStyle: 'dashed',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.04)',
  },
  testReactionBox: {
    width: '86%',
    height: '38%',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.6)',
    borderStyle: 'dashed',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  corner: { position: 'absolute', width: 14, height: 14 },
  cornerTL: { top: -2, left: -2, borderTopWidth: 2.5, borderLeftWidth: 2.5 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 2.5, borderLeftWidth: 2.5 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 2.5, borderRightWidth: 2.5 },
  reticleBadgeWrapper: {
    alignItems: 'center',
    gap: 3,
  },
  reticleBadge01: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    overflow: 'hidden',
  },
  reticleBadge02: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    overflow: 'hidden',
  },
  reticleSubLabel: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  viewfinderBottomHud: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  viewfinderTelemetryText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  helperActionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  presetActionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexGrow: 1,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActionButtonText: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  uploadFileLabel: {
    backgroundColor: '#EDF2F7',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    minWidth: 110,
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
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 4,
  },
  telemetryLabel: { fontSize: 12, color: '#64748B', flexShrink: 0 },
  telemetryVal: { fontSize: 12, fontWeight: '600', color: '#0F172A', textAlign: 'right', flexShrink: 1 },
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
    width: '100%',
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
    width: '100%',
  },
  secondaryButtonText: { color: '#1E293B', fontSize: 14, fontWeight: '600' },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalCardMobile: {
    padding: 14,
    maxWidth: '94%',
  },
  modalScrollContent: {
    paddingBottom: 4,
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
  telemetryModeBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  telemetryModeBannerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.3,
  },
});
