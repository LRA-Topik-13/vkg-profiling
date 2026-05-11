import asyncio
import httpx
from app.config import ONTOP_ENDPOINT

_RETRY_DELAYS = [1, 2, 4]
_RETRYABLE_STATUS = {502, 503}


async def execute_sparql(query: str) -> dict:
    headers = {"Accept": "application/sparql-results+json"}

    for attempt in range(len(_RETRY_DELAYS) + 1):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    ONTOP_ENDPOINT,
                    params={"query": query},
                    headers=headers,
                    timeout=30.0,
                )
                response.raise_for_status()
                return response.json()
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
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
