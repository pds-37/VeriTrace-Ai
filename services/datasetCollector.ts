import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { computeImageSha256Async } from './imageHash';

export type DatasetLabel = 'lateral_flow_cassette' | 'non_test_object';
export type LightingCondition =
  | 'indoor_normal'
  | 'warm_light'
  | 'daylight'
  | 'mild_shadow'
  | 'low_light';
export type Orientation = 'portrait' | 'landscape' | '15deg_tilt';
export type DistanceCategory = 'close' | 'medium' | 'far';

export interface DatasetSampleMetadata {
  imageId: string;
  label: DatasetLabel;
  source: 'project_real_capture';
  deviceModel: string;
  osVersion: string;
  lightingCondition: LightingCondition;
  orientation: Orientation;
  distanceCategory: DistanceCategory;
  resolutionWidth: number;
  resolutionHeight: number;
  timestamp: string;
  sha256: string;
  provenance: 'captured_internally_with_non_hazardous_demo_object';
  notes: string;
  imageUri: string;
}

export interface DatasetStats {
  cassetteCount: number;
  nonTestCount: number;
  totalCount: number;
  duplicatesRejected: number;
  lastSample: DatasetSampleMetadata | null;
}

export interface SaveSampleResult {
  success: boolean;
  status: 'saved' | 'duplicate_rejected' | 'error';
  message: string;
  sample?: DatasetSampleMetadata;
  sha256?: string;
}

const STORAGE_KEY_SAMPLES = 'FTC_CAMERA_DOMAIN_SAMPLES';
const STORAGE_KEY_DUPLICATES = 'FTC_CAMERA_DOMAIN_DUPLICATES';

// In-memory fallback for environments without localStorage / disk
let inMemorySamples: DatasetSampleMetadata[] = [];
let inMemoryDuplicatesCount = 0;

/**
 * Load all saved dataset samples from local storage or memory.
 */
export async function getAllDatasetSamplesAsync(): Promise<DatasetSampleMetadata[]> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY_SAMPLES);
        if (raw) {
          return JSON.parse(raw) as DatasetSampleMetadata[];
        }
      }
      return inMemorySamples;
    } else {
      // Native FileSystem storage
      const manifestDir = `${FileSystem.documentDirectory}camera_domain_dataset/`;
      const manifestFile = `${manifestDir}manifest.json`;
      const fileInfo = await FileSystem.getInfoAsync(manifestFile);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(manifestFile);
        return JSON.parse(content) as DatasetSampleMetadata[];
      }
      return [];
    }
  } catch (error) {
    console.warn('Failed to load camera-domain dataset samples:', error);
    return inMemorySamples;
  }
}

/**
 * Get current duplicate rejection count.
 */
export async function getDuplicatesRejectedCountAsync(): Promise<number> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(STORAGE_KEY_DUPLICATES);
        return val ? parseInt(val, 10) : 0;
      }
      return inMemoryDuplicatesCount;
    } else {
      const countFile = `${FileSystem.documentDirectory}camera_domain_dataset/duplicates.txt`;
      const info = await FileSystem.getInfoAsync(countFile);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(countFile);
        return parseInt(content, 10) || 0;
      }
      return 0;
    }
  } catch {
    return inMemoryDuplicatesCount;
  }
}

/**
 * Increment duplicate count when a duplicate hash is rejected.
 */
async function incrementDuplicatesRejectedAsync(): Promise<number> {
  const current = await getDuplicatesRejectedCountAsync();
  const next = current + 1;
  inMemoryDuplicatesCount = next;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_DUPLICATES, next.toString());
      }
    } else {
      const manifestDir = `${FileSystem.documentDirectory}camera_domain_dataset/`;
      await FileSystem.makeDirectoryAsync(manifestDir, { intermediates: true });
      await FileSystem.writeAsStringAsync(`${manifestDir}duplicates.txt`, next.toString());
    }
  } catch (err) {
    console.warn('Could not persist duplicate count:', err);
  }
  return next;
}

/**
 * Computes current dataset statistics.
 */
export async function getDatasetStatsAsync(): Promise<DatasetStats> {
  const samples = await getAllDatasetSamplesAsync();
  const duplicatesRejected = await getDuplicatesRejectedCountAsync();

  let cassetteCount = 0;
  let nonTestCount = 0;

  for (const s of samples) {
    if (s.label === 'lateral_flow_cassette') {
      cassetteCount++;
    } else if (s.label === 'non_test_object') {
      nonTestCount++;
    }
  }

  const lastSample = samples.length > 0 ? samples[samples.length - 1] : null;

  return {
    cassetteCount,
    nonTestCount,
    totalCount: samples.length,
    duplicatesRejected,
    lastSample,
  };
}

/**
 * Saves a newly captured genuine dataset sample after computing SHA-256 and checking for duplicates.
 */
