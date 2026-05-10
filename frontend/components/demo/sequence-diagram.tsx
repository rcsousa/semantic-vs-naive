// FILE: c:\Users\ricar\OneDrive\demo-graph\frontend\components\demo\sequence-diagram.tsx
"use client";

import React, { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Brain,
  Shuffle,
  BookOpen,
  BarChart3,
  Network,
  Database,
  CheckCircle2,
  Zap,
  Server,
} from "lucide-react";
import type { WorkstripEvent } from "@/lib/api";

// ─── constants ───────────────────────────────────────────────────────────────

const COL_WIDTH = 140;
const HEADER_H = 70;
const ROW_H = 52;
const LIFELINE_X_OFFSET = COL_WIDTH / 2; // center of each column
const ACTIVATION_W = 8;
const ARROW_Y_OFFSET = 22; // vertical center of an event row

// ─── participant config ───────────────────────────────────────────────────────

type ParticipantKey =
  | "agent"
  | "agg"
  | "disambig"
  | "ontology"
  | "metrics"
  | "kg"
  | "qdrant"
  | "rag"
  | "eval"
  | "default"
  | "postgres"
  | "neo4j"
  | "qdrant_db";

const PARTICIPANT_ICON: Record<ParticipantKey, React.FC<{ color: string; size: number }>> = {
  agent:     ({ color, size }) => <Brain color={color} width={size} height={size} />,
  agg:       ({ color, size }) => <Server color={color} width={size} height={size} />,
  disambig:  ({ color, size }) => <Shuffle color={color} width={size} height={size} />,
  ontology:  ({ color, size }) => <BookOpen color={color} width={size} height={size} />,
  metrics:   ({ color, size }) => <BarChart3 color={color} width={size} height={size} />,
  kg:        ({ color, size }) => <Network color={color} width={size} height={size} />,
  qdrant:    ({ color, size }) => <Database color={color} width={size} height={size} />,
  rag:       ({ color, size }) => <Database color={color} width={size} height={size} />,
  eval:      ({ color, size }) => <CheckCircle2 color={color} width={size} height={size} />,
  default:   ({ color, size }) => <Zap color={color} width={size} height={size} />,
  postgres:  ({ color, size }) => <Database color={color} width={size} height={size} />,
  neo4j:     ({ color, size }) => <Database color={color} width={size} height={size} />,
  qdrant_db: ({ color, size }) => <Database color={color} width={size} height={size} />,
};

const PARTICIPANT_COLOR: Record<ParticipantKey, string> = {
  agent:     "#3b82f6",
  agg:       "#6366f1",
  disambig:  "#8b5cf6",
  ontology:  "#0ea5e9",
  metrics:   "#10b981",
  kg:        "#f59e0b",
  qdrant:    "#6366f1",
  rag:       "#6366f1",
  eval:      "#ef4444",
  default:   "#94a3b8",
  postgres:  "#64748b",
  neo4j:     "#0f9d58",
  qdrant_db: "#818cf8",
};

const PARTICIPANT_LABEL: Record<string, string> = {
  agent:     "Agente",
  agg:       "MCP Gateway",
  disambig:  "Disambig",
  ontology:  "Ontologia",
  metrics:   "Métricas",
  kg:        "KG Neo4j",
  qdrant:    "Qdrant",
  rag:       "RAG",
  eval:      "Eval",
  postgres:  "Postgres",
  neo4j:     "Neo4j",
  qdrant_db: "Qdrant DB",
};

// Backend participants are "inferred" (not directly visible in events — called by MCPs)
const BACKEND_PARTICIPANTS = new Set(["postgres", "neo4j", "qdrant_db"]);

// Backends mostrados como raias separadas — apenas onde o SQL determinístico
// é o ponto pedagógico. KG e RAG são conceitualmente o próprio serviço MCP.
const MCP_BACKEND_MAP: Record<string, string> = {
  metrics: "postgres",
  eval:    "postgres",
};

function participantKey(name: string): ParticipantKey {
  if (name in PARTICIPANT_ICON) return name as ParticipantKey;
  return "default";
}

