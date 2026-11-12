"""O schema do Banco de negócio (spec da F13, "Banco de negócio e script de carga").

As tabelas em SQLAlchemy Core: a carga as cria, e o catálogo de Métricas monta o SQL sobre elas.
Ids inteiros e nomes em inglês, como o resto do projeto; valores em `numeric(12,2)`.
"""

from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Numeric,
    Table,
    Text,
)

metadata = MetaData()

Money = Numeric(12, 2)

customers = Table(
    "customers",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("name", Text, nullable=False),
    # Contato: nunca sai numa resposta do Agente.
    Column("email", Text, nullable=False),
    Column("phone", Text, nullable=False),
    Column("document", Text, nullable=False),
    # A base de "clientes novos".
    Column("created_at", DateTime(timezone=True), nullable=False),
)

sellers = Table(
    "sellers",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("name", Text, nullable=False),
)

products = Table(
    "products",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("name", Text, nullable=False),
    Column("price", Money, nullable=False),
)

orders = Table(
    "orders",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("customer_id", Integer, ForeignKey("customers.id"), nullable=False),
    Column("seller_id", Integer, ForeignKey("sellers.id"), nullable=False),
    Column("ordered_at", DateTime(timezone=True), nullable=False),
    Column("status", Text, nullable=False),
    Column("gross_amount", Money, nullable=False),
    Column("discount", Money, nullable=False),
    Column("net_amount", Money, nullable=False),
    CheckConstraint(
        "status IN ('paid', 'cancelled', 'pending')", name="orders_status_check"
    ),
    Index("orders_status_ordered_at_idx", "status", "ordered_at"),
    Index("orders_seller_id_idx", "seller_id"),
    Index("orders_customer_id_idx", "customer_id"),
)

order_items = Table(
    "order_items",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("order_id", Integer, ForeignKey("orders.id"), nullable=False),
    Column("product_id", Integer, ForeignKey("products.id"), nullable=False),
    Column("quantity", Integer, nullable=False),
    Column("unit_price", Money, nullable=False),
    Index("order_items_order_id_idx", "order_id"),
)
