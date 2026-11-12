"""O PDF do Relatório, o lastro sobre o texto dele e o nome do arquivo (F14-T03, CA4 e CA5)."""

from dataclasses import replace
from datetime import UTC, date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.business.catalog import Filter, Period
from app.business.lastro import has_lastro
from app.worker.metrics import report_rows
from app.worker.pdf import (
    ReportContent,
    allowed_numbers,
    build_pdf,
    file_name,
    pdf_text,
    read_pdf,
)

MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))
FEBRUARY = Period(date(2026, 2, 1), date(2026, 2, 28))
CURRENT = {
    "faturamento": Decimal("182340.00"),
    "pedidos": 398,
    "ticket_medio": Decimal("458.14"),
    "clientes_ativos": 1204,
    "clientes_novos": 37,
    "itens_vendidos": 1512,
}
PREVIOUS = {
    "faturamento": Decimal("165210.50"),
    "pedidos": 371,
    "ticket_medio": Decimal("445.31"),
    "clientes_ativos": 1187,
    "clientes_novos": 41,
    "itens_vendidos": 1430,
}
GENERATED = datetime(2026, 11, 12, 14, 32, tzinfo=ZoneInfo("America/Sao_Paulo"))
REQUESTED = datetime(2026, 11, 12, 17, 31, tzinfo=UTC)


def content(current: dict = CURRENT, filter_label: str | None = None) -> ReportContent:
    filter = Filter("vendedor", 1) if filter_label else None
    values = (
        {k: v for k, v in current.items() if k != "clientes_novos"}
        if filter
        else current
    )
    previous = (
        {k: v for k, v in PREVIOUS.items() if k != "clientes_novos"}
        if filter
        else PREVIOUS
    )
    return ReportContent(
        period=MARCH,
        previous_period=FEBRUARY,
        filter_label=filter_label,
        generated_at=GENERATED,
        time_zone="America/Sao_Paulo",
        rows=report_rows(values, previous, filter),
    )


def test_o_pdf_traz_o_titulo_as_datas_a_tabela_e_as_definicoes() -> None:
    text = pdf_text(build_pdf(content(filter_label="vendedor Ana Souza"), REQUESTED))

    for expected in (
        "Relatório de vendas",
        "Março de 2026 · vendedor Ana Souza",
        "Gerado em 12/11/2026 às 14:32 (America/Sao_Paulo)",
        "Período: 01/03/2026 a 31/03/2026",
        "Período anterior: 01/02/2026 a 28/02/2026",
        "Faturamento líquido  R$ 182.340,00  R$ 165.210,50  +10,4%",
        "Clientes novos  não se aplica  não se aplica  não se aplica",
        "O que cada Métrica considera",
        "Página 1 de 1",
    ):
        assert expected in text
    labels = [
        "Faturamento líquido",
        "Pedidos",
        "Ticket médio",
        "Clientes ativos",
        "Clientes novos",
        "Itens vendidos",
    ]
    table = text.split("Variação", 1)[1].split("O que cada", 1)[0]
    assert [table.index(label) for label in labels] == sorted(
        table.index(label) for label in labels
    )


def test_o_mesmo_relatorio_gera_o_mesmo_pdf() -> None:
    first = build_pdf(content(), REQUESTED)

    second = build_pdf(content(), REQUESTED)

    assert first == second


def test_o_nome_do_arquivo_segue_a_spec() -> None:
    assert file_name(MARCH, None, None) == "relatorio-2026-03-01-a-2026-03-31.pdf"
    assert (
        file_name(MARCH, "vendedor", "Ana Souza")
        == "relatorio-2026-03-01-a-2026-03-31-vendedor-ana-souza.pdf"
    )
    assert (
        file_name(MARCH, "cliente", "Café São João Ltda.")
        == "relatorio-2026-03-01-a-2026-03-31-cliente-cafe-sao-joao-ltda.pdf"
    )


def test_o_lastro_aceita_o_pdf_com_os_numeros_do_resultado() -> None:
    report = content()
    text, pages = read_pdf(build_pdf(report, REQUESTED))

    allowed = allowed_numbers(report, None, pages)

    assert has_lastro(text, allowed)


def test_o_lastro_recusa_um_numero_adulterado() -> None:
    truthful = content()
    tampered = replace(
        truthful,
        rows=content({**CURRENT, "pedidos": 399}).rows,
    )
    text, pages = read_pdf(build_pdf(tampered, REQUESTED))

    allowed = allowed_numbers(truthful, None, pages)

    assert not has_lastro(text, allowed)
