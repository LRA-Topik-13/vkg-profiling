import re

from fastapi import HTTPException

MAX_PAGE_LIMIT = 500
DEFAULT_PAGE_LIMIT = 100

_HTTP_URI_RE = re.compile(r"^https?://[^\s<>{}|^`\"]+$")


def validate_http_uri(uri: str, label: str = "URI") -> str:
    if not _HTTP_URI_RE.match(uri or ""):
        raise HTTPException(status_code=400, detail=f"Invalid {label}: '{uri}'")
    return uri


def validate_pagination(limit: int, offset: int) -> tuple[int, int]:
    if limit < 1 or limit > MAX_PAGE_LIMIT:
        raise HTTPException(status_code=400, detail=f"limit must be between 1 and {MAX_PAGE_LIMIT}")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be greater than or equal to 0")
    return limit, offset


def get_class(class_uri: str, code: int = 404) -> dict:
    from app.routers.metadata_router import KNOWN_CLASSES_BY_URI

    entry = KNOWN_CLASSES_BY_URI.get(class_uri)
    if entry is None:
        raise HTTPException(status_code=code, detail=f"Class '{class_uri}' not found")
    return entry
