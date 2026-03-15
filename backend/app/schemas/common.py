"""Shared response helpers and pagination."""
from typing import Any


def success_response(data: Any, message: str = "success") -> dict:
    return {"code": 0, "data": data, "message": message}


def error_response(code: int, message: str) -> dict:
    return {"code": code, "data": None, "message": message}


def paged_response(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "code": 0,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
        "message": "success",
    }
