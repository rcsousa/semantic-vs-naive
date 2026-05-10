"use client";
import { useEffect, useState } from "react";
import { governStream, listScenarios, type GovernEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GovernedAgent } from "./governed-agent";
import { ScenarioPicker, type Scenario } from "./scenario-picker";
import { Play, Loader2 } from "lucide-react";

type JudgeResult = {
  verdict: string;
  reasoning: string;
  confidence: number;
  axiom_id?: string;
  instance_count?: number;
};
type Trigger = { code: string; threshold: number; observed: number; detail: string };
type KillswitchResult = { armed: boolean; triggers: Trigger[]; ragas_score?: number };

export function GovernanceDemo({
  initialQuestion = "",
  initialScenarioId,
}: {
  initialQuestion?: string;
  initialScenarioId?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentEvents, setAgentEvents] = useState<GovernEvent[]>([]);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [killswitchResult, setKillswitchResult] = useState<KillswitchResult | null>(null);
  const [finalEvent, setFinalEvent] = useState<GovernEvent | null>(null);
  const [mockMode, setMockMode] = useState(false);

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
    setAgentEvents([]);
    setJudgeResult(null);
    setKillswitchResult(null);
    setFinalEvent(null);
    try {
      for await (const ev of governStream(question, scenario?.id)) {
        if (ev.type === "started") {
          setMockMode(!!ev.detail?.mock_mode);
          continue;
        }
        if (ev.type === "judge_result") {
          setJudgeResult({
            verdict: ev.detail.verdict,
            reasoning: ev.detail.reasoning,
            confidence: ev.detail.confidence,
            axiom_id: ev.detail.axiom_id,
            instance_count: ev.detail.instance_count,
          });
          continue;
        }
        if (ev.type === "killswitch_evaluated") {
          setKillswitchResult({
            armed: ev.detail.armed,
            triggers: ev.detail.triggers ?? [],
            ragas_score: ev.detail.ragas_score,
          });
          continue;
        }
        if (ev.type === "final_governed" || ev.type === "escalated") {
          setFinalEvent(ev);
          continue;
        }
        if (ev.type === "judge_started") continue;
        // eventos do agente semântico
        if (ev.agent === "semantic" || ev.agent === "system") {
          setAgentEvents((p) => [...p, ev]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b pb-4 mb-4">
        <div className="flex-1 min-w-0">
          <ScenarioPicker
            selected={scenario?.id || null}
            onSelect={(s) => {
              setScenario(s);
              if (s) setQuestion(s.question);
            }}
            filter={(s) => s.category === "governance"}
          />
        </div>

        {mockMode && (
          <Badge variant="warning" className="shrink-0 whitespace-nowrap">
            mock mode
          </Badge>
        )}

        <div className="flex-[2] min-w-0">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex.: Qual o spread médio na carteira volátil? Qual o NPL Ratio?"
            rows={2}
            className="resize-none"
          />
        </div>

        <Button onClick={run} disabled={loading} className="gap-2 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? "Executando…" : "Executar"}
        </Button>
      </div>

      <GovernedAgent
        agentEvents={agentEvents}
        judgeResult={judgeResult}
        killswitchResult={killswitchResult}
        finalEvent={finalEvent}
      />
    </div>
  );
}
