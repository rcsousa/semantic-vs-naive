"""Eventos do workstrip — emitidos durante a execução para o frontend."""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, asdict, field
from typing import Any


@dataclass
class WorkstripEvent:
    type: str                     # 'agent_started' | 'tool_call' | 'tool_result' | 'thinking' | 'final' | 'error'
    agent: str                    # 'naive' | 'semantic'
    label: str                    # texto curto para a UI
    detail: dict[str, Any] = field(default_factory=dict)
    elapsed_ms: int | None = None
    ts: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])

    def to_dict(self) -> dict:
        return asdict(self)
