"""O Alembic só gera e aplica as tabelas do registro (F10-T04, CA2)."""

from sqlalchemy import Column, MetaData, Table, Text

from app.registry.store import REGISTRY_METADATA, include_registry_object


def test_aceita_connected_agents_e_ignora_as_tabelas_do_adk() -> None:
    adk_table = Table("sessions", MetaData(), Column("id", Text, primary_key=True))

    assert include_registry_object(
        REGISTRY_METADATA.tables["connected_agents"],
        "connected_agents",
        "table",
        False,
        None,
    )
    assert not include_registry_object(adk_table, "sessions", "table", True, None)
    assert not include_registry_object(adk_table.c.id, "id", "column", True, None)