function participantLabel(name: string): string {
  return PARTICIPANT_LABEL[name] ?? name;
}

function participantColor(name: string): string {
  return PARTICIPANT_COLOR[participantKey(name)];
}

// ─── event filtering & participant extraction ─────────────────────────────────

const VISIBLE_TYPES = new Set([
  "agent_started",
  "thinking",
  "tool_call",
  "tool_result",
  "final",
  "error",
]);

type InferredItem = {
  kind: "inferred";
  from: string;
  to: string;
  direction: "call" | "return";
  label: string;
  parentEv?: WorkstripEvent; // evento pai para dados reais no popover
};

type SequenceItem =
  | { kind: "event"; ev: WorkstripEvent }
  | InferredItem;

function serviceFromToolCall(label: string): string {
  // "disambig__suggest" → "disambig"; "qdrant.search" → "qdrant"
  const dblUnder = label.indexOf("__");
  if (dblUnder !== -1) return label.slice(0, dblUnder);
  const dot = label.indexOf(".");
  if (dot !== -1) return label.slice(0, dot);
  return label;
}

function serviceFromToolResult(detail: any): string | null {
  if (!detail || typeof detail.tool !== "string") return null;
  return serviceFromToolCall(detail.tool);
}

function shortToolName(label: string): string {
  const dblUnder = label.indexOf("__");
  if (dblUnder !== -1) return label.slice(dblUnder + 2);
  const dot = label.indexOf(".");
  if (dot !== -1) return label.slice(dot + 1);
  return label;
}

function richCallLabel(ev: WorkstripEvent): string {
  const base = shortToolName(ev.label);
  const args = ev.detail?.args;
  if (!args) return base;
  const id = args.id ?? args.axiom_id ?? args.term ?? args.cypher?.slice(0, 20);
  if (id) return `${base}(${String(id).slice(0, 22)})`;
  const text = args.text;
  if (text) return `${base}("${String(text).slice(0, 18)}")`;
  return base;
}

function richResultLabel(ev: WorkstripEvent): string {
  const out = ev.detail?.output;
  if (!out) return ev.label.slice(0, 30);
  if (out.count !== undefined) return `${out.count} ${out.count === 1 ? "linha" : "linhas"}`;
  if (Array.isArray(out.rows)) return `${out.rows.length} ${out.rows.length === 1 ? "linha" : "linhas"}`;
  if (out.verdict) return `verdict: ${out.verdict}`;
  if (out.matches !== undefined) return `${out.matches?.length ?? 0} termos`;
  if (out.resolves_to) return `→ ${out.resolves_to}`;
  return ev.label.slice(0, 30);
}

function richBackendCallLabel(parentEv: WorkstripEvent | undefined, to: string): string {
  if (!parentEv) return "query";
  const args = parentEv.detail?.args;
  const id = args?.id ?? args?.axiom_id;
  if (to === "postgres" && id) return `SQL · ${String(id).slice(0, 18)}`;
  if (to === "neo4j") return "Cypher";
  if (to === "qdrant_db") return "vector search";
  return "query";
}

function extractParticipants(events: WorkstripEvent[]): string[] {
  const seen = new Set<string>(["agent"]);
  const order: string[] = ["agent"];
  const backendsNeeded = new Set<string>();
  let hasAggregator = false;

  for (const ev of events) {
    if (!VISIBLE_TYPES.has(ev.type)) continue;
    let svc: string | null = null;
    if (ev.type === "tool_call") {
      // tool names with __ prefix indicate aggregator is in use
      if (ev.label.includes("__")) hasAggregator = true;
      svc = serviceFromToolCall(ev.label);
    }
    if (ev.type === "tool_result") svc = serviceFromToolResult(ev.detail);

    if (svc && svc !== "agg" && !seen.has(svc)) {
      seen.add(svc);
      order.push(svc);
      const backend = MCP_BACKEND_MAP[svc];
      if (backend) backendsNeeded.add(backend);
    }
  }

  // Insert aggregator at position 1 (between agent and MCP servers)
  if (hasAggregator) order.splice(1, 0, "agg");

  // Append backend columns at the end (fixed order)
  for (const b of ["postgres", "neo4j", "qdrant_db"]) {
    if (backendsNeeded.has(b) && !seen.has(b)) order.push(b);
  }

  return order;
}

