export type SyncStatusType = 'local_only' | 'pending' | 'synced' | 'conflict' | 'rejected';
export type OutcomeCategoryType = 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';

export interface FieldTestRecord {
  id: string;
  referenceId: string;
  sampleName?: string;
  imageUri: string;
  createdAt: string;
  analysisStatus: string;
  presumptiveStatus: string;
  syncStatus: SyncStatusType;
  latitude: number | null;
  longitude: number | null;
  locationStatus: 'available' | 'unavailable' | 'permission_denied' | string;
  operatorId: string;
  imageHash: string;
  serverRecordHash?: string | null;
  serverPrevHash?: string | null;
  syncedAt?: string | null;

  // Evidentiary & Reagent additions
  kitType?: string;
  outcomeCategory?: OutcomeCategoryType | string;
  presumptiveSubstance?: string;
  confidenceScore?: number | null;
  calibratedRgb?: string | null;
  rawRgb?: string | null;
  referenceCardCalibrated?: boolean;
  digitalSignature?: string;
  signatureVerified?: boolean;
}

const STORAGE_KEY = 'field_test_records';
const SETTINGS_KEY = 'field_test_settings';
let memoryStorage: FieldTestRecord[] = [];
let memorySettings: Record<string, string> = {};

/**
 * Generate a unique local record ID.
 */
export function generateRecordId(): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `REC-${timestamp}-${randomPart}`;
}

/**
 * Helper to get records from browser localStorage or memory.
 */
function getStoredRecords(): FieldTestRecord[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read from localStorage, using memory:', e);
    }
  }
  return memoryStorage;
}

/**
 * Helper to save records to browser localStorage or memory.
 */
function setStoredRecords(records: FieldTestRecord[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return;
    } catch (e) {
      console.warn('Failed to write to localStorage, using memory:', e);
    }
  }
  memoryStorage = records;
}

/**
 * Web database initialization stub.
 */
export async function getDatabaseAsync(): Promise<boolean> {
  return true;
}

/**
 * Save a new field test record to web persistent storage (localStorage).
 */
export async function saveFieldTestRecordAsync(params: {
  id?: string;
  referenceId?: string;
  sampleName?: string;
  imageUri: string;
  latitude?: number | null;
  longitude?: number | null;
  locationStatus?: string;
  operatorId?: string;
  imageHash?: string;
  analysisStatus?: string;
  presumptiveStatus?: string;
  syncStatus?: SyncStatusType;
  serverRecordHash?: string | null;
  serverPrevHash?: string | null;
  syncedAt?: string | null;
  kitType?: string;
  outcomeCategory?: OutcomeCategoryType | string;
  presumptiveSubstance?: string;
  confidenceScore?: number | null;
  calibratedRgb?: string | null;
  rawRgb?: string | null;
  referenceCardCalibrated?: boolean;
  digitalSignature?: string;
  signatureVerified?: boolean;
}): Promise<FieldTestRecord> {
  const name = (params.sampleName || params.referenceId || '').trim();

  const hasCoords = params.latitude !== undefined && params.latitude !== null &&
                    params.longitude !== undefined && params.longitude !== null;

  const locationStatus = params.locationStatus
    ? params.locationStatus
    : (hasCoords ? 'available' : 'unavailable');

  const record: FieldTestRecord = {
    id: params.id?.trim() || generateRecordId(),
    referenceId: name,
    sampleName: name,
    imageUri: params.imageUri,
    createdAt: new Date().toISOString(),
    analysisStatus: params.analysisStatus || 'completed',
    presumptiveStatus: params.presumptiveStatus || 'Presumptive (Unanalyzed)',
    syncStatus: params.syncStatus || 'pending',
    latitude: hasCoords ? params.latitude! : null,
    longitude: hasCoords ? params.longitude! : null,
    locationStatus,
    operatorId: (params.operatorId || '').trim(),
    imageHash: (params.imageHash || '').trim(),
    serverRecordHash: params.serverRecordHash || null,
    serverPrevHash: params.serverPrevHash || null,
    syncedAt: params.syncedAt || null,
    kitType: params.kitType || 'scott',
    outcomeCategory: params.outcomeCategory || 'INCONCLUSIVE',
    presumptiveSubstance: params.presumptiveSubstance || params.presumptiveStatus || 'Presumptive (Unanalyzed)',
    confidenceScore: params.confidenceScore ?? null,
    calibratedRgb: params.calibratedRgb ?? null,
    rawRgb: params.rawRgb ?? null,
    referenceCardCalibrated: params.referenceCardCalibrated ?? false,
    digitalSignature: params.digitalSignature ?? undefined,
    signatureVerified: params.signatureVerified ?? true,
  };

  try {
    const existing = getStoredRecords();
    const updated = [record, ...existing];
    setStoredRecords(updated);
    return record;
  } catch (error) {
    console.error('Failed to save field test record on web:', error);
    throw new Error('Failed to save record to local web storage.');
  }
}

/**
 * Update the sync status and server hashes of a locally stored record on web.
 */
