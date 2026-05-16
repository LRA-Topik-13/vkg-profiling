import asyncio
from typing import Optional

import httpx
from app.config import (
    ONTOP_ENDPOINT,
    SPARQL_MAX_CONCURRENCY,
    SPARQL_MAX_CONNECTIONS,
    SPARQL_MAX_KEEPALIVE_CONNECTIONS,
    SPARQL_TIMEOUT,
)

_RETRY_DELAYS = [1, 2, 4]
_RETRYABLE_STATUS = {502, 503}
_SPARQL_SEMAPHORE = asyncio.Semaphore(SPARQL_MAX_CONCURRENCY)
_CLIENT: Optional[httpx.AsyncClient] = None
_CLIENT_LOCK = asyncio.Lock()


async def _get_sparql_client() -> httpx.AsyncClient:
    global _CLIENT

    if _CLIENT is not None and not _CLIENT.is_closed:
        return _CLIENT

    async with _CLIENT_LOCK:
        if _CLIENT is None or _CLIENT.is_closed:
            limits = httpx.Limits(
                max_connections=SPARQL_MAX_CONNECTIONS,
                max_keepalive_connections=SPARQL_MAX_KEEPALIVE_CONNECTIONS,
            )
            _CLIENT = httpx.AsyncClient(limits=limits, timeout=SPARQL_TIMEOUT)
    return _CLIENT


async def close_sparql_client() -> None:
    global _CLIENT

    if _CLIENT is not None and not _CLIENT.is_closed:
        await _CLIENT.aclose()
    _CLIENT = None


async def execute_sparql(query: str) -> dict:
    headers = {
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    async with _SPARQL_SEMAPHORE:
        for attempt in range(len(_RETRY_DELAYS) + 1):
            try:
                client = await _get_sparql_client()
                response = await client.post(
                    ONTOP_ENDPOINT,
                    data={"query": query},
                    headers=headers,
                )
                response.raise_for_status()
                return response.json()
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout):
                if attempt == len(_RETRY_DELAYS):
                    raise
                await asyncio.sleep(_RETRY_DELAYS[attempt])
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in _RETRYABLE_STATUS:
                    if attempt == len(_RETRY_DELAYS):
                        raise
                    await asyncio.sleep(_RETRY_DELAYS[attempt])
                else:
                    raise

    raise RuntimeError("SPARQL query did not return a response")
