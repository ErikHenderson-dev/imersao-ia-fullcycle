"""O armazenamento de objetos do PDF (spec da F14, "Armazenamento").

O boto3 é síncrono: cada chamada roda em `asyncio.to_thread`, uma por Relatório, para não travar o
laço do Worker. A chave é `reports/<id do Pedido>.pdf`: uma nova tentativa regrava a mesma.
"""

from __future__ import annotations

import asyncio
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import WorkerConfig


def report_key(request_id: str) -> str:
    return f"reports/{request_id}.pdf"


class ReportStorage:
    def __init__(self, client: Any, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    @classmethod
    def from_settings(cls, settings: WorkerConfig) -> ReportStorage:
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name="us-east-1",
            # Tempos de rede abaixo do tempo limite da tentativa, sem as novas tentativas do boto3:
            # quem tenta de novo é o job (spec da F14, "Fila e job").
            config=Config(
                s3={"addressing_style": "path"},
                connect_timeout=5,
                read_timeout=10,
                retries={"max_attempts": 1},
            ),
        )
        return cls(client, settings.s3_bucket)

    async def put_pdf(self, key: str, body: bytes) -> None:
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=body,
            ContentType="application/pdf",
        )

    async def ensure_bucket(self) -> None:
        """Cria o bucket se ele não existe; só no desenvolvimento (`S3_CREATE_BUCKET`)."""

        def ensure() -> None:
            try:
                self._client.head_bucket(Bucket=self._bucket)
            except ClientError as error:
                # Só o bucket que não existe é criado; credencial errada ou outra recusa sobe.
                if error.response.get("Error", {}).get("Code") not in (
                    "404",
                    "NoSuchBucket",
                ):
                    raise
                self._client.create_bucket(Bucket=self._bucket)

        await asyncio.to_thread(ensure)
