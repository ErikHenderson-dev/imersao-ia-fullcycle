"""A carga do Banco de negócio com dados fixos (spec da F13, "Banco de negócio e script de carga").

Apaga e recria as tabelas e os dados na transação de quem chama: rodar duas vezes dá os mesmos
dados, porque tudo sai de uma semente fixa e de listas fixas. Os dados trazem de propósito nomes que
se repetem por trecho (dois vendedores com "Ana", seis clientes com "Silva") e um mês sem pedidos de
uma vendedora (Ana Paula Ramos, julho de 2026), para a Pergunta pendente de nome, o nome genérico
demais e o resultado vazio.
"""

from __future__ import annotations

import bisect
import random
import unicodedata
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.business.schema import (
    customers,
    metadata,
    order_items,
    orders,
    products,
    sellers,
)

SEED = 13
# Os pedidos são gerados no fuso da empresa, o mesmo das consultas (LLD, "Valores e configuração").
TIME_ZONE = ZoneInfo("America/Sao_Paulo")
FIRST_DAY = date(2025, 1, 1)
LAST_DAY = date(2026, 10, 31)
# A vendedora sem pedidos num mês conhecido.
SELLER_WITHOUT_ORDERS = "Ana Paula Ramos"
MONTH_WITHOUT_ORDERS = (2026, 7)

SELLERS = [
    "Ana Beatriz Costa",
    SELLER_WITHOUT_ORDERS,
    "Bruno Carvalho",
    "Carla Mendes",
    "Diego Fernandes",
    "Eduardo Lima",
    "Helena Rocha",
    "Gustavo Pereira",
]

# Os seis clientes com "Silva": mais de cinco, o "nome genérico demais" da Pergunta pendente.
SILVAS = [
    "Marcos Silva",
    "Patrícia Silva",
    "João da Silva",
    "Luciana Silva Prado",
    "Roberto Silva",
    "Tatiane Silva",
]
FIRST_NAMES = [
    "Adriana",
    "Alexandre",
    "Beatriz",
    "Caio",
    "Camila",
    "Daniel",
    "Débora",
    "Elisa",
    "Fábio",
    "Gabriela",
    "Heitor",
    "Igor",
    "Isabela",
    "Jéssica",
    "Leonardo",
    "Lívia",
    "Mariana",
    "Mateus",
    "Natália",
    "Otávio",
    "Paula",
    "Rafael",
    "Renata",
    "Sérgio",
    "Thiago",
    "Vanessa",
    "Vítor",
    "Yasmin",
    "Lucas",
    "Bianca",
]
# Nenhum sobrenome contém "silva", para os seis acima serem os únicos.
LAST_NAMES = [
    "Almeida",
    "Barbosa",
    "Cardoso",
    "Correia",
    "Dias",
    "Esteves",
    "Farias",
    "Gomes",
    "Lopes",
    "Machado",
    "Martins",
    "Moreira",
    "Nogueira",
    "Oliveira",
    "Pinto",
    "Ribeiro",
    "Santos",
    "Souza",
    "Teixeira",
    "Vieira",
]
CUSTOMERS_BEFORE_2025 = 120
CUSTOMER_COUNT = 300

PRODUCTS = [
    ("Caneca térmica", "59.90"),
    ("Garrafa de aço", "89.00"),
    ("Mochila urbana", "249.00"),
    ("Caderno pontilhado", "39.50"),
    ("Caneta gel", "12.90"),
    ("Fone sem fio", "329.00"),
    ("Mouse ergonômico", "149.90"),
    ("Teclado mecânico", "459.00"),
    ("Suporte de notebook", "119.00"),
    ("Luminária de mesa", "179.90"),
    ("Cabo USB-C", "34.90"),
    ("Carregador rápido", "99.90"),
    ("Mousepad grande", "69.90"),
    ("Webcam HD", "279.00"),
    ("Hub USB", "129.00"),
    ("Agenda 2026", "54.90"),
    ("Estojo", "29.90"),
    ("Marca-texto", "8.90"),
    ("Planner semanal", "44.90"),
    ("Copo de vidro", "24.90"),
    ("Bolsa de notebook", "199.00"),
    ("Organizador de cabos", "19.90"),
    ("Pen drive 64 GB", "49.90"),
    ("Headset", "389.00"),
]

CENTS = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def _slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return ".".join(ascii_name.lower().split())


def _local(day: date, minutes: int) -> datetime:
    """O instante `minutes` depois da meia-noite do dia, no fuso da empresa, em UTC."""
    moment = datetime.combine(day, time(), tzinfo=TIME_ZONE) + timedelta(
        minutes=minutes
    )
    return moment.astimezone(UTC)


def _days(first: date, last: date) -> list[date]:
    return [first + timedelta(days=n) for n in range((last - first).days + 1)]


