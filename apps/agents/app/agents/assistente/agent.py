# ruff: noqa
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

from google.adk.agents import Agent
from google.adk.apps import App

from app.model import build_model

from .tools import get_current_time, get_weather


root_agent = Agent(
    # Keep in sync with create_params.root_agent_name in agents-cli-manifest.yaml:
    # telemetry reports this name as gen_ai.agent.name, and agents-cli reports the
    # manifest's value. Renaming the agent only here makes the two disagree, and
    # anything selecting traces by name stops finding this agent's.
    name="assistente",
    # Provedor e modelo por AGENT_MODEL (spec da F11, "Modelo de IA").
    model=build_model(),
    # Instrução mínima da F11-T03; as instruções do resumo e as ferramentas dele são da F11-T04.
    instruction=(
        "Você é o Assistente, um agente que responde na Conversa de um chat de equipe. "
        "Responda em português do Brasil, em poucas frases, ao pedido de quem o mencionou. "
        "Nunca escreva @usuário de ninguém."
    ),
    tools=[get_weather, get_current_time],
)

# O ADK serve o agente em /apps/<nome da pasta>: o nome do App é o da pasta.
app = App(
    root_agent=root_agent,
    name="assistente",
)
