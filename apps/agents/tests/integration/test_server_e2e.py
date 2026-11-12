# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import logging
import os
import socket
import subprocess
import sys
import threading
import time
import uuid
from collections.abc import Iterator
from typing import Any

import httpx
import pytest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_NAME = "assistente"
HEADERS = {"Content-Type": "application/json"}
# Streaming runs make several model calls (and tool calls such as web search);
# the read timeout must cover the longest gap between streamed events.
STREAM_TIMEOUT = 120


def free_port() -> int:
    """A free port on 127.0.0.1, so the test never collides with the dev server."""
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def log_output(pipe: Any, log_func: Any) -> None:
    """Log the output from the given pipe."""
    for line in iter(pipe.readline, ""):
        log_func(line.strip())


def start_server(port: int) -> subprocess.Popen[str]:
    """Start the FastAPI server using subprocess and log its output."""
    command = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.fast_api_app:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
    ]
    env = os.environ.copy()
    env["INTEGRATION_TEST"] = "TRUE"
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        env=env,
    )

    # Start threads to log stdout and stderr in real-time
    threading.Thread(
        target=log_output, args=(process.stdout, logger.info), daemon=True
    ).start()
    threading.Thread(
        target=log_output, args=(process.stderr, logger.error), daemon=True
    ).start()

    return process


def wait_for_server(base_url: str, timeout: int = 90, interval: int = 1) -> bool:
    """Wait for the server to list the agents."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = httpx.get(f"{base_url}/list-apps", timeout=10)
            if response.status_code == 200:
                logger.info("Server is ready")
                return True
        except httpx.HTTPError:
            pass
        time.sleep(interval)
    logger.error(f"Server did not become ready within {timeout} seconds")
    return False


@pytest.fixture(scope="session")
def base_url(request: Any) -> Iterator[str]:
    """Start the server for the session and return its base URL."""
    port = free_port()
    url = f"http://127.0.0.1:{port}"
    logger.info("Starting server process")
    server_process = start_server(port)
    if not wait_for_server(url):
        server_process.terminate()
        pytest.fail("Server failed to start")
    logger.info("Server process started")

    def stop_server() -> None:
        logger.info("Stopping server process")
        server_process.terminate()
        server_process.wait()
        logger.info("Server process stopped")

    request.addfinalizer(stop_server)
    yield url


def test_list_apps(base_url: str) -> None:
    """Every folder in app/agents is served as an agent."""
    response = httpx.get(f"{base_url}/list-apps", timeout=10)
    assert response.status_code == 200
    assert response.json() == [APP_NAME]


def test_adk_run_sse(base_url: str) -> None:
    """Test the native ADK route (/run_sse) end to end."""
    logger.info("Starting ADK /run_sse test")
    user_id = f"user_{uuid.uuid4()}"
    session_data = {"state": {"preferred_language": "English", "visit_count": 1}}

    session_response = httpx.post(
        f"{base_url}/apps/{APP_NAME}/users/{user_id}/sessions",
        headers=HEADERS,
        json=session_data,
        timeout=60,
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["id"]

    data = {
        "app_name": APP_NAME,
        "user_id": user_id,
        "session_id": session_id,
        "new_message": {"role": "user", "parts": [{"text": "Hi!"}]},
        "streaming": True,
    }
    events = []
    with httpx.stream(
        "POST",
        f"{base_url}/run_sse",
        headers=HEADERS,
        json=data,
        timeout=STREAM_TIMEOUT,
    ) as response:
        assert response.status_code == 200
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

    assert events, "No events received from stream"
    has_text_content = any(
        (content := event.get("content"))
        and content.get("parts")
        and any(part.get("text") for part in content["parts"])
        for event in events
    )
    assert has_text_content, "Expected at least one event with text content"
