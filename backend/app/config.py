import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "evidence_records.db"

# Database Configuration
DATABASE_PATH = os.environ.get("DATABASE_PATH", str(DEFAULT_DB_PATH))

# Chain of Custody Configuration
GENESIS_HASH = "0" * 64
DISCLAIMER_TEXT = "FIELD TEST RESULTS ARE PRESUMPTIVE ONLY AND DO NOT REPLACE LABORATORY CONFIRMATION."

# API Metadata
APP_TITLE = "Field Test Companion - Evidence & Chain of Custody API"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = (
    "Backend service for secure field test record ingestion, "
    "deterministic hash-linked chain of custody auditability, "
    "idempotent offline synchronization, and evidence export."
)
