import json
import hashlib
from typing import Dict, Any, List, Tuple
from datetime import datetime, timezone

from .config import GENESIS_HASH


def build_canonical_payload(
    record_id: str,
    sample_reference_id: str,
    operator_id: str,
    timestamp: str,
    latitude: Any,
    longitude: Any,
    location_status: str,
    image_sha256: str,
    presumptive_status: str,
    classification_result: Any,
    previous_record_hash: str,
) -> Dict[str, Any]:
    """
    Constructs a normalized dictionary payload for deterministic canonical serialization.
    """
    return {
        "record_id": str(record_id).strip(),
        "sample_reference_id": str(sample_reference_id).strip(),
        "operator_id": str(operator_id).strip() if operator_id else "Unassigned",
        "timestamp": str(timestamp).strip(),
        "latitude": round(float(latitude), 6) if latitude is not None else None,
        "longitude": round(float(longitude), 6) if longitude is not None else None,
        "location_status": str(location_status).strip().lower() if location_status else "unavailable",
        "image_sha256": str(image_sha256).strip().lower(),
        "presumptive_status": str(presumptive_status).strip() if presumptive_status else "Presumptive (Unanalyzed)",
        "classification_result": str(classification_result).strip() if classification_result else None,
        "previous_record_hash": str(previous_record_hash).strip().lower(),
    }


def compute_record_hash(
    record_id: str,
    sample_reference_id: str,
    operator_id: str,
    timestamp: str,
    latitude: Any,
    longitude: Any,
    location_status: str,
    image_sha256: str,
    presumptive_status: str,
    classification_result: Any,
    previous_record_hash: str,
) -> str:
    """
    Calculates a deterministic SHA-256 cryptographic hash over canonical record data
    and previous record hash in the chain of custody.
    """
    payload = build_canonical_payload(
        record_id=record_id,
        sample_reference_id=sample_reference_id,
        operator_id=operator_id,
        timestamp=timestamp,
        latitude=latitude,
        longitude=longitude,
        location_status=location_status,
        image_sha256=image_sha256,
        presumptive_status=presumptive_status,
        classification_result=classification_result,
        previous_record_hash=previous_record_hash,
    )
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def verify_record_integrity(
    record: Dict[str, Any],
    expected_previous_hash: str
) -> Tuple[bool, bool, str, str]:
    """
    Verifies the cryptographic integrity and previous-link consistency of a single record.
    Returns: (is_valid, link_valid, calculated_hash, details)
    """
    stored_hash = record.get("record_hash", "")
    stored_previous_hash = record.get("previous_record_hash", "")

    calculated_hash = compute_record_hash(
        record_id=record.get("record_id", ""),
        sample_reference_id=record.get("sample_reference_id", ""),
        operator_id=record.get("operator_id", ""),
        timestamp=record.get("timestamp", ""),
        latitude=record.get("latitude"),
        longitude=record.get("longitude"),
        location_status=record.get("location_status", ""),
        image_sha256=record.get("image_sha256", ""),
        presumptive_status=record.get("presumptive_status", ""),
        classification_result=record.get("classification_result"),
        previous_record_hash=stored_previous_hash,
    )

    hash_valid = (stored_hash.lower() == calculated_hash.lower())
    link_valid = (stored_previous_hash.lower() == expected_previous_hash.lower())

    if not hash_valid and not link_valid:
        details = (
            f"Tamper detected: Record hash mismatch ({stored_hash[:12]}... != {calculated_hash[:12]}...) "
            f"and chain linkage broken ({stored_previous_hash[:12]}... != {expected_previous_hash[:12]}...)"
        )
    elif not hash_valid:
        details = f"Tamper detected: Internal record data has been altered (Calculated hash: {calculated_hash})"
    elif not link_valid:
        details = f"Chain linkage broken: Expected previous hash {expected_previous_hash}, got {stored_previous_hash}"
    else:
        details = "Cryptographic integrity verified: Record hash and chain linkage valid."

    is_valid = hash_valid and link_valid
    return is_valid, link_valid, calculated_hash, details


def verify_full_chain(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Performs full sequential audit of the chain of custody from Genesis to Head.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    if not records:
        return {
            "is_valid": True,
            "total_records": 0,
            "valid_records_count": 0,
            "tampered_records_count": 0,
            "tampered_record_ids": [],
            "chain_head_hash": None,
            "status": "CHAIN_INTEGRITY_VERIFIED",
            "verification_records": [],
            "verified_at": now_iso,
        }

    expected_prev = GENESIS_HASH
    tampered_ids: List[str] = []
    record_verifications: List[Dict[str, Any]] = []

    for rec in records:
        is_val, link_val, calc_hash, details = verify_record_integrity(rec, expected_prev)
        rec_id = rec.get("record_id", "")
        seq_num = rec.get("sequence_number", 0)

        record_verifications.append({
            "record_id": rec_id,
            "sequence_number": seq_num,
            "is_valid": is_val,
            "stored_hash": rec.get("record_hash", ""),
            "calculated_hash": calc_hash,
            "previous_record_hash": rec.get("previous_record_hash", ""),
            "expected_previous_record_hash": expected_prev,
            "link_valid": link_val,
            "status": "VERIFIED" if is_val else "TAMPERED",
            "details": details,
            "verified_at": now_iso,
        })

        if not is_val:
            tampered_ids.append(rec_id)

        # In chain traversal, next expected previous is current record's stored hash
        expected_prev = rec.get("record_hash", "")

    all_valid = len(tampered_ids) == 0
    head_hash = records[-1].get("record_hash") if records else None

    return {
        "is_valid": all_valid,
        "total_records": len(records),
        "valid_records_count": len(records) - len(tampered_ids),
        "tampered_records_count": len(tampered_ids),
        "tampered_record_ids": tampered_ids,
        "chain_head_hash": head_hash,
        "status": "CHAIN_INTEGRITY_VERIFIED" if all_valid else "CHAIN_COMPROMISED",
        "verification_records": record_verifications,
        "verified_at": now_iso,
    }
