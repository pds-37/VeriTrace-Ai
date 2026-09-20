import sqlite3
import threading
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone

from . import config
from .chain import compute_record_hash

# Thread lock for sequential chain write operations
_db_write_lock = threading.Lock()


def get_db_path(custom_path: Optional[str] = None) -> str:
    return custom_path or config.DATABASE_PATH


def get_connection(custom_path: Optional[str] = None) -> sqlite3.Connection:
    """
    Creates an SQLite connection configured with Row factory and WAL mode.
    """
    path = get_db_path(custom_path)
    conn = sqlite3.connect(path, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(custom_path: Optional[str] = None) -> None:
    """
    Initializes the SQLite schema for the evidence records and hash-linked chain of custody.
    """
    with _db_write_lock:
        conn = get_connection(custom_path)
        try:
            with conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS evidence_records (
                        sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
                        record_id TEXT UNIQUE NOT NULL,
                        sample_reference_id TEXT NOT NULL,
                        operator_id TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        latitude REAL,
                        longitude REAL,
                        location_status TEXT NOT NULL,
                        image_sha256 TEXT NOT NULL,
                        presumptive_status TEXT NOT NULL,
                        classification_result TEXT,
                        previous_record_hash TEXT NOT NULL,
                        record_hash TEXT NOT NULL,
                        sync_status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_records_record_id 
                    ON evidence_records(record_id);
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_records_seq 
                    ON evidence_records(sequence_number);
                """)
                
                # Users table for Authentication
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL
                    );
                """)
                
                # Insert default users if table is empty
                cursor = conn.execute("SELECT COUNT(*) as count FROM users")
                row = cursor.fetchone()
                if row and row["count"] == 0:
                    from .auth import get_password_hash
                    # Admin
                    conn.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                                 ("admin", get_password_hash("admin123"), "admin"))
                    # Field Officer
                    conn.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                                 ("officer_1", get_password_hash("field123"), "officer"))
        finally:
            conn.close()


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


