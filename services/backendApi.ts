import { Platform } from 'react-native';
import {
  FieldTestRecord,
  getPendingSyncRecordsAsync,
  getSettingAsync,
  setSettingAsync,
  updateRecordSyncStatusAsync,
  type SyncStatusType,
} from './database';

const SETTING_BACKEND_URL_KEY = 'backend_url';
const SETTING_AUTH_TOKEN_KEY = 'auth_token';

/**
 * Returns the default backend URL based on execution platform:
 * - Android Emulator: http://10.0.2.2:8000 (standard loopback to host PC)
 * - iOS Simulator / Web / Desktop: http://localhost:8000
 */
export function getDefaultBackendUrl(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.trim().replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

/**
 * Retrieves the configured backend base URL (from SQLite/local storage with platform fallback).
 */
export async function getBackendBaseUrl(): Promise<string> {
  const savedUrl = await getSettingAsync(SETTING_BACKEND_URL_KEY, '');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }
  return getDefaultBackendUrl();
}

/**
 * Persists a custom backend base URL (e.g. PC LAN IP: http://192.168.1.100:8000).
 */
export async function setBackendBaseUrl(url: string): Promise<void> {
  const sanitized = (url || '').trim().replace(/\/+$/, '');
  await setSettingAsync(SETTING_BACKEND_URL_KEY, sanitized);
}

export async function getAuthTokenAsync(): Promise<string> {
  return await getSettingAsync(SETTING_AUTH_TOKEN_KEY, '');
}

export async function setAuthTokenAsync(token: string): Promise<void> {
  await setSettingAsync(SETTING_AUTH_TOKEN_KEY, token);
}

export async function loginAsync(username: string, password: string):Promise<{ok: boolean, token?: string, error?: string, role?: string}> {
  const baseUrl = await getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/auth/token`;
  
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: formData,
    });
    
    if (response.ok) {
      const data = await response.json();
      await setAuthTokenAsync(data.access_token);
      return { ok: true, token: data.access_token, role: data.role };
    } else {
      return { ok: false, error: 'Invalid username or password' };
    }
  } catch (error: any) {
    return { ok: false, error: error.message || 'Network error' };
  }
}

export interface BackendHealthResult {
  ok: boolean;
  message: string;
  url: string;
  details?: any;
}

/**
 * Test connectivity and health of the configured backend server.
 */
export async function testBackendConnectionAsync(customUrl?: string): Promise<BackendHealthResult> {
  const baseUrl = customUrl ? customUrl.trim().replace(/\/+$/, '') : await getBackendBaseUrl();
  const endpoint = `${baseUrl}/health`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        ok: true,
        message: 'Backend connection established successfully.',
        url: baseUrl,
        details: data,
      };
    } else {
      return {
        ok: false,
        message: `Server returned HTTP ${response.status} (${response.statusText})`,
        url: baseUrl,
      };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    return {
      ok: false,
      message: isTimeout
        ? 'Connection timed out (server unreachable).'
        : `Could not reach backend at ${baseUrl}: ${error.message || String(error)}`,
      url: baseUrl,
    };
  }
}

export interface RecordSyncResult {
  status: 'synced' | 'already_synced' | 'conflict' | 'rejected' | 'network_unavailable';
  recordId: string;
  message: string;
  recordHash?: string | null;
  previousRecordHash?: string | null;
  sequenceNumber?: number;
}

import * as FileSystem from 'expo-file-system';

/**
 * Uploads an image payload to the backend and verifies its cryptographic hash.
 */
export async function uploadImageAsync(imageUri: string, expectedHash: string): Promise<boolean> {
  const baseUrl = await getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/images`;
  const token = await getAuthTokenAsync();

  const filename = imageUri.split('/').pop() || `${expectedHash}.jpg`;

  try {
    const uploadResult = await FileSystem.uploadAsync(endpoint, imageUri, {
      httpMethod: 'POST',
      uploadType: (FileSystem as any).FileSystemUploadType?.MULTIPART ?? (FileSystem as any).UploadType?.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Bypass-Tunnel-Reminder': 'true'
      },
    });

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      const data = JSON.parse(uploadResult.body);
      if (data.image_sha256 === expectedHash) {
        return true;
      } else {
        console.warn(`Hash mismatch! Expected: ${expectedHash}, Got: ${data.image_sha256}`);
        return false;
      }
    } else {
      console.warn(`Failed to upload image. Status: ${uploadResult.status}`);
      return false;
    }
  } catch (error) {
    console.warn('Network error during image upload:', error);
    return false;
  }
}

