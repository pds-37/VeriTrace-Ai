import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { analyzeFieldTestImageAsync, type AnalysisResult, type DemoClassificationResult } from '@/services/aiAnalysis';
import { sendRecordToBackendAsync } from '@/services/backendApi';

export default function CaptureScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [referenceId, setReferenceId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [recordId, setRecordId] = useState('');
  const [capturedImage, setCapturedImage] = useState<CameraCapturedPicture | null>(null);
  const [imageHash, setImageHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // GPS state
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

  // Barcode scanning state
  const [isBarcodeScanned, setIsBarcodeScanned] = useState(false);
  const barcodeCooldownRef = useRef(false);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (barcodeCooldownRef.current) return;
    
    // Set value and trigger haptic feedback
    setReferenceId(data);
    setIsBarcodeScanned(true);
    Vibration.vibrate(100);
    
    // Start cooldown
    barcodeCooldownRef.current = true;
    setTimeout(() => {
      barcodeCooldownRef.current = false;
      setIsBarcodeScanned(false);
    }, 2500); // 2.5 seconds cooldown
  };

  /**
   * Request GPS permission and fetch coordinates.
   * If permission is denied or location is unavailable, handles gracefully.
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

      // Try current location with a timeout
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
        // Fallback to last known position
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
        const newRecId = generateRecordId();
        setRecordId(newRecId);
        setCapturedImage(photo);

        // Compute SHA-256 hash of image file immediately
        setIsHashing(true);
        try {
          const hash = await computeImageSha256Async(photo.uri, photo.base64);
          setImageHash(hash);
        } catch (hashError) {
          console.warn('Failed to compute image hash:', hashError);
          setImageHash('UNAVAILABLE');
        } finally {
          setIsHashing(false);
        }

        // Run AI/CV demonstration analysis flow
        setIsAnalyzing(true);
        try {
          const result = await analyzeFieldTestImageAsync(photo.uri, photo.base64);
          setAnalysisResult(result);
        } catch (analysisError) {
          console.warn('AI/CV analysis stub error:', analysisError);
          setAnalysisResult({
            status: 'failed',
            presumptiveResult: 'Demo analysis unavailable',
            confidenceScore: null,
            analyzedAt: new Date().toISOString(),
            isDemoStub: true,
            notes: 'Demo analysis could not be completed. You can still save this field record.',
          });
        } finally {
          setIsAnalyzing(false);
        }
      }
    } catch (error: any) {
      console.error('Failed to capture photo:', error);
      Alert.alert('Capture Failed', error?.message || 'Could not capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setRecordId('');
    setImageHash('');
    setAnalysisResult(null);
    setIsAnalyzing(false);
  };

  const handleSaveRecord = async () => {
    const trimmedId = referenceId.trim();
    if (!trimmedId) {
      setIdError('Please enter a Sample Name / Reference ID.');
      Alert.alert('Reference ID Required', 'Please enter a test / sample reference ID before saving.');
      return;
    }

    if (!capturedImage?.uri) {
      Alert.alert('Image Required', 'Please capture a photo of the test kit and reference card before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setIdError('');

      // Ensure SHA-256 hash is computed
      let finalHash = imageHash;
      if (!finalHash || finalHash === 'UNAVAILABLE') {
        finalHash = await computeImageSha256Async(capturedImage.uri, capturedImage.base64);
      }

      // Determine location status string
      let effectiveLocStatus = 'unavailable';
      if (gpsCoords) {
        effectiveLocStatus = 'available';
      } else if (locationStatus === 'permission_denied') {
        effectiveLocStatus = 'permission_denied';
      }

      let effectiveAnalysisStatus = 'demo_telemetry_completed';
      if (analysisResult?.demoClassification) {
        effectiveAnalysisStatus = analysisResult.demoClassification.isCassetteLike
          ? 'demo_cassette_like'
          : 'demo_non_test_object';
      } else if (analysisResult) {
        effectiveAnalysisStatus =
          analysisResult.status === 'completed'
            ? 'telemetry_completed'
            : analysisResult.status === 'failed'
              ? 'telemetry_failed'
              : 'telemetry_inconclusive';
      }

      // 1. Always save to local SQLite / storage first (Offline-First Guarantee)
      const savedLocal = await saveFieldTestRecordAsync({
        id: recordId || undefined,
        referenceId: trimmedId,
        sampleName: trimmedId,
        imageUri: capturedImage.uri,
        latitude: gpsCoords?.latitude ?? null,
        longitude: gpsCoords?.longitude ?? null,
        locationStatus: effectiveLocStatus,
        operatorId: operatorId.trim() || 'Unassigned',
        imageHash: finalHash || 'UNAVAILABLE',
        analysisStatus: effectiveAnalysisStatus,
        presumptiveStatus: 'Presumptive (Unanalyzed)',
        syncStatus: 'pending',
      });

      // 2. Attempt immediate synchronization with backend if reachable
      let alertTitle = 'Record Saved Locally';
      let alertMsg = `Field test record "${trimmedId}" has been securely saved to local device storage.`;

      try {
        const syncRes = await sendRecordToBackendAsync(savedLocal);

        if (syncRes.status === 'synced') {
          await updateRecordSyncStatusAsync(
            savedLocal.id,
            'synced',
            syncRes.recordHash,
            syncRes.previousRecordHash
          );
          alertTitle = 'Record Saved & Synced';
          alertMsg = `Record "${trimmedId}" saved locally and cryptographically linked to Hash-Linked Chain of Custody (Hash: ${syncRes.recordHash ? syncRes.recordHash.substring(0, 16) : ''}...).`;
        } else if (syncRes.status === 'already_synced') {
          await updateRecordSyncStatusAsync(savedLocal.id, 'synced', syncRes.recordHash);
          alertTitle = 'Record Saved & Synced';
          alertMsg = `Record "${trimmedId}" saved locally (already synchronized on server).`;
        } else if (syncRes.status === 'conflict') {
          await updateRecordSyncStatusAsync(savedLocal.id, 'conflict', syncRes.recordHash);
          alertTitle = 'Record Saved (Conflict Flagged)';
          alertMsg = `Record "${trimmedId}" saved locally, but server reported a conflict with an existing record ID.`;
        } else if (syncRes.status === 'network_unavailable') {
          alertTitle = 'Record Saved (Offline)';
          alertMsg = `Record "${trimmedId}" saved locally. Queued as "Pending Sync" and will sync when backend is available.`;
        } else if (syncRes.status === 'rejected') {
          await updateRecordSyncStatusAsync(savedLocal.id, 'rejected');
          alertTitle = 'Record Saved (Validation Issue)';
          alertMsg = `Record "${trimmedId}" saved locally. Server validation notice: ${syncRes.message}`;
        }
      } catch (syncErr) {
        console.warn('Immediate sync attempt skipped or failed, record remains saved locally:', syncErr);
        // Record is safely stored in local database
      }

      Alert.alert(
        alertTitle,
        alertMsg,
        [
          {
            text: 'View Records',
            onPress: () => router.replace('/records'),
          },
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Failed to save record:', error);
      const errorMessage = error?.message || 'Failed to save record to local database.';
      Alert.alert('Save Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Permission is loading
  if (!permission) {
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

  // Permission not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <View style={styles.container}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>

          <View style={styles.permissionCard}>
            <View style={styles.permissionBadge}>
              <Text style={styles.permissionBadgeText}>PERMISSION REQUIRED</Text>
            </View>
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionDescription}>
              Field Test Companion requires camera access to photograph test kits alongside
              the reference colour card for local record keeping.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Grant Camera Permission"
            >
              <Text style={styles.buttonText}>Grant Camera Permission</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Post-Capture State (Photo Taken & Reviewing)
  if (capturedImage) {
    const demo = analysisResult?.demoClassification;
    const colorMetrics = analysisResult?.colorMetrics;
    const roi = colorMetrics?.roi;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.container}>
            <Pressable
              style={styles.backButton}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButtonText}>‹ Dashboard</Text>
            </Pressable>

            {/* Prominent Demo Result Notice Banner */}
            <View style={styles.demoDisclaimerBanner}>
              <View style={styles.demoDisclaimerBadge}>
                <Text style={styles.demoDisclaimerBadgeText}>PROTOTYPE DEMO</Text>
              </View>
              <Text style={styles.demoDisclaimerTitle}>
                DEMO RESULT — NOT A VERIFIED AI PREDICTION
              </Text>
              <Text style={styles.demoDisclaimerSubtitle}>
                This screen demonstrates image telemetry and camera-domain structural analysis only. No chemical substance or laboratory prediction is performed.
              </Text>
            </View>

            {/* Demo Classification Card */}
            <View style={styles.classificationCard}>
              <Text style={styles.cardSectionHeading}>DEMO CLASSIFICATION</Text>

              <View style={styles.classificationPillContainer}>
                {isAnalyzing ? (
                  <View style={styles.analyzingBadge}>
                    <ActivityIndicator size="small" color="#1D5D8F" style={{ marginRight: 6 }} />
                    <Text style={styles.analyzingBadgeText}>Evaluating image geometry...</Text>
                  </View>
                ) : demo ? (
                  <View
                    style={demo.isCassetteLike ? styles.cassetteBadge : styles.nonTestBadge}
                  >
                    <Text style={demo.isCassetteLike ? styles.cassetteBadgeText : styles.nonTestBadgeText}>
                      {demo.isCassetteLike ? '✓  Cassette-like object' : '⚠  Non-test object'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.nonTestBadge}>
                    <Text style={styles.nonTestBadgeText}>⚠  Non-test object (Unclassified)</Text>
                  </View>
                )}
              </View>

              {demo?.structuralIndicators && demo.structuralIndicators.length > 0 ? (
                <View style={styles.indicatorList}>
                  <Text style={styles.indicatorHeader}>Observed Structural Indicators:</Text>
                  {demo.structuralIndicators.map((ind, idx) => (
                    <View key={idx} style={styles.indicatorItem}>
                      <Text style={styles.indicatorBullet}>•</Text>
                      <Text style={styles.indicatorText}>{ind}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.cardSubtitle}>
                Deterministic structural heuristic based on aspect ratio, edge contrast & substrate reflectance.
              </Text>
            </View>

            {/* Photo Preview Card */}
            <View style={styles.previewCard}>
              <Image
                source={{ uri: capturedImage.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <View style={styles.previewResolutionTag}>
                <Text style={styles.previewResolutionText}>
                  {capturedImage.width} × {capturedImage.height} px
                </Text>
              </View>
            </View>

            {/* Image Analysis Telemetry Details Card */}
            <View style={styles.infoCard}>
              <Text style={styles.cardSectionHeading}>IMAGE ANALYSIS TELEMETRY</Text>

              {/* Record ID */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Record ID</Text>
                <Text style={[styles.infoValue, styles.hashMonoText]}>
                  {recordId || 'Generating...'}
                </Text>
              </View>

              {/* Image Hash */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Image SHA-256</Text>
                <Text style={[styles.infoValue, styles.hashMonoText]} numberOfLines={1}>
                  {isHashing ? 'Computing...' : (imageHash ? `${imageHash.slice(0, 16)}...` : 'Unavailable')}
                </Text>
              </View>

              {/* ROI Details */}
              {roi ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Region of Interest (ROI)</Text>
                  <Text style={styles.infoValue}>
                    {roi.x}, {roi.y} ({roi.width}×{roi.height}px) · {roi.detectionMethod === 'dynamic_contrast' ? `Adaptive (${(roi.qualityScore * 100).toFixed(0)}%)` : 'Center'}
                  </Text>
                </View>
              ) : null}

              {/* Dominant Color & HEX / RGB */}
              {colorMetrics?.dominantHex ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Measured Color</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: colorMetrics.dominantHex },
                      ]}
                    />
                    <Text style={[styles.infoValue, styles.hashMonoText]}>
                      {colorMetrics.dominantHex} (RGB: {colorMetrics.rgb?.join(', ')})
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Normalized Chromaticity */}
              {colorMetrics?.normalizedRgb ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Normalized Chromaticity</Text>
                  <Text style={[styles.infoValue, styles.hashMonoText]}>
                    r: {colorMetrics.normalizedRgb[0]}, g: {colorMetrics.normalizedRgb[1]}, b: {colorMetrics.normalizedRgb[2]}
                  </Text>
                </View>
              ) : null}

              {/* Intensity Score */}
              {colorMetrics?.intensityScore !== undefined ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Substrate Intensity</Text>
                  <Text style={styles.infoValue}>
                    {colorMetrics.intensityScore} / 255
                  </Text>
                </View>
              ) : null}

              {/* GPS Location */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>GPS Location</Text>
                <View style={styles.gpsValueContainer}>
                  {gpsCoords ? (
                    <Text style={styles.gpsAvailableText}>
                      ✓ {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
                    </Text>
                  ) : locationStatus === 'acquiring' ? (
                    <Text style={styles.gpsAcquiringText}>Acquiring GPS...</Text>
                  ) : locationStatus === 'permission_denied' ? (
                    <Pressable onPress={fetchLocationAsync}>
                      <Text style={styles.gpsDeniedText}>Denied (Tap to retry)</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={fetchLocationAsync}>
                      <Text style={styles.gpsUnavailableText}>Unavailable (Tap to retry)</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Operator ID */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Operator ID</Text>
                <Text style={styles.infoValue}>{operatorId.trim() || 'Unassigned'}</Text>
              </View>

              {/* Presumptive Status */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Presumptive Status</Text>
                <Text style={styles.infoValue}>Presumptive (Unanalyzed)</Text>
              </View>

              {/* Sync Status */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sync Status</Text>
                <Text style={styles.infoValue}>pending (Local Only)</Text>
              </View>
            </View>

            {/* Reference ID Input Card */}
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
                placeholder="e.g. SMP-2026-001 or Batch #4"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {idError ? <Text style={styles.errorText}>{idError}</Text> : null}
            </View>

            {/* Operator ID Input Card */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>
                Operator ID <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={operatorId}
                onChangeText={setOperatorId}
                placeholder="e.g. OP-104 or Badge #"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>Operator identifier for audit and field traceability</Text>
            </View>

            {/* Important Presumptive Notice */}
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                Field test results are presumptive only and do not replace laboratory confirmation.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <Pressable
                style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                onPress={handleSaveRecord}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save Record"
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>💾  Save Record</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={handleRetake}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Retake Photo"
              >
                <Text style={styles.secondaryButtonText}>↺  Retake Photo</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Active Live Camera State
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <View style={styles.cameraScreenContainer}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.screenHeaderTitle}>Capture Test</Text>
          <View style={styles.topBarPlaceholder} />
        </View>

        {/* Quick Inputs Row: Sample ID and Operator ID */}
        <View style={styles.quickInputsRow}>
          <View style={styles.quickInputColumn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.quickInputLabel}>Sample ID:</Text>
              {isBarcodeScanned && (
                <View style={{ backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>✓ SCANNED</Text>
                </View>
              )}
            </View>
            <TextInput
              style={[styles.quickTextInput, isBarcodeScanned && { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}
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

        {/* GPS Live Pill */}
        <View style={styles.gpsLiveBar}>
          {gpsCoords ? (
            <Text style={styles.gpsLiveText}>
              📍 GPS: {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)} (±{Math.round(gpsCoords.accuracy || 0)}m)
            </Text>
          ) : locationStatus === 'acquiring' ? (
            <Text style={styles.gpsLiveAcquiring}>📍 GPS: Acquiring coordinates...</Text>
          ) : locationStatus === 'permission_denied' ? (
            <Pressable onPress={fetchLocationAsync}>
              <Text style={styles.gpsLiveDenied}>📍 GPS: Permission denied (Tap to grant)</Text>
            </Pressable>
          ) : (
            <Pressable onPress={fetchLocationAsync}>
              <Text style={styles.gpsLiveUnavailable}>📍 GPS: Unavailable (Tap to retry)</Text>
            </Pressable>
          )}
        </View>

        {/* Instructions Banner */}
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionTitle}>ALIGNMENT INSTRUCTION</Text>
          <Text style={styles.instructionText}>
            Point camera at QR code to auto-fill ID, then align test kit inside the frame.
          </Text>
        </View>

        {/* Live Camera Preview */}
        <View style={styles.cameraWrapper}>
          <CameraView 
            ref={cameraRef} 
            style={styles.camera} 
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'upc_a'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Alignment Target Frame Overlay */}
          <View style={styles.overlayContainer} pointerEvents="none">
            <View style={styles.alignmentBox}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              <Text style={styles.alignmentGuideText}>
                Test Kit & Colour Card Area
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.controlsContainer}>
          <Text style={styles.helperText}>
            Hold steady and ensure balanced lighting across the sample.
          </Text>

          <Pressable
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={handleCapturePhoto}
            disabled={isCapturing}
            accessibilityRole="button"
            accessibilityLabel="Capture Photo"
          >
            {isCapturing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <View style={styles.captureButtonInner} />
                <Text style={styles.captureButtonLabel}>Capture Photo</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  cameraScreenContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topBarPlaceholder: {
    width: 60,
  },
  screenHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#142536',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backButtonText: {
    color: '#1D5D8F',
    fontSize: 15,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 12,
  },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 24,
    marginTop: 24,
  },
  permissionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDF3F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  permissionBadgeText: {
    color: '#183B56',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#142536',
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    marginBottom: 24,
  },
  quickInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  quickInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#142536',
  },
  quickTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#142536',
    fontWeight: '600',
    padding: 0,
  },
  instructionBanner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderLeftWidth: 4,
    borderLeftColor: '#1D5D8F',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  instructionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#183B56',
    marginBottom: 3,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142536',
    lineHeight: 18,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#000000',
    minHeight: 280,
    position: 'relative',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alignmentBox: {
    width: '90%',
    height: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  alignmentGuideText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(20, 37, 54, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  controlsContainer: {
    paddingTop: 10,
    alignItems: 'center',
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  captureButton: {
    backgroundColor: '#1D5D8F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    gap: 10,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  captureButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  statusBanner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderLeftWidth: 4,
    borderLeftColor: '#0F766E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#142536',
  },
  statusBannerSubtitle: {
    fontSize: 13,
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 2,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142536',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#DC2626',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#142536',
    fontWeight: '600',
  },
  textInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
  },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    height: 240,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142536',
  },
  noticeBox: {
    backgroundColor: '#FFF9E9',
    borderColor: '#F1D99A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  noticeText: {
    color: '#785817',
    fontSize: 12,
    lineHeight: 17,
  },
  buttonGroup: {
    flexDirection: 'column',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#183B56',
    fontSize: 15,
    fontWeight: '600',
  },
  optionalText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
  },
  inputHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  gpsValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsAvailableText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  gpsAcquiringText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
  },
  gpsDeniedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    textDecorationLine: 'underline',
  },
  gpsUnavailableText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  hashMonoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
  },
  quickInputsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  quickInputColumn: {
    flex: 1,
  },
  gpsLiveBar: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  gpsLiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  gpsLiveAcquiring: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  gpsLiveDenied: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    textDecorationLine: 'underline',
  },
  gpsLiveUnavailable: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  demoDisclaimerBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderLeftWidth: 5,
    borderLeftColor: '#D97706',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  demoDisclaimerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  demoDisclaimerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  demoDisclaimerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  demoDisclaimerSubtitle: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  classificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  cardSectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  classificationPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  analyzingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  analyzingBadgeText: {
    color: '#1D5D8F',
    fontSize: 13,
    fontWeight: '600',
  },
  cassetteBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#34D399',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cassetteBadgeText: {
    color: '#065F46',
    fontSize: 15,
    fontWeight: '700',
  },
  nonTestBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nonTestBadgeText: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '700',
  },
  indicatorList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  indicatorHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
    letterSpacing: 0.4,
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  indicatorBullet: {
    color: '#1D5D8F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  indicatorText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 16,
  },
  previewResolutionTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  previewResolutionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
});
