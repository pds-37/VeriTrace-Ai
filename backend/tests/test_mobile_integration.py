"""
End-to-End Integration Tests for Mobile App (Person B) + Backend (Person C)
Verifies:
1. Mobile-compatible schema ingestion (camelCase & snake_case)
2. Immediate single record sync (POST /api/records)
3. Offline batch queue sync (POST /api/sync)
4. Idempotent duplicate re-sync handling (already_synced)
5. Conflicting record submission protection (conflict)
6. Single record & chain-of-custody integrity verification
7. Tamper-evident detection
8. Lab-handoff evidence package export with presumptive notice
"""

import pytest
import sqlite3
from app.config import GENESIS_HASH


def test_mobile_schema_camelcase_ingestion(client):
    """
    Test that mobile app payload formatted with camelCase properties
    (as sent by services/backendApi.ts) is fully accepted by POST /api/records.
    """
    mobile_payload = {
        "id": "REC-MOBILE-001",
        "referenceId": "SMP-FIELD-M01",
        "operatorId": "OFFICER-789",
        "createdAt": "2026-09-20T08:30:00Z",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "locationStatus": "available",
        "imageHash": "a1b2c3d4e5f60102030405060708090a1b2c3d4e5f60102030405060708090a1",
        "presumptiveStatus": "Presumptive (Unanalyzed)",
        "analysisStatus": "demo_cassette_like"
    }

    res = client.post("/api/records", json=mobile_payload)
    assert res.status_code == 201
    data = res.json()

    assert data["record_id"] == "REC-MOBILE-001"
    assert data["sample_reference_id"] == "SMP-FIELD-M01"
    assert data["operator_id"] == "OFFICER-789"
    assert data["previous_record_hash"] == GENESIS_HASH
    assert len(data["record_hash"]) == 64
    assert data["sync_status"] == "synced"
    assert data["sequence_number"] == 1


def test_offline_batch_sync_and_idempotency(client):
    """
    Test mobile offline batch sync (POST /api/sync) with:
    - 2 new offline records
    - 1 duplicate record (already synced)
    - 1 conflicting record (same ID, altered sample/hash)
    """
    # 1. Sync 2 new offline records
    batch_payload = {
        "records": [
            {
                "id": "REC-OFFLINE-001",
                "referenceId": "SMP-OFFLINE-A",
                "operatorId": "OFFICER-101",
                "createdAt": "2026-09-20T08:31:00Z",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "locationStatus": "available",
                "imageHash": "1111111111111111111111111111111111111111111111111111111111111111",
                "presumptiveStatus": "Presumptive (Unanalyzed)",
                "analysisStatus": "demo_non_test_object"
            },
            {
                "id": "REC-OFFLINE-002",
                "referenceId": "SMP-OFFLINE-B",
                "operatorId": "OFFICER-102",
                "createdAt": "2026-09-20T08:32:00Z",
                "latitude": None,
                "longitude": None,
                "locationStatus": "unavailable",
                "imageHash": "2222222222222222222222222222222222222222222222222222222222222222",
                "presumptiveStatus": "Presumptive (Unanalyzed)",
                "analysisStatus": "demo_telemetry_completed"
            }
        ]
    }

    res = client.post("/api/sync", json=batch_payload)
    assert res.status_code == 200
    sync_data = res.json()
    assert sync_data["total_received"] == 2
    assert sync_data["synced_count"] == 2
    assert sync_data["already_synced_count"] == 0
    assert sync_data["conflict_count"] == 0

    # 2. Resubmit exact duplicate batch -> Must report already_synced without error
    res_dup = client.post("/api/sync", json=batch_payload)
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["already_synced_count"] == 2
    assert dup_data["synced_count"] == 0
    assert dup_data["conflict_count"] == 0

    # 3. Submit conflicting payload for REC-OFFLINE-001 with modified image hash
    conflict_payload = {
        "records": [
            {
                "id": "REC-OFFLINE-001",
                "referenceId": "SMP-OFFLINE-A-TAMPERED",
                "operatorId": "ATTACKER",
                "createdAt": "2026-09-20T08:31:00Z",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "locationStatus": "available",
                "imageHash": "9999999999999999999999999999999999999999999999999999999999999999",
                "presumptiveStatus": "Presumptive (Unanalyzed)",
                "analysisStatus": "demo_non_test_object"
            }
        ]
    }

    res_conflict = client.post("/api/sync", json=conflict_payload)
    assert res_conflict.status_code == 200
    conf_data = res_conflict.json()
    assert conf_data["conflict_count"] == 1
    assert conf_data["synced_count"] == 0
    assert conf_data["results"][0]["status"] == "conflict"

    # Verify original record on server was preserved intact
    get_res = client.get("/api/records/REC-OFFLINE-001")
    assert get_res.status_code == 200
    assert get_res.json()["sample_reference_id"] == "SMP-OFFLINE-A"
    assert get_res.json()["operator_id"] == "OFFICER-101"


