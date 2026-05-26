from __future__ import annotations

import asyncio
import time

import psycopg2

from app.config import (
    TEIID_HOST,
    TEIID_PORT,
    TEIID_DB,
    TEIID_USER,
    TEIID_PASSWORD,
    TEIID_CONNECT_TIMEOUT,
)


class TeiidUnavailable(RuntimeError):
    pass


_RETRY_DELAYS = (0.5, 1.5)


def _run_query_once(sql: str) -> list[tuple]:
    conn = None
    try:
        conn = psycopg2.connect(
            host=TEIID_HOST,
            port=TEIID_PORT,
            dbname=TEIID_DB,
            user=TEIID_USER,
            password=TEIID_PASSWORD,
            connect_timeout=TEIID_CONNECT_TIMEOUT,
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql)
            return cur.fetchall()
    finally:
        if conn is not None:
            conn.close()


def _run_query_sync(sql: str) -> list[tuple]:
    last: psycopg2.Error | None = None
    for attempt in range(len(_RETRY_DELAYS) + 1):
        try:
            return _run_query_once(sql)
        except psycopg2.Error as exc:
            last = exc
            if attempt < len(_RETRY_DELAYS):
                time.sleep(_RETRY_DELAYS[attempt])
    raise TeiidUnavailable(str(last).strip()) from last


async def execute_teiid(sql: str) -> list[tuple]:
    return await asyncio.to_thread(_run_query_sync, sql)
