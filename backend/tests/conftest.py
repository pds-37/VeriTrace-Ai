import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import config
from app.database import init_db


@pytest.fixture(autouse=True)
def isolated_test_db(monkeypatch, tmp_path):
    """
    Creates an isolated SQLite database file for each test function,
    ensuring no state leaks between test runs.
    """
    test_db_file = tmp_path / "test_evidence.db"
    test_db_path = str(test_db_file)

    monkeypatch.setattr(config, "DATABASE_PATH", test_db_path)
    init_db(test_db_path)

    yield test_db_path


@pytest.fixture
def client():
    """
    Returns a FastAPI TestClient instance.
    """
    with TestClient(app) as test_client:
        yield test_client