def test_chain_audit_and_tamper_detection(client, isolated_test_db):
    """
    Test full cryptographic chain verification and database tampering detection.
    """
    # Create 3 sequential linked records
    for i in range(1, 4):
        payload = {
            "id": f"REC-SEQ-00{i}",
            "referenceId": f"SMP-SEQ-00{i}",
            "operatorId": "OFFICER-AUDIT",
            "imageHash": f"abcdef{i:02d}" + "0" * 56,
            "presumptiveStatus": "Presumptive (Unanalyzed)"
        }
        res = client.post("/api/records", json=payload)
        assert res.status_code == 201

    # Verify initial chain is 100% valid
    verify_res = client.get("/api/chain/verify")
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["is_valid"] is True
    assert v_data["status"] == "CHAIN_INTEGRITY_VERIFIED"
    assert len(v_data["tampered_record_ids"]) == 0

    # Tamper with record 2 directly in SQLite
    conn = sqlite3.connect(isolated_test_db)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE evidence_records SET sample_reference_id = 'TAMPERED_SAMPLE' WHERE record_id = 'REC-SEQ-002'"
    )
    conn.commit()
    conn.close()

    # Re-verify chain
    tamper_audit = client.get("/api/chain/verify")
    assert tamper_audit.status_code == 200
    t_data = tamper_audit.json()
    assert t_data["is_valid"] is False
    assert t_data["status"] == "CHAIN_COMPROMISED"
    assert "REC-SEQ-002" in t_data["tampered_record_ids"]


def test_forensic_export_package(client):
    """
    Test GET /api/export/{id} produces the required lab-handoff package.
    """
    payload = {
        "id": "REC-EXPORT-001",
        "referenceId": "SMP-FORENSIC-EXP",
        "operatorId": "DETECTIVE-44",
        "createdAt": "2026-09-20T08:45:00Z",
        "latitude": 28.7041,
        "longitude": 77.1025,
        "locationStatus": "available",
        "imageHash": "7777777777777777777777777777777777777777777777777777777777777777",
        "presumptiveStatus": "Presumptive (Unanalyzed)"
    }
    create_res = client.post("/api/records", json=payload)
    assert create_res.status_code == 201

    export_res = client.get("/api/export/REC-EXPORT-001")
    assert export_res.status_code == 200
    exp = export_res.json()

    assert exp["export_type"] == "LAB_HANDOFF_EVIDENCE_PACKAGE"
    assert exp["is_presumptive"] is True
    assert "FIELD TEST RESULTS ARE PRESUMPTIVE ONLY" in exp["disclaimer"]
    assert exp["evidence_record"]["record_id"] == "REC-EXPORT-001"
    assert exp["evidence_record"]["forensic_integrity"]["image_sha256"] == "7777777777777777777777777777777777777777777777777777777777777777"
    assert exp["evidence_record"]["forensic_integrity"]["record_hash"] is not None
    assert "chain_of_custody_provenance" in exp
    assert exp["chain_of_custody_provenance"]["tamper_evident_linked"] is True