export async function saveDatasetSampleAsync(params: {
  imageUri: string;
  base64Data?: string;
  label: DatasetLabel;
  deviceModel?: string;
  osVersion?: string;
  lightingCondition: LightingCondition;
  orientation: Orientation;
  distanceCategory: DistanceCategory;
  resolutionWidth: number;
  resolutionHeight: number;
  notes?: string;
}): Promise<SaveSampleResult> {
  try {
    // 1. Compute instant SHA-256 hash
    const sha256 = await computeImageSha256Async(params.imageUri, params.base64Data);
    if (!sha256 || sha256 === 'UNAVAILABLE') {
      return {
        success: false,
        status: 'error',
        message: 'Failed to compute SHA-256 hash from image stream.',
      };
    }

    // 2. Duplicate Detection: Check if hash already exists in dataset
    const existingSamples = await getAllDatasetSamplesAsync();
    const isDuplicate = existingSamples.some((s) => s.sha256.toLowerCase() === sha256.toLowerCase());

    if (isDuplicate) {
      await incrementDuplicatesRejectedAsync();
      return {
        success: false,
        status: 'duplicate_rejected',
        message: 'Duplicate image detected (identical SHA-256 hash) — sample not added.',
        sha256,
      };
    }

    // 3. Generate structured Unique Sample ID
    const prefix = params.label === 'lateral_flow_cassette' ? 'CAM_CAS' : 'CAM_NON';
    const timestampStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const imageId = `${prefix}_${timestampStr}_${randomSuffix}`;

    // 4. Save Image locally
    let persistedImageUri = params.imageUri;

    if (Platform.OS !== 'web' && params.imageUri.startsWith('file:')) {
      try {
        const destDir = `${FileSystem.documentDirectory}camera_domain_dataset/images/${params.label}/`;
        await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
        const destUri = `${destDir}${imageId}.jpg`;
        await FileSystem.copyAsync({ from: params.imageUri, to: destUri });
        persistedImageUri = destUri;
      } catch (fileErr) {
        console.warn('Could not copy file locally, using original URI:', fileErr);
      }
    }

    // 5. Construct full metadata record
    const newSample: DatasetSampleMetadata = {
      imageId,
      label: params.label,
      source: 'project_real_capture',
      deviceModel: params.deviceModel || (Platform.OS === 'ios' ? 'Apple Device' : 'Android Device'),
      osVersion: params.osVersion || `${Platform.OS} ${Platform.Version || ''}`.trim(),
      lightingCondition: params.lightingCondition,
      orientation: params.orientation,
      distanceCategory: params.distanceCategory,
      resolutionWidth: params.resolutionWidth || 1080,
      resolutionHeight: params.resolutionHeight || 1920,
      timestamp: new Date().toISOString(),
      sha256,
      provenance: 'captured_internally_with_non_hazardous_demo_object',
      notes: params.notes || '',
      imageUri: persistedImageUri,
    };

    // 6. Persist to storage
    const updatedSamples = [...existingSamples, newSample];
    inMemorySamples = updatedSamples;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_SAMPLES, JSON.stringify(updatedSamples));
      }
    } else {
      const manifestDir = `${FileSystem.documentDirectory}camera_domain_dataset/`;
      await FileSystem.makeDirectoryAsync(manifestDir, { intermediates: true });
      await FileSystem.writeAsStringAsync(
        `${manifestDir}manifest.json`,
        JSON.stringify(updatedSamples, null, 2)
      );

      // Also append to CSV
      const csvLine = [
        newSample.imageId,
        newSample.label,
        newSample.source,
        `"${newSample.deviceModel.replace(/"/g, '""')}"`,
        `"${newSample.osVersion.replace(/"/g, '""')}"`,
        newSample.lightingCondition,
        newSample.orientation,
        newSample.distanceCategory,
        newSample.resolutionWidth,
        newSample.resolutionHeight,
        newSample.timestamp,
        newSample.sha256,
        newSample.provenance,
        `"${newSample.notes.replace(/"/g, '""')}"`,
      ].join(',');

      const csvFile = `${manifestDir}camera_domain_manifest.csv`;
      const csvExists = (await FileSystem.getInfoAsync(csvFile)).exists;
      if (!csvExists) {
        const header =
          'image_id,label,source,device_model,os_version,lighting_condition,orientation,distance_category,resolution_width,resolution_height,timestamp,sha256,provenance,notes\n';
        await FileSystem.writeAsStringAsync(csvFile, header + csvLine + '\n');
      } else {
        const existingCsv = await FileSystem.readAsStringAsync(csvFile);
        await FileSystem.writeAsStringAsync(csvFile, existingCsv + csvLine + '\n');
      }
    }

    return {
      success: true,
      status: 'saved',
      message: `Sample saved successfully as ${imageId}.`,
      sample: newSample,
      sha256,
    };
  } catch (error: any) {
    console.error('Error saving dataset sample:', error);
    return {
      success: false,
      status: 'error',
      message: error?.message || 'An unexpected error occurred while saving dataset sample.',
    };
  }
}

/**
 * Generates an exported CSV string of all genuine samples.
 */
