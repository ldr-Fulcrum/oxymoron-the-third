from fastapi import FastAPI
from pydantic import BaseModel, Field
import subprocess
import time


app = FastAPI(title="Contradictor Execution Backend")


class ExecutionRequest(BaseModel):
    request_id: str
    executable: str
    args: list[str]
    timeout_ms: int = Field(gt=0)


class ExecutionResponse(BaseModel):
    request_id: str
    status: str
    exit_code: int | None
    stdout: str
    stderr: str
    timed_out: bool
    duration_ms: int
    process_error: str | None




def run_process(request: ExecutionRequest):
    start = time.monotonic()

    try:
        result = subprocess.run(
            [request.executable, *request.args],
            capture_output=True,
            text=True,
            timeout=request.timeout_ms / 1000,
        )

    except FileNotFoundError:
        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "request_id": request.request_id,
            "status": "process_error",
            "exit_code": None,
            "stdout": "",
            "stderr": "",
            "timed_out": False,
            "duration_ms": duration_ms,
            "process_error": "EXECUTABLE_NOT_FOUND",
        }

    except subprocess.TimeoutExpired as exc:
        duration_ms = int((time.monotonic() - start) * 1000)

        stdout = exc.stdout or ""
        stderr = exc.stderr or ""

        if isinstance(stdout, bytes):
            stdout = stdout.decode(errors="replace")

        if isinstance(stderr, bytes):
            stderr = stderr.decode(errors="replace")

        return {
            "request_id": request.request_id,
            "status": "timeout",
            "exit_code": None,
            "stdout": stdout,
            "stderr": stderr,
            "timed_out": True,
            "duration_ms": duration_ms,
            "process_error": "TIMEOUT",
        }
    except Exception:
        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "request_id": request.request_id,
            "status": "error",
            "exit_code": None,
            "stdout": "",
            "stderr": "",
            "timed_out": False,
            "duration_ms": duration_ms,
            "process_error": "BACKEND_EXECUTION_ERROR",
        }
    duration_ms = int((time.monotonic() - start) * 1000)

    return {
        "request_id": request.request_id,
        "status": "completed",
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "timed_out": False,
        "duration_ms": duration_ms,
        "process_error": None,
    }

@app.post("/execute", response_model=ExecutionResponse)
def execute(request: ExecutionRequest):
    return run_process(request)
@app.get("/health")
def health():
    return {"status": "ok"}
