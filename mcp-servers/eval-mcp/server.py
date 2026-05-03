"""
eval-mcp — avalia respostas de agente vs ground truth determinístico.

Tools:
  - eval.list_scenarios()
  - eval.get_scenario(id)
  - eval.compute_truth(id)            -- executa a query canônica
  - eval.score(id, agent_answer)      -- compara, retorna métricas
"""
from __future__ import annotations

import json
import os
import re
from decimal import Decimal

import psycopg
from psycopg.rows import dict_row

from common.mcp_base import MCPServer

DSN = os.environ["POSTGRES_DSN"]
GT_PATH = os.environ["GROUND_TRUTH_PATH"]

with open(GT_PATH, "r", encoding="utf-8") as f:
    SCENARIOS = {s["id"]: s for s in json.load(f)["scenarios"]}


def _q(sql: str) -> list[dict]:
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            try:
                return cur.fetchall()
            except psycopg.ProgrammingError:
                return []


def _truth_value(scenario: dict):
    gt = scenario["ground_truth"]
    rows = _q(gt["deterministic_query"])
    if gt["type"] == "scalar":
        if not rows:
            return 0
        v = next(iter(rows[0].values()))
        return float(v) if isinstance(v, Decimal) else v
    if gt["type"] == "boolean":
        if not rows:
            return False
        return bool(next(iter(rows[0].values())))
    if gt["type"] == "set":
        return sorted([next(iter(r.values())) for r in rows])
    return rows


def _extract_set(answer: str) -> list[str]:
    """Heurística: extrai códigos C### / K### / ids da resposta livre do agente."""
    return sorted(set(re.findall(r"\b[A-Z]\d{3}\b", answer or "")))


def _normalize_num(s: str) -> str:
    """Normaliza separadores BR/EN para formato float-parseable."""
    if "," in s and "." in s:
        return s.replace(".", "").replace(",", ".")  # 1.234,56 → 1234.56
    if "," in s:
        return s.replace(",", ".")                   # 1234,56 → 1234.56
    return s                                          # já em formato EN ou inteiro


def _extract_scalar(answer: str) -> float | None:
    """
    Extrai valor numérico da resposta com três níveis de prioridade:
    1. Percentual: '5,2%' → 0.052, '0,1356%' → 0.001356
    2. Valor monetário BR: 'R$ 7.000,00' → 7000.0  (evita capturar C002, K004)
    3. Primeiro número NÃO precedido por letra (negative lookbehind evita IDs como C002)
    """
    if not answer:
        return None

    # 1. Percentual: número seguido de %
    m_pct = re.search(r"(-?\d[\d.,]*)\s*%", answer)
    if m_pct:
        try:
            return float(_normalize_num(m_pct.group(1))) / 100.0
        except ValueError:
            pass

    # 2. Valor monetário BR explícito: R$ 7.000,00 → 7000.0
    m_brl = re.search(r"R\$\s*(-?\d[\d.,]+)", answer)
    if m_brl:
        try:
            return float(_normalize_num(m_brl.group(1)))
        except ValueError:
            pass

    # 3. Primeiro número não precedido por letra NEM dígito
    # (?<![A-Za-z0-9]) evita capturar "02" do meio de "C002" (onde o 2º '0' é precedido por '0')
    m = re.search(r"(?<![A-Za-z0-9])-?\d[\d.,]*", answer)
    if not m:
        return None
    try:
        return float(_normalize_num(m.group()))
    except ValueError:
        return None


def _extract_boolean(answer: str) -> bool | None:
    if not answer:
        return None
    a = answer.lower()

    # 1. Padrões negativos explícitos (alta precisão)
    neg = [
        " não é", " nao é", "não está", "nao está",
        "não inadim", "nao inadim", "não é inadim",
        "não se enquadra", "não configura inadimplência",
        "não é considerado inadimplente", "não está inadimplente",
        "não é inadimplente", "não consta", "não figura",
        "considerado inativo", "nao é considerado",
        "false", "negativo",
    ]
    if any(t in a for t in neg):
        return False

    # 2. Verificação por janela ±60 chars ao redor do termo-chave
    # Captura "C004 está inadimplente? Não." (não vem depois) e
    # "não é o caso que C004 está inadimplente" (não vem antes)
    for kw in ["inadim", "ativo", "ativa"]:
        for m in re.finditer(kw, a):
            window = a[max(0, m.start() - 60) : min(len(a), m.end() + 60)]
            if "não" in window or "nao" in window:
                return False

    # 3. Padrões positivos — só chegam aqui se nenhuma negação foi encontrada
    pos = [
        " é inadimplente", " está inadimplente", "é considerado inadimplente",
        "configura inadimplência", "sim,", "sim.", "true", "positivo",
    ]
    if any(t in a for t in pos):
        return True

    # 4. Fallback: qualquer "não" no texto
    if "não" in a or "nao" in a:
        return False
    return None


