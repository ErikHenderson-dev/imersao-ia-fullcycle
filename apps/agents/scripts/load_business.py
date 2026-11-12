"""Carrega o Banco de negócio com os dados fixos (spec da F13, "Banco de negócio e script de carga").

No contêiner `agents`: `uv run python -m scripts.load_business`. Conecta com
`BUSINESS_OWNER_DATABASE_URL`, o dono do banco, e roda a carga numa transação: as tabelas nascem do
dono, e os privilégios padrão do init dão a leitura ao `business_readonly`.
"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from app.business.load import load
from app.config import load_business_load_settings


async def main() -> None:
    settings = load_business_load_settings()
    engine = create_async_engine(settings.business_owner_database_url)
    try:
        async with engine.begin() as connection:
            counts = await load(connection)
    finally:
        await engine.dispose()
    print(
        "Banco de negócio carregado: "
        + ", ".join(f"{count} {table}" for table, count in counts.items())
        + "."
    )


if __name__ == "__main__":
    asyncio.run(main())
