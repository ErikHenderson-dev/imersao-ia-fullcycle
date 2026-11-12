"""Auditoria das consultas ao Banco de negócio (spec da F13, "Auditoria").

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "business_queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "outcome IN ('answered', 'no_permission', 'not_found', 'ambiguous_name', "
            "'too_generic', 'lastro_blocked', 'error')",
            name="business_queries_outcome_check",
        ),
        sa.PrimaryKeyConstraint("id", name="business_queries_pkey"),
    )
    op.create_index(
        "business_queries_request_id_idx", "business_queries", ["request_id"]
    )


def downgrade() -> None:
    op.drop_index("business_queries_request_id_idx", table_name="business_queries")
    op.drop_table("business_queries")
