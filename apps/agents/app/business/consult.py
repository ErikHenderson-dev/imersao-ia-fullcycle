"""A consulta a Dados de negócio, que a ferramenta `consultar_dados` faz (spec da F13, "O Agente
`assistente`").

O modelo só escolhe a Métrica e as datas; o código confere a Permissão de dados antes de tocar o
banco, monta o SQL, confere que só lê, consulta com o usuário só leitura, escreve o texto, confere o
lastro, grava a auditoria e só então a `reply`. A Permissão de dados vem do estado do Pedido, que o
modelo não vê.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.business import audit, names
from app.business.answer import (
    NAO_CONSEGUI_RESPONDER,
    SEM_PERMISSAO,
    Comparison,
    allowed_numbers,
    answer_text,
    comparable,
    not_found_text,
    rounded,
    too_generic_text,
    unresolved_name_text,
    variation,
    which_name_text,
)
from app.business.catalog import (
    FILTERABLE,
    METRICS,
    Filter,
    Period,
    compiled_sql,
    query_for,
)
from app.business.db import BusinessStore
from app.business.lastro import has_lastro
from app.business.readonly import assert_read_only
from app.chat_api import ChatApiClient

logger = logging.getLogger(__name__)

# A ferramenta gravou a resposta: o fim do Pedido não grava outra `reply`.
DONE = {"resposta": "gravada na Conversa; não escreva nada"}


# A pergunta de nome lista no máximo estes nomes; mais que isso, pede um nome mais completo.
MAX_NAME_OPTIONS = 5


@dataclass(frozen=True)
class Params:
    period: Period
    compared: Period | None
    filter_kind: str | None
    filter_name: str | None


def _period(start: str | None, end: str | None) -> Period | str:
    try:
        period = Period(date.fromisoformat(start or ""), date.fromisoformat(end or ""))
    except ValueError:
        return "As datas precisam estar no formato AAAA-MM-DD."
    if period.start > period.end:
        return "O início precisa ser antes do fim."
    return period


def parse_params(
    metrica: str,
    inicio: str,
    fim: str,
    bruto: bool,
    comparar_inicio: str | None = None,
    comparar_fim: str | None = None,
    filtro_tipo: str | None = None,
    filtro_nome: str | None = None,
) -> Params | dict[str, str]:
    """Os parâmetros validados, ou o `erro` que volta ao modelo, sem consulta."""
    if metrica not in METRICS:
        return {
            "erro": f"Métrica fora do catálogo: use uma de {', '.join(sorted(METRICS))}."
        }
    if bruto and metrica != "faturamento":
        return {"erro": "`bruto` só vale para o faturamento."}
    period = _period(inicio, fim)
    if isinstance(period, str):
        return {"erro": period}
    compared = None
    if comparar_inicio or comparar_fim:
        compared = _period(comparar_inicio, comparar_fim)
        if isinstance(compared, str):
            return {"erro": f"Comparação: {compared}"}
    if bool(filtro_tipo) != bool(filtro_nome and filtro_nome.strip()):
        return {"erro": "O filtro precisa de `filtro_tipo` e `filtro_nome` juntos."}
    if filtro_tipo and filtro_tipo not in FILTERABLE:
        return {"erro": "`filtro_tipo` é cliente, vendedor ou produto."}
    if filtro_tipo and metrica not in FILTERABLE[filtro_tipo]:
        return {"erro": f"A Métrica {metrica} não tem filtro por {filtro_tipo}."}
    name = (filtro_nome or "").strip() or None
    return Params(period, compared, filtro_tipo, name)


async def consult(
    client: ChatApiClient,
    store: BusinessStore,
    tool_context: ToolContext,
    metrica: str,
    inicio: str,
    fim: str,
    bruto: bool = False,
    comparar_inicio: str | None = None,
    comparar_fim: str | None = None,
    filtro_tipo: str | None = None,
    filtro_nome: str | None = None,
) -> dict[str, Any]:
    state = tool_context.state
    request_id = state[context.REQUEST_ID]
    params = {
        "metrica": metrica,
        "inicio": inicio,
        "fim": fim,
        "bruto": bruto,
        "comparar_inicio": comparar_inicio,
        "comparar_fim": comparar_fim,
        "filtro_tipo": filtro_tipo,
        "filtro_nome": filtro_nome,
    }

    async def record(outcome: audit.Outcome, sql: str | None) -> None:
        await audit.record(
            store.agents,
            request_id=request_id,
            requester_id=state[context.REQUESTER_ID],
            conversation_id=state[context.CONVERSATION_ID],
            question=state.get(context.QUESTION) or "",
            params=params,
            sql=sql,
            outcome=outcome,
        )

    async def finish(
        outcome: audit.Outcome, text: str, *, sql: str | None, business_data: bool
    ) -> dict[str, Any]:
        await record(outcome, sql)
        await client.reply(request_id, text, business_data=business_data)
        context.mark_answered(tool_context, "business")
        return DONE

    # A Permissão de dados é conferida no código, antes de tocar o banco (ADR 0015).
    if not state.get(context.DATA_ACCESS):
        return await finish(
            "no_permission", SEM_PERMISSAO, sql=None, business_data=False
        )
    parsed = parse_params(
        metrica,
        inicio,
        fim,
        bruto,
        comparar_inicio,
        comparar_fim,
        filtro_tipo,
        filtro_nome,
    )
    if isinstance(parsed, dict):
        return parsed
    filter = None
    filter_label = None
    if parsed.filter_kind and parsed.filter_name:
        kind, name = parsed.filter_kind, parsed.filter_name
        found = await names.find(store, kind, name)
        if not found:
            return await finish(
                "not_found", not_found_text(kind, name), sql=None, business_data=True
            )
        if len(found) > MAX_NAME_OPTIONS:
            return await finish(
                "too_generic",
                too_generic_text(kind, name),
                sql=None,
                business_data=True,
            )
        if len(found) > 1:
            # Numa continuação, a resposta já veio de uma pergunta: não pergunta de novo.
            if state.get(context.KIND) == "continuation":
                return await finish(
                    "ambiguous_name",
                    unresolved_name_text(kind, name),
                    sql=None,
                    business_data=True,
                )
            await record("ambiguous_name", None)
            labels = [full_name for _, full_name in found]
            await client.question(
                request_id, which_name_text(name), labels, business_data=True
            )
            context.mark_answered(tool_context, "question")
            return {"pergunta": which_name_text(name), "opcoes": labels}
        [(found_id, full_name)] = found
        filter = Filter(kind, found_id)
        filter_label = f"{kind} {full_name}"
    query = query_for(
        metrica, parsed.period, store.time_zone, gross=bruto, filter=filter
    )
    compared_query = (
        query_for(metrica, parsed.compared, store.time_zone, gross=bruto, filter=filter)
        if parsed.compared
        else None
    )
    sql = compiled_sql(query.statement)
    try:
        assert_read_only(sql)
        row = await store.fetch_one(query.statement)
        compared_row = None
        if compared_query is not None:
            assert_read_only(compiled_sql(compared_query.statement))
            compared_row = await store.fetch_one(compared_query.statement)
    except Exception as error:
        # O tempo limite, o banco fora ou a conferência: sem número, "não consegui responder".
        logger.warning(
            "Consulta do Pedido %s falhou: %s",
            request_id,
            type(error).__name__,
            extra={"request_id": request_id},
        )
        return await finish(
            "error", NAO_CONSEGUI_RESPONDER, sql=sql, business_data=False
        )
    value = _value(metrica, row)
    time_zone = store.time_zone.key
    allowed = allowed_numbers([value], parsed.period, query.window, time_zone)
    comparison = None
    if compared_query is not None and parsed.compared is not None:
        compared_value = _value(metrica, compared_row)
        comparison = Comparison(parsed.compared, compared_query.window, compared_value)
        current, base = comparable(metrica, value), comparable(metrica, compared_value)
        change = (
            variation(current, base)
            if current is not None and base is not None
            else None
        )
        allowed |= allowed_numbers(
            [current, base, change], parsed.compared, compared_query.window, time_zone
        )
    text = answer_text(
        metrica,
        parsed.period,
        query.window,
        value,
        time_zone,
        gross=bruto,
        filter_label=filter_label,
        comparison=comparison,
    )
    if not has_lastro(text, allowed):
        return await finish(
            "lastro_blocked", NAO_CONSEGUI_RESPONDER, sql=sql, business_data=False
        )
    return await finish("answered", text, sql=sql, business_data=True)


def _value(metric: str, row: Any) -> Decimal | int | None:
    """O valor arredondado, ou nenhum com a base vazia."""
    return None if row.base == 0 or row.value is None else rounded(metric, row.value)
