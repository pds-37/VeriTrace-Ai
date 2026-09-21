from typing import Dict, Any
from fastapi import APIRouter, Depends

from ..models import ChainVerificationResponse
from ..database import get_connection, get_all_records
from ..chain import verify_full_chain
from ..auth import get_admin_user

router = APIRouter(prefix="/api/chain", tags=["Chain of Custody"])


@router.get(
    "/verify",
    response_model=ChainVerificationResponse,
    summary="Verify full chain of custody integrity",
    description="Audits the entire sequence of evidence records from genesis to the current head."
)
def verify_chain(current_user: Dict[str, Any] = Depends(get_admin_user)):
    conn = get_connection()
    try:
        # Fetch all records ordered chronologically from genesis (ascending)
        all_records = get_all_records(conn, limit=100000, offset=0, ascending=True)
        report = verify_full_chain(all_records)
        return ChainVerificationResponse(**report)
    finally:
        conn.close()

@router.post(
    "/simulate-tamper",
    summary="Simulate Database Tampering for Demo",
    description="Intentionally corrupts the latest record's data without updating its hash, to demonstrate chain compromise."
)
def simulate_tamper(current_user: Dict[str, Any] = Depends(get_admin_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Find the max sequence number
        cursor.execute("SELECT MAX(sequence_number) FROM records")
        row = cursor.fetchone()
        if not row or not row[0]:
            return {"status": "error", "detail": "No records to tamper."}
        max_seq = row[0]
        
        # Corrupt the operator_id
        cursor.execute(
            "UPDATE records SET operator_id = 'TAMPERED-OPERATOR' WHERE sequence_number = ?",
            (max_seq,)
        )
        conn.commit()
        return {"status": "success", "detail": f"Record seq {max_seq} tampered successfully."}
    finally:
        conn.close()
