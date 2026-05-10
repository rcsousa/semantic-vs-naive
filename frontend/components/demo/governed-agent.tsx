"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workstrip } from "./workstrip";
import type { GovernEvent } from "@/lib/api";
import { CheckCircle2, XCircle, AlertTriangle, ShieldAlert, ShieldCheck, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Trigger = { code: string; threshold: number; observed: number; detail: string };

export function GovernedAgent({
  agentEvents,
  judgeResult,
  killswitchResult,
  finalEvent,
}: {
  agentEvents: GovernEvent[];
  judgeResult: { verdict: string; reasoning: string; confidence: number } | null;
  killswitchResult: { armed: boolean; triggers: Trigger[]; ragas_score?: number } | null;
  finalEvent: GovernEvent | null;
}) {
  const verdict = judgeResult?.verdict ?? null;
  const armed = killswitchResult?.armed ?? false;

  return (
    <Card className="overflow-hidden border-emerald-500/40">
      <CardHeader className="bg-muted/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Agente Semântico · Governança
            </CardTitle>
            <CardDescription>
              Calcular → Julgar → Parar. Auditabilidade como subproduto.
            </CardDescription>
          </div>
        </div>

        {/* ── Três badges de governança ── */}
        {(agentEvents.length > 0 || judgeResult) && (
          <div className="mt-3 flex flex-wrap gap-2">
            <GovernBadge
              label="Calcular"
              status={agentEvents.some((e) => e.type === "final") ? "ok" : "pending"}
              tooltip="Pipeline semântico executado (disambig → axioma → métrica)"
            />
            <GovernBadge
              label={`Julgar ${verdict ? `· ${verdict}` : ""}`}
              status={
                verdict === "consistent" ? "ok"
                : verdict === "insufficient_evidence" ? "warn"
                : verdict === "inconsistent" ? "error"
                : "pending"
              }
              tooltip={judgeResult?.reasoning ?? "Aguardando judge…"}
            />
            <GovernBadge
              label={`Parar · ${armed ? "armed" : killswitchResult ? "passivo" : "aguardando"}`}
              status={armed ? "error" : killswitchResult ? "ok" : "pending"}
              tooltip={
                armed
                  ? `Triggers: ${killswitchResult?.triggers.map((t) => t.code).join(", ")}`
                  : "Killswitch passivo — resposta entregue"
              }
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        {/* ── Caixa de escalação ── */}
        {armed && finalEvent?.type === "escalated" && (
          <EscalationBox
            triggers={finalEvent.detail.triggers ?? []}
            hash={finalEvent.detail.reproducibility_hash ?? ""}
          />
        )}

        {/* ── Resposta entregue ── */}
        {!armed && finalEvent?.type === "final_governed" && (
          <DeliveredAnswer
            text={finalEvent.detail.text ?? ""}
            hash={finalEvent.detail.reproducibility_hash ?? ""}
          />
        )}

        {/* ── Aguardando ── */}
        {!finalEvent && agentEvents.length === 0 && (
          <div className="rounded-md border bg-background p-3">
            <span className="text-sm text-muted-foreground">aguardando execução…</span>
          </div>
        )}

        {/* ── Workstrip do agente semântico ── */}
        {agentEvents.length > 0 && (
          <Workstrip
            title="Fluxo de execução"
            events={agentEvents as any}
            agentColor="green"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function GovernBadge({
  label,
  status,
  tooltip,
}: {
  label: string;
  status: "ok" | "warn" | "error" | "pending";
  tooltip: string;
}) {
  const colors: Record<string, string> = {
    ok: "border-emerald-500/60 text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
    warn: "border-amber-500/60 text-amber-600 bg-amber-50 dark:bg-amber-950",
    error: "border-red-500/60 text-red-600 bg-red-50 dark:bg-red-950",
    pending: "border-muted text-muted-foreground",
  };
  const Icon = status === "ok" ? CheckCircle2 : status === "warn" ? AlertTriangle : status === "error" ? XCircle : null;
  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium cursor-help",
        colors[status],
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

function EscalationBox({ triggers, hash }: { triggers: Trigger[]; hash: string }) {
  return (
    <div className="rounded-md border border-red-500/40 bg-red-50/60 dark:bg-red-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
        <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
          Resposta não entregue — escalada para revisão humana
        </p>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
          {triggers.length} trigger{triggers.length !== 1 ? "s" : ""} ativo{triggers.length !== 1 ? "s" : ""}
        </summary>
        <ul className="mt-2 space-y-1 pl-4 border-l-2 border-red-300">
          {triggers.map((t) => (
            <li key={t.code} className="text-xs text-foreground/80">
              <span className="font-mono text-red-600">{t.code}</span>
              {" — "}
              {t.detail}
            </li>
          ))}
        </ul>
      </details>
      <HashRow hash={hash} />
    </div>
  );
}

function DeliveredAnswer({ text, hash }: { text: string; hash: string }) {
  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-background p-3">
        <div className="mb-1 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-medium uppercase text-muted-foreground">Resposta</span>
        </div>
        <div className="whitespace-pre-wrap text-sm">{text}</div>
      </div>
      <HashRow hash={hash} />
    </div>
  );
}

function HashRow({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span className="font-mono truncate max-w-[320px]" title={hash}>
        hash: {hash.slice(0, 16)}…
      </span>
      <button
        onClick={copy}
        title="Copiar hash completo"
        className="flex items-center gap-0.5 hover:text-foreground transition-colors"
      >
        <Copy className="h-3 w-3" />
        {copied ? "copiado" : "copiar"}
      </button>
    </div>
  );
}
