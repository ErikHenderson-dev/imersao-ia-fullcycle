"""A auditoria do Relatório: o tipo da linha e o desfecho `delivered` (spec da F14, "Auditoria").

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OUTCOMES_F13 = (
    "'answered', 'no_permission', 'not_found', 'ambiguous_name', "
    "'too_generic', 'lastro_blocked', 'error'"
)


def upgrade() -> None:
    op.add_column(
        "business_queries",
        sa.Column("kind", sa.Text(), server_default="answer", nullable=False),
    )
    op.create_check_constraint(
        "business_queries_kind_check",
        "business_queries",
        "kind IN ('answer', 'report')",
    )
    op.drop_constraint(
        "business_queries_outcome_check", "business_queries", type_="check"
    )
    op.create_check_constraint(
        "business_queries_outcome_check",
        "business_queries",
        f"outcome IN ({OUTCOMES_F13}, 'delivered')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM business_queries WHERE outcome = 'delivered'")
    op.drop_constraint(
        "business_queries_outcome_check", "business_queries", type_="check"
    )
    op.create_check_constraint(
        "business_queries_outcome_check",
        "business_queries",
        f"outcome IN ({OUTCOMES_F13})",
    )
    op.drop_constraint("business_queries_kind_check", "business_queries", type_="check")
    op.drop_column("business_queries", "kind")