def get_latest_record(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
    """
    Retrieves the latest head record in the chain.
    """
    cursor = conn.execute("""
        SELECT * FROM evidence_records 
        ORDER BY sequence_number DESC 
        LIMIT 1;
    """)
    row = cursor.fetchone()
    return row_to_dict(row)


def get_record_by_id(conn: sqlite3.Connection, record_id: str) -> Optional[Dict[str, Any]]:
    """
    Finds a record by its unique record_id.
    """
    cursor = conn.execute("""
        SELECT * FROM evidence_records 
        WHERE record_id = ?;
    """, (record_id.strip(),))
    row = cursor.fetchone()
    return row_to_dict(row)


def get_record_by_sequence(conn: sqlite3.Connection, sequence_number: int) -> Optional[Dict[str, Any]]:
    """
    Finds a record by its sequence number.
    """
    cursor = conn.execute("""
        SELECT * FROM evidence_records 
        WHERE sequence_number = ?;
    """, (sequence_number,))
    row = cursor.fetchone()
    return row_to_dict(row)


def get_all_records(
    conn: sqlite3.Connection,
    limit: int = 1000,
    offset: int = 0,
    ascending: bool = True
) -> List[Dict[str, Any]]:
    """
    Returns records ordered by sequence number.
    """
    order = "ASC" if ascending else "DESC"
    cursor = conn.execute(f"""
        SELECT * FROM evidence_records 
        ORDER BY sequence_number {order}
        LIMIT ? OFFSET ?;
    """, (limit, offset))
    rows = cursor.fetchall()
    return [dict(r) for r in rows]


def count_records(conn: sqlite3.Connection) -> int:
    """
    Returns total record count.
    """
    cursor = conn.execute("SELECT COUNT(*) as count FROM evidence_records;")
    row = cursor.fetchone()
    return row["count"] if row else 0


def generate_unique_record_id() -> str:
    """
    Generates a fallback unique record ID if client didn't supply one.
    """
    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    import random
    import string
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"REC-{timestamp}-{rand}"


def insert_evidence_record(
    conn: sqlite3.Connection,
    record_data: Dict[str, Any],
    sync_status: str = "synced"
) -> Dict[str, Any]:
    """
    Atomically links the record to the current chain head, computes record_hash,
    and inserts into SQLite.
    """
    with _db_write_lock:
        with conn:
            latest = get_latest_record(conn)
            prev_hash = latest["record_hash"] if latest else config.GENESIS_HASH

            rec_id = str(record_data.get("record_id") or "").strip()
            if not rec_id:
                rec_id = generate_unique_record_id()

            sample_ref_id = str(record_data.get("sample_reference_id") or "").strip()
            operator_id = str(record_data.get("operator_id") or "Unassigned").strip()
            timestamp = str(record_data.get("timestamp") or datetime.now(timezone.utc).isoformat()).strip()
            
            lat = record_data.get("latitude")
            latitude = float(lat) if lat is not None else None

            lon = record_data.get("longitude")
            longitude = float(lon) if lon is not None else None

            location_status = str(record_data.get("location_status") or "unavailable").strip()
            image_sha256 = str(record_data.get("image_sha256") or "").strip()
            presumptive_status = str(record_data.get("presumptive_status") or "Presumptive (Unanalyzed)").strip()
            classification_result = record_data.get("classification_result")
            classification_str = str(classification_result).strip() if classification_result else None
            created_at = datetime.now(timezone.utc).isoformat()

            # Compute deterministic SHA-256 hash linked to previous hash
            rec_hash = compute_record_hash(
                record_id=rec_id,
                sample_reference_id=sample_ref_id,
                operator_id=operator_id,
                timestamp=timestamp,
                latitude=latitude,
                longitude=longitude,
                location_status=location_status,
                image_sha256=image_sha256,
                presumptive_status=presumptive_status,
                classification_result=classification_str,
                previous_record_hash=prev_hash,
            )

            cursor = conn.execute("""
                INSERT INTO evidence_records (
                    record_id,
                    sample_reference_id,
                    operator_id,
                    timestamp,
                    latitude,
                    longitude,
                    location_status,
                    image_sha256,
                    presumptive_status,
                    classification_result,
                    previous_record_hash,
                    record_hash,
                    sync_status,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                rec_id,
                sample_ref_id,
                operator_id,
                timestamp,
                latitude,
                longitude,
                location_status,
                image_sha256,
                presumptive_status,
                classification_str,
                prev_hash,
                rec_hash,
                sync_status,
                created_at,
            ))

            seq_number = cursor.lastrowid

            return {
                "sequence_number": seq_number,
                "record_id": rec_id,
                "sample_reference_id": sample_ref_id,
                "operator_id": operator_id,
                "timestamp": timestamp,
                "latitude": latitude,
                "longitude": longitude,
                "location_status": location_status,
                "image_sha256": image_sha256,
                "presumptive_status": presumptive_status,
                "classification_result": classification_str,
                "previous_record_hash": prev_hash,
                "record_hash": rec_hash,
                "sync_status": sync_status,
                "created_at": created_at,
            }


def check_record_conflict(
    existing_record: Dict[str, Any],
    incoming_data: Dict[str, Any]
) -> bool:
    """
    Compares substantive evidentiary content between existing server record and incoming sync record.
    Returns True if conflict (i.e. different content for same record_id), False if identical.
    """
    # Compare core fields
    if str(existing_record.get("sample_reference_id", "")).strip() != str(incoming_data.get("sample_reference_id", "")).strip():
        return True

    if str(existing_record.get("image_sha256", "")).strip().lower() != str(incoming_data.get("image_sha256", "")).strip().lower():
        return True

    # Check operator if provided
    incoming_op = str(incoming_data.get("operator_id") or "").strip()
    if incoming_op and incoming_op != "Unassigned":
        if str(existing_record.get("operator_id", "")).strip() != incoming_op:
            return True

    # Check coordinates if provided
    inc_lat = incoming_data.get("latitude")
    if inc_lat is not None and existing_record.get("latitude") is not None:
        if abs(float(existing_record["latitude"]) - float(inc_lat)) > 1e-4:
            return True

    inc_lon = incoming_data.get("longitude")
    if inc_lon is not None and existing_record.get("longitude") is not None:
        if abs(float(existing_record["longitude"]) - float(inc_lon)) > 1e-4:
            return True

    return False
