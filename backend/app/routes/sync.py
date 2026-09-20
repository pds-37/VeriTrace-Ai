import os
from fastapi import APIRouter, status, Depends
from datetime import datetime, timezone
from typing import List, Dict, Any

from ..models import SyncRequest, SyncResponse, SyncResultItem
from ..database import (
    get_connection,
    get_record_by_id,
    insert_evidence_record,
    check_record_conflict,
)
from ..auth import get_current_user

EVIDENCE_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence_images")

router = APIRouter(prefix="/api/sync", tags=["Sync"])


@router.post(
    "",
    response_model=SyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Synchronize offline field records",
    description=(
        "Ingests a batch of offline field test records from mobile clients. "
        "Guarantees idempotency (re-syncing existing identical records succeeds without duplicate insertion) "
        "and detects evidentiary conflicts (conflicting content for an existing record_id is flagged and never silently overwrites the original server record)."
    )
)
def sync_records(payload: SyncRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_connection()
    try:
        results: List[SyncResultItem] = []
        synced_count = 0
        already_synced_count = 0
        conflict_count = 0

        for item in payload.records:
            item_data = item.model_dump()
            rec_id = item_data["record_id"].strip()

            existing = get_record_by_id(conn, rec_id)

            if existing is None:
                # 0. Check if image file was uploaded
                image_hash = item_data.get("image_sha256", "")
                if image_hash:
                    expected_jpg = os.path.join(EVIDENCE_IMAGES_DIR, f"{image_hash}.jpg")
                    expected_png = os.path.join(EVIDENCE_IMAGES_DIR, f"{image_hash}.png")
                    
                    if not (os.path.exists(expected_jpg) or os.path.exists(expected_png)):
                        conflict_count += 1
                        results.append(SyncResultItem(
                            record_id=rec_id,
                            status="conflict",
                            message="Evidence image payload missing on server. Upload the image first."
                        ))
                        continue

                # 1. New Record: Insert into chain
                try:
                    new_rec = insert_evidence_record(conn, item_data, sync_status="synced")
                    synced_count += 1
                    results.append(SyncResultItem(
                        record_id=rec_id,
                        status="synced",
                        message="Record successfully linked into chain of custody and persisted.",
                        record_hash=new_rec["record_hash"]
                    ))
                except Exception as ex:
                    conflict_count += 1
                    results.append(SyncResultItem(
                        record_id=rec_id,
                        status="conflict",
                        message=f"Insertion failed: {str(ex)}"
                    ))
            else:
                # 2. Existing Record: Check for evidentiary conflict
                is_conflict = check_record_conflict(existing, item_data)
                if is_conflict:
                    conflict_count += 1
                    results.append(SyncResultItem(
                        record_id=rec_id,
                        status="conflict",
                        message=(
                            "Conflict detected: Incoming payload contains divergent sample or hash content "
                            "for an existing record_id. Original server evidence record was preserved."
                        ),
                        record_hash=existing["record_hash"]
                    ))
                else:
                    # 3. Idempotent Success: Record already synced identically
                    already_synced_count += 1
                    results.append(SyncResultItem(
                        record_id=rec_id,
                        status="already_synced",
                        message="Record already synchronized with identical cryptographic state.",
                        record_hash=existing["record_hash"]
                    ))

        return SyncResponse(
            total_received=len(payload.records),
            synced_count=synced_count,
            already_synced_count=already_synced_count,
            conflict_count=conflict_count,
            results=results,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )
    finally:
        conn.close()
