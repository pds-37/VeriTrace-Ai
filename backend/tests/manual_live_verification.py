import os
import sys
import sqlite3
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app
from app import config
from app.database import init_db

def run_live_verification():
    print("=" * 70)
    print("PERSON C BACKEND & CHAIN OF CUSTODY - COMPREHENSIVE LIVE TEST")
    print("=" * 70)

    # Use a clean temporary test database
    temp_dir = tempfile.TemporaryDirectory()
    test_db_path = os.path.join(temp_dir.name, "live_test_evidence.db")
    config.DATABASE_PATH = test_db_path
    init_db(test_db_path)
    print(f"[Setup] Isolated Test DB Initialized at: {test_db_path}")

    client = TestClient(app)

    # ------------------------------------------------------------------------
    # Step 3: POST /api/records
    # ------------------------------------------------------------------------
    print("\n--- Step 3: Test POST /api/records ---")
    rec1_payload = {
        "record_id": "REC-LIVE-001",
        "sample_reference_id": "SMP-SIH-2026-A",
        "operator_id": "OP-OFFICER-101",
        "timestamp": "2026-09-20T08:30:00Z",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location_status": "available",
        "image_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "presumptive_status": "Presumptive (Unanalyzed)",
        "classification_result": "Cassette-like object",
    }
    res = client.post("/api/records", json=rec1_payload)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    rec1_data = res.json()
    print(f" Record Created: ID={rec1_data['record_id']}, Seq={rec1_data['sequence_number']}")
    print(f"  - Previous Hash : {rec1_data['previous_record_hash'][:16]}... (Genesis: {'0'*64 == rec1_data['previous_record_hash']})")
    print(f"  - Record Hash   : {rec1_data['record_hash'][:16]}...")
    assert rec1_data["previous_record_hash"] == config.GENESIS_HASH
    assert len(rec1_data["record_hash"]) == 64
    assert rec1_data["sync_status"] == "synced"
    print("  -> Step 3 Passed: record_id, previous_record_hash, record_hash generated correctly.")

    # Create second record to verify chain linking
    rec2_payload = {
        "record_id": "REC-LIVE-002",
        "sample_reference_id": "SMP-SIH-2026-B",
        "operator_id": "OP-OFFICER-101",
        "image_sha256": "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
    }
    res = client.post("/api/records", json=rec2_payload)
    assert res.status_code == 201
    rec2_data = res.json()
    assert rec2_data["sequence_number"] == 2
    assert rec2_data["previous_record_hash"] == rec1_data["record_hash"]
    print(f" Record 2 Linked: ID={rec2_data['record_id']}, PrevHash={rec2_data['previous_record_hash'][:16]}... (matches Record 1 Hash)")

    # ------------------------------------------------------------------------
    # Step 4: GET /api/records & GET /api/records/{record_id}
    # ------------------------------------------------------------------------
    print("\n--- Step 4: Test GET /api/records and GET /api/records/{record_id} ---")
    list_res = client.get("/api/records")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total_count"] == 2
    print(f" List Records Count: {list_data['total_count']} records")

    get_res = client.get("/api/records/REC-LIVE-001")
    assert get_res.status_code == 200
    assert get_res.json()["record_id"] == "REC-LIVE-001"
    print(f" Single Record Retrieved: {get_res.json()['sample_reference_id']}")
    print("  -> Step 4 Passed.")

    # ------------------------------------------------------------------------
    # Step 5: GET /api/records/{record_id}/verify
    # ------------------------------------------------------------------------
    print("\n--- Step 5: Test GET /api/records/{record_id}/verify ---")
    ver_res = client.get("/api/records/REC-LIVE-001/verify")
    assert ver_res.status_code == 200
    ver_data = ver_res.json()
    print(f" Record 1 Verification: is_valid={ver_data['is_valid']}, status={ver_data['status']}")
    assert ver_data["is_valid"] is True
    assert ver_data["status"] == "VERIFIED"
    assert ver_data["link_valid"] is True
    assert ver_data["stored_hash"] == ver_data["calculated_hash"]
    print("  -> Step 5 Passed: Record reports is_valid=True and status=VERIFIED.")

    # ------------------------------------------------------------------------
    # Step 6: GET /api/chain/verify
    # ------------------------------------------------------------------------
    print("\n--- Step 6: Test GET /api/chain/verify ---")
    chain_res = client.get("/api/chain/verify")
    assert chain_res.status_code == 200
    chain_data = chain_res.json()
    print(f" Full Chain Audit: is_valid={chain_data['is_valid']}, status={chain_data['status']}, total={chain_data['total_records']}")
    assert chain_data["is_valid"] is True
    assert chain_data["status"] == "CHAIN_INTEGRITY_VERIFIED"
    assert chain_data["tampered_records_count"] == 0
    print("  -> Step 6 Passed: Complete chain is valid.")

    # ------------------------------------------------------------------------
    # Step 7: Tamper-detection test
    # ------------------------------------------------------------------------
    print("\n--- Step 7: Tamper-detection test ---")
    print(" [Simulating Attack] Modifying sample_reference_id in SQLite directly...")
    conn = sqlite3.connect(test_db_path)
    with conn:
        conn.execute("UPDATE evidence_records SET sample_reference_id = 'TAMPERED_SAMPLE_PAYLOAD' WHERE record_id = 'REC-LIVE-001';")
    conn.close()

    # Verify single record shows tampered
    t_rec_res = client.get("/api/records/REC-LIVE-001/verify")
    assert t_rec_res.status_code == 200
    t_rec_data = t_rec_res.json()
    print(f" Single Record Tamper Check: is_valid={t_rec_data['is_valid']}, status={t_rec_data['status']}")
    print(f"  Details: {t_rec_data['details']}")
    assert t_rec_data["is_valid"] is False
    assert t_rec_data["status"] == "TAMPERED"

    # Verify chain audit catches the tamper
    t_chain_res = client.get("/api/chain/verify")
    assert t_chain_res.status_code == 200
    t_chain_data = t_chain_res.json()
    print(f" Chain Tamper Check: is_valid={t_chain_data['is_valid']}, status={t_chain_data['status']}")
    print(f"  Tampered Record IDs: {t_chain_data['tampered_record_ids']}")
    assert t_chain_data["is_valid"] is False
    assert t_chain_data["status"] == "CHAIN_COMPROMISED"
    assert "REC-LIVE-001" in t_chain_data["tampered_record_ids"]
    print("  -> Step 7 Passed: Tamper detection successfully flagged modified record and compromised chain.")

    # Restore database for subsequent tests
    conn = sqlite3.connect(test_db_path)
    with conn:
        conn.execute("UPDATE evidence_records SET sample_reference_id = 'SMP-SIH-2026-A' WHERE record_id = 'REC-LIVE-001';")
    conn.close()

    # ------------------------------------------------------------------------
    # Step 8: Sync test
    # ------------------------------------------------------------------------
    print("\n--- Step 8: Sync test (POST /api/sync) ---")
    sync_new_payload = {
        "records": [
            {
                "id": "REC-SYNC-TEST-001",
                "referenceId": "SMP-FIELD-OFFLINE-X",
                "operatorId": "OP-SYNC-AGENT",
                "imageHash": "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "locationStatus": "available",
            }
        ]
    }
    # 8.1 Submit new record
    s1 = client.post("/api/sync", json=sync_new_payload)
    assert s1.status_code == 200
    s1_data = s1.json()
    print(f" 8.1 New Sync: synced_count={s1_data['synced_count']}, status={s1_data['results'][0]['status']}")
    assert s1_data["synced_count"] == 1
    assert s1_data["results"][0]["status"] == "synced"

    # 8.2 Duplicate sync (idempotency)
    s2 = client.post("/api/sync", json=sync_new_payload)
    assert s2.status_code == 200
    s2_data = s2.json()
    print(f" 8.2 Duplicate Sync: already_synced_count={s2_data['already_synced_count']}, status={s2_data['results'][0]['status']}")
    assert s2_data["synced_count"] == 0
    assert s2_data["already_synced_count"] == 1
    assert s2_data["results"][0]["status"] == "already_synced"

    # 8.3 Conflicting sync (same record_id, changed content)
    sync_conflict_payload = {
        "records": [
            {
                "id": "REC-SYNC-TEST-001",
                "referenceId": "SMP-DIFFERENT-FORGED-CONTENT",
                "operatorId": "OP-IMPOSTER",
                "imageHash": "0000000000000000000000000000000000000000000000000000000000000000",
            }
        ]
    }
    s3 = client.post("/api/sync", json=sync_conflict_payload)
    assert s3.status_code == 200
    s3_data = s3.json()
    print(f" 8.3 Conflicting Sync: conflict_count={s3_data['conflict_count']}, status={s3_data['results'][0]['status']}")
    print(f"  Message: {s3_data['results'][0]['message']}")
    assert s3_data["conflict_count"] == 1
    assert s3_data["results"][0]["status"] == "conflict"

    # Verify original record preserved
    orig = client.get("/api/records/REC-SYNC-TEST-001").json()
    assert orig["sample_reference_id"] == "SMP-FIELD-OFFLINE-X"
    print("  -> Step 8 Passed: Sync is idempotent and preserves original records against conflict.")

    # ------------------------------------------------------------------------
    # Step 9: Export test (GET /api/export/{record_id})
    # ------------------------------------------------------------------------
    print("\n--- Step 9: Export test (GET /api/export/{record_id}) ---")
    exp_res = client.get("/api/export/REC-LIVE-001")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    print(f" Evidence Export Type : {exp_data['export_type']}")
    print(f" Disclaimer           : {exp_data['disclaimer']}")
    print(f" Is Presumptive       : {exp_data['is_presumptive']}")
    print(f" Image SHA-256        : {exp_data['evidence_record']['forensic_integrity']['image_sha256']}")
    print(f" Record Hash          : {exp_data['evidence_record']['forensic_integrity']['record_hash'][:16]}...")
    print(f" Previous Record Hash : {exp_data['evidence_record']['forensic_integrity']['previous_record_hash'][:16]}...")
    print(f" GPS Location         : {exp_data['evidence_record']['location']}")
    print(f" Operator ID          : {exp_data['evidence_record']['operator_id']}")

    assert exp_data["export_type"] == "LAB_HANDOFF_EVIDENCE_PACKAGE"
    assert exp_data["is_presumptive"] is True
    assert "PRESUMPTIVE" in exp_data["disclaimer"]
    assert exp_data["evidence_record"]["forensic_integrity"]["image_sha256"] == rec1_payload["image_sha256"]
    assert exp_data["evidence_record"]["operator_id"] == "OP-OFFICER-101"
    assert exp_data["evidence_record"]["location"]["latitude"] == 28.6139
    assert exp_data["evidence_record"]["location"]["longitude"] == 77.2090
    assert exp_data["evidence_record"]["forensic_integrity"]["chain_verification_status"] == "VERIFIED"
    print("  -> Step 9 Passed: Complete forensic lab-handoff package exported with presumptive status and metadata.")

    # Clean up
    temp_dir.cleanup()
    print("\n" + "=" * 70)
    print("ALL LIVE VERIFICATION TESTS PASSED SUCCESSFULLY! (100% PASS)")
    print("=" * 70)

if __name__ == "__main__":
    run_live_verification()
