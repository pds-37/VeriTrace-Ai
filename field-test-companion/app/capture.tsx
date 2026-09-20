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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as Location from 'expo-location';
import { saveFieldTestRecordAsync } from '@/services/database';
import { computeImageSha256Async } from '@/services/imageHash';

export default function CaptureScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [referenceId, setReferenceId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [capturedImage, setCapturedImage] = useState<CameraCapturedPicture | null>(null);
  const [imageHash, setImageHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);

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
    setImageHash('');
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

      await saveFieldTestRecordAsync({
        referenceId: trimmedId,
        sampleName: trimmedId,
        imageUri: capturedImage.uri,
        latitude: gpsCoords?.latitude ?? null,
        longitude: gpsCoords?.longitude ?? null,
        locationStatus: effectiveLocStatus,
        operatorId: operatorId.trim() || 'Unassigned',
        imageHash: finalHash || 'UNAVAILABLE',
      });

      Alert.alert(
        'Record Saved',
        `Field test record "${trimmedId}" has been saved locally.`,
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

            {/* Status Banner */}
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerTitle}>Image captured</Text>
              <Text style={styles.statusBannerSubtitle}>
                Analysis not implemented yet
              </Text>
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

            {/* Photo Preview Card */}
            <View style={styles.previewCard}>
              <Image
                source={{ uri: capturedImage.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>

            {/* Metadata Summary */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Operator ID</Text>
                <Text style={styles.infoValue}>{operatorId.trim() || 'Unassigned'}</Text>
              </View>
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
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Image SHA-256</Text>
                <Text style={[styles.infoValue, styles.hashMonoText]} numberOfLines={1}>
                  {isHashing ? 'Computing...' : (imageHash ? `${imageHash.slice(0, 16)}...` : 'Unavailable')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Presumptive Status</Text>
                <Text style={styles.infoValue}>Presumptive (Unanalyzed)</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Analysis Status</Text>
                <Text style={styles.infoValue}>not_implemented</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sync Status</Text>
                <Text style={styles.infoValue}>pending (Local Only)</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Resolution</Text>
                <Text style={styles.infoValue}>
                  {capturedImage.width} × {capturedImage.height} px
                </Text>
              </View>

              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Field test results are presumptive only and do not replace laboratory confirmation.
                </Text>
              </View>
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
            <Text style={styles.quickInputLabel}>Sample ID:</Text>
            <TextInput
              style={styles.quickTextInput}
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
            Place the test kit and reference colour card inside the camera frame.
          </Text>
        </View>

        {/* Live Camera Preview */}
        <View style={styles.cameraWrapper}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />

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
});
