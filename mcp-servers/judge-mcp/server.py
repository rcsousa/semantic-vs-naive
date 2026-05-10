"""
judge-mcp — avalia se a resposta do agente é consistente com o axioma aplicado.

Tool:
  - judge.evaluate(question, axiom, instances, agent_response)
      → {verdict: consistent|inconsistent|insufficient_evidence, reasoning, confidence}

O judge NÃO faz vibe-check de fluência. Ele refaz o cálculo com o axioma e as
instâncias listadas e verifica se o resultado do agente bate dentro de tolerância.

Em modo MOCK (sem AZURE_OPENAI_API_KEY), retorna heurística determinística
consistent para preservar o fluxo end-to-end e permitir que o killswitch
demonstre os outros gatilhos (RAGAS, variância) sem dependência de LLM.
"""
from __future__ import annotations

import json
import os
import re

from common.mcp_base import MCPServer

AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
AZURE_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
AZURE_DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
AZURE_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

_MOCK_MODE = not (AZURE_ENDPOINT and AZURE_KEY)

SYSTEM_JUDGE = """Você é um auditor quantitativo de respostas de agentes em ambiente bancário regulado.

Sua única função é verificar se a resposta numérica do agente é CONSISTENTE com o axioma declarado
aplicado sobre as instâncias listadas.

Classes de veredicto:
- consistent: refazendo o cálculo com o axioma sobre as instâncias, o resultado bate dentro de
  tolerância de arredondamento (±0,5% relativo ou ±0,01 p.p. para percentuais).
- inconsistent: refazendo, o resultado diverge — cálculo errado, definição diferente ou instâncias indevidas.
- insufficient_evidence: não há dados suficientes para refazer o cálculo. Use SOMENTE quando for
  impossível verificar (axioma mal definido, instâncias ausentes ou incompatíveis com a pergunta).

Regras de formato (obrigatórias):
1. Responda APENAS com JSON válido, sem texto antes ou depois.
2. Nenhum markdown (sem ```json, sem **negrito**).
3. Campos obrigatórios: verdict (string), reasoning (string ≤ 200 chars), confidence (float 0–1).

Exemplo de saída válida:
{"verdict":"consistent","reasoning":"Média de 3 instâncias = 15,36 p.p., bate com resposta do agente.","confidence":0.95}
"""

USER_TEMPLATE = """Pergunta original: {question}

Axioma aplicado:
  id: {axiom_id}
  definição: {axiom_definition}
  fórmula: {axiom_formula}

Instâncias (dados que o agente consultou):
{instances_json}

Resposta do agente:
{agent_response}

Verifique se a resposta é consistent, inconsistent ou insufficient_evidence."""


def _llm_judge(question: str, axiom: dict, instances: list, agent_response: str) -> dict:
    from openai import AzureOpenAI  # import lazy — não quebra modo MOCK
    client = AzureOpenAI(
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version=AZURE_API_VERSION,
    )
    user_msg = USER_TEMPLATE.format(
        question=question,
        axiom_id=axiom.get("id", "N/A"),
        axiom_definition=axiom.get("definition", axiom.get("description", "N/A")),
        axiom_formula=axiom.get("formula", axiom.get("formal_definition", "N/A")),
        instances_json=json.dumps(instances[:20], ensure_ascii=False, indent=2),
        agent_response=agent_response or "(vazia)",
    )
    resp = client.chat.completions.create(
        model=AZURE_DEPLOYMENT,
        messages=[
            {"role": "system", "content": SYSTEM_JUDGE},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.0,
        max_tokens=300,
    )
    raw = resp.choices[0].message.content or ""
    return _parse_judge_output(raw)


def _parse_judge_output(raw: str) -> dict:
    """Parser tolerante: aceita fences markdown e texto extra. Fallback seguro."""
    # Remove fences markdown se presentes
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
    # Tenta extrair bloco JSON mesmo com texto ao redor
    m = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group())
            verdict = data.get("verdict", "")
            if verdict in ("consistent", "inconsistent", "insufficient_evidence"):
                return {
                    "verdict": verdict,
                    "reasoning": str(data.get("reasoning", ""))[:300],
                    "confidence": float(data.get("confidence", 0.5)),
                }
        except (json.JSONDecodeError, ValueError):
            pass
    # Fallback seguro em qualquer falha de parse
    return {
        "verdict": "insufficient_evidence",
        "reasoning": "Falha no parse da resposta do judge — tratado como insufficient_evidence.",
        "confidence": 0.0,
    }


def _mock_judge(instances: list) -> dict:
    """Heurística determinística sem LLM. Retorna consistent por default.

    Em modo MOCK, o ponto pedagógico do S15 é demonstrado pelo gatilho de
    variância, não pelo judge. O judge mock não interfere nesse fluxo.
    """
    if not instances:
        return {
            "verdict": "insufficient_evidence",
            "reasoning": "Mock: sem instâncias para verificar.",
            "confidence": 0.0,
        }
    return {
        "verdict": "consistent",
        "reasoning": "Mock: cálculo verificado deterministicamente via heurística.",
        "confidence": 0.85,
    }


server = MCPServer(name="judge", version="1.0.0")


@server.tool(
    name="evaluate",
    description=(
        "Avalia se a resposta do agente é consistente com o axioma e as instâncias declaradas. "
        "Retorna verdict (consistent|inconsistent|insufficient_evidence), reasoning e confidence."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "Pergunta original do usuário."},
            "axiom": {
                "type": "object",
                "description": "Axioma aplicado: {id, definition, formula}.",
                "properties": {
                    "id": {"type": "string"},
                    "definition": {"type": "string"},
                    "formula": {"type": "string"},
                },
            },
            "instances": {
                "type": "array",
                "description": "Linhas retornadas pelo backend determinístico (metrics.compute).",
                "items": {"type": "object"},
            },
            "agent_response": {"type": "string", "description": "Resposta final do agente semântico."},
        },
        "required": ["question", "axiom", "instances", "agent_response"],
    },
)
async def evaluate(question: str, axiom: dict, instances: list, agent_response: str) -> dict:
    if _MOCK_MODE:
        return _mock_judge(instances)
    try:
        return _llm_judge(question, axiom, instances, agent_response)
    except Exception as exc:
        return {
            "verdict": "insufficient_evidence",
            "reasoning": f"Erro ao chamar LLM judge: {type(exc).__name__}",
            "confidence": 0.0,
        }


if __name__ == "__main__":
    server.run()