def _customer_rows(rng: random.Random) -> list[dict[str, object]]:
    pairs = [(first, last) for first in FIRST_NAMES for last in LAST_NAMES]
    rng.shuffle(pairs)
    names = [f"{first} {last}" for first, last in pairs[: CUSTOMER_COUNT - len(SILVAS)]]
    names += SILVAS
    rng.shuffle(names)
    early_days = _days(date(2024, 6, 1), date(2024, 12, 31))
    later_days = _days(FIRST_DAY, LAST_DAY)
    created = [
        _local(
            rng.choice(early_days if index < CUSTOMERS_BEFORE_2025 else later_days),
            rng.randrange(8 * 60, 22 * 60),
        )
        for index in range(len(names))
    ]
    rows = []
    for index, (created_at, name) in enumerate(
        sorted(zip(created, names, strict=True)), 1
    ):
        rows.append(
            {
                "id": index,
                "name": name,
                "email": f"{_slug(name)}.{index}@exemplo.com.br",
                "phone": f"(11) 9{rng.randrange(1000, 9999)}-{rng.randrange(1000, 9999)}",
                "document": (
                    f"{rng.randrange(100, 999)}.{rng.randrange(100, 999)}."
                    f"{rng.randrange(100, 999)}-{rng.randrange(10, 99)}"
                ),
                "created_at": created_at,
            }
        )
    return rows


def _order_rows(
    rng: random.Random, customers_created: list[datetime]
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    prices = [Decimal(price) for _, price in PRODUCTS]
    without_orders = SELLERS.index(SELLER_WITHOUT_ORDERS) + 1
    order_rows: list[dict[str, object]] = []
    item_rows: list[dict[str, object]] = []
    for day in _days(FIRST_DAY, LAST_DAY):
        day_start = _local(day, 0)
        # O cliente de cada pedido já tinha conta no dia; os ids seguem a data da conta.
        eligible = bisect.bisect_left(customers_created, day_start)
        sellers_today = [
            seller
            for seller in range(1, len(SELLERS) + 1)
            if not (
                seller == without_orders
                and (day.year, day.month) == MONTH_WITHOUT_ORDERS
            )
        ]
        minutes = sorted(
            rng.randrange(8 * 60, 22 * 60) for _ in range(rng.randint(7, 11))
        )
        for minute in minutes:
            order_id = len(order_rows) + 1
            gross = Decimal(0)
            for _ in range(rng.randint(1, 4)):
                product = rng.randrange(len(PRODUCTS))
                quantity = rng.randint(1, 5)
                item_rows.append(
                    {
                        "id": len(item_rows) + 1,
                        "order_id": order_id,
                        "product_id": product + 1,
                        "quantity": quantity,
                        "unit_price": prices[product],
                    }
                )
                gross += prices[product] * quantity
            discount = (
                _money(gross * Decimal(rng.choice([5, 10])) / 100)
                if rng.random() < 0.3
                else Decimal("0.00")
            )
            draw = rng.random()
            order_rows.append(
                {
                    "id": order_id,
                    "customer_id": rng.randint(1, eligible),
                    "seller_id": rng.choice(sellers_today),
                    "ordered_at": _local(day, minute),
                    "status": "paid"
                    if draw < 0.8
                    else "cancelled"
                    if draw < 0.9
                    else "pending",
                    "gross_amount": _money(gross),
                    "discount": discount,
                    "net_amount": _money(gross - discount),
                }
            )
    return order_rows, item_rows


async def load(connection: AsyncConnection) -> dict[str, int]:
    """Apaga e recria as tabelas e os dados, na transação de quem chama; devolve as contagens."""
    rng = random.Random(SEED)
    await connection.execute(
        text(
            "DROP TABLE IF EXISTS order_items, orders, products, sellers, customers CASCADE"
        )
    )
    await connection.run_sync(metadata.create_all)
    seller_rows = [{"id": index, "name": name} for index, name in enumerate(SELLERS, 1)]
    product_rows = [
        {"id": index, "name": name, "price": Decimal(price)}
        for index, (name, price) in enumerate(PRODUCTS, 1)
    ]
    customer_rows = _customer_rows(rng)
    # Os ids dos clientes seguem a data da conta (_customer_rows).
    created = sorted(row["created_at"] for row in customer_rows)  # type: ignore[type-var]
    order_rows, item_rows = _order_rows(rng, created)
    for table, rows in [
        (sellers, seller_rows),
        (products, product_rows),
        (customers, customer_rows),
        (orders, order_rows),
        (order_items, item_rows),
    ]:
        await connection.execute(table.insert(), rows)
    return {
        "customers": len(customer_rows),
        "sellers": len(seller_rows),
        "products": len(product_rows),
        "orders": len(order_rows),
        "order_items": len(item_rows),
    }
