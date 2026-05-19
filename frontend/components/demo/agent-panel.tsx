"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Workstrip } from "./workstrip";
import { KnowledgeGraphPanel } from "./knowledge-graph-panel";
import type { WorkstripEvent } from "@/lib/api";
import { CheckCircle2, XCircle, AlertTriangle, Network } from "lucide-react";
import { cn, fmtMs } from "@/lib/utils";

export function AgentPanel({
  label,
  events,
  evalResult,
  variant,
  description,
}: {
  label: string;
  events: WorkstripEvent[];
  evalResult?: any;
  variant: "naive" | "semantic";
  description: string;
}) {
  const last = [...events].reverse().find((e) => e.type === "final");
  // Tempo de relógio real: diferença entre o último e o primeiro evento (ts = Unix timestamp em segundos)
  const totalMs = events.length >= 2
    ? Math.round((events[events.length - 1].ts - events[0].ts) * 1000)
    : 0;
  const toolCalls = events.filter((e) => e.type === "tool_call").length;

  const isSem = variant === "semantic";
  const cardBorder = isSem ? "border-emerald-500/40" : "border-blue-500/40";
  const [showGraph, setShowGraph] = useState(false);

  return (
    <>
    <Card className={cn("overflow-hidden", cardBorder)}>
      <CardHeader className="bg-muted/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", isSem ? "bg-emerald-500" : "bg-blue-500")} />
              {label}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {isSem && (
              <Button
                variant={showGraph ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowGraph(p => !p)}
                className="h-6 gap-1.5 px-2 text-[11px]"
              >
                <Network className="h-3 w-3" />
                Grafo
              </Button>
            )}
            <Badge variant="outline">{toolCalls} tool calls</Badge>
            <Badge variant="outline">{fmtMs(totalMs)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="rounded-md border bg-background p-3">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Resposta</div>
          <div className="whitespace-pre-wrap text-sm">
            {last?.detail?.text || (
              <span className="text-muted-foreground">aguardando resposta…</span>
            )}
          </div>
        </div>

        {evalResult && <EvalPanel evalResult={evalResult} variant={variant} />}

        <Workstrip title="Fluxo de execução" events={events} agentColor={isSem ? "green" : "blue"} />
      </CardContent>
    </Card>
    {isSem && showGraph && (
      <KnowledgeGraphPanel events={events} onClose={() => setShowGraph(false)} />
    )}
    </>
  );
}

function RagasBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[10px]">{value.toFixed(2)}</span>
    </div>
  );
}

function EvalPanel({ evalResult, variant }: { evalResult: any; variant: "naive" | "semantic" }) {
  const ok = evalResult.exact_match;
  const ragas = evalResult.ragas_score;
  const Icon = ok ? CheckCircle2 : evalResult.score > 0 ? AlertTriangle : XCircle;
  const tone = ok ? "text-emerald-500" : evalResult.score > 0 ? "text-amber-500" : "text-red-500";

  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", tone)} />
        <div className="text-xs font-medium uppercase text-muted-foreground">Eval em tempo real</div>
        {ragas != null && (
          <span className={cn("ml-auto font-mono text-sm font-semibold", tone)}>
            RAGAS {ragas.toFixed(2)}
          </span>
        )}
      </div>

      {/* RAGAS dimensions */}
      {ragas != null && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_3fr] gap-x-2 gap-y-1 text-[10px]">
            <span className="text-muted-foreground">Correto</span>
            <RagasBar value={evalResult.ragas_correctness ?? 0} color="bg-blue-500" />
            <span className="text-muted-foreground">Fundamentado</span>
            <RagasBar value={evalResult.ragas_groundedness ?? 0} color="bg-violet-500" />
            <span className="text-muted-foreground">Completo</span>
            <RagasBar value={evalResult.ragas_completeness ?? 0} color="bg-emerald-500" />
            <span className="text-muted-foreground">Coerente</span>
            <RagasBar value={evalResult.ragas_coherence ?? 0} color="bg-amber-500" />
          </div>
        </div>
      )}

      {/* Métricas de grounding */}
      <div className="grid grid-cols-2 gap-1 text-xs border-t border-border/40 pt-2">
        <KV k="match" v={String(ok)} />
        {evalResult.precision != null && <KV k="precision" v={evalResult.precision.toFixed(2)} />}
        {evalResult.recall != null && <KV k="recall" v={evalResult.recall.toFixed(2)} />}
        {evalResult.f1 != null && <KV k="f1" v={evalResult.f1.toFixed(2)} />}
        {evalResult.abs_error != null && evalResult.abs_error !== Infinity && (
          <KV k="abs_error" v={evalResult.abs_error.toFixed(4)} />
        )}
        <KV k="truth" v={JSON.stringify(evalResult.truth)} />
        <KV k="predicted" v={JSON.stringify(evalResult.predicted)} />
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/40 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate font-mono">{v}</span>
    </div>
  );
}
