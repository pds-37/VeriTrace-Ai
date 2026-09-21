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


from app.auth import get_current_user, get_admin_user

def mock_get_current_user():
    return {"sub": "test_user", "username": "test_user"}

def mock_get_admin_user():
    return {"sub": "admin_user", "username": "admin_user"}

@pytest.fixture
def client():
    """
    Returns a FastAPI TestClient instance with mocked authentication.
    """
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_admin_user] = mock_get_admin_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

from unittest.mock import patch

@pytest.fixture(autouse=True)
def mock_image_exists():
    with patch("app.routes.sync.os.path.exists", return_value=True):
        yield
