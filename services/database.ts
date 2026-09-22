import * as SQLite from 'expo-sqlite';

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
  calibratedRgb?: string | null; // e.g. JSON string "[0, 71, 171]" or hex
  rawRgb?: string | null;
  referenceCardCalibrated?: boolean;
  digitalSignature?: string;
  signatureVerified?: boolean;
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
  server_record_hash: string | null;
  server_prev_hash: string | null;
  synced_at: string | null;
  kit_type: string | null;
  outcome_category: string | null;
  presumptive_substance: string | null;
  confidence_score: number | null;
  calibrated_rgb: string | null;
  raw_rgb: string | null;
  reference_card_calibrated: number | null;
  digital_signature: string | null;
  signature_verified: number | null;
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

      // Create main evidence records table if it doesn't exist
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS field_test_records (
          id TEXT PRIMARY KEY NOT NULL,
          reference_id TEXT NOT NULL,
          image_uri TEXT NOT NULL,
          created_at TEXT NOT NULL,
          analysis_status TEXT NOT NULL DEFAULT 'completed',
          presumptive_status TEXT NOT NULL DEFAULT 'Presumptive (Unanalyzed)',
          sync_status TEXT NOT NULL DEFAULT 'pending',
          latitude REAL,
          longitude REAL,
          location_status TEXT NOT NULL DEFAULT 'unavailable',
          operator_id TEXT NOT NULL DEFAULT '',
          image_hash TEXT NOT NULL DEFAULT '',
          server_record_hash TEXT DEFAULT NULL,
          server_prev_hash TEXT DEFAULT NULL,
          synced_at TEXT DEFAULT NULL,
          kit_type TEXT DEFAULT 'scott',
          outcome_category TEXT DEFAULT 'INCONCLUSIVE',
          presumptive_substance TEXT DEFAULT 'Presumptive (Unanalyzed)',
          confidence_score REAL DEFAULT NULL,
          calibrated_rgb TEXT DEFAULT NULL,
          raw_rgb TEXT DEFAULT NULL,
          reference_card_calibrated INTEGER DEFAULT 0,
          digital_signature TEXT DEFAULT NULL,
          signature_verified INTEGER DEFAULT 1
        );
      `);

      // Create key-value app settings table for backend URL and configuration
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);

      // Verify and migrate missing columns if table existed from an earlier schema version
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(field_test_records);');
      const columnNames = new Set(columns.map((c) => c.name));

      const migrations = [
        { col: 'presumptive_status', sql: "ALTER TABLE field_test_records ADD COLUMN presumptive_status TEXT NOT NULL DEFAULT 'Presumptive (Unanalyzed)';" },
        { col: 'analysis_status', sql: "ALTER TABLE field_test_records ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'completed';" },
        { col: 'sync_status', sql: "ALTER TABLE field_test_records ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';" },
        { col: 'latitude', sql: "ALTER TABLE field_test_records ADD COLUMN latitude REAL;" },
        { col: 'longitude', sql: "ALTER TABLE field_test_records ADD COLUMN longitude REAL;" },
        { col: 'location_status', sql: "ALTER TABLE field_test_records ADD COLUMN location_status TEXT NOT NULL DEFAULT 'unavailable';" },
        { col: 'operator_id', sql: "ALTER TABLE field_test_records ADD COLUMN operator_id TEXT NOT NULL DEFAULT '';" },
        { col: 'image_hash', sql: "ALTER TABLE field_test_records ADD COLUMN image_hash TEXT NOT NULL DEFAULT '';" },
        { col: 'server_record_hash', sql: "ALTER TABLE field_test_records ADD COLUMN server_record_hash TEXT DEFAULT NULL;" },
        { col: 'server_prev_hash', sql: "ALTER TABLE field_test_records ADD COLUMN server_prev_hash TEXT DEFAULT NULL;" },
        { col: 'synced_at', sql: "ALTER TABLE field_test_records ADD COLUMN synced_at TEXT DEFAULT NULL;" },
        { col: 'kit_type', sql: "ALTER TABLE field_test_records ADD COLUMN kit_type TEXT DEFAULT 'scott';" },
        { col: 'outcome_category', sql: "ALTER TABLE field_test_records ADD COLUMN outcome_category TEXT DEFAULT 'INCONCLUSIVE';" },
        { col: 'presumptive_substance', sql: "ALTER TABLE field_test_records ADD COLUMN presumptive_substance TEXT DEFAULT 'Presumptive (Unanalyzed)';" },
        { col: 'confidence_score', sql: "ALTER TABLE field_test_records ADD COLUMN confidence_score REAL DEFAULT NULL;" },
        { col: 'calibrated_rgb', sql: "ALTER TABLE field_test_records ADD COLUMN calibrated_rgb TEXT DEFAULT NULL;" },
        { col: 'raw_rgb', sql: "ALTER TABLE field_test_records ADD COLUMN raw_rgb TEXT DEFAULT NULL;" },
        { col: 'reference_card_calibrated', sql: "ALTER TABLE field_test_records ADD COLUMN reference_card_calibrated INTEGER DEFAULT 0;" },
        { col: 'digital_signature', sql: "ALTER TABLE field_test_records ADD COLUMN digital_signature TEXT DEFAULT NULL;" },
        { col: 'signature_verified', sql: "ALTER TABLE field_test_records ADD COLUMN signature_verified INTEGER DEFAULT 1;" },
      ];

      for (const m of migrations) {
        if (!columnNames.has(m.col)) {
          await db.execAsync(m.sql);
        }
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
 * Save a new field test record to SQLite with metadata (GPS, operator ID, image SHA-256, signature, classification).
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
    await db.runAsync(
      `INSERT INTO field_test_records (
        id, reference_id, image_uri, created_at, analysis_status,
        presumptive_status, sync_status, latitude, longitude,
        location_status, operator_id, image_hash, server_record_hash,
        server_prev_hash, synced_at, kit_type, outcome_category,
        presumptive_substance, confidence_score, calibrated_rgb,
        raw_rgb, reference_card_calibrated, digital_signature, signature_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        record.serverRecordHash ?? null,
        record.serverPrevHash ?? null,
        record.syncedAt ?? null,
        record.kitType ?? 'scott',
        record.outcomeCategory ?? 'INCONCLUSIVE',
        record.presumptiveSubstance ?? 'Presumptive (Unanalyzed)',
        record.confidenceScore ?? null,
        record.calibratedRgb ?? null,
        record.rawRgb ?? null,
        record.referenceCardCalibrated ? 1 : 0,
        record.digitalSignature ?? null,
        record.signatureVerified ? 1 : 0,
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
 * Update the sync status and server hashes of a locally stored record.
 */
export async function updateRecordSyncStatusAsync(
  id: string,
  syncStatus: SyncStatusType,
  serverRecordHash?: string | null,
  serverPrevHash?: string | null
): Promise<void> {
  const db = await getDatabaseAsync();
  const syncedAt = syncStatus === 'synced' ? new Date().toISOString() : null;

  try {
    if (serverRecordHash !== undefined) {
      await db.runAsync(
        `UPDATE field_test_records
         SET sync_status = ?,
             server_record_hash = ?,
             server_prev_hash = COALESCE(?, server_prev_hash),
             synced_at = COALESCE(?, synced_at)
         WHERE id = ?;`,
        [syncStatus, serverRecordHash, serverPrevHash ?? null, syncedAt, id]
      );
    } else {
      await db.runAsync(
        `UPDATE field_test_records
         SET sync_status = ?,
             synced_at = COALESCE(?, synced_at)
         WHERE id = ?;`,
        [syncStatus, syncedAt, id]
      );
    }
  } catch (error: any) {
    console.error(`Failed to update sync status for record ${id}:`, error);
    throw new Error(`Failed to update record sync status: ${error?.message || String(error)}`);
  }
}

/**
 * Retrieve saved field test records with multi-attribute search and filtering.
 */
export async function getFieldTestRecordsAsync(options: {
  searchQuery?: string;
  outcomeCategory?: string;
  kitType?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<FieldTestRecord[]> {
  const db = await getDatabaseAsync();
  
  let query = `SELECT
        id, reference_id, image_uri, created_at, analysis_status,
        presumptive_status, sync_status, latitude, longitude,
        location_status, operator_id, image_hash, server_record_hash,
        server_prev_hash, synced_at, kit_type, outcome_category,
        presumptive_substance, confidence_score, calibrated_rgb,
        raw_rgb, reference_card_calibrated, digital_signature, signature_verified
       FROM field_test_records`;

  const whereClauses: string[] = [];
  const params: (number | string)[] = [];

  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const term = `%${options.searchQuery.trim()}%`;
    whereClauses.push('(reference_id LIKE ? OR operator_id LIKE ? OR id LIKE ? OR presumptive_substance LIKE ?)');
    params.push(term, term, term, term);
  }

  if (options.outcomeCategory && options.outcomeCategory !== 'ALL') {
    whereClauses.push('outcome_category = ?');
    params.push(options.outcomeCategory);
  }

  if (options.kitType && options.kitType !== 'ALL') {
    whereClauses.push('kit_type = ?');
    params.push(options.kitType);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit !== undefined) {
    query += ` LIMIT ?`;
    params.push(options.limit);
    if (options.offset !== undefined) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }
  }

  try {
    const rows = await db.getAllAsync<DatabaseRow>(query, params);

    return rows.map((row) => ({
      id: row.id,
      referenceId: row.reference_id,
      sampleName: row.reference_id,
      imageUri: row.image_uri,
      createdAt: row.created_at,
      analysisStatus: row.analysis_status || 'completed',
      presumptiveStatus: row.presumptive_status || 'Presumptive (Unanalyzed)',
      syncStatus: (row.sync_status as SyncStatusType) || 'pending',
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      locationStatus: row.location_status || 'unavailable',
      operatorId: row.operator_id || '',
      imageHash: row.image_hash || '',
      serverRecordHash: row.server_record_hash || null,
      serverPrevHash: row.server_prev_hash || null,
      syncedAt: row.synced_at || null,
      kitType: row.kit_type || 'scott',
      outcomeCategory: (row.outcome_category as OutcomeCategoryType) || 'INCONCLUSIVE',
      presumptiveSubstance: row.presumptive_substance || row.presumptive_status || 'Presumptive (Unanalyzed)',
      confidenceScore: row.confidence_score ?? null,
      calibratedRgb: row.calibrated_rgb || null,
      rawRgb: row.raw_rgb || null,
      referenceCardCalibrated: Boolean(row.reference_card_calibrated),
      digitalSignature: row.digital_signature || undefined,
      signatureVerified: row.signature_verified !== 0,
    }));
  } catch (error: any) {
    console.error('Failed to fetch records from SQLite:', error);
    const detail = error?.message || String(error);
    throw new Error(`Failed to load field test records: ${detail}`);
  }
}

/**
 * Retrieve all records that require synchronization (pending, local_only, or conflict).
 */
export async function getPendingSyncRecordsAsync(): Promise<FieldTestRecord[]> {
  const db = await getDatabaseAsync();
  
  try {
    const rows = await db.getAllAsync<DatabaseRow>(
      `SELECT
        id, reference_id, image_uri, created_at, analysis_status,
        presumptive_status, sync_status, latitude, longitude,
        location_status, operator_id, image_hash, server_record_hash,
        server_prev_hash, synced_at, kit_type, outcome_category,
        presumptive_substance, confidence_score, calibrated_rgb,
        raw_rgb, reference_card_calibrated, digital_signature, signature_verified
       FROM field_test_records
       WHERE sync_status IN ('pending', 'local_only', 'conflict')
       ORDER BY created_at ASC;`
    );

    return rows.map((row) => ({
      id: row.id,
      referenceId: row.reference_id,
      sampleName: row.reference_id,
      imageUri: row.image_uri,
      createdAt: row.created_at,
      analysisStatus: row.analysis_status || 'completed',
      presumptiveStatus: row.presumptive_status || 'Presumptive (Unanalyzed)',
      syncStatus: (row.sync_status as SyncStatusType) || 'pending',
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      locationStatus: row.location_status || 'unavailable',
      operatorId: row.operator_id || '',
      imageHash: row.image_hash || '',
      serverRecordHash: row.server_record_hash || null,
      serverPrevHash: row.server_prev_hash || null,
      syncedAt: row.synced_at || null,
      kitType: row.kit_type || 'scott',
      outcomeCategory: (row.outcome_category as OutcomeCategoryType) || 'INCONCLUSIVE',
      presumptiveSubstance: row.presumptive_substance || row.presumptive_status || 'Presumptive (Unanalyzed)',
      confidenceScore: row.confidence_score ?? null,
      calibratedRgb: row.calibrated_rgb || null,
      rawRgb: row.raw_rgb || null,
      referenceCardCalibrated: Boolean(row.reference_card_calibrated),
      digitalSignature: row.digital_signature || undefined,
      signatureVerified: row.signature_verified !== 0,
    }));
  } catch (error: any) {
    console.error('Failed to fetch pending sync records:', error);
    return [];
  }
}

/**
 * Get count summary for records stored on the device, including outcome breakdown.
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
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<{ sync_status: string; outcome_category: string; count: number }>(
      `SELECT sync_status, outcome_category, COUNT(*) as count FROM field_test_records GROUP BY sync_status, outcome_category;`
    );

    let totalCount = 0;
    let pendingCount = 0;
    let syncedCount = 0;
    let conflictCount = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let inconclusiveCount = 0;

    for (const r of rows) {
      totalCount += r.count;
      if (r.sync_status === 'synced') {
        syncedCount += r.count;
      } else if (r.sync_status === 'conflict') {
        conflictCount += r.count;
        pendingCount += r.count;
      } else {
        pendingCount += r.count;
      }

      if (r.outcome_category === 'POSITIVE') {
        positiveCount += r.count;
      } else if (r.outcome_category === 'NEGATIVE') {
        negativeCount += r.count;
      } else {
        inconclusiveCount += r.count;
      }
    }

    return { totalCount, pendingCount, syncedCount, conflictCount, positiveCount, negativeCount, inconclusiveCount };
  } catch (error) {
    console.warn('Could not fetch record stats:', error);
    return { totalCount: 0, pendingCount: 0, syncedCount: 0, conflictCount: 0, positiveCount: 0, negativeCount: 0, inconclusiveCount: 0 };
  }
}

/**
 * Get a setting value from SQLite app_settings.
 */
export async function getSettingAsync(key: string, defaultValue: string): Promise<string> {
  try {
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [key]
    );
    return row?.value || defaultValue;
  } catch (error) {
    console.warn(`Failed to read setting "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Store a setting value in SQLite app_settings.
 */
export async function setSettingAsync(key: string, value: string): Promise<void> {
  try {
    const db = await getDatabaseAsync();
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [key, value]
    );
  } catch (error) {
    console.error(`Failed to save setting "${key}":`, error);
  }
}