# ─── RAGAS-style scoring ──────────────────────────────────────────────────────

def _ragas_groundedness(answer: str) -> float:
    """Quão fundamentada é a resposta em fontes/axiomas explícitos?"""
    if not answer or len(answer.strip()) < 5:
        return 0.0
    a = answer
    # Cita axioma ou métrica formal → máxima fundamentação
    if re.search(r"\bAX-[A-Z0-9-]+\b", a):
        return 1.0
    if re.search(r"\bMetric:[A-Za-z]+\b", a):
        return 1.0
    # Referência estruturada a critérios ou fontes
    al = a.lower()
    if any(t in al for t in ["axioma", "critério", "conforme", "segundo", "bcb", "bacen", "basel", "resolução"]):
        return 0.75
    if any(t in al for t in ["definição", "regra", "política", "norma"]):
        return 0.55
    # Resposta presente mas sem grounding explícito
    if len(answer.split()) >= 5:
        return 0.25
    return 0.0


def _ragas_completeness(answer: str, truth, gt_type: str, tolerance: float = 0.0) -> float:
    """A resposta cobre completamente o que foi perguntado?"""
    if not answer or len(answer.strip()) < 5:
        return 0.0
    if gt_type == "set":
        pred_ids = set(re.findall(r"\b[A-Z]\d{3}\b", answer))
        truth_set = set(truth)
        if not truth_set:
            return 1.0
        recall = len(pred_ids & truth_set) / len(truth_set)
        return round(recall, 3)
    elif gt_type == "scalar":
        pred = _extract_scalar(answer)
        if pred is None:
            return 0.0
        err = abs(pred - truth)
        if err == 0:
            return 1.0
        tol_ref = tolerance if tolerance else max(abs(truth) * 0.05, 1e-9)
        return round(max(0.0, 1.0 - err / (tol_ref * 10)), 3)
    elif gt_type == "boolean":
        pred = _extract_boolean(answer)
        return 1.0 if pred is not None else 0.0
    return 0.5


def _ragas_coherence(answer: str) -> float:
    """A resposta é bem estruturada, não trivial e não vaga?"""
    if not answer or len(answer.strip()) < 5:
        return 0.0
    words = len(answer.split())
    al = answer.lower()
    # Penaliza respostas que admitem ignorância
    if any(t in al for t in ["não sei", "não tenho informação", "não foi possível", "não encontrei"]):
        return 0.15
    # Coerência cresce com tamanho (com teto)
    length_score = min(1.0, words / 40)
    # Bônus por explicação além do número/ID
    has_explanation = words > 8
    return round(length_score * (1.0 if has_explanation else 0.5), 3)


def _ragas_score(answer: str, truth, gt_type: str,
                 correctness: float, tolerance: float = 0.0) -> dict:
    """Calcula as 4 dimensões RAGAS e o score composto."""
    groundedness = _ragas_groundedness(answer)
    completeness = _ragas_completeness(answer, truth, gt_type, tolerance)
    coherence = _ragas_coherence(answer)
    # Pesos: correto(0.4) + fundamentado(0.25) + completo(0.2) + coerente(0.15)
    composite = round(
        0.40 * correctness +
        0.25 * groundedness +
        0.20 * completeness +
        0.15 * coherence,
        3,
    )
    return {
        "ragas_correctness": round(correctness, 3),
        "ragas_groundedness": round(groundedness, 3),
        "ragas_completeness": round(completeness, 3),
        "ragas_coherence": round(coherence, 3),
        "ragas_score": composite,
    }


server = MCPServer(name="eval", version="1.0.0")