export async function exportDatasetManifestCsvAsync(): Promise<string> {
  const samples = await getAllDatasetSamplesAsync();
  const header =
    'image_id,label,source,device_model,os_version,lighting_condition,orientation,distance_category,resolution_width,resolution_height,timestamp,sha256,provenance,notes\n';
  const rows = samples.map((s) =>
    [
      s.imageId,
      s.label,
      s.source,
      `"${s.deviceModel.replace(/"/g, '""')}"`,
      `"${s.osVersion.replace(/"/g, '""')}"`,
      s.lightingCondition,
      s.orientation,
      s.distanceCategory,
      s.resolutionWidth,
      s.resolutionHeight,
      s.timestamp,
      s.sha256,
      s.provenance,
      `"${s.notes.replace(/"/g, '""')}"`,
    ].join(',')
  );

  return header + rows.join('\n');
}

/**
 * Generates an exported JSON manifest string formatted according to the dataset schema.
 */
export async function exportDatasetManifestJsonAsync(): Promise<string> {
  const samples = await getAllDatasetSamplesAsync();
  const stats = await getDatasetStatsAsync();

  const manifest = {
    dataset_name: 'Field Test Companion Camera-Domain Dataset',
    exported_at: new Date().toISOString(),
    task: 'non_diagnostic_object_format_classification',
    classes: ['lateral_flow_cassette', 'non_test_object'],
    description:
      'Camera-domain dataset captured via mobile device hardware. Contains strictly non-diagnostic visual object format photos.',
    counts: {
      lateral_flow_cassette: stats.cassetteCount,
      non_test_object: stats.nonTestCount,
      total: stats.totalCount,
      duplicates_rejected: stats.duplicatesRejected,
    },
    images: samples.map((s) => ({
      image_id: s.imageId,
      label: s.label,
      source: s.source,
      device_model: s.deviceModel,
      os_version: s.osVersion,
      lighting_condition: s.lightingCondition,
      orientation: s.orientation,
      distance_category: s.distanceCategory,
      resolution: `${s.resolutionWidth}x${s.resolutionHeight}`,
      timestamp: s.timestamp,
      sha256: s.sha256,
      provenance: s.provenance,
      notes: s.notes,
      image_uri: s.imageUri,
    })),
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Deletes a single dataset sample by imageId.
 */
export async function deleteDatasetSampleAsync(imageId: string): Promise<boolean> {
  try {
    const samples = await getAllDatasetSamplesAsync();
    const target = samples.find((s) => s.imageId === imageId);
    if (!target) return false;

    const filtered = samples.filter((s) => s.imageId !== imageId);
    inMemorySamples = filtered;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_SAMPLES, JSON.stringify(filtered));
      }
    } else {
      const manifestDir = `${FileSystem.documentDirectory}camera_domain_dataset/`;
      await FileSystem.writeAsStringAsync(
        `${manifestDir}manifest.json`,
        JSON.stringify(filtered, null, 2)
      );

      // Re-write CSV
      const header =
        'image_id,label,source,device_model,os_version,lighting_condition,orientation,distance_category,resolution_width,resolution_height,timestamp,sha256,provenance,notes\n';
      const rows = filtered.map((s) =>
        [
          s.imageId,
          s.label,
          s.source,
          `"${s.deviceModel.replace(/"/g, '""')}"`,
          `"${s.osVersion.replace(/"/g, '""')}"`,
          s.lightingCondition,
          s.orientation,
          s.distanceCategory,
          s.resolutionWidth,
          s.resolutionHeight,
          s.timestamp,
          s.sha256,
          s.provenance,
          `"${s.notes.replace(/"/g, '""')}"`,
        ].join(',')
      );
      await FileSystem.writeAsStringAsync(`${manifestDir}camera_domain_manifest.csv`, header + rows.join('\n') + '\n');

      // Attempt to delete image file
      if (target.imageUri && target.imageUri.startsWith('file:')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(target.imageUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(target.imageUri, { idempotent: true });
          }
        } catch (delErr) {
          console.warn('Could not delete image file:', delErr);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting dataset sample:', error);
    return false;
  }
}

/**
 * Resets/clears all stored camera-domain dataset samples and duplicate counter.
 */
export async function clearDatasetSamplesAsync(): Promise<void> {
  inMemorySamples = [];
  inMemoryDuplicatesCount = 0;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY_SAMPLES);
      window.localStorage.removeItem(STORAGE_KEY_DUPLICATES);
    }
  } else {
    try {
      const manifestDir = `${FileSystem.documentDirectory}camera_domain_dataset/`;
      const info = await FileSystem.getInfoAsync(manifestDir);
      if (info.exists) {
        await FileSystem.deleteAsync(manifestDir, { idempotent: true });
      }
    } catch (err) {
      console.warn('Could not clear dataset folder:', err);
    }
  }
}

/**
 * Returns a human-readable description of where dataset samples are persisted.
 */
export function getDatasetStorageLocation(): string {
  if (Platform.OS === 'web') {
    return 'Web LocalStorage (Key: FTC_CAMERA_DOMAIN_SAMPLES)';
  }
  return `${FileSystem.documentDirectory}camera_domain_dataset/`;
}

