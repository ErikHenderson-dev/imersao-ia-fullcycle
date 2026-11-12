"""A carga do job e a chave da trava do Relatório (F14-T03, CA2)."""

from datetime import UTC, date, datetime

from app.business.catalog import Period
from app.business.report_queue import ReportFilter, ReportJob, lock_key


def test_a_carga_do_job_vai_e_volta_pelo_dicionario() -> None:
    job = ReportJob(
        request_id="01a1d175-0000-7000-8000-000000000001",
        requester_id="01a1d175-0000-7000-8000-000000000002",
        conversation_id="01a1d175-0000-7000-8000-000000000003",
        question="@assistente relatório de março da Ana em PDF",
        period=Period(date(2026, 3, 1), date(2026, 3, 31)),
        previous_period=Period(date(2026, 2, 1), date(2026, 2, 28)),
        filter=ReportFilter("vendedor", 7, "Ana Souza"),
        requested_at=datetime(2026, 11, 12, 17, 32, tzinfo=UTC),
    )

    payload = job.to_payload()

    assert payload["period"] == {"start": "2026-03-01", "end": "2026-03-31"}
    assert payload["filter"] == {"type": "vendedor", "id": 7, "name": "Ana Souza"}
    assert ReportJob.from_payload(payload) == job


def test_a_carga_sem_filtro_leva_filtro_nulo() -> None:
    job = ReportJob(
        request_id="r",
        requester_id="p",
        conversation_id="c",
        question="q",
        period=Period(date(2026, 3, 1), date(2026, 3, 31)),
        previous_period=Period(date(2026, 2, 1), date(2026, 2, 28)),
        filter=None,
        requested_at=datetime(2026, 11, 12, tzinfo=UTC),
    )

    assert ReportJob.from_payload(job.to_payload()).filter is None


def test_a_chave_da_trava_e_por_pessoa() -> None:
    assert lock_key("p1") == "reports:active:p1"
