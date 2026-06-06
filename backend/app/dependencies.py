import asyncio
from typing import Optional

import httpx
from fastapi import HTTPException
from app.config import (
    ONTOP_ENDPOINT,
    SPARQL_MAX_CONCURRENCY,
    SPARQL_MAX_CONNECTIONS,
    SPARQL_MAX_KEEPALIVE_CONNECTIONS,
    SPARQL_TIMEOUT,
)

_RETRY_DELAYS = [1, 2, 4]
_RETRYABLE_STATUS = {502, 503}
_SPARQL_SEMAPHORE: asyncio.Semaphore | None = None
_CLIENT: Optional[httpx.AsyncClient] = None
_CLIENT_LOCK: asyncio.Lock | None = None


async def init_sparql_resources() -> None:
    """Initialise event-loop-bound primitives. Called from lifespan startup."""
    global _SPARQL_SEMAPHORE, _CLIENT_LOCK, _CLIENT
    _SPARQL_SEMAPHORE = asyncio.Semaphore(SPARQL_MAX_CONCURRENCY)
    _CLIENT_LOCK = asyncio.Lock()
    _CLIENT = None  # force re-creation in the current event loop


async def _get_sparql_client() -> httpx.AsyncClient:
    global _CLIENT, _CLIENT_LOCK

    if _CLIENT is not None and not _CLIENT.is_closed:
        return _CLIENT

    if _CLIENT_LOCK is None:
        _CLIENT_LOCK = asyncio.Lock()
    async with _CLIENT_LOCK:
        if _CLIENT is None or _CLIENT.is_closed:
            limits = httpx.Limits(
                max_connections=SPARQL_MAX_CONNECTIONS,
                max_keepalive_connections=SPARQL_MAX_KEEPALIVE_CONNECTIONS,
            )
            _CLIENT = httpx.AsyncClient(limits=limits, timeout=SPARQL_TIMEOUT)
    return _CLIENT


async def close_sparql_client() -> None:
    global _CLIENT, _SPARQL_SEMAPHORE, _CLIENT_LOCK

    if _CLIENT is not None and not _CLIENT.is_closed:
        await _CLIENT.aclose()
    _CLIENT = None
    _SPARQL_SEMAPHORE = None
    _CLIENT_LOCK = None


async def execute_sparql(query: str) -> dict:
    global _SPARQL_SEMAPHORE
    if _SPARQL_SEMAPHORE is None:
        _SPARQL_SEMAPHORE = asyncio.Semaphore(SPARQL_MAX_CONCURRENCY)

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


PREFIXES = """
    PREFIX : <http://example.org/voc#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
"""


def local_name(uri: str) -> str:
    return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]


def bindings(raw: dict) -> list[dict]:
    return raw.get("results", {}).get("bindings", [])


def count_binding(raw: dict, var_name: str, default: int = 0) -> int:
    rows = bindings(raw)
    if not rows:
        return default
    return int(rows[0].get(var_name, {}).get("value", str(default)))


def sparql_502(exc: Exception) -> HTTPException:
    return HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(exc)}")


def source_membership_filter(var: str, sources: list[str]) -> str:
    clauses = " || ".join(f'STRSTARTS(STR({var}), "{s}")' for s in sources)
    return f"FILTER({clauses})"


def different_source_filter(sources: list[str], var1: str = "?e1", var2: str = "?e2") -> str:
    same = " || ".join(
        f'(STRSTARTS(STR({var1}), "{s}") && STRSTARTS(STR({var2}), "{s}"))'
        for s in sources
    )
    return f"FILTER(!({same}))"


def find_source(uri: str, sources: list[str]) -> str:
    for s in sources:
        if uri.startswith(s):
            return s
    return "unknown"
