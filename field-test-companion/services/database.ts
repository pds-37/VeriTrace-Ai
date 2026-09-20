import * as SQLite from 'expo-sqlite';

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

interface DatabaseRow {
  id: string;
  reference_id: string;
  image_uri: string;
  created_at: string;
  analysis_status: string;
  presumptive_status: string;
  sync_status: string;
  latitude: number | null;
  longitude: number | null;
  location_status: string | null;
  operator_id: string | null;
  image_hash: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Initialize and return the SQLite database connection.
 * Ensures table creation and schema migrations complete before returning.
 */
export async function getDatabaseAsync(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('field_test_companion.db');

      // Enable WAL mode for reliable concurrency and performance
      await db.execAsync('PRAGMA journal_mode = WAL;');

      // Create table if it doesn't exist
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS field_test_records (
          id TEXT PRIMARY KEY NOT NULL,
          reference_id TEXT NOT NULL,
          image_uri TEXT NOT NULL,
          created_at TEXT NOT NULL,
          analysis_status TEXT NOT NULL DEFAULT 'not_implemented',
          presumptive_status TEXT NOT NULL DEFAULT 'Presumptive (Unanalyzed)',
          sync_status TEXT NOT NULL DEFAULT 'pending',
          latitude REAL,
          longitude REAL,
          location_status TEXT NOT NULL DEFAULT 'unavailable',
          operator_id TEXT NOT NULL DEFAULT '',
          image_hash TEXT NOT NULL DEFAULT ''
        );
      `);

      // Verify and migrate missing columns if table existed from an earlier schema version
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(field_test_records);');
      const columnNames = new Set(columns.map((c) => c.name));

      if (!columnNames.has('presumptive_status')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN presumptive_status TEXT NOT NULL DEFAULT 'Presumptive (Unanalyzed)';"
        );
      }
      if (!columnNames.has('analysis_status')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'not_implemented';"
        );
      }
      if (!columnNames.has('sync_status')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';"
        );
      }
      if (!columnNames.has('latitude')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN latitude REAL;"
        );
      }
      if (!columnNames.has('longitude')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN longitude REAL;"
        );
      }
      if (!columnNames.has('location_status')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN location_status TEXT NOT NULL DEFAULT 'unavailable';"
        );
      }
      if (!columnNames.has('operator_id')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN operator_id TEXT NOT NULL DEFAULT '';"
        );
      }
      if (!columnNames.has('image_hash')) {
        await db.execAsync(
          "ALTER TABLE field_test_records ADD COLUMN image_hash TEXT NOT NULL DEFAULT '';"
        );
      }

      return db;
    } catch (error: any) {
      dbPromise = null; // Allow retry on failure
      console.error('Failed to initialize SQLite database:', error);
      throw new Error(`Database initialization failed: ${error?.message || String(error)}`);
    }
  })();

  return dbPromise;
}

/**
 * Generate a unique local record ID.
 */
export function generateRecordId(): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `REC-${timestamp}-${randomPart}`;
}

/**
 * Save a new field test record to SQLite with metadata (GPS, operator ID, image SHA-256).
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
  const db = await getDatabaseAsync();
  const name = (params.sampleName || params.referenceId || '').trim();

  if (!name) {
    throw new Error('Sample reference ID / name is required.');
  }
  if (!params.imageUri) {
    throw new Error('Captured image URI is required.');
  }

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
    await db.runAsync(
      `INSERT INTO field_test_records (
        id,
        reference_id,
        image_uri,
        created_at,
        analysis_status,
        presumptive_status,
        sync_status,
        latitude,
        longitude,
        location_status,
        operator_id,
        image_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.referenceId,
        record.imageUri,
        record.createdAt,
        record.analysisStatus,
        record.presumptiveStatus,
        record.syncStatus,
        record.latitude,
        record.longitude,
        record.locationStatus,
        record.operatorId,
        record.imageHash,
      ]
    );

    return record;
  } catch (error: any) {
    console.error('Failed to save field test record to SQLite:', error);
    const detail = error?.message || String(error);
    throw new Error(`Failed to save record to SQLite: ${detail}`);
  }
}

/**
 * Retrieve all saved field test records from SQLite, newest first.
 */
export async function getFieldTestRecordsAsync(): Promise<FieldTestRecord[]> {
  const db = await getDatabaseAsync();

  try {
    const rows = await db.getAllAsync<DatabaseRow>(
      `SELECT
        id,
        reference_id,
        image_uri,
        created_at,
        analysis_status,
        presumptive_status,
        sync_status,
        latitude,
        longitude,
        location_status,
        operator_id,
        image_hash
       FROM field_test_records
       ORDER BY created_at DESC;`
    );

    return rows.map((row) => ({
      id: row.id,
      referenceId: row.reference_id,
      sampleName: row.reference_id,
      imageUri: row.image_uri,
      createdAt: row.created_at,
      analysisStatus: 'not_implemented',
      presumptiveStatus: row.presumptive_status || 'Presumptive (Unanalyzed)',
      syncStatus: 'pending',
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      locationStatus: row.location_status || 'unavailable',
      operatorId: row.operator_id || '',
      imageHash: row.image_hash || '',
    }));
  } catch (error: any) {
    console.error('Failed to fetch records from SQLite:', error);
    const detail = error?.message || String(error);
    throw new Error(`Failed to load field test records: ${detail}`);
  }
}

/**
 * Get count summary for records stored on the device.
 */
export async function getRecordStatsAsync(): Promise<{ totalCount: number; pendingCount: number }> {
  try {
    const db = await getDatabaseAsync();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM field_test_records;`
    );
    const totalCount = result?.count ?? 0;

    return {
      totalCount,
      pendingCount: totalCount, // All local records are pending sync
    };
  } catch (error) {
    console.warn('Could not fetch record stats:', error);
    return { totalCount: 0, pendingCount: 0 };
  }
}
