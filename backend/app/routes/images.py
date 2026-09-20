import os
import hashlib
import aiofiles
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from typing import Dict, Any

from ..auth import get_current_user

router = APIRouter(prefix="/api/images", tags=["Images"])

EVIDENCE_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence_images")

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Upload an evidence image payload",
    description="Uploads an image, computes its SHA-256 hash securely on the server, and stores it in the local evidence_images directory."
)
async def upload_image(file: UploadFile = File(...), current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type. Only images are allowed.")

    # Read file content and compute hash
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file payload.")

    file_hash = hashlib.sha256(content).hexdigest()

    # Create filename based on hash
    file_extension = ".jpg" if file.content_type == "image/jpeg" else ".png" if file.content_type == "image/png" else ""
    if not file_extension:
        file_extension = os.path.splitext(file.filename or "")[1].lower() or ".jpg"

    filename = f"{file_hash}{file_extension}"
    filepath = os.path.join(EVIDENCE_IMAGES_DIR, filename)

    # Save file
    async with aiofiles.open(filepath, 'wb') as out_file:
        await out_file.write(content)

    return {
        "status": "stored",
        "image_sha256": file_hash,
        "filename": filename
    }
