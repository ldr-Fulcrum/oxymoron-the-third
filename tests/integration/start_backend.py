"""Test-owned loopback server with OS-assigned port; no fixed-port collision."""
import socket
import sys
from pathlib import Path
print("Loading execution backend dependencies", file=sys.stderr, flush=True)
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.main import app

listener = socket.socket()
listener.bind(('127.0.0.1', 0))
print(listener.getsockname()[1], flush=True)
uvicorn.Server(uvicorn.Config(app, log_level='error')).run(sockets=[listener])
