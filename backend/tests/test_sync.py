import pytest


def test_sync_new_records(client):
    sync_payload = {
        "records": [
            {
                "id": "REC-OFFLINE-001",
                "referenceId": "SMP-OFFLINE-1",
                "operatorId": "OP-10",
                "imageHash": "a" * 64,
                "latitude": 28.5,
                "longitude": 77.2,
                "locationStatus": "available",
            },
            {
                "id": "REC-OFFLINE-002",
                "referenceId": "SMP-OFFLINE-2",
                "operatorId": "OP-11",
                "imageHash": "b" * 64,
            },
        ]
    }
    res = client.post("/api/sync", json=sync_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["total_received"] == 2
    assert data["synced_count"] == 2
    assert data["already_synced_count"] == 0
    assert data["conflict_count"] == 0
    assert data["results"][0]["status"] == "synced"
    assert data["results"][1]["status"] == "synced"


def test_duplicate_sync_idempotency(client):
    record_payload = {
        "records": [
            {
                "id": "REC-IDEMPOTENT-01",
                "referenceId": "SMP-IDEMPOTENT",
                "operatorId": "OP-42",
                "imageHash": "c" * 64,
            }
        ]
    }

    # First sync -> Synced
    res1 = client.post("/api/sync", json=record_payload)
    assert res1.status_code == 200
    assert res1.json()["synced_count"] == 1

    # Second sync (identical) -> Idempotent already_synced
    res2 = client.post("/api/sync", json=record_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["total_received"] == 1
    assert data2["synced_count"] == 0
    assert data2["already_synced_count"] == 1
    assert data2["conflict_count"] == 0
    assert data2["results"][0]["status"] == "already_synced"

    # Verify total count on server is still exactly 1
    list_res = client.get("/api/records")
    assert list_res.json()["total_count"] == 1


def test_conflicting_sync_protection(client):
    initial_payload = {
        "records": [
            {
                "id": "REC-CONFLICT-01",
                "referenceId": "SMP-GENUINE",
                "operatorId": "OP-AUTHENTIC",
                "imageHash": "1" * 64,
            }
        ]
    }
    res1 = client.post("/api/sync", json=initial_payload)
    assert res1.status_code == 200
    original_hash = res1.json()["results"][0]["record_hash"]

    # Incoming conflicting sync payload with altered image hash and sample ID
    conflicting_payload = {
        "records": [
            {
                "id": "REC-CONFLICT-01",
                "referenceId": "SMP-FORGERY-ALTERED",
                "operatorId": "OP-UNKNOWN",
                "imageHash": "9" * 64,
            }
        ]
    }
    res2 = client.post("/api/sync", json=conflicting_payload)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["conflict_count"] == 1
    assert data2["results"][0]["status"] == "conflict"
    assert "Conflict detected" in data2["results"][0]["message"]

    # Verify server record was NOT silently overwritten
    server_rec = client.get("/api/records/REC-CONFLICT-01").json()
    assert server_rec["sample_reference_id"] == "SMP-GENUINE"
    assert server_rec["image_sha256"] == "1" * 64
    assert server_rec["record_hash"] == original_hash
