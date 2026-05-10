"""
AuditTrail — acumula steps do pipeline de governança e gera hash reprodutível.

Hash SHA-256 da forma canônica do trail excluindo timestamps, request_id e
durations. Dois runs do mesmo cálculo determinístico produzem hash idêntico
mesmo com timestamps diferentes. Drift no hash = drift real.
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TrailStep:
    name: str          # 'calculate' | 'judge' | 'killswitch' | 'respond' | 'escalate'
    inputs: dict[str, Any]
    outputs: dict[str, Any]
    ts: float = field(default_factory=time.time)
    duration_ms: int = 0


@dataclass
class AuditTrail:
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    question: str = ""
    steps: list[TrailStep] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)

    def add_step(
        self,
        name: str,
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        duration_ms: int = 0,
    ) -> "AuditTrail":
        self.steps.append(TrailStep(
            name=name,
            inputs=inputs,
            outputs=outputs,
            ts=time.time(),
            duration_ms=duration_ms,
        ))
        return self

    def _canonical(self) -> dict:
        """Forma canônica excluindo voláteis (timestamps, request_id, durations)."""
        return {
            "question": self.question,
            "steps": [
                {"name": s.name, "inputs": s.inputs, "outputs": s.outputs}
                for s in self.steps
            ],
        }

    def reproducibility_hash(self) -> str:
        """SHA-256 da forma canônica. Idêntico entre runs com os mesmos dados."""
        canonical_json = json.dumps(
            self._canonical(),
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    def to_dict(self) -> dict:
        return {
            "request_id": self.request_id,
            "question": self.question,
            "created_at": self.created_at,
            "steps": [
                {
                    "name": s.name,
                    "inputs": s.inputs,
                    "outputs": s.outputs,
                    "ts": s.ts,
                    "duration_ms": s.duration_ms,
                }
                for s in self.steps
            ],
            "hash": self.reproducibility_hash(),
        }