export async function updateRecordSyncStatusAsync(
  id: string,
  syncStatus: SyncStatusType,
  serverRecordHash?: string | null,
  serverPrevHash?: string | null
): Promise<void> {
  const existing = getStoredRecords();
  const syncedAt = syncStatus === 'synced' ? new Date().toISOString() : null;

  const updated = existing.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        syncStatus,
        serverRecordHash: serverRecordHash !== undefined ? serverRecordHash : r.serverRecordHash,
        serverPrevHash: serverPrevHash !== undefined ? serverPrevHash : r.serverPrevHash,
        syncedAt: syncedAt ?? r.syncedAt,
      };
    }
    return r;
  });

  setStoredRecords(updated);
}

/**
 * Retrieve saved field test records on web with search and filtering.
 */
export async function getFieldTestRecordsAsync(options: {
  searchQuery?: string;
  outcomeCategory?: string;
  kitType?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<FieldTestRecord[]> {
  try {
    const records = getStoredRecords();
    let filtered = records.map((r) => ({
      ...r,
      sampleName: r.sampleName || r.referenceId,
      analysisStatus: r.analysisStatus || 'completed',
      presumptiveStatus: r.presumptiveStatus || 'Presumptive (Unanalyzed)',
      syncStatus: (r.syncStatus as SyncStatusType) || 'pending',
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      locationStatus: r.locationStatus || 'unavailable',
      operatorId: r.operatorId || '',
      imageHash: r.imageHash || '',
      serverRecordHash: r.serverRecordHash || null,
      serverPrevHash: r.serverPrevHash || null,
      syncedAt: r.syncedAt || null,
      kitType: r.kitType || 'scott',
      outcomeCategory: (r.outcomeCategory as OutcomeCategoryType) || 'INCONCLUSIVE',
      presumptiveSubstance: r.presumptiveSubstance || r.presumptiveStatus || 'Presumptive (Unanalyzed)',
      confidenceScore: r.confidenceScore ?? null,
      calibratedRgb: r.calibratedRgb || null,
      rawRgb: r.rawRgb || null,
      referenceCardCalibrated: Boolean(r.referenceCardCalibrated),
      digitalSignature: r.digitalSignature || undefined,
      signatureVerified: r.signatureVerified !== false,
    }));

    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      const q = options.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.referenceId.toLowerCase().includes(q) ||
          r.operatorId.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.presumptiveSubstance && r.presumptiveSubstance.toLowerCase().includes(q))
      );
    }

    if (options.outcomeCategory && options.outcomeCategory !== 'ALL') {
      filtered = filtered.filter((r) => r.outcomeCategory === options.outcomeCategory);
    }

    if (options.kitType && options.kitType !== 'ALL') {
      filtered = filtered.filter((r) => r.kitType === options.kitType);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit !== undefined ? options.limit : filtered.length;
      filtered = filtered.slice(offset, offset + limit);
    }

    return filtered;
  } catch (error) {
    console.error('Failed to fetch records on web:', error);
    throw new Error('Failed to load field test records.');
  }
}

/**
 * Retrieve all records that require synchronization on web.
 */
export async function getPendingSyncRecordsAsync(): Promise<FieldTestRecord[]> {
  const allRecords = await getFieldTestRecordsAsync();
  return allRecords.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'local_only' || r.syncStatus === 'conflict'
  );
}

/**
 * Get count summary for records stored on web, including outcome breakdown.
 */
export async function getRecordStatsAsync(): Promise<{
  totalCount: number;
  pendingCount: number;
  syncedCount: number;
  conflictCount: number;
  positiveCount: number;
  negativeCount: number;
  inconclusiveCount: number;
}> {
  try {
    const records = getStoredRecords();
    let totalCount = records.length;
    let pendingCount = 0;
    let syncedCount = 0;
    let conflictCount = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let inconclusiveCount = 0;

    for (const r of records) {
      if (r.syncStatus === 'synced') {
        syncedCount += 1;
      } else if (r.syncStatus === 'conflict') {
        conflictCount += 1;
        pendingCount += 1;
      } else {
        pendingCount += 1;
      }

      const cat = r.outcomeCategory || 'INCONCLUSIVE';
      if (cat === 'POSITIVE') {
        positiveCount += 1;
      } else if (cat === 'NEGATIVE') {
        negativeCount += 1;
      } else {
        inconclusiveCount += 1;
      }
    }

    return { totalCount, pendingCount, syncedCount, conflictCount, positiveCount, negativeCount, inconclusiveCount };
  } catch (error) {
    console.warn('Could not fetch record stats on web:', error);
    return { totalCount: 0, pendingCount: 0, syncedCount: 0, conflictCount: 0, positiveCount: 0, negativeCount: 0, inconclusiveCount: 0 };
  }
}

/**
 * Get setting value from web localStorage or memory.
 */
export async function getSettingAsync(key: string, defaultValue: string): Promise<string> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed[key] || defaultValue;
      }
    } catch (e) {
      console.warn('Failed to read settings from localStorage:', e);
    }
  }
  return memorySettings[key] || defaultValue;
}

/**
 * Store setting value in web localStorage or memory.
 */
export async function setSettingAsync(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(SETTINGS_KEY);
      const parsed = data ? JSON.parse(data) : {};
      parsed[key] = value;
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
      return;
    } catch (e) {
      console.warn('Failed to write setting to localStorage:', e);
    }
  }
  memorySettings[key] = value;
}
