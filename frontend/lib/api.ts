// Cliente para o gateway. No browser, usa NEXT_PUBLIC_GATEWAY_URL diretamente.
export const GATEWAY_URL =
  (typeof window !== "undefined"
    ? (window as any).__GW || process.env.NEXT_PUBLIC_GATEWAY_URL
    : process.env.NEXT_PUBLIC_GATEWAY_URL) || "http://localhost:8000";

export type WorkstripEvent = {
  type:
    | "started"
    | "agent_started"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "final"
    | "eval"
    | "done"
    | "error";
  agent: "naive" | "semantic" | "system";
  label: string;
  detail: any;
  elapsed_ms?: number;
  ts: number;
  id: string;
};

export type GovernEvent = {
  type:
    | "started"
    | "agent_started"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "final"
    | "judge_started"
    | "judge_result"
    | "killswitch_evaluated"
    | "final_governed"
    | "escalated"
    | "error";
  agent: "semantic" | "governance" | "system";
  label: string;
  detail: any;
  elapsed_ms?: number;
  ts: number;
  id: string;
};

export async function listScenarios() {
  const r = await fetch(`${GATEWAY_URL}/api/scenarios`);
  return r.json();
}

export async function listAxioms() {
  const r = await fetch(`${GATEWAY_URL}/api/axioms`);
  return r.json();
}

export async function listSynonyms() {
  const r = await fetch(`${GATEWAY_URL}/api/synonyms`);
  return r.json();
}

export async function getOntology() {
  const r = await fetch(`${GATEWAY_URL}/api/ontology`);
  return r.json();
}

export async function getMcpCatalog() {
  const r = await fetch(`${GATEWAY_URL}/api/mcp-catalog`);
  return r.json();
}

export async function health() {
  const r = await fetch(`${GATEWAY_URL}/health`);
  return r.json();
}

export async function* governStream(question: string, scenario_id?: string) {
  const r = await fetch(`${GATEWAY_URL}/api/govern`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, scenario_id }),
  });
  if (!r.body) return;
  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() || "";
    for (const block of events) {
      if (!block.trim()) continue;
      const lines = block.split("\n");
      let event = "message";
      let data = "";
      for (const ln of lines) {
        if (ln.startsWith("event:")) event = ln.slice(6).trim();
        else if (ln.startsWith("data:")) data += ln.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        yield { ...parsed, type: parsed.type || event } as GovernEvent;
      } catch {
        // ignora chunks parciais
      }
    }
  }
}

export async function* askStream(question: string, scenario_id?: string) {
  const r = await fetch(`${GATEWAY_URL}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, scenario_id }),
  });
  if (!r.body) return;
  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() || "";
    for (const block of events) {
      if (!block.trim()) continue;
      const lines = block.split("\n");
      let event = "message";
      let data = "";
      for (const ln of lines) {
        if (ln.startsWith("event:")) event = ln.slice(6).trim();
        else if (ln.startsWith("data:")) data += ln.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        yield { ...parsed, type: parsed.type || event } as WorkstripEvent;
      } catch {
        // ignora chunks parciais
      }
    }
  }
}