function fixLabel(label: string): string {
  // Legacy fallback: "LLM step N" → "Dispatch N" (only if no better label)
  return label.replace(/^LLM step (\d+)$/gi, "Dispatch $1");
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function colX(index: number): number {
  return index * COL_WIDTH + LIFELINE_X_OFFSET;
}

interface ArrowProps {
  x1: number;
  x2: number;
  y: number;
  dashed?: boolean;
  color?: string;
  label?: string;
  markerId: string;
}

function HArrow({ x1, x2, y, dashed, color = "#64748b", label, markerId }: ArrowProps) {
  const goingRight = x2 > x1;
  const labelX = (x1 + x2) / 2;
  // For left-going (return) arrows, use the left-pointing marker at markerEnd (x2)
  const markerEndId = goingRight ? markerId : markerId.replace("arrow-", "arrow-left-");

  return (
    <g>
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5,3" : undefined}
        markerEnd={`url(#${markerEndId})`}
      />
      {label && (
        <text
          x={labelX}
          y={y - 4}
          textAnchor="middle"
          fontSize={10}
          fill={color}
          fontFamily="ui-monospace, monospace"
        >
          {label.length > 28 ? label.slice(0, 28) + "…" : label}
        </text>
      )}
    </g>
  );
}

// ─── Popover row overlay ──────────────────────────────────────────────────────

interface RowOverlayProps {
  x: number;
  y: number;
  width: number;
  ev: WorkstripEvent;
}

function RowOverlay({ x, y, width, ev }: RowOverlayProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <rect
          x={x}
          y={y}
          width={width}
          height={ROW_H}
          fill="transparent"
          style={{ cursor: "pointer" }}
          role="button"
          aria-label={`Ver detalhe: ${ev.label}`}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={4}
          style={{
            zIndex: 9999,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            padding: 12,
            minWidth: 280,
            maxWidth: 420,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              {ev.agent}
            </span>
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
              {ev.type} · {ev.elapsed_ms != null ? `${ev.elapsed_ms}ms` : "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{ev.label}</div>
          <pre
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              background: "hsl(var(--muted))",
              borderRadius: 6,
              padding: 8,
              maxHeight: "40vh",
              overflowY: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {JSON.stringify(ev.detail, null, 2)}
          </pre>
          <Popover.Arrow style={{ fill: "hsl(var(--border))" }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Popover para setas inferidas ────────────────────────────────────────────

interface InferredOverlayProps {
  x: number;
  y: number;
  width: number;
  item: InferredItem;
}

function InferredOverlay({ x, y, width, item }: InferredOverlayProps) {
  const [open, setOpen] = useState(false);
  const fromLabel = participantLabel(item.from);
  const toLabel = participantLabel(item.to);
  const pEv = item.parentEv;

  const POPOVER_STYLE = {
    zIndex: 9999,
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    padding: 12,
    minWidth: 300,
    maxWidth: 440,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <rect
          x={x} y={y} width={width} height={ROW_H}
          fill="transparent"
          style={{ cursor: "pointer" }}
          role="button"
          aria-label={`${fromLabel} → ${toLabel}`}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="start" sideOffset={4} style={POPOVER_STYLE}>
          <div style={{ marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))",
              borderRadius: 4, padding: "1px 6px",
            }}>
              {item.direction === "call" ? "→ roteamento" : "← retorno"}
            </span>
            {pEv?.elapsed_ms != null && (
              <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                {pEv.elapsed_ms}ms
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
            {fromLabel} → {toLabel}
          </div>
          {/* Dados reais do evento pai */}
          {pEv && (
            <pre style={{
              fontSize: 11, lineHeight: 1.5,
              background: "hsl(var(--muted))", borderRadius: 6, padding: 8,
              maxHeight: "35vh", overflowY: "auto", margin: 0,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {JSON.stringify(
                item.direction === "call"
                  ? (pEv.detail?.args ?? pEv.detail)
                  : (pEv.detail?.output ?? pEv.detail),
                null, 2
              )}
            </pre>
          )}
          {!pEv && (
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
              Chamada interna rastreada via evento {item.direction === "call" ? "tool_call" : "tool_result"}.
            </div>
          )}
          <Popover.Arrow style={{ fill: "hsl(var(--border))" }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SequenceDiagram({
  events,
  agentVariant,
}: {
  events: WorkstripEvent[];
  agentVariant: "naive" | "semantic";
}) {
  const participants = useMemo(() => extractParticipants(events), [events]);

  const sequenceItems = useMemo((): SequenceItem[] => {
    const visible = events.filter((ev) => VISIBLE_TYPES.has(ev.type));
    const hasAgg = participants.includes("agg");
    const items: SequenceItem[] = [];

    // Mantém mapa tool_call por label para linkagem com tool_result
    const lastToolCallByLabel = new Map<string, WorkstripEvent>();

    for (const ev of visible) {
      if (ev.type === "tool_call" && hasAgg) {
        const svc = serviceFromToolCall(ev.label);
        lastToolCallByLabel.set(ev.label, ev);
        items.push({ kind: "event", ev });
        items.push({ kind: "inferred", from: "agg", to: svc, direction: "call",
                     label: richCallLabel(ev), parentEv: ev });
        const backend = MCP_BACKEND_MAP[svc];
        if (backend && participants.includes(backend)) {
          items.push({ kind: "inferred", from: svc, to: backend, direction: "call",
                       label: richBackendCallLabel(ev, backend), parentEv: ev });
          items.push({ kind: "inferred", from: backend, to: svc, direction: "return",
                       label: "rows ↩", parentEv: ev });
        }
      } else if (ev.type === "tool_result" && hasAgg) {
        const svc = serviceFromToolResult(ev.detail);
        if (svc && svc !== "agg" && participants.includes(svc)) {
          items.push({ kind: "inferred", from: svc, to: "agg", direction: "return",
                       label: richResultLabel(ev), parentEv: ev });
        }
        items.push({ kind: "event", ev });
      } else {
        items.push({ kind: "event", ev });
        if (ev.type === "tool_call" && !hasAgg) {
          const svc = serviceFromToolCall(ev.label);
          const backend = MCP_BACKEND_MAP[svc];
          if (backend && participants.includes(backend)) {
            items.push({ kind: "inferred", from: svc, to: backend, direction: "call",
                         label: richBackendCallLabel(ev, backend), parentEv: ev });
            items.push({ kind: "inferred", from: backend, to: svc, direction: "return",
                         label: "rows ↩", parentEv: ev });
          }
        }
      }
    }
    return items;
  }, [events, participants]);

  const totalCols = participants.length;
  const svgWidth = totalCols * COL_WIDTH;
  const svgHeight = HEADER_H + sequenceItems.length * ROW_H + 20;

  const lifelineBottom = svgHeight - 10;

  if (events.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 120,
          color: "hsl(var(--muted-foreground))",
          fontSize: 13,
        }}
      >
        aguardando execução…
      </div>
    );
  }

  // Build row rendering data
  interface RowData {
    item: SequenceItem;
    rowIndex: number;
    y: number; // top of the row
    centerY: number; // center y for arrows/markers
  }

  const rows: RowData[] = sequenceItems.map((item, i) => ({
    item,
    rowIndex: i,
    y: HEADER_H + i * ROW_H,
    centerY: HEADER_H + i * ROW_H + ARROW_Y_OFFSET,
  }));

  const agentColX = colX(0);

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: "block", minWidth: svgWidth }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── defs: arrowheads ── */}
        <defs>
          {/* solid right-pointing (calls) */}
          <marker id="arrow-solid" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
          </marker>
          {/* dashed right-pointing (calls, lighter) */}
          <marker id="arrow-dashed" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
          {/* solid left-pointing (returns) — fixed orient, tip at x=8 */}
          <marker id="arrow-left-solid" markerWidth={8} markerHeight={6} refX={1} refY={3} orient="auto">
            <path d="M8,0 L8,6 L0,3 z" fill="#64748b" />
          </marker>
          {/* dashed left-pointing (returns, lighter) */}
          <marker id="arrow-left-dashed" markerWidth={8} markerHeight={6} refX={1} refY={3} orient="auto">
            <path d="M8,0 L8,6 L0,3 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* ── participant headers ── */}
        {participants.map((name, idx) => {
          const cx = colX(idx);
          const color = participantColor(name);
          const Icon = PARTICIPANT_ICON[participantKey(name)];
          const label = participantLabel(name);

          return (
            <g key={name}>
              {/* header box as foreignObject */}
              <foreignObject
                x={cx - COL_WIDTH / 2 + 6}
                y={4}
                width={COL_WIDTH - 12}
                height={HEADER_H - 10}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    border: `1.5px solid ${color}`,
                    borderRadius: 8,
                    background: "hsl(var(--card))",
                    boxSizing: "border-box",
                  }}
                >
                  <Icon color={color} size={18} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: color,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {label}
                  </span>
                </div>
              </foreignObject>

              {/* lifeline */}
              <line
                x1={cx}
                y1={HEADER_H}
                x2={cx}
                y2={lifelineBottom}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.45}
              />
            </g>
          );
        })}

        {/* ── event rows ── */}
        {rows.map(({ item, rowIndex, y, centerY }) => {
          const agentIdx = 0;

          if (item.kind === "inferred") {
            const srcIdx = participants.indexOf(item.from);
            const tgtIdx = participants.indexOf(item.to);
            if (srcIdx === -1 || tgtIdx === -1) return null;
            const x1 = colX(srcIdx);
            const x2 = colX(tgtIdx);
            const inferredColor = participantColor(item.to);
            return (
              <g key={`inferred-${rowIndex}`} opacity={0.5}>
                <HArrow
                  x1={x1} x2={x2} y={centerY}
                  dashed
                  color={inferredColor}
                  label={item.label}
                  markerId={item.direction === "call" ? "arrow-dashed" : "arrow-dashed-start"}
                />
                <InferredOverlay x={0} y={y} width={svgWidth} item={item} />
              </g>
            );
          }

          // existing: const ev = item.ev;
          const ev = item.ev;

          if (ev.type === "agent_started") {
            return (
              <g key={ev.id + rowIndex}>
                {/* star / start marker */}
                <circle cx={agentColX} cy={centerY} r={5} fill="#3b82f6" opacity={0.9} />
                <text
                  x={agentColX + 10}
                  y={centerY + 4}
                  fontSize={10}
                  fill="#3b82f6"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {fixLabel(ev.label)}
                </text>
                <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
              </g>
            );
          }

          if (ev.type === "thinking") {
            const displayLabel = fixLabel(ev.label);
            return (
              <g key={ev.id + rowIndex}>
                {/* activation box on agent lifeline */}
                <rect
                  x={agentColX - ACTIVATION_W / 2}
                  y={y + 6}
                  width={ACTIVATION_W}
                  height={ROW_H - 12}
                  rx={2}
                  fill="#3b82f6"
                  opacity={0.55}
                />
                <text
                  x={agentColX + ACTIVATION_W / 2 + 6}
                  y={centerY + 4}
                  fontSize={10}
                  fill="hsl(var(--foreground))"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {displayLabel.length > 32 ? displayLabel.slice(0, 32) + "…" : displayLabel}
                </text>
                <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
              </g>
            );
          }

          if (ev.type === "tool_call") {
            const svc = serviceFromToolCall(ev.label);
            // When aggregator is present, arrow goes Agent → agg; otherwise Agent → service
            const targetName = participants.includes("agg") ? "agg" : svc;
            const svcIdx = participants.indexOf(targetName);
            if (svcIdx === -1) {
              return (
                <g key={ev.id + rowIndex}>
                  <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
                </g>
              );
            }
            const svcX = colX(svcIdx);
            const callLabel = richCallLabel(ev);
            const color = participantColor(targetName);

            return (
              <g key={ev.id + rowIndex}>
                <line
                  x1={agentColX + ACTIVATION_W / 2}
                  y1={centerY}
                  x2={svcX - 4}
                  y2={centerY}
                  stroke={color}
                  strokeWidth={2}
                  markerEnd="url(#arrow-solid)"
                />
                <text
                  x={(agentColX + svcX) / 2}
                  y={centerY - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fill={color}
                  fontFamily="ui-monospace, monospace"
                >
                  {callLabel.length > 30 ? callLabel.slice(0, 30) + "…" : callLabel}
                </text>
                <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
              </g>
            );
          }

          if (ev.type === "tool_result") {
            const svc = serviceFromToolResult(ev.detail);
            // When aggregator present, return arrow comes from agg; otherwise from service
            const sourceName = participants.includes("agg") ? "agg" : (svc ?? null);
            const svcIdx = sourceName ? participants.indexOf(sourceName) : -1;
            if (svcIdx === -1) {
              return (
                <g key={ev.id + rowIndex}>
                  <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
                </g>
              );
            }
            const svcX = colX(svcIdx);
            const color = participantColor(sourceName!);
            const retLabel = richResultLabel(ev);

            return (
              <g key={ev.id + rowIndex}>
                <line
                  x1={svcX}
                  y1={centerY}
                  x2={agentColX + ACTIVATION_W / 2 + 4}
                  y2={centerY}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="5,3"
                  markerEnd="url(#arrow-left-dashed)"
                />
                <text
                  x={(agentColX + svcX) / 2}
                  y={centerY - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fill={color}
                  opacity={0.8}
                  fontFamily="ui-monospace, monospace"
                >
                  {retLabel.length > 30 ? retLabel.slice(0, 30) + "…" : retLabel}
                </text>
                <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
              </g>
            );
          }

          if (ev.type === "final") {
            const responseText =
              typeof ev.detail?.response === "string"
                ? ev.detail.response
                : typeof ev.detail?.answer === "string"
                ? ev.detail.answer
                : ev.label;
            const truncated =
              responseText.length > 50 ? responseText.slice(0, 50) + "…" : responseText;

            return (
              <g key={ev.id + rowIndex}>
                {/* double horizontal line at bottom of agent lifeline */}
                <line
                  x1={agentColX - 24}
                  y1={centerY - 2}
                  x2={agentColX + 24}
                  y2={centerY - 2}
                  stroke="#3b82f6"
                  strokeWidth={3}
                />
                <line
                  x1={agentColX - 24}
                  y1={centerY + 4}
                  x2={agentColX + 24}
                  y2={centerY + 4}
                  stroke="#3b82f6"
                  strokeWidth={3}
                />
                <text
                  x={agentColX + 30}
                  y={centerY + 4}
                  fontSize={10}
                  fill="#3b82f6"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {truncated}
                </text>
                <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
              </g>
            );
          }

          if (ev.type === "error") {
            return (
              <g key={ev.id + rowIndex}>
                {/* red X */}
                <line
                  x1={agentColX - 8}
                  y1={centerY - 8}
                  x2={agentColX + 8}
                  y2={centerY + 8}
                  stroke="#ef4444"
                  strokeWidth={2.5}
                />
                <line
                  x1={agentColX + 8}
                  y1={centerY - 8}
                  x2={agentColX - 8}
                  y2={centerY + 8}
                  stroke="#ef4444"
                  strokeWidth={2.5}
                />
                <text
                  x={agentColX + 14}
                  y={centerY + 4}
                  fontSize={10}
                  fill="#ef4444"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {ev.label.length > 40 ? ev.label.slice(0, 40) + "…" : ev.label}
                </text>
                <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
              </g>
            );
          }

          // fallback
          return (
            <g key={ev.id + rowIndex}>
              <RowOverlay x={0} y={y} width={svgWidth} ev={ev} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