@server.tool(
    name="list_scenarios",
    description="Lista todos os cenários de avaliação disponíveis.",
    input_schema={"type": "object", "properties": {}},
)
async def list_scenarios():
    return {"scenarios": [
        {"id": s["id"], "category": s["category"], "difficulty": s["difficulty"],
         "question": s["question"]}
        for s in SCENARIOS.values()
    ]}


@server.tool(
    name="get_scenario",
    description="Detalhes de um cenário pelo id.",
    input_schema={"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}
)
async def get_scenario(id: str):  # noqa: A002
    s = SCENARIOS.get(id)
    if not s:
        raise ValueError(f"cenário desconhecido: {id}")
    return s


@server.tool(
    name="compute_truth",
    description="Executa a query canônica do cenário e retorna o ground truth determinístico.",
    input_schema={"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}
)
async def compute_truth(id: str):  # noqa: A002
    s = SCENARIOS.get(id)
    if not s:
        raise ValueError(f"cenário desconhecido: {id}")
    return {"id": id, "truth": _truth_value(s), "type": s["ground_truth"]["type"]}


@server.tool(
    name="score",
    description=(
        "Compara a resposta de um agente contra o ground truth. Retorna acurácia (0/1), "
        "precisão/recall/f1 (sets), erro absoluto (scalar), match exato (boolean)."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "agent_answer": {"type": "string"},
            "agent_label": {"type": "string", "description": "naive | semantic"}
        },
        "required": ["id", "agent_answer"]
    }
)
async def score(id: str, agent_answer: str, agent_label: str = "agent"):  # noqa: A002
    s = SCENARIOS.get(id)
    if not s:
        raise ValueError(f"cenário desconhecido: {id}")
    gt_type = s["ground_truth"]["type"]
    truth = _truth_value(s)
    out: dict = {"id": id, "agent": agent_label, "truth": truth, "type": gt_type, "agent_raw": agent_answer}

    tol = s["ground_truth"].get("tolerance", 0.0)

    if gt_type == "set":
        truth_set = set(truth)
        truth_prefixes = {t[0] for t in truth_set if t and t[0].isalpha()}
        if len(truth_prefixes) == 1:
            prefix = next(iter(truth_prefixes))
            pred = sorted(set(re.findall(rf"\b{prefix}\d{{3}}\b", agent_answer or "")))
        else:
            pred = _extract_set(agent_answer)
        pred_set = set(pred)
        tp = len(pred_set & truth_set)
        fp = len(pred_set - truth_set)
        fn = len(truth_set - pred_set)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        correctness = 1.0 if pred_set == truth_set else round(f1, 3)
        out.update({
            "predicted": sorted(pred_set),
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "exact_match": pred_set == truth_set,
            "score": correctness,
        })

    elif gt_type == "scalar":
        pred = _extract_scalar(agent_answer)
        if pred is None:
            err = None   # float("inf") não é JSON válido
            ok = False
            correctness = 0.0
        else:
            if truth != 0 and abs(truth) < 1.0 and abs(pred) > 1.0:
                scaled = pred / 100.0
                if abs(scaled - truth) < abs(pred - truth):
                    pred = scaled
            err = abs(pred - truth)
            ok = err <= tol if tol else (pred == truth)
            # Correctness decai suavemente com o erro relativo
            if ok:
                correctness = 1.0
            elif truth != 0:
                rel = err / (abs(truth) + 1e-9)
                correctness = round(max(0.0, 1.0 - min(rel, 1.0)), 3)
            else:
                correctness = 0.0
        out.update({"predicted": pred, "abs_error": err if err is not None else None,
                    "tolerance": tol, "exact_match": ok, "score": 1 if ok else 0})

    elif gt_type == "boolean":
        pred = _extract_boolean(agent_answer)
        ok = pred is not None and pred == truth
        correctness = 1.0 if ok else 0.0
        out.update({"predicted": pred, "exact_match": ok, "score": 1 if ok else 0})

    else:
        correctness = 0.0
        out.update({"predicted": None, "score": 0, "exact_match": False})

    # RAGAS: groundedness, completeness, coherence + correctness
    out.update(_ragas_score(agent_answer, truth, gt_type, correctness, tol))
    return out


if __name__ == "__main__":
    server.run()
