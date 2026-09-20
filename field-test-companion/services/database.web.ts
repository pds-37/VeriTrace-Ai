export interface FieldTestRecord {
  id: string;
  referenceId: string;
  sampleName?: string;
  imageUri: string;
  createdAt: string;
  analysisStatus: 'not_implemented';
  presumptiveStatus: string;
  syncStatus: 'pending';
  latitude: number | null;
  longitude: number | null;
  locationStatus: 'available' | 'unavailable' | 'permission_denied' | string;
  operatorId: string;
  imageHash: string;
}

const STORAGE_KEY = 'field_test_records';
let memoryStorage: FieldTestRecord[] = [];

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
  referenceId?: string;
  sampleName?: string;
  imageUri: string;
  latitude?: number | null;
  longitude?: number | null;
  locationStatus?: string;
  operatorId?: string;
  imageHash?: string;
}): Promise<FieldTestRecord> {
  const name = (params.sampleName || params.referenceId || '').trim();

  const hasCoords = params.latitude !== undefined && params.latitude !== null &&
                    params.longitude !== undefined && params.longitude !== null;

  const locationStatus = params.locationStatus
    ? params.locationStatus
    : (hasCoords ? 'available' : 'unavailable');

  const record: FieldTestRecord = {
    id: generateRecordId(),
    referenceId: name,
    sampleName: name,
    imageUri: params.imageUri,
    createdAt: new Date().toISOString(),
    analysisStatus: 'not_implemented',
    presumptiveStatus: 'Presumptive (Unanalyzed)',
    syncStatus: 'pending',
    latitude: hasCoords ? params.latitude! : null,
    longitude: hasCoords ? params.longitude! : null,
    locationStatus,
    operatorId: (params.operatorId || '').trim(),
    imageHash: (params.imageHash || '').trim(),
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
 * Retrieve all saved field test records on web, newest first.
 */
export async function getFieldTestRecordsAsync(): Promise<FieldTestRecord[]> {
  try {
    const records = getStoredRecords();
    return records
      .map((r) => ({
        ...r,
        sampleName: r.sampleName || r.referenceId,
        presumptiveStatus: r.presumptiveStatus || 'Presumptive (Unanalyzed)',
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        locationStatus: r.locationStatus || 'unavailable',
        operatorId: r.operatorId || '',
        imageHash: r.imageHash || '',
      }))
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch (error) {
    console.error('Failed to fetch records on web:', error);
    throw new Error('Failed to load field test records.');
  }
}

/**
 * Get count summary for records stored on web.
 */
export async function getRecordStatsAsync(): Promise<{ totalCount: number; pendingCount: number }> {
  try {
    const records = getStoredRecords();
    const count = records.length;
    return {
      totalCount: count,
      pendingCount: count,
    };
  } catch (error) {
    console.warn('Could not fetch record stats on web:', error);
    return { totalCount: 0, pendingCount: 0 };
  }
}
