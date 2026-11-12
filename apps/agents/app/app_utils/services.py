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

"""Process-wide ADK session/artifact services shared by every serving surface.

Registered under ``shared://`` so every route of the ADK app shares one instance:
a session created on any route is visible to the others.
"""

from __future__ import annotations

import functools
import os

from google.adk.artifacts import InMemoryArtifactService
from google.adk.cli.service_registry import get_service_registry
from google.adk.cli.utils.service_factory import create_session_service_from_options

SESSION_SERVICE_URI = "shared://session"
ARTIFACT_SERVICE_URI = "shared://artifact"

_AGENT_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)


@functools.cache
def build_session_service(uri: str | None):
    """O serviço de sessões do ADK: o Banco dos agentes com a URI, ou em memória sem ela.

    Uma instância por URI no processo: as rotas genéricas e a rota de Pedido dividem a mesma, e o
    mesmo pool de conexões.
    """
    if uri:
        return create_session_service_from_options(
            base_dir=_AGENT_DIR, session_service_uri=uri
        )
    from google.adk.sessions.in_memory_session_service import InMemorySessionService

    return InMemorySessionService()


def get_session_service():
    """Process-wide session service: the Banco dos agentes when SESSION_SERVICE_URI is set."""
    return build_session_service(os.environ.get("SESSION_SERVICE_URI"))


@functools.cache
def get_artifact_service():
    """Process-wide artifact service, in memory."""
    return InMemoryArtifactService()


_registry = get_service_registry()
_registry.register_session_service("shared", lambda uri, **kw: get_session_service())
_registry.register_artifact_service("shared", lambda uri, **kw: get_artifact_service())
