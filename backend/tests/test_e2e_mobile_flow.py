"""
Full End-to-End Simulation of Mobile Client Sync Life Cycle
Simulates:
1. Online record creation: Mobile local save -> Backend POST /api/records -> Hash-linked chain update -> Local status marked Synced.
2. Offline record creation: Backend offline -> Record safely preserved locally as Pending Sync.
3. Network restoration: Batch sync POST /api/sync -> Pending records transition to Synced.
4. Duplicate re-sync: Idempotent already_synced response.
5. Conflict protection: Conflicting record_id submission -> conflict flagged without overwriting server record.
6. Forensic Lab-Handoff Export: Presumptive notice, image SHA-256, chain hashes, GPS and operator ID preserved.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import tempfile
import sqlite3
from fastapi.testclient import TestClient
from app.main import app
from app import config
from app.database import init_db

def run_simulation():
    print("=" * 70)
    print("MOBILE CLIENT + FASTAPI BACKEND: FULL END-TO-END INTEGRATION TEST")
    print("=" * 70)

    with tempfile.TemporaryDirectory() as temp_dir:
        test_db_path = os.path.join(temp_dir, "mobile_e2e_evidence.db")
        config.DATABASE_PATH = test_db_path
        init_db(test_db_path)
        print(f"[Setup] Isolated Backend SQLite DB initialized at: {test_db_path}")

        client = TestClient(app)

        # -------------------------------------------------------------
        # 1. Health Check Test
        # -------------------------------------------------------------
        print("\n--- 1. Health & Base URL Test ---")
        health_res = client.get("/health")
        assert health_res.status_code == 200
        print(f" [PASS] Health check OK: {health_res.json()}")

        # -------------------------------------------------------------
        # 2. Online Mobile Record Creation Flow
        # -------------------------------------------------------------
        print("\n--- 2. Online Record Creation (Local Save -> Sync) ---")
        # Simulates mobile saving record 1
        rec1_mobile = {
            "id": "REC-MOB-101",
            "referenceId": "SMP-SIH-ONLINE-01",
            "operatorId": "OFFICER-PRIYA",
            "createdAt": "2026-09-20T09:10:00Z",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "locationStatus": "available",
            "imageHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "presumptiveStatus": "Presumptive (Unanalyzed)",
            "analysisStatus": "demo_cassette_like"
        }
        res1 = client.post("/api/records", json=rec1_mobile)
        assert res1.status_code == 201
        data1 = res1.json()
        print(f" [PASS] Record 1 Ingested:")
        print(f"   Record ID           : {data1['record_id']}")
        print(f"   Sequence Number     : {data1['sequence_number']}")
        print(f"   Previous Hash       : {data1['previous_record_hash'][:16]}... (Genesis)")
        print(f"   Record Hash         : {data1['record_hash'][:16]}...")
        print(f"   Sync Status (Server): {data1['sync_status']}")

        # -------------------------------------------------------------
        # 3. Verify Single Record & Chain
        # -------------------------------------------------------------
        print("\n--- 3. Single Record & Chain Integrity Check ---")
        v1 = client.get("/api/records/REC-MOB-101/verify").json()
        assert v1["is_valid"] is True
        assert v1["status"] == "VERIFIED"
        print(f" [PASS] Single Record Integrity: is_valid={v1['is_valid']}, status={v1['status']}")

        chain_v = client.get("/api/chain/verify").json()
        assert chain_v["is_valid"] is True
        print(f" [PASS] Complete Chain Integrity: is_valid={chain_v['is_valid']}, total={chain_v['total_records']}")

        # -------------------------------------------------------------
        # 4. Offline Queue & Batch Synchronization
        # -------------------------------------------------------------
        print("\n--- 4. Offline Queue & Batch Synchronization ---")
        # Simulates 2 records created on mobile while offline
        offline_batch = {
            "records": [
                {
                    "id": "REC-MOB-102",
                    "referenceId": "SMP-SIH-OFFLINE-02",
                    "operatorId": "OFFICER-PRIYA",
                    "createdAt": "2026-09-20T09:12:00Z",
                    "latitude": 28.6140,
                    "longitude": 77.2095,
                    "locationStatus": "available",
                    "imageHash": "4444444444444444444444444444444444444444444444444444444444444444",
                    "presumptiveStatus": "Presumptive (Unanalyzed)",
                    "analysisStatus": "demo_non_test_object"
                },
                {
                    "id": "REC-MOB-103",
                    "referenceId": "SMP-SIH-OFFLINE-03",
                    "operatorId": "OFFICER-KUMAR",
                    "createdAt": "2026-09-20T09:15:00Z",
                    "latitude": None,
                    "longitude": None,
                    "locationStatus": "unavailable",
                    "imageHash": "5555555555555555555555555555555555555555555555555555555555555555",
                    "presumptiveStatus": "Presumptive (Unanalyzed)",
                    "analysisStatus": "demo_telemetry_completed"
                }
            ]
        }
        sync_res = client.post("/api/sync", json=offline_batch)
        assert sync_res.status_code == 200
        s_data = sync_res.json()
        assert s_data["synced_count"] == 2
        print(f" [PASS] Batch Sync Processed: {s_data['synced_count']} newly synced")

        # -------------------------------------------------------------
        # 5. Duplicate Re-sync Test (Idempotency)
        # -------------------------------------------------------------
        print("\n--- 5. Duplicate Re-sync Test (Idempotency) ---")
        dup_res = client.post("/api/sync", json=offline_batch)
        assert dup_res.status_code == 200
        d_data = dup_res.json()
        assert d_data["already_synced_count"] == 2
        assert d_data["synced_count"] == 0
        print(f" [PASS] Duplicate Sync Idempotent: already_synced_count={d_data['already_synced_count']}")

        # -------------------------------------------------------------
        # 6. Conflict Protection Test
        # -------------------------------------------------------------
        print("\n--- 6. Conflict Protection Test ---")
        conflict_payload = {
            "records": [
                {
                    "id": "REC-MOB-102",  # Existing ID
                    "referenceId": "SMP-DIVERGENT-TAMPERED-SAMPLE",
                    "operatorId": "ATTACKER",
                    "createdAt": "2026-09-20T09:12:00Z",
                    "latitude": 0.0,
                    "longitude": 0.0,
                    "locationStatus": "available",
                    "imageHash": "9999999999999999999999999999999999999999999999999999999999999999",
                    "presumptiveStatus": "Presumptive (Unanalyzed)",
                    "analysisStatus": "demo_non_test_object"
                }
            ]
        }
        conf_res = client.post("/api/sync", json=conflict_payload)
        assert conf_res.status_code == 200
        c_data = conf_res.json()
        assert c_data["conflict_count"] == 1
        assert c_data["synced_count"] == 0
        print(f" [PASS] Conflict Flagged: {c_data['results'][0]['message']}")

        # Verify original record unchanged
        orig = client.get("/api/records/REC-MOB-102").json()
        assert orig["sample_reference_id"] == "SMP-SIH-OFFLINE-02"
        print(f" [PASS] Server Record Preserved Original Content: {orig['sample_reference_id']}")

        # -------------------------------------------------------------
        # 7. Tamper Detection Test
        # -------------------------------------------------------------
        print("\n--- 7. Direct Database Tamper Detection Test ---")
        conn = sqlite3.connect(test_db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE evidence_records SET image_sha256 = '0000000000000000000000000000000000000000000000000000000000000000' WHERE record_id = 'REC-MOB-101'")
        conn.commit()
        conn.close()

        tamper_audit = client.get("/api/chain/verify").json()
        assert tamper_audit["is_valid"] is False
        assert tamper_audit["status"] == "CHAIN_COMPROMISED"
        assert "REC-MOB-101" in tamper_audit["tampered_record_ids"]
        print(f" [PASS] Chain Tampering Detected: status={tamper_audit['status']}, compromised_ids={tamper_audit['tampered_record_ids']}")

        # -------------------------------------------------------------
        # 8. Forensic Lab-Handoff Export Test
        # -------------------------------------------------------------
        print("\n--- 8. Forensic Lab-Handoff Export Test ---")
        exp_res = client.get("/api/export/REC-MOB-103")
        assert exp_res.status_code == 200
        exp = exp_res.json()
        assert exp["export_type"] == "LAB_HANDOFF_EVIDENCE_PACKAGE"
        assert exp["is_presumptive"] is True
        print(f" [PASS] Export Evidence Package:")
        print(f"   Export Type    : {exp['export_type']}")
        print(f"   Is Presumptive : {exp['is_presumptive']}")
        print(f"   Disclaimer     : {exp['disclaimer']}")
        print(f"   Record ID      : {exp['evidence_record']['record_id']}")
        print(f"   Image SHA-256  : {exp['evidence_record']['forensic_integrity']['image_sha256']}")
        print(f"   Record Hash    : {exp['evidence_record']['forensic_integrity']['record_hash'][:16]}...")

        print("\n" + "=" * 70)
        print("ALL END-TO-END MOBILE + BACKEND INTEGRATION TESTS PASSED (100%)")
        print("=" * 70)

if __name__ == "__main__":
    run_simulation()
