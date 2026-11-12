"""O Aviso de início do Relatório (spec da F14, "Ferramenta `gerar_relatorio`"; F14-T05, CA3)."""

from datetime import date

from app.business.catalog import Period
from app.business.report_request import notice_text

MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))


def test_o_aviso_traz_o_filtro() -> None:
    assert notice_text(MARCH, "vendedor Ana Paula Ramos") == (
        "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026, vendedor Ana Paula Ramos. "
        "Ele chega aqui quando ficar pronto."
    )


def test_sem_filtro_o_trecho_some() -> None:
    assert notice_text(MARCH) == (
        "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026. Ele chega aqui quando ficar pronto."
    )
