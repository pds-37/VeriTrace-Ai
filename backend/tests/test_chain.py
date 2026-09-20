import sqlite3
import pytest
from app.chain import compute_record_hash
from app.config import GENESIS_HASH
from app.database import get_connection


def test_deterministic_hash_generation():
    params = {
        "record_id": "REC-HASH-TEST",
        "sample_reference_id": "SMP-100",
        "operator_id": "OP-1",
        "timestamp": "2026-09-20T08:00:00Z",
        "latitude": 12.345678,
        "longitude": 98.765432,
        "location_status": "available",
        "image_sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "presumptive_status": "Presumptive (Unanalyzed)",
        "classification_result": "Cassette-like object",
        "previous_record_hash": GENESIS_HASH,
    }
    hash1 = compute_record_hash(**params)
    hash2 = compute_record_hash(**params)

    assert len(hash1) == 64
    assert hash1 == hash2

    # Changing any single field should produce a completely different hash
    params_modified = dict(params, sample_reference_id="SMP-101")
    hash3 = compute_record_hash(**params_modified)
    assert hash1 != hash3


def test_chain_linking(client):
    r1 = client.post("/api/records", json={
        "record_id": "REC-CHAIN-1",
        "sample_reference_id": "SMP-1",
        "image_sha256": "1" * 64,
    }).json()

    r2 = client.post("/api/records", json={
        "record_id": "REC-CHAIN-2",
        "sample_reference_id": "SMP-2",
        "image_sha256": "2" * 64,
    }).json()

    r3 = client.post("/api/records", json={
        "record_id": "REC-CHAIN-3",
        "sample_reference_id": "SMP-3",
        "image_sha256": "3" * 64,
    }).json()

    # Record 1 links to Genesis
    assert r1["previous_record_hash"] == GENESIS_HASH
    # Record 2 links to Record 1's record_hash
    assert r2["previous_record_hash"] == r1["record_hash"]
    # Record 3 links to Record 2's record_hash
    assert r3["previous_record_hash"] == r2["record_hash"]


def test_chain_verification_intact(client):
    for i in range(5):
        client.post("/api/records", json={
            "record_id": f"REC-AUDIT-{i}",
            "sample_reference_id": f"SMP-{i}",
            "image_sha256": f"{i}" * 64,
        })

    res = client.get("/api/chain/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["total_records"] == 5
    assert data["tampered_records_count"] == 0
    assert len(data["tampered_record_ids"]) == 0
    assert data["status"] == "CHAIN_INTEGRITY_VERIFIED"


def test_tamper_detection_data_modification(client, isolated_test_db):
    # Create 3 records
    for i in range(1, 4):
        client.post("/api/records", json={
            "record_id": f"REC-TAMPER-{i}",
            "sample_reference_id": f"SMP-ORIGINAL-{i}",
            "image_sha256": f"{i}" * 64,
        })

    # Tamper with Record 2 directly in SQLite database
    conn = sqlite3.connect(isolated_test_db)
    with conn:
        conn.execute(
            "UPDATE evidence_records SET sample_reference_id = 'SMP-TAMPERED-FORGERY' WHERE record_id = 'REC-TAMPER-2';"
        )
    conn.close()

    # Verify single record shows TAMPERED
    single_res = client.get("/api/records/REC-TAMPER-2/verify")
    assert single_res.status_code == 200
    single_data = single_res.json()
    assert single_data["is_valid"] is False
    assert single_data["status"] == "TAMPERED"

    # Verify full chain detects the compromised record
    chain_res = client.get("/api/chain/verify")
    assert chain_res.status_code == 200
    chain_data = chain_res.json()
    assert chain_data["is_valid"] is False
    assert chain_data["status"] == "CHAIN_COMPROMISED"
    assert "REC-TAMPER-2" in chain_data["tampered_record_ids"]


def test_tamper_detection_broken_link(client, isolated_test_db):
    for i in range(1, 4):
        client.post("/api/records", json={
            "record_id": f"REC-LINK-{i}",
            "sample_reference_id": f"SMP-{i}",
            "image_sha256": f"{i}" * 64,
        })

    # Tamper with Record 3's previous_record_hash
    conn = sqlite3.connect(isolated_test_db)
    with conn:
        conn.execute(
            "UPDATE evidence_records SET previous_record_hash = 'f' * 64 WHERE record_id = 'REC-LINK-3';"
        )
    conn.close()

    chain_res = client.get("/api/chain/verify")
    assert chain_res.status_code == 200
    chain_data = chain_res.json()
    assert chain_data["is_valid"] is False
    assert "REC-LINK-3" in chain_data["tampered_record_ids"]
