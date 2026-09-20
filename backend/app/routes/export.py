from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
import io
import csv
from datetime import datetime, timezone
from typing import Dict, Any

from ..models import EvidenceExportPackage
from ..database import get_connection, get_record_by_id, get_record_by_sequence, get_all_records
from ..chain import verify_record_integrity
from ..config import GENESIS_HASH, DISCLAIMER_TEXT
from ..auth import get_admin_user

router = APIRouter(prefix="/api/export", tags=["Evidence Export"])

@router.get(
    "",
    summary="Export Chain of Custody Ledger as CSV",
    description="Exports all evidence records as a downloadable CSV ledger."
)
def export_csv_ledger(current_user: Dict[str, Any] = Depends(get_admin_user)):
    conn = get_connection()
    try:
        records = get_all_records(conn, limit=10000, offset=0, ascending=True)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Sequence", "Record ID", "Sample Reference", "Operator ID", 
            "Timestamp", "Latitude", "Longitude", "Location Status",
            "Presumptive Status", "Image SHA-256", "Previous Hash", "Record Hash"
        ])
        
        for r in records:
            writer.writerow([
                r["sequence_number"], r["record_id"], r["sample_reference_id"], r["operator_id"],
                r["timestamp"], r["latitude"], r["longitude"], r["location_status"],
                r["presumptive_status"], r["image_sha256"], r["previous_record_hash"], r["record_hash"]
            ])
            
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=chain_of_custody_{int(datetime.now().timestamp())}.csv"}
        )
    finally:
        conn.close()


@router.get(
    "/{record_id}",
    response_model=EvidenceExportPackage,
    summary="Export standardized lab-handoff evidence package",
    description=(
        "Generates a complete forensic evidence and chain-of-custody transfer package for a field test record. "
        "Includes sample metadata, cryptographic image SHA-256 hash, operator provenance, GPS coordinates, "
        "chain-of-custody hashes, verification status, and presumptive test notice."
    )
)
def export_evidence_package(record_id: str, current_user: Dict[str, Any] = Depends(get_admin_user)):
    conn = get_connection()
    try:
        record = get_record_by_id(conn, record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence record '{record_id}' not found."
            )

        # Verify integrity on export
        seq = record["sequence_number"]
        if seq == 1:
            expected_prev = GENESIS_HASH
        else:
            prev = get_record_by_sequence(conn, seq - 1)
            expected_prev = prev["record_hash"] if prev else GENESIS_HASH

        is_val, link_val, calc_hash, details = verify_record_integrity(record, expected_prev)
        verification_status = "VERIFIED" if is_val else "TAMPERED"

        now_iso = datetime.now(timezone.utc).isoformat()

        package = {
            "export_type": "LAB_HANDOFF_EVIDENCE_PACKAGE",
            "schema_version": "1.0",
            "exported_at": now_iso,
            "disclaimer": DISCLAIMER_TEXT,
            "is_presumptive": True,
            "evidence_record": {
                "record_id": record["record_id"],
                "sequence_number": record["sequence_number"],
                "sample_reference_id": record["sample_reference_id"],
                "operator_id": record["operator_id"],
                "acquisition_timestamp": record["timestamp"],
                "server_ingestion_timestamp": record["created_at"],
                "location": {
                    "latitude": record["latitude"],
                    "longitude": record["longitude"],
                    "location_status": record["location_status"],
                },
                "forensic_integrity": {
                    "image_sha256": record["image_sha256"],
                    "previous_record_hash": record["previous_record_hash"],
                    "record_hash": record["record_hash"],
                    "chain_verification_status": verification_status,
                    "verification_details": details,
                },
                "field_test_telemetry": {
                    "presumptive_status": record["presumptive_status"],
                    "classification_result": record["classification_result"] or "Unclassified",
                    "sync_status": record["sync_status"],
                }
            },
            "chain_of_custody_provenance": {
                "custody_event": "DIGITAL_EVIDENCE_ACQUISITION",
                "hash_algorithm": "SHA-256",
                "tamper_evident_linked": True,
                "genesis_hash": GENESIS_HASH if seq == 1 else None,
                "exported_by": "Field Test Companion Backend v1.0",
            }
        }

        return EvidenceExportPackage(**package)
    finally:
        conn.close()
