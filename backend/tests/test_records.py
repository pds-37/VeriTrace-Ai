import pytest
from app.config import GENESIS_HASH


def test_create_record_success(client):
    payload = {
        "record_id": "REC-2026-TEST-001",
        "sample_reference_id": "SMP-2026-001",
        "operator_id": "OP-104",
        "timestamp": "2026-09-20T08:30:00Z",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location_status": "available",
        "image_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "presumptive_status": "Presumptive (Unanalyzed)",
        "classification_result": "Cassette-like object",
    }
    response = client.post("/api/records", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["record_id"] == "REC-2026-TEST-001"
    assert data["sample_reference_id"] == "SMP-2026-001"
    assert data["operator_id"] == "OP-104"
    assert data["sequence_number"] == 1
    assert data["previous_record_hash"] == GENESIS_HASH
    assert len(data["record_hash"]) == 64
    assert data["sync_status"] == "synced"


def test_create_record_auto_generated_id(client):
    payload = {
        "sample_reference_id": "SMP-AUTO-ID",
        "image_sha256": "a" * 64,
    }
    response = client.post("/api/records", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["record_id"].startswith("REC-")
    assert data["sample_reference_id"] == "SMP-AUTO-ID"


def test_create_record_duplicate_id_conflict(client):
    payload = {
        "record_id": "REC-DUPLICATE-01",
        "sample_reference_id": "SMP-ORIGINAL",
        "image_sha256": "b" * 64,
    }
    res1 = client.post("/api/records", json=payload)
    assert res1.status_code == 201

    # Attempt to insert same record_id
    res2 = client.post("/api/records", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_get_records_list(client):
    for i in range(3):
        client.post("/api/records", json={
            "record_id": f"REC-LIST-{i}",
            "sample_reference_id": f"SMP-{i}",
            "image_sha256": f"{i}" * 64,
        })

    response = client.get("/api/records")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 3
    assert len(data["records"]) == 3
    assert data["records"][0]["sequence_number"] == 1
    assert data["records"][2]["sequence_number"] == 3


def test_get_single_record(client):
    rec_id = "REC-FIND-ME"
    client.post("/api/records", json={
        "record_id": rec_id,
        "sample_reference_id": "SMP-TARGET",
        "image_sha256": "c" * 64,
    })

    res = client.get(f"/api/records/{rec_id}")
    assert res.status_code == 200
    assert res.json()["record_id"] == rec_id

    res_404 = client.get("/api/records/NON-EXISTENT")
    assert res_404.status_code == 404


def test_verify_single_record_valid(client):
    rec_id = "REC-VERIFY-01"
    client.post("/api/records", json={
        "record_id": rec_id,
        "sample_reference_id": "SMP-VERIFY",
        "image_sha256": "d" * 64,
    })

    res = client.get(f"/api/records/{rec_id}/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["link_valid"] is True
    assert data["status"] == "VERIFIED"
    assert data["stored_hash"] == data["calculated_hash"]
