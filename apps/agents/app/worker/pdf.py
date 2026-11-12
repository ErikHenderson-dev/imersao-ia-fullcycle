"""O PDF do Relatório (spec da F14, "O PDF"), com o fpdf2 e a Lato embutida.

A4 retrato, como o frame `Relatório / PDF / Março de 2026` do Figma: o título com o período e o
filtro, a data de geração, as datas dos dois períodos, a tabela das seis Métricas, o que cada uma
considera e a página no rodapé. O texto sai selecionável; os metadados são fixos, e o mesmo
Relatório gera o mesmo conteúdo, a não ser pela data de geração.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from fpdf import FPDF
from pypdf import PdfReader

from app.business.answer import WORDING, period_label
from app.business.catalog import Period
from app.business.lastro import has_lastro, numbers_in
from app.worker.metrics import REPORT_METRICS, MetricRow

FONTS = Path(__file__).parent / "fonts"
PRODUCER = "Full Cycle Chat"

# As cores do tema claro do design system: o PDF sai sempre claro.
FG = (0x1D, 0x1C, 0x1D)
FG_MUTED = (0x61, 0x60, 0x61)
BORDER_SUBTLE = (0xE4, 0xE4, 0xE4)
SURFACE_INSET = (0xF0, 0xF0, 0xF0)

MARGIN = 40
COLUMNS = (175, 110, 120, 110)
ROW_HEIGHT = 22
HEADERS = ("Métrica", "Período", "Período anterior", "Variação")

# O que cada Métrica considera: a linha do que foi considerado da F13, sem números, para nenhum
# número sem lastro entrar no PDF.
DEFINITIONS = {
    **{metric: WORDING[metric].considered for metric, _ in REPORT_METRICS},
    "clientes_ativos": "clientes distintos com pedido pago nos três meses até o fim do período",
}


@dataclass(frozen=True)
class ReportContent:
    period: Period
    previous_period: Period
    # O filtro como sai no título ("vendedor Ana Souza"), ou nenhum.
    filter_label: str | None
    generated_at: datetime
    time_zone: str
    rows: list[MetricRow]


def subtitle(content: ReportContent) -> str:
    label = period_label(content.period)
    label = label[:1].upper() + label[1:]
    return f"{label} · {content.filter_label}" if content.filter_label else label


def _date(day: date) -> str:
    return day.strftime("%d/%m/%Y")


def _span(period: Period) -> str:
    return f"{_date(period.start)} a {_date(period.end)}"


class _ReportPdf(FPDF):
    def footer(self) -> None:
        self.set_y(-MARGIN)
        self.set_font("Lato", size=12)
        self.set_text_color(*FG_MUTED)
        self.cell(0, 16, f"Página {self.page_no()} de {{nb}}", align="R")


def build_pdf(content: ReportContent, created_at: datetime) -> bytes:
    """O PDF do Relatório; `created_at` (o instante do Pedido) fixa os metadados."""
    pdf = _ReportPdf(unit="pt", format="A4")
    pdf.set_creation_date(created_at)
    pdf.set_producer(PRODUCER)
    pdf.set_creator(PRODUCER)
    pdf.set_title("Relatório de vendas")
    pdf.set_margins(MARGIN, 48, MARGIN)
    pdf.set_auto_page_break(True, margin=MARGIN + 24)
    pdf.add_font("Lato", "", FONTS / "Lato-Regular.ttf")
    pdf.add_font("Lato", "B", FONTS / "Lato-Bold.ttf")
    pdf.add_page()

    def line(
        text: str, *, size: int, bold: bool = False, color=FG, height: float = 20
    ) -> None:
        pdf.set_font("Lato", "B" if bold else "", size)
        pdf.set_text_color(*color)
        pdf.cell(0, height, text, new_x="LMARGIN", new_y="NEXT")

    line("Relatório de vendas", size=18, bold=True, height=24)
    line(subtitle(content), size=15)
    generated = content.generated_at
    line(
        f"Gerado em {_date(generated)} às {generated.strftime('%H:%M')} ({content.time_zone})",
        size=13,
        color=FG_MUTED,
    )
    pdf.ln(12)
    line(f"Período: {_span(content.period)}", size=13, height=18)
    line(f"Período anterior: {_span(content.previous_period)}", size=13, height=18)
    pdf.ln(14)

    _table_row(pdf, HEADERS, header=True)
    for row in content.rows:
        _table_row(
            pdf, (row.label, row.current, row.previous, row.change), header=False
        )
    pdf.ln(16)

    line("O que cada Métrica considera", size=15, bold=True)
    for metric, label in REPORT_METRICS:
        pdf.set_font("Lato", "", 13)
        pdf.set_text_color(*FG)
        pdf.multi_cell(
            0, 20, f"{label}: {DEFINITIONS[metric]}", new_x="LMARGIN", new_y="NEXT"
        )
    return bytes(pdf.output())


def _table_row(pdf: FPDF, cells: Iterable[str], *, header: bool) -> None:
    pdf.set_font("Lato", "B" if header else "", 13)
    pdf.set_text_color(*FG)
    pdf.set_fill_color(*SURFACE_INSET)
    pdf.set_draw_color(*BORDER_SUBTLE)
    for index, (text, width) in enumerate(zip(cells, COLUMNS, strict=True)):
        pdf.cell(
            width,
            ROW_HEIGHT,
            f" {text} ",
            border="B",
            fill=header,
            align="L" if index == 0 else "R",
        )
    pdf.ln(ROW_HEIGHT)


def pdf_text(pdf_bytes: bytes) -> str:
    """O texto do PDF, como o pypdf o extrai, página a página."""
    reader = PdfReader(BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def page_count(pdf_bytes: bytes) -> int:
    return len(PdfReader(BytesIO(pdf_bytes)).pages)


def allowed_numbers(
    content: ReportContent, filter_name: str | None, pages: int
) -> set[Decimal]:
    """O lastro do PDF (spec da F14, "Worker de agentes", passo 4): os números das consultas e as
    variações, o dia, o mês e o ano das datas dos dois períodos e da geração, a hora e o minuto da
    geração, os números do nome do fuso e os da paginação. O nome do filtro vem do cadastro."""
    allowed = {number for row in content.rows for number in row.numbers}
    for period in (content.period, content.previous_period):
        for day in (period.start, period.end):
            allowed |= {Decimal(day.day), Decimal(day.month), Decimal(day.year)}
    generated = content.generated_at
    allowed |= {
        Decimal(part)
        for part in (
            generated.day,
            generated.month,
            generated.year,
            generated.hour,
            generated.minute,
        )
    }
    allowed |= {abs(number) for number in numbers_in(content.time_zone)}
    if filter_name:
        allowed |= {abs(number) for number in numbers_in(filter_name)}
    allowed |= {Decimal(page) for page in range(1, pages + 1)}
    return allowed


def has_pdf_lastro(pdf_bytes: bytes, allowed: set[Decimal]) -> bool:
    """Todo número do texto extraído do PDF tem lastro."""
    return has_lastro(pdf_text(pdf_bytes), allowed)


def file_name(period: Period, filter_type: str | None, filter_name: str | None) -> str:
    """`relatorio-<início>-a-<fim>[-<tipo>-<nome>].pdf`, com as datas em ISO e o nome em kebab-case
    sem acento (spec da F14, "O PDF", "Nome do arquivo")."""
    name = f"relatorio-{period.start.isoformat()}-a-{period.end.isoformat()}"
    if filter_type and filter_name:
        name += f"-{_kebab(filter_type)}-{_kebab(filter_name)}"
    return f"{name}.pdf"


def _kebab(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
