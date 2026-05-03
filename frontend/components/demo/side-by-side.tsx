// FILE: c:\Users\ricar\OneDrive\demo-graph\frontend\components\demo\side-by-side.tsx
"use client";
import { useEffect, useState } from "react";
import { askStream, listScenarios, type WorkstripEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentPanel } from "./agent-panel";
import { ScenarioPicker, type Scenario } from "./scenario-picker";
import { Play, Loader2 } from "lucide-react";

export function SideBySide({
  initialQuestion = "",
  initialScenarioId,
}: {
  initialQuestion?: string;
  initialScenarioId?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [naiveEvents, setNaiveEvents] = useState<WorkstripEvent[]>([]);
  const [semEvents, setSemEvents] = useState<WorkstripEvent[]>([]);
  const [evalNaive, setEvalNaive] = useState<any>(null);
  const [evalSem, setEvalSem] = useState<any>(null);
  const [meta, setMeta] = useState<{ mockMode: boolean }>({ mockMode: false });

  useEffect(() => {
    if (initialQuestion) setQuestion(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    if (!initialScenarioId) return;
    listScenarios()
      .then((d) => {
        const found = (d.scenarios || []).find((s: Scenario) => s.id === initialScenarioId);
        if (found) {
          setScenario(found);
          if (!initialQuestion) setQuestion(found.question);
        }
      })
      .catch(() => {});
  }, [initialScenarioId]);

  async function run() {
    if (!question.trim()) return;
    setLoading(true);
    setNaiveEvents([]);
    setSemEvents([]);
    setEvalNaive(null);
    setEvalSem(null);
    try {
      for await (const ev of askStream(question, scenario?.id)) {
        if (ev.type === "started") {
          setMeta({ mockMode: !!ev.detail?.mock_mode });
          continue;
        }
        if (ev.type === "eval") {
          if (ev.agent === "naive") setEvalNaive(ev.detail.output);
          else setEvalSem(ev.detail.output);
          continue;
        }
        if (ev.agent === "naive") setNaiveEvents((p) => [...p, ev]);
        else if (ev.agent === "semantic") setSemEvents((p) => [...p, ev]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar — no Card wrapper */}
      <div className="flex items-center gap-3 border-b pb-4 mb-4">
        {/* ScenarioPicker takes flex-1 */}
        <div className="flex-1 min-w-0">
          <ScenarioPicker
            selected={scenario?.id || null}
            onSelect={(s) => {
              setScenario(s);
              if (s) setQuestion(s.question);
            }}
          />
        </div>

        {/* Mock mode badge inline after picker */}
        {meta.mockMode && (
          <Badge variant="warning" className="shrink-0 whitespace-nowrap">
            mock mode (sem chave Azure OpenAI)
          </Badge>
        )}

        {/* Textarea takes flex-[2] */}
        <div className="flex-[2] min-w-0">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex.: Quais clientes estão inadimplentes? Qual a exposição do C002?"
            rows={2}
            className="resize-none"
          />
        </div>

        {/* Comparar button */}
        <Button onClick={run} disabled={loading} className="gap-2 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? "Executando…" : "Comparar"}
        </Button>
      </div>

      {/* Agent panels — unchanged */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AgentPanel
          variant="naive"
          label="Agente Naive"
          description="LLM + RAG vetorial sobre docs. Sem ontologia, sem axiomas, sem grafo."
          events={naiveEvents}
          evalResult={evalNaive}
        />
        <AgentPanel
          variant="semantic"
          label="Agente Semantic"
          description="Ontology-aware. MCP: disambiguação → axioma → métrica determinística → KG."
          events={semEvents}
          evalResult={evalSem}
        />
      </div>

    </div>
  );
}

