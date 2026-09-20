import pytest
from app.config import DISCLAIMER_TEXT


def test_export_evidence_package_success(client):
    rec_id = "REC-EXPORT-001"
    create_res = client.post("/api/records", json={
        "record_id": rec_id,
        "sample_reference_id": "SMP-EXPORT-EVIDENCE",
        "operator_id": "OP-FORENSIC-99",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location_status": "available",
        "image_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "presumptive_status": "Presumptive (Unanalyzed)",
        "classification_result": "Cassette-like object",
    })
    assert create_res.status_code == 201
    created_data = create_res.json()

    export_res = client.get(f"/api/export/{rec_id}")
    assert export_res.status_code == 200
    export_data = export_res.json()

    assert export_data["export_type"] == "LAB_HANDOFF_EVIDENCE_PACKAGE"
    assert export_data["schema_version"] == "1.0"
    assert export_data["is_presumptive"] is True
    assert export_data["disclaimer"] == DISCLAIMER_TEXT

    # Evidence record details
    rec = export_data["evidence_record"]
    assert rec["record_id"] == rec_id
    assert rec["sample_reference_id"] == "SMP-EXPORT-EVIDENCE"
    assert rec["operator_id"] == "OP-FORENSIC-99"
    assert rec["location"]["latitude"] == 28.6139
    assert rec["location"]["longitude"] == 77.2090

    # Forensic integrity section
    integrity = rec["forensic_integrity"]
    assert integrity["image_sha256"] == "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    assert integrity["record_hash"] == created_data["record_hash"]
    assert integrity["chain_verification_status"] == "VERIFIED"

    # Provenance section
    prov = export_data["chain_of_custody_provenance"]
    assert prov["custody_event"] == "DIGITAL_EVIDENCE_ACQUISITION"
    assert prov["hash_algorithm"] == "SHA-256"
    assert prov["tamper_evident_linked"] is True


def test_export_non_existent_record(client):
    res = client.get("/api/export/REC-NON-EXISTENT")
    assert res.status_code == 404
