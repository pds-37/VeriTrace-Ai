import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status, Depends
from datetime import datetime, timezone

from ..models import (
    RecordCreate,
    EvidenceRecord,
    RecordListResponse,
    RecordVerificationResponse,
)
from ..database import (
    get_connection,
    get_record_by_id,
    get_all_records,
    count_records,
    insert_evidence_record,
    get_record_by_sequence,
)
from ..chain import verify_record_integrity
from ..config import GENESIS_HASH
from ..auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/records", tags=["Records"])
EVIDENCE_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence_images")

@router.post(
    "",
    response_model=EvidenceRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new evidence record",
    description="Ingests a new field test record, links it cryptographically to the chain of custody head, and stores it."
)
def create_record(payload: RecordCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_connection()
    try:
        data = payload.model_dump()
        
        # Optionally overwrite operator_id with the logged-in username for stricter auditing
        data["operator_id"] = current_user["username"]
        
        # Verify image payload exists on server
        image_hash = data.get("image_sha256")
        if not image_hash:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_sha256 is required.")
            
        expected_image_path_jpg = os.path.join(EVIDENCE_IMAGES_DIR, f"{image_hash}.jpg")
        expected_image_path_png = os.path.join(EVIDENCE_IMAGES_DIR, f"{image_hash}.png")
        if not (os.path.exists(expected_image_path_jpg) or os.path.exists(expected_image_path_png)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Evidence image payload missing. Please upload the image first."
            )

        # Check if record_id already exists
        if data.get("record_id"):
            existing = get_record_by_id(conn, data["record_id"])
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Record with ID '{data['record_id']}' already exists on the server."
                )

        new_record = insert_evidence_record(conn, data, sync_status="synced")
        return EvidenceRecord(**new_record)
    finally:
        conn.close()


@router.get(
    "",
    response_model=RecordListResponse,
    summary="List evidence records",
    description="Returns all evidence records ordered by chain sequence."
)
def list_records(
    limit: int = Query(default=100, ge=1, le=1000, description="Max number of records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    order: str = Query(default="asc", pattern="^(asc|desc)$", description="Sort order: asc or desc"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    conn = get_connection()
    try:
        total = count_records(conn)
        records = get_all_records(conn, limit=limit, offset=offset, ascending=(order == "asc"))
        return RecordListResponse(
            total_count=total,
            records=[EvidenceRecord(**r) for r in records]
        )
    finally:
        conn.close()


@router.get(
    "/{record_id}",
    response_model=EvidenceRecord,
    summary="Get single evidence record",
    description="Fetches an individual evidence record by its unique record ID."
)
def get_record(record_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_connection()
    try:
        record = get_record_by_id(conn, record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence record '{record_id}' not found."
            )
        return EvidenceRecord(**record)
    finally:
        conn.close()


@router.get(
    "/{record_id}/verify",
    response_model=RecordVerificationResponse,
    summary="Verify record integrity and custody link",
    description="Cryptographically verifies that the record's payload has not been tampered with and checks link to previous record."
)
def verify_record(record_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_connection()
    try:
        record = get_record_by_id(conn, record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence record '{record_id}' not found."
            )

        # Determine expected previous hash based on sequence position
        seq = record["sequence_number"]
        if seq == 1:
            expected_prev_hash = GENESIS_HASH
        else:
            prev_record = get_record_by_sequence(conn, seq - 1)
            expected_prev_hash = prev_record["record_hash"] if prev_record else GENESIS_HASH

        is_val, link_val, calc_hash, details = verify_record_integrity(record, expected_prev_hash)

        return RecordVerificationResponse(
            record_id=record["record_id"],
            sequence_number=record["sequence_number"],
            is_valid=is_val,
            stored_hash=record["record_hash"],
            calculated_hash=calc_hash,
            previous_record_hash=record["previous_record_hash"],
            expected_previous_record_hash=expected_prev_hash,
            link_valid=link_val,
            status="VERIFIED" if is_val else "TAMPERED",
            details=details,
            verified_at=datetime.now(timezone.utc).isoformat(),
        )
    finally:
        conn.close()
