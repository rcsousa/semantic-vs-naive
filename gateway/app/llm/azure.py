"""
Wrapper de Azure OpenAI com fallback determinístico (modo MOCK).

Modo MOCK: usado quando não há credenciais. Retorna respostas plausíveis
porém *fixas*, suficientes para mostrar a estrutura da demo sem custo.
"""
from __future__ import annotations

import json
import re
from typing import Any

from openai import AsyncAzureOpenAI

from app.settings import settings


# ---------------------- MOCK ------------------------------------------------

NAIVE_MOCK_BY_KEYWORD = [
    # cada (regex, resposta) — usado pelo agente naive em modo mock
    (r"inadimplent", "Os clientes inadimplentes são C002, C004 e C006 (com base nos nomes nos documentos)."),
    (r"atras",       "Estão atrasados C002 e C004."),
    (r"ativos",      "Temos clientes ativos: C001, C002, C003, C004, C005, C006, C007 e C008 — total 8."),
    (r"c004.*inad|inad.*c004", "Sim, C004 está inadimplente — há parcelas em aberto."),
    (r"c006",        "C006 está ativo."),
    (r"npl",         "O NPL Ratio aproximado é 12% considerando os contratos com atraso."),
    (r"spread",      "O spread médio é cerca de 25%."),
    (r"exposi.*c002", "A exposição do C002 é R$ 7.000."),
    (r"exposi",      "Exposição soma o principal contratado dos clientes."),
    (r"carteir",     "A carteira ativa está em torno de R$ 5,3 milhões."),
    (r"contas correntes", "Temos 8 contas correntes na base."),
    (r"ltv|imobili",  "O contrato K004 é imobiliário."),
]

SEMANTIC_MOCK_NOTE = (
    "[modo mock] O agente semântico orquestraria: disambig.resolve_term → "
    "ontology.get_axiom → metrics.compute. Em runtime real, esta resposta vem "
    "do LLM Azure tomando decisões de tool-call."
)


def _mock_chat(messages: list[dict], naive: bool) -> str:
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    text = last_user.lower()
    if naive:
        for pat, ans in NAIVE_MOCK_BY_KEYWORD:
            if re.search(pat, text):
                return ans
        return "Com base nos documentos, posso lhe ajudar com este tópico."
    # semantic mock: deve ser direcionado pelo orchestrator (tool-calling),
    # mas aqui devolvemos uma stub textual.
    return "[mock-semantic] aguardando tool-calls para responder com axioma."


# ---------------------- Cliente real ---------------------------------------

class LLM:
    def __init__(self):
        self.configured = settings.azure_configured
        self._client = None
        if self.configured:
            self._client = AsyncAzureOpenAI(
                azure_endpoint=settings.azure_endpoint,
                api_key=settings.azure_key,
                api_version=settings.azure_api_version,
            )

    async def chat(self, messages: list[dict], naive: bool = False,
                   tools: list[dict] | None = None,
                   tool_choice: str = "auto",
                   temperature: float = 0.0) -> dict:
        """
        Retorna {'content': str | None, 'tool_calls': list, 'mock': bool}.
        """
        if not self.configured:
            return {"content": _mock_chat(messages, naive), "tool_calls": [], "mock": True}

        kwargs: dict[str, Any] = {
            "model": settings.azure_deployment,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice

        resp = await self._client.chat.completions.create(**kwargs)
        msg = resp.choices[0].message
        return {
            "content": msg.content,
            "tool_calls": [
                {"id": tc.id, "name": tc.function.name,
                 "arguments": json.loads(tc.function.arguments or "{}")}
                for tc in (msg.tool_calls or [])
            ],
            "mock": False,
        }


llm = LLM()