/**
 * Attempt to send a single field test evidence record to POST /api/records.
 * Automatically handles conflicts, idempotency, and network failures.
 */
export async function sendRecordToBackendAsync(record: FieldTestRecord): Promise<RecordSyncResult> {
  
  // 1. Upload Evidence Image Payload First
  if (record.imageUri && record.imageHash) {
    const uploadSuccess = await uploadImageAsync(record.imageUri, record.imageHash);
    if (!uploadSuccess) {
      return {
        status: 'network_unavailable',
        recordId: record.id,
        message: 'Could not upload evidence image. Record saved locally.',
      };
    }
  }

  const baseUrl = await getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/records`;
  const token = await getAuthTokenAsync();

  const payload = {
    id: record.id,
    referenceId: record.referenceId || record.sampleName,
    operatorId: record.operatorId || 'Unassigned',
    createdAt: record.createdAt,
    latitude: record.latitude,
    longitude: record.longitude,
    locationStatus: record.locationStatus,
    imageHash: record.imageHash,
    presumptiveStatus: record.presumptiveStatus,
    analysisStatus: record.analysisStatus,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // 1. Success (HTTP 201 Created)
    if (response.status === 201) {
      const data = await response.json();
      return {
        status: 'synced',
        recordId: record.id,
        message: 'Record successfully linked into Hash-Linked Chain of Custody.',
        recordHash: data.record_hash,
        previousRecordHash: data.previous_record_hash,
        sequenceNumber: data.sequence_number,
      };
    }

    // 2. Conflict or Duplicate (HTTP 409 Conflict)
    if (response.status === 409) {
      // Use /api/sync to determine if it's an idempotent duplicate or true data conflict
      const syncResult = await syncBatchWithBackendAsync([record]);
      if (syncResult.ok && syncResult.results.length > 0) {
        const item = syncResult.results[0];
        return {
          status: item.status as any,
          recordId: record.id,
          message: item.message,
          recordHash: item.record_hash,
        };
      }
      return {
        status: 'conflict',
        recordId: record.id,
        message: 'Conflict: Record ID already exists on server with conflicting data.',
      };
    }

    // 3. Validation Failure (HTTP 422 or 400)
    if (response.status === 422 || response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      return {
        status: 'rejected',
        recordId: record.id,
        message: `Validation error: ${JSON.stringify(errorData?.detail || 'Payload rejected.')}`,
      };
    }

    // 4. Other Server Error
    return {
      status: 'network_unavailable',
      recordId: record.id,
      message: `Server returned unexpected HTTP ${response.status}`,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      status: 'network_unavailable',
      recordId: record.id,
      message: error.name === 'AbortError'
        ? 'Network request timed out. Record saved locally.'
        : `Network unavailable (${error.message || 'Offline'}). Record saved locally.`,
    };
  }
}

export interface BatchSyncSummary {
  ok: boolean;
  totalReceived: number;
  syncedCount: number;
  alreadySyncedCount: number;
  conflictCount: number;
  results: Array<{
    record_id: string;
    status: 'synced' | 'already_synced' | 'conflict';
    message: string;
    record_hash?: string | null;
  }>;
  error?: string;
}

/**
 * Synchronize a batch of offline records via POST /api/sync.
 */
export async function syncBatchWithBackendAsync(records: FieldTestRecord[]): Promise<BatchSyncSummary> {
  if (!records || records.length === 0) {
    return {
      ok: true,
      totalReceived: 0,
      syncedCount: 0,
      alreadySyncedCount: 0,
      conflictCount: 0,
      results: [],
    };
  }
  
  // 1. Upload Images for all pending records in batch sequentially
  for (const record of records) {
    if (record.imageUri && record.imageHash) {
      await uploadImageAsync(record.imageUri, record.imageHash);
      // We don't fail the whole batch if one image fails. 
      // The backend will reject that specific record gracefully during sync if image is missing.
    }
  }

  const baseUrl = await getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/sync`;
  const token = await getAuthTokenAsync();

  const payload = {
    records: records.map((r) => ({
      id: r.id,
      referenceId: r.referenceId || r.sampleName,
      operatorId: r.operatorId || 'Unassigned',
      createdAt: r.createdAt,
      latitude: r.latitude,
      longitude: r.longitude,
      locationStatus: r.locationStatus,
      imageHash: r.imageHash,
      presumptiveStatus: r.presumptiveStatus,
      analysisStatus: r.analysisStatus,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        ok: true,
        totalReceived: data.total_received ?? records.length,
        syncedCount: data.synced_count ?? 0,
        alreadySyncedCount: data.already_synced_count ?? 0,
        conflictCount: data.conflict_count ?? 0,
        results: data.results ?? [],
      };
    } else {
      return {
        ok: false,
        totalReceived: records.length,
        syncedCount: 0,
        alreadySyncedCount: 0,
        conflictCount: 0,
        results: [],
        error: `Server error: HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      totalReceived: records.length,
      syncedCount: 0,
      alreadySyncedCount: 0,
      conflictCount: 0,
      results: [],
      error: error.message || 'Network request failed',
    };
  }
}

export interface SyncExecutionReport {
  total: number;
  synced: number;
  alreadySynced: number;
  conflict: number;
  failed: number;
  success: boolean;
  message: string;
}

/**
 * Automatically fetch all pending or unsynced records from SQLite and sync with the backend.
 * Updates local SQLite record statuses and cryptographic hashes accordingly.
 */
export async function syncPendingRecordsAsync(): Promise<SyncExecutionReport> {
  try {
    const pending = await getPendingSyncRecordsAsync();
    if (pending.length === 0) {
      return {
        total: 0,
        synced: 0,
        alreadySynced: 0,
        conflict: 0,
        failed: 0,
        success: true,
        message: 'All local records are already synchronized.',
      };
    }

    const batchResult = await syncBatchWithBackendAsync(pending);

    if (!batchResult.ok) {
      return {
        total: pending.length,
        synced: 0,
        alreadySynced: 0,
        conflict: 0,
        failed: pending.length,
        success: false,
        message: batchResult.error || 'Network error: could not reach backend server.',
      };
    }

    let syncedCount = 0;
    let alreadySyncedCount = 0;
    let conflictCount = 0;

    for (const item of batchResult.results) {
      if (item.status === 'synced') {
        syncedCount += 1;
        await updateRecordSyncStatusAsync(item.record_id, 'synced', item.record_hash);
      } else if (item.status === 'already_synced') {
        alreadySyncedCount += 1;
        await updateRecordSyncStatusAsync(item.record_id, 'synced', item.record_hash);
      } else if (item.status === 'conflict') {
        conflictCount += 1;
        await updateRecordSyncStatusAsync(item.record_id, 'conflict', item.record_hash);
      }
    }

    return {
      total: pending.length,
      synced: syncedCount,
      alreadySynced: alreadySyncedCount,
      conflict: conflictCount,
      failed: 0,
      success: true,
      message: `Sync completed: ${syncedCount} newly synced, ${alreadySyncedCount} already synced, ${conflictCount} conflicts.`,
    };
  } catch (error: any) {
    console.error('Error during batch sync:', error);
    return {
      total: 0,
      synced: 0,
      alreadySynced: 0,
      conflict: 0,
      failed: 0,
      success: false,
      message: `Sync error: ${error?.message || String(error)}`,
    };
  }
}
