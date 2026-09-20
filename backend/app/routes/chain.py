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
