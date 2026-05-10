"""
Killswitch — decide se uma resposta deve ser entregue ou escalada.

Três gatilhos independentes em OR (qualquer um é suficiente para escalar):
  1. ragas_below_floor   — RAGAS composto abaixo do piso (default 0.70)
  2. judge_not_consistent — verdict do judge é inconsistent ou insufficient_evidence
  3. high_instance_variance — std dev das instâncias numéricas acima do teto (default 25 pp)

Defaults são opinionados: 25 pp é adequado para carteiras diversas multi-produto.
Para portfólios homogêneos (ex.: só PERSONAL_LOAN), reduza para 5–10 pp.

O killswitch NÃO chama LLM nem MCP. É lógica pura de orquestração.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


@dataclass
class KillswitchConfig:
    ragas_floor: float = 0.70
    variance_ceiling_pp: float = 25.0  # percentual points; ver nota no módulo
    min_instances_for_variance: int = 2


@dataclass
class Trigger:
    code: str
    threshold: float
    observed: float
    detail: str


@dataclass
class KillswitchResult:
    armed: bool
    triggers: list[Trigger] = field(default_factory=list)


def _std_dev_pp(values: list[float]) -> float:
    """Desvio-padrão populacional em percentage points (valores em decimal → pp)."""
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    # converte de decimal para pp (ex.: 0.15 → 15 pp)
    return math.sqrt(variance) * 100.0


def _extract_numeric_values(instances: list[dict[str, Any]]) -> list[float]:
    """Extrai valores numéricos das instâncias de métricas.

    Prioridade: spread > exposure > ltv > primeiro float encontrado por linha.
    """
    if not instances:
        return []
    priority_keys = ("spread", "exposure", "ltv", "npl_ratio", "outstanding_principal")
    out: list[float] = []
    for row in instances:
        for key in priority_keys:
            v = row.get(key)
            if v is not None:
                try:
                    out.append(float(v))
                    break
                except (TypeError, ValueError):
                    continue
        else:
            # tenta qualquer valor numérico na linha
            for v in row.values():
                try:
                    f = float(v)
                    out.append(f)
                    break
                except (TypeError, ValueError):
                    continue
    return out


class Killswitch:
    def __init__(self, config: KillswitchConfig | None = None):
        self._cfg = config or KillswitchConfig()

    def evaluate(
        self,
        *,
        judge_verdict: str,
        ragas_score: float | None = None,
        instances: list[dict[str, Any]] | None = None,
    ) -> KillswitchResult:
        triggers: list[Trigger] = []

        # Gatilho 1 — RAGAS abaixo do piso
        if ragas_score is not None and ragas_score < self._cfg.ragas_floor:
            triggers.append(Trigger(
                code="ragas_below_floor",
                threshold=self._cfg.ragas_floor,
                observed=round(ragas_score, 4),
                detail=f"RAGAS {ragas_score:.3f} < piso {self._cfg.ragas_floor:.2f}",
            ))

        # Gatilho 2 — Judge não-consistent
        if judge_verdict in ("inconsistent", "insufficient_evidence"):
            triggers.append(Trigger(
                code="judge_not_consistent",
                threshold=1.0,
                observed=0.0,
                detail=f"Judge retornou '{judge_verdict}'",
            ))

        # Gatilho 3 — Variância das instâncias acima do teto
        inst = instances or []
        if len(inst) >= self._cfg.min_instances_for_variance:
            values = _extract_numeric_values(inst)
            if len(values) >= self._cfg.min_instances_for_variance:
                std_pp = _std_dev_pp(values)
                if std_pp > self._cfg.variance_ceiling_pp:
                    triggers.append(Trigger(
                        code="high_instance_variance",
                        threshold=self._cfg.variance_ceiling_pp,
                        observed=round(std_pp, 2),
                        detail=(
                            f"Std dev das instâncias = {std_pp:.1f} p.p. "
                            f"> teto {self._cfg.variance_ceiling_pp:.1f} p.p."
                        ),
                    ))

        return KillswitchResult(armed=bool(triggers), triggers=triggers)
