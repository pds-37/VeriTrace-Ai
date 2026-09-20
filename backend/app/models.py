from typing import Optional, List, Any, Dict
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict

def get_current_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ============================================================================
# Core Evidence Record Models
# ============================================================================

class RecordCreate(BaseModel):
    """
    Request model for creating a new field test evidence record.
    Supports both client-generated ID and server-generated ID.
    """
    model_config = ConfigDict(populate_by_name=True)

    record_id: Optional[str] = Field(
        default=None,
        description="Optional unique client record ID (e.g. REC-177...)",
        alias="id"
    )
    sample_reference_id: str = Field(
        ...,
        description="Unique sample name or reference identifier (e.g. SMP-2026-001)",
        alias="referenceId"
    )
    operator_id: Optional[str] = Field(
        default="Unassigned",
        description="Operator ID or badge number",
        alias="operatorId"
    )
    timestamp: Optional[str] = Field(
        default_factory=get_current_utc_iso,
        description="ISO-8601 acquisition timestamp",
        alias="createdAt"
    )
    latitude: Optional[float] = Field(
        default=None,
        description="GPS Latitude in decimal degrees",
        alias="latitude"
    )
    longitude: Optional[float] = Field(
        default=None,
        description="GPS Longitude in decimal degrees",
        alias="longitude"
    )
    location_status: Optional[str] = Field(
        default="unavailable",
        description="GPS telemetry status: available | unavailable | permission_denied",
        alias="locationStatus"
    )
    image_sha256: str = Field(
        ...,
        description="Cryptographic SHA-256 hash of the captured image payload",
        alias="imageHash"
    )
    presumptive_status: Optional[str] = Field(
        default="Presumptive (Unanalyzed)",
        description="Presumptive indicator status",
        alias="presumptiveStatus"
    )
    classification_result: Optional[str] = Field(
        default=None,
        description="Demo classification or AI telemetry descriptor",
        alias="analysisStatus"
    )


class EvidenceRecord(BaseModel):
    """
    Complete server-side evidence record with hash-linked chain of custody.
    """
    sequence_number: int
    record_id: str
    sample_reference_id: str
    operator_id: str
    timestamp: str
    latitude: Optional[float]
    longitude: Optional[float]
    location_status: str
    image_sha256: str
    presumptive_status: str
    classification_result: Optional[str]
    previous_record_hash: str
    record_hash: str
    sync_status: str
    created_at: str


class RecordListResponse(BaseModel):
    total_count: int
    records: List[EvidenceRecord]


# ============================================================================
# Verification Models
# ============================================================================

class RecordVerificationResponse(BaseModel):
    record_id: str
    sequence_number: int
    is_valid: bool
    stored_hash: str
    calculated_hash: str
    previous_record_hash: str
    expected_previous_record_hash: str
    link_valid: bool
    status: str  # "VERIFIED" | "TAMPERED"
    details: str
    verified_at: str


class ChainVerificationResponse(BaseModel):
    is_valid: bool
    total_records: int
    valid_records_count: int
    tampered_records_count: int
    tampered_record_ids: List[str]
    chain_head_hash: Optional[str]
    status: str  # "CHAIN_INTEGRITY_VERIFIED" | "CHAIN_COMPROMISED"
    verification_records: List[RecordVerificationResponse]
    verified_at: str


# ============================================================================
# Sync Models
# ============================================================================

class SyncRecordItem(BaseModel):
    """
    Accepts offline records in either snake_case or camelCase matching mobile schema.
    """
    model_config = ConfigDict(populate_by_name=True)

    record_id: str = Field(..., alias="id")
    sample_reference_id: str = Field(..., alias="referenceId")
    operator_id: Optional[str] = Field(default="Unassigned", alias="operatorId")
    timestamp: Optional[str] = Field(default_factory=get_current_utc_iso, alias="createdAt")
    latitude: Optional[float] = Field(default=None, alias="latitude")
    longitude: Optional[float] = Field(default=None, alias="longitude")
    location_status: Optional[str] = Field(default="unavailable", alias="locationStatus")
    image_sha256: str = Field(..., alias="imageHash")
    presumptive_status: Optional[str] = Field(default="Presumptive (Unanalyzed)", alias="presumptiveStatus")
    classification_result: Optional[str] = Field(default=None, alias="analysisStatus")


class SyncRequest(BaseModel):
    records: List[SyncRecordItem]


class SyncResultItem(BaseModel):
    record_id: str
    status: str  # "synced" | "already_synced" | "conflict"
    message: str
    record_hash: Optional[str] = None


class SyncResponse(BaseModel):
    total_received: int
    synced_count: int
    already_synced_count: int
    conflict_count: int
    results: List[SyncResultItem]
    processed_at: str


# ============================================================================
# Export Models
# ============================================================================

class EvidenceExportPackage(BaseModel):
    export_type: str = "LAB_HANDOFF_EVIDENCE_PACKAGE"
    schema_version: str = "1.0"
    exported_at: str
    disclaimer: str
    is_presumptive: bool = True
    evidence_record: Dict[str, Any]
    chain_of_custody_provenance: Dict[str, Any]
