import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_execute_success():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-001",
            "executable": sys.executable,
            "args": ["tests/fixtures/success.py"],
            "timeout_ms": 2000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-001"
    assert data["status"] == "completed"
    assert data["exit_code"] == 0
    assert data["stdout"] == "hello\n"
    assert data["stderr"] == ""
    assert data["timed_out"] is False
    assert data["duration_ms"] >= 0
    assert data["process_error"] is None 


def test_execute_failure():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-002",
            "executable": sys.executable,
            "args": ["tests/fixtures/failure.py"],
            "timeout_ms": 2000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-002"
    assert data["status"] == "completed"
    assert data["exit_code"] == 1
    assert data["stdout"] == "test failed\n"
    assert data["stderr"] == ""
    assert data["timed_out"] is False
    assert data["duration_ms"] >= 0
    assert data["process_error"] is None


def test_execute_timeout():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-003",
            "executable": sys.executable,
            "args": ["tests/fixtures/timeout.py"],
            "timeout_ms": 1000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-003"
    assert data["status"] == "timeout"
    assert data["exit_code"] is None
    assert data["stdout"] == ""
    assert data["stderr"] == ""
    assert data["timed_out"] is True
    assert data["duration_ms"] >= 1000
    assert data["process_error"] == "TIMEOUT"


def test_execute_process_error():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-005",
            "executable": "this-command-does-not-exist",
            "args": [],
            "timeout_ms": 2000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-005"
    assert data["status"] == "process_error"
    assert data["exit_code"] is None
    assert data["stdout"] == ""
    assert data["stderr"] == ""
    assert data["timed_out"] is False
    assert data["duration_ms"] >= 0
    assert data["process_error"] == "EXECUTABLE_NOT_FOUND"


def test_execute_stdout_stderr():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-006",
            "executable": sys.executable,
            "args": ["tests/fixtures/output.py"],
            "timeout_ms": 2000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-006"
    assert data["status"] == "completed"
    assert data["exit_code"] == 0
    assert data["stdout"] == "normal output\n"
    assert data["stderr"] == "error output\n"
    assert data["timed_out"] is False
    assert data["duration_ms"] >= 0
    assert data["process_error"] is None


def test_execute_timeout_preserves_partial_output():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-004",
            "executable": sys.executable,
            "args": [
                "-c",
                "import sys,time; print('started', flush=True); print('warning', file=sys.stderr, flush=True); time.sleep(5)",
            ],
            "timeout_ms": 1000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-004"
    assert data["status"] == "timeout"
    assert data["exit_code"] is None
    assert data["stdout"] == "started\n"
    assert data["stderr"] == "warning\n"
    assert data["timed_out"] is True
    assert data["duration_ms"] >= 1000
    assert data["process_error"] == "TIMEOUT"


def test_execute_unexpected_error(monkeypatch):
    def raise_error(*args, **kwargs):
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr("backend.main.subprocess.run", raise_error)

    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-007",
            "executable": sys.executable,
            "args": ["-c", "print('hello')"],
            "timeout_ms": 2000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["request_id"] == "REQ-007"
    assert data["status"] == "error"
    assert data["exit_code"] is None
    assert data["stdout"] == ""
    assert data["stderr"] == ""
    assert data["timed_out"] is False
    assert data["duration_ms"] >= 0
    assert data["process_error"] == "BACKEND_EXECUTION_ERROR"

def test_execute_response_schema():
    response = client.post(
        "/execute",
        json={
            "request_id": "REQ-008",
            "executable": sys.executable,
            "args": ["tests/fixtures/success.py"],
            "timeout_ms": 2000,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert set(data.keys()) == {
        "request_id",
        "status",
        "exit_code",
        "stdout",
        "stderr",
        "timed_out",
        "duration_ms",
        "process_error",
    }