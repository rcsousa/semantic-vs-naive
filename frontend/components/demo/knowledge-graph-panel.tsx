"use client";

import { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, GripHorizontal, Network } from "lucide-react";
import type { WorkstripEvent } from "@/lib/api";

// ── Color / label maps ────────────────────────────────────────────────────────

const COLORS: Record<string, string> = {
  Customer:       "#10b981",
  Account:        "#3b82f6",
  CreditContract: "#6366f1",
  Payment:        "#f59e0b",
  Collateral:     "#ef4444",
};

const LABELS_PT: Record<string, string> = {
  Customer:       "Cliente",
  Account:        "Conta",
  CreditContract: "Contrato",
  Payment:        "Parcela",
  Collateral:     "Garantia",
};

type Highlight = "idle" | "querying" | "found" | "visited";

// ── Custom node ───────────────────────────────────────────────────────────────

function EntityNode({ data }: NodeProps) {
  const type = data.entityType as string;
  const hl   = (data.highlight as Highlight) ?? "idle";
  const c    = COLORS[type] ?? "#64748b";

  const border = hl === "idle" ? `${c}55` : c;
  const bg     = hl === "idle" ? `${c}0f` : `${c}28`;
  const shadow =
    hl === "querying" ? `0 0 0 3px ${c}, 0 0 22px ${c}88` :
    hl === "found"    ? `0 0 0 2px ${c}, 0 0 12px ${c}55` :
    hl === "visited"  ? `0 0 0 1px ${c}99` :
                        "none";

  return (
    <>
      <Handle type="target" position={Position.Top}  style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        style={{
          width: 76, height: 76, borderRadius: "50%",
          border: `2px solid ${border}`,
          background: bg,
          boxShadow: shadow,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2,
          transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: c, textAlign: "center", lineHeight: 1.2, padding: "0 6px" }}>
          {type}
        </span>
        <span style={{ fontSize: 8, color: `${c}bb`, textAlign: "center" }}>
          {LABELS_PT[type]}
        </span>
        {hl === "querying" && (
          <span style={{ fontSize: 7, color: c, fontFamily: "monospace", marginTop: 2 }}>⟳ querying</span>
        )}
        {(hl === "found" || hl === "visited") && (
          <span style={{ fontSize: 7, color: `${c}cc`, fontFamily: "monospace", marginTop: 2 }}>✓</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />
    </>
  );
}

const NODE_TYPES = { entityNode: EntityNode };

// ── Static schema (ontologia bancária) ───────────────────────────────────────

const INITIAL_NODES = [
  { id: "Customer",       x: 148, y: 10  },
  { id: "Account",        x: 10,  y: 160 },
  { id: "CreditContract", x: 278, y: 160 },
  { id: "Payment",        x: 158, y: 310 },
  { id: "Collateral",     x: 378, y: 310 },
].map(({ id, x, y }) => ({
  id,
  type: "entityNode",
  position: { x, y },
  data: { entityType: id, highlight: "idle" as Highlight },
  draggable: false,
}));

const INITIAL_EDGES = [
  { id: "owns",       source: "Customer",       target: "Account",        label: "OWNS",        color: "#3b82f6" },
  { id: "holds",      source: "Customer",       target: "CreditContract", label: "HOLDS",       color: "#6366f1" },
  { id: "has-pay",    source: "CreditContract", target: "Payment",        label: "HAS_PAYMENT", color: "#f59e0b" },
  { id: "secured-by", source: "CreditContract", target: "Collateral",     label: "SECURED_BY",  color: "#ef4444" },
].map(({ id, source, target, label, color }) => ({
  id: `e-${id}`,
  source, target, label,
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color },
  style: { stroke: `${color}55`, strokeWidth: 1.5 },
  labelStyle: { fontSize: 8, fill: "#6b7280" },
  labelBgStyle: { fill: "transparent" },
}));

// ── Event → entity mapping ────────────────────────────────────────────────────

const VALID_ENTITIES = new Set(["Customer", "CreditContract", "Payment", "Account", "Collateral"]);

function parseCypherLabels(cypher: string): string[] {
  return [...new Set(
    [...cypher.matchAll(/\([\w]*:(\w+)\)/g)]
      .map(m => m[1])
      .filter(l => VALID_ENTITIES.has(l))
  )];
}

function entitiesFromEvent(ev: WorkstripEvent): string[] {
  if (ev.type === "tool_call") {
    const t = ev.label;
    if (t.startsWith("disambig__")) return ["Customer"];
    if (t.startsWith("ontology__")) {
      const id: string = ev.detail?.args?.axiom_id ?? ev.detail?.args?.id ?? "";
      if (id.includes("LTV") || id.includes("MORTGAGE")) return ["CreditContract", "Collateral"];
      if (id.includes("ACTIVE") || id.includes("INACTIVE")) return ["Customer", "Account"];
      return ["Customer"];
    }
    if (t.startsWith("metrics__")) return ["Customer"];
    if (t.startsWith("kg__")) {
      const cypher: string = ev.detail?.args?.cypher ?? "";
      const labels = parseCypherLabels(cypher);
      return labels.length > 0 ? labels : ["Customer", "CreditContract"];
    }
  }
  if (ev.type === "tool_result") {
    const t: string = ev.detail?.tool ?? "";
    if (t.startsWith("kg__") || t.startsWith("metrics__")) {
      const rows: Record<string, unknown>[] = ev.detail?.output?.rows ?? [];
      const entities = new Set<string>(["Customer"]);
      for (const row of rows) {
        if ("contract_id" in row) entities.add("CreditContract");
        if ("days_past_due" in row || "days_past_due_max" in row) entities.add("Payment");
        if ("ltv" in row || "appraised_value" in row) entities.add("Collateral");
        if ("account_id" in row) entities.add("Account");
      }
      return [...entities];
    }
  }
  return [];
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function KnowledgeGraphPanel({
  events,
  onClose,
}: {
  events: WorkstripEvent[];
  onClose: () => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges]                          = useEdgesState(INITIAL_EDGES);

  // Draggable position (initialized on mount to avoid SSR mismatch)
  const [pos, setPos]   = useState({ x: -1, y: -1 });
  const dragging        = useRef(false);
  const dragOff         = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    setPos({
      x: Math.max(0, window.innerWidth  - 510),
      y: Math.max(0, window.innerHeight - 465),
    });
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 490, e.clientX - dragOff.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight -  50, e.clientY - dragOff.current.dy)),
      });
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup",   up);
    };
  }, []);

  const onHeaderDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOff.current  = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.preventDefault();
  };

  // Highlight state ─────────────────────────────────────────────────────────
  const [hlMap, setHlMap]   = useState<Record<string, Highlight>>({});
  const timers              = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const processed           = useRef(0);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    const newEvs = events.slice(processed.current);
    processed.current = events.length;
    if (newEvs.length === 0) return;

    const updates: Record<string, Highlight> = {};
    for (const ev of newEvs) {
      const state: Highlight = ev.type === "tool_call" ? "querying" : "found";
      for (const entity of entitiesFromEvent(ev)) updates[entity] = state;
    }
    if (Object.keys(updates).length === 0) return;

    setHlMap(prev => ({ ...prev, ...updates }));

    // Transition to "visited" after a short delay
    for (const [entity, state] of Object.entries(updates)) {
      const existing = timers.current.get(entity);
      if (existing) clearTimeout(existing);
      const delay = state === "querying" ? 1500 : 2500;
      const t = setTimeout(() => {
        setHlMap(prev => prev[entity] !== state ? prev : { ...prev, [entity]: "visited" });
        timers.current.delete(entity);
      }, delay);
      timers.current.set(entity, t);
    }
  }, [events]);

  // Sync hlMap → node data
  useEffect(() => {
    setNodes(nds =>
      nds.map(n => ({ ...n, data: { ...n.data, highlight: hlMap[n.id] ?? "idle" } }))
    );
  }, [hlMap, setNodes]);

  if (pos.x < 0) return null;

  const LEGEND: { state: Highlight; label: string }[] = [
    { state: "querying", label: "consultando" },
    { state: "found",    label: "encontrado"  },
    { state: "visited",  label: "visitado"    },
    { state: "idle",     label: "inativo"     },
  ];

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x, top: pos.y,
        width: 490, height: 450,
        zIndex: 50,
        borderRadius: 12,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={onHeaderDown}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid hsl(var(--border))",
          background: "hsl(var(--muted) / 40%)",
          cursor: "grab", userSelect: "none",
        }}
      >
        <GripHorizontal style={{ width: 13, height: 13, color: "hsl(var(--muted-foreground))" }} />
        <Network style={{ width: 13, height: 13, color: "#10b981" }} />
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Grafo de Conhecimento</span>
        <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
          ontologia bancária · agente semântico
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, borderRadius: 4,
            border: "none", background: "transparent",
            cursor: "pointer", color: "hsl(var(--muted-foreground))",
          }}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* ReactFlow canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.4}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color="hsl(var(--muted-foreground))"
            gap={24}
            size={0.4}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex", gap: 14, padding: "6px 14px",
          borderTop: "1px solid hsl(var(--border))",
          background: "hsl(var(--muted) / 20%)",
          alignItems: "center",
        }}
      >
        {LEGEND.map(({ state, label }) => (
          <div key={state} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background:
                state === "querying" ? "#10b981" :
                state === "found"    ? "#10b981" :
                state === "visited"  ? "#10b98177" :
                                       "#6b728044",
              boxShadow:
                state === "querying" ? "0 0 0 2px #10b981, 0 0 6px #10b981" :
                state === "found"    ? "0 0 0 1px #10b981" : "none",
            }} />
            <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
