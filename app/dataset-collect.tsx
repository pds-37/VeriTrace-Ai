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
import {
  getDatasetStatsAsync,
  saveDatasetSampleAsync,
  getAllDatasetSamplesAsync,
  deleteDatasetSampleAsync,
  clearDatasetSamplesAsync,
  exportDatasetManifestCsvAsync,
  exportDatasetManifestJsonAsync,
  getDatasetStorageLocation,
  type DatasetLabel,
  type LightingCondition,
  type Orientation,
  type DistanceCategory,
  type DatasetStats,
  type DatasetSampleMetadata,
} from '@/services/datasetCollector';
import { computeImageSha256Async } from '@/services/imageHash';

export default function DatasetCollectionScreen({ isTab = false }: { isTab?: boolean } = {}) {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Label & Metadata state
  const [selectedLabel, setSelectedLabel] = useState<DatasetLabel>('lateral_flow_cassette');
  const [lighting, setLighting] = useState<LightingCondition>('indoor_normal');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [distance, setDistance] = useState<DistanceCategory>('medium');
  const [notes, setNotes] = useState('');

  // Capture & Validation state
  const [capturedImage, setCapturedImage] = useState<CameraCapturedPicture | null>(null);
  const [imageHash, setImageHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Dashboard Stats & Samples list state
  const [stats, setStats] = useState<DatasetStats>({
    cassetteCount: 0,
    nonTestCount: 0,
    totalCount: 0,
    duplicatesRejected: 0,
    lastSample: null,
  });
  const [samplesList, setSamplesList] = useState<DatasetSampleMetadata[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, samplesData] = await Promise.all([
        getDatasetStatsAsync(),
        getAllDatasetSamplesAsync(),
      ]);
      setStats(statsData);
      setSamplesList(samplesData);
    } catch (err) {
      console.warn('Could not load dataset data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Image Capture
  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      setFeedbackMessage(null);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
        skipProcessing: false,
      });

      if (!photo || !photo.uri) {
        Alert.alert('Capture Error', 'Could not acquire camera image.');
        return;
      }

      setCapturedImage(photo);

      // Compute SHA-256 hash immediately
      setIsHashing(true);
      const hash = await computeImageSha256Async(photo.uri, photo.base64);
      setImageHash(hash);
      setIsHashing(false);
    } catch (err: any) {
      console.error('Camera capture error:', err);
      Alert.alert('Error', err?.message || 'Failed to capture dataset image.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle Save Sample
  const handleSaveSample = async () => {
    if (!capturedImage) return;

    try {
      setIsSaving(true);
      setFeedbackMessage(null);

      const result = await saveDatasetSampleAsync({
        imageUri: capturedImage.uri,
        base64Data: capturedImage.base64,
        label: selectedLabel,
        lightingCondition: lighting,
        orientation,
        distanceCategory: distance,
        resolutionWidth: capturedImage.width || 1080,
        resolutionHeight: capturedImage.height || 1920,
        notes: notes.trim(),
      });

      if (result.success) {
        setFeedbackMessage({
          type: 'success',
          text: `✓ ${result.message}`,
        });
        await loadData();
        // Reset capture for next shot
        setCapturedImage(null);
        setImageHash('');
        setNotes('');
      } else if (result.status === 'duplicate_rejected') {
        setFeedbackMessage({
          type: 'warning',
          text: `⚠️ ${result.message}`,
        });
        await loadData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: `❌ ${result.message}`,
        });
      }
    } catch (err: any) {
      console.error('Save sample error:', err);
      Alert.alert('Save Error', err?.message || 'Failed to save dataset sample.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Retake
  const handleRetake = () => {
    setCapturedImage(null);
    setImageHash('');
    setFeedbackMessage(null);
  };

  // Handle CSV Export
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const csv = await exportDatasetManifestCsvAsync();
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'camera_domain_manifest.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Export Successful', `Exported ${stats.totalCount} samples to CSV file.`);
      } else {
        Alert.alert(
          'Export Complete',
          `CSV manifest saved to: ${getDatasetStorageLocation()}camera_domain_manifest.csv\nTotal records: ${stats.totalCount}`
        );
      }
    } catch (err: any) {
      console.error('Export CSV error:', err);
      Alert.alert('Export Failed', err?.message || 'Could not export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle JSON Export
  const handleExportJson = async () => {
    try {
      setIsExporting(true);
      const jsonStr = await exportDatasetManifestJsonAsync();
      if (Platform.OS === 'web') {
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'camera_domain_manifest.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Export Successful', `Exported ${stats.totalCount} samples to JSON manifest.`);
      } else {
        Alert.alert(
          'Export Complete',
          `JSON manifest saved to: ${getDatasetStorageLocation()}manifest.json\nTotal records: ${stats.totalCount}`
        );
      }
    } catch (err: any) {
      console.error('Export JSON error:', err);
      Alert.alert('Export Failed', err?.message || 'Could not export JSON.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Delete Sample
  const handleDeleteSample = async (imageId: string) => {
    const doDelete = async () => {
      const ok = await deleteDatasetSampleAsync(imageId);
      if (ok) {
        setFeedbackMessage({
          type: 'success',
          text: `Sample ${imageId} removed.`,
        });
        await loadData();
      } else {
        Alert.alert('Error', 'Could not delete sample.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete sample ${imageId}?`)) {
        await doDelete();
      }
    } else {
      Alert.alert('Delete Sample', `Are you sure you want to remove ${imageId}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Handle Clear Dataset
  const handleClearDataset = async () => {
    const doClear = async () => {
      await clearDatasetSamplesAsync();
      setFeedbackMessage({
        type: 'warning',
        text: 'Dataset samples have been cleared.',
      });
      await loadData();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Reset all collected dataset samples and duplicate records?')) {
        await doClear();
      }
    } else {
      Alert.alert(
        'Clear Dataset',
        'Reset all collected dataset samples and duplicate counters on this device?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear All', style: 'destructive', onPress: doClear },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            {!isTab && (
              <Pressable
                style={styles.backButton}
                onPress={() => router.back()}
                accessibilityLabel="Back"
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </Pressable>
            )}
            <View style={styles.headerTitles}>
              <Text style={styles.headerCategory}>PROTOTYPE DATA COLLECTION</Text>
              <Text style={styles.headerTitle}>Camera-Domain Dataset Mode</Text>
            </View>
          </View>

          {/* Collection Dashboard Summary Card */}
          <View style={styles.dashboardCard}>
            <Text style={styles.dashboardTitle}>DATASET PROGRESS (160 MINIMUM TARGET)</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Lateral Flow Cassette</Text>
                <Text style={styles.progressCount}>
                  {stats.cassetteCount} <Text style={styles.targetCount}>/ 80 target</Text>
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, (stats.cassetteCount / 80) * 100)}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Non-Test Object</Text>
                <Text style={styles.progressCount}>
                  {stats.nonTestCount} <Text style={styles.targetCount}>/ 80 target</Text>
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, (stats.nonTestCount / 80) * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.dashboardFooter}>
              <Text style={styles.dashboardStatText}>
                Total Samples: <Text style={{ fontWeight: '700' }}>{stats.totalCount}</Text>
              </Text>
              <Text style={styles.dashboardStatText}>
                Duplicates Rejected: <Text style={{ fontWeight: '700' }}>{stats.duplicatesRejected}</Text>
              </Text>
            </View>

            {/* Storage Location Badge */}
            <View style={styles.storageLocationBox}>
              <Text style={styles.storageLocationLabel}>Storage:</Text>
              <Text style={styles.storageLocationText} numberOfLines={1}>
                {getDatasetStorageLocation()}
              </Text>
            </View>
          </View>

          {/* Non-Diagnostic Disclaimer */}
          <View style={styles.disclaimerBanner}>
            <Text style={styles.disclaimerText}>
              🛡️ <Text style={{ fontWeight: '700' }}>Non-Diagnostic Safeguard:</Text> This collection
              is strictly for training a visual object-format classifier (cassette vs. non-test object).
              It does NOT detect drugs, substances, or chemical reactions.
            </Text>
          </View>

          {/* Step 1: Select Label */}
          <Text style={styles.sectionHeader}>1. SELECT DATASET LABEL</Text>
          <View style={styles.labelSelector}>
            <Pressable
              style={[
                styles.labelOption,
                selectedLabel === 'lateral_flow_cassette' && styles.labelOptionSelected,
              ]}
              onPress={() => setSelectedLabel('lateral_flow_cassette')}
            >
              <Text
                style={[
                  styles.labelOptionText,
                  selectedLabel === 'lateral_flow_cassette' && styles.labelOptionTextSelected,
                ]}
              >
                🔬 Lateral Flow Cassette
              </Text>
              <Text style={styles.labelOptionHint}>Test kit plastic housing with window</Text>
            </Pressable>

            <Pressable
              style={[
                styles.labelOption,
                selectedLabel === 'non_test_object' && styles.labelOptionSelected,
              ]}
              onPress={() => setSelectedLabel('non_test_object')}
            >
              <Text
                style={[
                  styles.labelOptionText,
                  selectedLabel === 'non_test_object' && styles.labelOptionTextSelected,
                ]}
              >
                📦 Non-Test Object
              </Text>
              <Text style={styles.labelOptionHint}>Paper, pen, card, desk, mug, etc.</Text>
            </Pressable>
          </View>

          {/* Step 2: Metadata Selection */}
          <Text style={styles.sectionHeader}>2. CAPTURE CONDITIONS & METADATA</Text>
          <View style={styles.metadataCard}>
            {/* Lighting */}
            <Text style={styles.metaLabel}>Lighting Condition</Text>
            <View style={styles.chipRow}>
              {(['indoor_normal', 'warm_light', 'daylight', 'mild_shadow', 'low_light'] as LightingCondition[]).map(
                (l) => (
                  <Pressable
                    key={l}
                    style={[styles.chip, lighting === l && styles.chipSelected]}
                    onPress={() => setLighting(l)}
                  >
                    <Text style={[styles.chipText, lighting === l && styles.chipTextSelected]}>
                      {l.replace('_', ' ')}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            {/* Distance */}
            <Text style={[styles.metaLabel, { marginTop: 12 }]}>Distance Category</Text>
            <View style={styles.chipRow}>
              {(['close', 'medium', 'far'] as DistanceCategory[]).map((d) => (
                <Pressable
                  key={d}
                  style={[styles.chip, distance === d && styles.chipSelected]}
                  onPress={() => setDistance(d)}
                >
                  <Text style={[styles.chipText, distance === d && styles.chipTextSelected]}>
                    {d} {d === 'close' ? '(10-15cm)' : d === 'medium' ? '(15-25cm)' : '(30-40cm)'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Orientation */}
            <Text style={[styles.metaLabel, { marginTop: 12 }]}>Orientation</Text>
            <View style={styles.chipRow}>
              {(['portrait', 'landscape', '15deg_tilt'] as Orientation[]).map((o) => (
                <Pressable
                  key={o}
                  style={[styles.chip, orientation === o && styles.chipSelected]}
                  onPress={() => setOrientation(o)}
                >
                  <Text style={[styles.chipText, orientation === o && styles.chipTextSelected]}>
                    {o.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.metaLabel, { marginTop: 12 }]}>Notes (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Clean white desk, educational blank cassette"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Step 3: Capture / Preview */}
          <Text style={styles.sectionHeader}>3. CAPTURE SAMPLE</Text>

          {feedbackMessage && (
            <View
              style={[
                styles.feedbackBox,
                feedbackMessage.type === 'success' && styles.feedbackSuccess,
                feedbackMessage.type === 'warning' && styles.feedbackWarning,
                feedbackMessage.type === 'error' && styles.feedbackError,
              ]}
            >
              <Text style={styles.feedbackText}>{feedbackMessage.text}</Text>
            </View>
          )}

          {!capturedImage ? (
            <View style={styles.cameraContainer}>
              {permission && permission.granted ? (
                <View style={styles.cameraWrapper}>
                  <CameraView ref={cameraRef} style={styles.camera} facing="back" />
                  <View style={styles.captureOverlay}>
                    <Text style={styles.captureOverlayText}>
                      Framing: {selectedLabel === 'lateral_flow_cassette' ? 'Test Cassette' : 'Non-Test Object'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.permissionBox}>
                  <Text style={styles.permissionText}>Camera permission is required.</Text>
                  <Pressable style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
                onPress={handleCapture}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.captureButtonText}>📷 Capture Dataset Image</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} resizeMode="contain" />

              {/* Sample Metadata Card */}
              <View style={styles.previewMetaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Assigned Label:</Text>
                  <Text style={styles.metaValHighlight}>{selectedLabel}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Resolution:</Text>
                  <Text style={styles.metaVal}>
                    {capturedImage.width || 1080} x {capturedImage.height || 1920} px
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Conditions:</Text>
                  <Text style={styles.metaVal}>
                    {lighting} · {orientation} · {distance}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>SHA-256 Hash:</Text>
                  <Text style={styles.hashText} numberOfLines={2}>
                    {isHashing ? 'Computing digest...' : imageHash}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSaveSample}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>💾 Save to Dataset</Text>
                  )}
                </Pressable>

                <Pressable style={styles.retakeButton} onPress={handleRetake} disabled={isSaving}>
                  <Text style={styles.retakeButtonText}>🔄 Discard & Retake</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 4: Dataset Export & Management Actions */}
          <Text style={styles.sectionHeader}>4. EXPORT & DATASET ACTIONS</Text>
          <View style={styles.exportCard}>
            <View style={styles.exportBtnRow}>
              <Pressable
                style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
                onPress={handleExportCsv}
                disabled={isExporting}
              >
                <Text style={styles.exportBtnText}>📄 Export CSV</Text>
              </Pressable>

              <Pressable
                style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
                onPress={handleExportJson}
                disabled={isExporting}
              >
                <Text style={styles.exportBtnText}>📋 Export JSON</Text>
              </Pressable>

              <Pressable
                style={[styles.clearBtn, isExporting && styles.exportBtnDisabled]}
                onPress={handleClearDataset}
                disabled={isExporting}
              >
                <Text style={styles.clearBtnText}>🗑️ Clear All</Text>
              </Pressable>
            </View>
          </View>

          {/* Step 5: Recent Saved Samples List */}
          <View style={styles.samplesHeaderRow}>
            <Text style={styles.sectionHeader}>5. SAVED SAMPLES ({samplesList.length})</Text>
            <Pressable onPress={loadData}>
              <Text style={styles.refreshLink}>🔄 Refresh</Text>
            </Pressable>
          </View>

          {samplesList.length === 0 ? (
            <View style={styles.emptySamplesBox}>
              <Text style={styles.emptySamplesTitle}>No camera-domain samples collected yet.</Text>
              <Text style={styles.emptySamplesSubtitle}>
                Capture genuine physical test cassettes and harmless everyday objects to build the dataset.
              </Text>
            </View>
          ) : (
            <View style={styles.samplesListContainer}>
              {samplesList.map((sample) => (
                <View key={sample.imageId} style={styles.sampleItemCard}>
                  <View style={styles.sampleItemHeader}>
                    <View style={styles.sampleIdRow}>
                      <Text style={styles.sampleIdText}>{sample.imageId}</Text>
                      <View
                        style={[
                          styles.sampleBadge,
                          sample.label === 'lateral_flow_cassette'
                            ? styles.sampleBadgeCassette
                            : styles.sampleBadgeNonTest,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sampleBadgeText,
                            sample.label === 'lateral_flow_cassette'
                              ? styles.sampleBadgeTextCassette
                              : styles.sampleBadgeTextNonTest,
                          ]}
                        >
                          {sample.label === 'lateral_flow_cassette' ? 'Cassette' : 'Non-Test'}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.deleteSampleBtn}
                      onPress={() => handleDeleteSample(sample.imageId)}
                    >
                      <Text style={styles.deleteSampleBtnText}>✕</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.sampleDetails}>
                    {sample.lightingCondition} · {sample.orientation} · {sample.distanceCategory} ·{' '}
                    {sample.resolutionWidth}x{sample.resolutionHeight}
                  </Text>
                  <Text style={styles.sampleSha} numberOfLines={1}>
                    SHA-256: {sample.sha256}
                  </Text>
                  {sample.notes ? <Text style={styles.sampleNotes}>"{sample.notes}"</Text> : null}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  headerTitles: {
    flex: 1,
  },
  headerCategory: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#0F766E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  dashboardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#475569',
    marginBottom: 10,
  },
  progressRow: {
    gap: 10,
    marginBottom: 10,
  },
  progressItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  progressCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  targetCount: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 3,
  },
  dashboardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dashboardStatText: {
    fontSize: 11,
    color: '#64748B',
  },
  storageLocationBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageLocationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  storageLocationText: {
    fontSize: 10,
    color: '#0F766E',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
  },
  disclaimerBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#334155',
    marginBottom: 8,
    marginTop: 4,
  },
  labelSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  labelOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  labelOptionSelected: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  labelOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  labelOptionTextSelected: {
    color: '#0F766E',
  },
  labelOptionHint: {
    fontSize: 11,
    color: '#64748B',
  },
  metadataCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  cameraContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraWrapper: {
    width: '100%',
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    marginBottom: 12,
  },
  camera: {
    flex: 1,
  },
  captureOverlay: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  captureOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  permissionBox: {
    padding: 30,
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  permissionButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  captureButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    marginBottom: 12,
  },
  previewMetaCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaKey: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '600',
  },
  metaValHighlight: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '700',
  },
  hashText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
    maxWidth: '65%',
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  feedbackSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
  },
  feedbackWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  exportCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  exportBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  samplesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  emptySamplesBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptySamplesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  emptySamplesSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  samplesListContainer: {
    gap: 8,
    marginBottom: 20,
  },
  sampleItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  sampleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sampleIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sampleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleBadgeCassette: {
    backgroundColor: '#CCFBF1',
  },
  sampleBadgeNonTest: {
    backgroundColor: '#F1F5F9',
  },
  sampleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sampleBadgeTextCassette: {
    color: '#0F766E',
  },
  sampleBadgeTextNonTest: {
    color: '#475569',
  },
  deleteSampleBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  deleteSampleBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  sampleDetails: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  sampleSha: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#94A3B8',
  },
  sampleNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
    marginTop: 4,
  },
});
