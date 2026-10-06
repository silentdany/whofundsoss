"""Shared source result type. A failed source is never a silent zero."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SourceResult:
    name: str
    status: str  # "ok" | "unavailable"
    items: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    fetched_at: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.status == "ok"

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "error": self.error,
            "fetched_at": self.fetched_at,
            "count": len(self.items) if self.ok else None,
            "meta": self.meta,
            # items omitted here; callers attach snapshot companies separately
        }
