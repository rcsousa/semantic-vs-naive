"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, GripHorizontal, Network, Loader2, Sun, Moon, Eye, EyeOff } from "lucide-react";
import type { WorkstripEvent } from "@/lib/api";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

// ── Visual config ─────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  Customer:       "#10b981",
  Account:        "#3b82f6",
  CreditContract: "#6366f1",
  Payment:        "#f59e0b",
  Collateral:     "#ef4444",
  EntityClass:    "#64748b",
  Axiom:          "#a855f7",
  Metric:         "#f97316",
};

const NODE_SIZES: Record<string, number> = {
  Customer:       5,
  Account:        2,
  CreditContract: 3,
  Payment:        1.5,
  Collateral:     2.5,
  EntityClass:    7,
  Axiom:          10,
  Metric:         7,
};

const LINK_COLORS: Record<string, string> = {
  OWNS:        "#3b82f6",
  HOLDS:       "#6366f1",
  HAS_PAYMENT: "#f59e0b",
  SECURED_BY:  "#ef4444",
  typeof:      "#94a3b8",
  governs:     "#a855f7",
  measures:    "#f97316",
};

const LINK_WIDTHS: Record<string, number> = {
  OWNS:        1,
  HOLDS:       1.5,
  HAS_PAYMENT: 0.8,
  SECURED_BY:  1,
  typeof:      0.3,
  governs:     2,
  measures:    1.5,
};

const LEGEND = [
  { type: "Axiom",          label: "Axioma"   },
  { type: "Metric",         label: "Métrica"  },
  { type: "EntityClass",    label: "Hub"      },
  { type: "Customer",       label: "Cliente"  },
  { type: "CreditContract", label: "Contrato" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Highlight = "idle" | "querying" | "found" | "visited";
type GraphNode  = { id: string; nodeType: string; label?: string; rule_pt?: string };
type GraphLink  = { source: string | GraphNode; target: string | GraphNode; linkType: string };

// ── Color helpers ─────────────────────────────────────────────────────────────

function dimHex(hex: string, f: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r*f).toString(16).padStart(2,"0")}${Math.round(g*f).toString(16).padStart(2,"0")}${Math.round(b*f).toString(16).padStart(2,"0")}`;
}

function lightHex(hex: string, f: number): string {
  // f=0 → original, f=1 → white
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r+(255-r)*f).toString(16).padStart(2,"0")}${Math.round(g+(255-g)*f).toString(16).padStart(2,"0")}${Math.round(b+(255-b)*f).toString(16).padStart(2,"0")}`;
}

// ── Event → entity mapping ────────────────────────────────────────────────────

const VALID_ENTITIES = new Set(["Customer","CreditContract","Payment","Account","Collateral"]);

function parseCypherLabels(cypher: string): string[] {
  return [...new Set(
    [...cypher.matchAll(/\([\w]*:(\w+)\)/g)].map(m => m[1]).filter(l => VALID_ENTITIES.has(l))
  )];
}

function entitiesFromEvent(ev: WorkstripEvent): string[] {
  if (ev.type === "tool_call") {
    const t = ev.label;
    if (t.startsWith("disambig__")) return ["Customer"];
    if (t.startsWith("ontology__")) {
      const id: string = ev.detail?.args?.axiom_id ?? ev.detail?.args?.id ?? "";
      const types = id.includes("LTV")||id.includes("MORTGAGE") ? ["CreditContract","Collateral"]
                  : id.includes("ACTIVE")||id.includes("INACTIVE") ? ["Customer","Account"]
                  : ["Customer"];
      return id ? [id, ...types] : types;
    }
    if (t.startsWith("metrics__")) {
      const id: string = ev.detail?.args?.id ?? ev.detail?.args?.axiom_id ?? "";
      return [id, "Customer"].filter(Boolean);
    }
    if (t.startsWith("kg__")) {
      const cypher: string = ev.detail?.args?.cypher ?? "";
      const labels = parseCypherLabels(cypher);
      return labels.length > 0 ? labels : ["Customer","CreditContract"];
    }
  }
  if (ev.type === "tool_result") {
    const t: string = ev.detail?.tool ?? "";
    if (t.startsWith("kg__") || t.startsWith("metrics__")) {
      const rows: Record<string,unknown>[] = ev.detail?.output?.rows ?? [];
      const e = new Set<string>(["Customer"]);
      for (const row of rows) {
        if ("contract_id"   in row) e.add("CreditContract");
        if ("days_past_due" in row || "days_past_due_max" in row) e.add("Payment");
        if ("ltv"           in row || "appraised_value"   in row) e.add("Collateral");
        if ("account_id"    in row) e.add("Account");
        if (row.customer_id)  e.add(String(row.customer_id));
        if (row.contract_id)  e.add(String(row.contract_id));
      }
      return [...e];
    }
    if (t.startsWith("ontology__")) {
      const id = ev.detail?.output?.id ?? ev.detail?.args?.axiom_id;
      if (id) return [id];
    }
    if (t.startsWith("disambig__")) {
      return (ev.detail?.output?.matches ?? []).map((m: any) => m.resolves_to).filter(Boolean);
    }
  }
  return [];
}

// ── Panel constants ───────────────────────────────────────────────────────────

const HEADER_H = 42;
const INIT_W   = 720;
const INIT_H   = 580;
const MIN_W    = 420;
const MIN_H    = 320;

// ── Theme presets ─────────────────────────────────────────────────────────────

function makeTheme(light: boolean) {
  return light ? {
    panelBg:  "#ffffff",
    graphBg:  "#f1f5f9",
    headerBg: "rgba(168,85,247,0.04)",
    border:   "rgba(0,0,0,0.1)",
    shadow:   "0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(168,85,247,0.25)",
    textMain: "#0f172a",
    textSub:  "#475569",
    iconMuted:"#94a3b8",
    btnBorder:"rgba(0,0,0,0.1)",
    btnBg:    "rgba(0,0,0,0.04)",
    btnColor: "#475569",
    resize:   "rgba(0,0,0,0.18)",
    spriteBg: "rgba(255,255,255,0.93)",
    spriteText:(base: string, hl: Highlight) => "#1e293b",
  } : {
    panelBg:  "#050510",
    graphBg:  "#050510",
    headerBg: "rgba(168,85,247,0.06)",
    border:   "rgba(255,255,255,0.1)",
    shadow:   "0 30px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.15)",
    textMain: "rgba(255,255,255,0.9)",
    textSub:  "rgba(255,255,255,0.5)",
    iconMuted:"rgba(255,255,255,0.25)",
    btnBorder:"rgba(255,255,255,0.1)",
    btnBg:    "rgba(255,255,255,0.05)",
    btnColor: "rgba(255,255,255,0.45)",
    resize:   "rgba(255,255,255,0.18)",
    spriteBg: "rgba(5,5,16,0.82)",
    spriteText:(base: string, hl: Highlight) => hl === "querying" ? "#ffffff" : base,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KnowledgeGraphPanel({
  events,
  onClose,
}: {
  events: WorkstripEvent[];
  onClose: () => void;
}) {
  const fgRef = useRef<any>(null);

  // three-spritetext lazy-loaded (client-only, avoids SSR)
  const spriteTextRef = useRef<any>(null);
  const [spriteReady, setSpriteReady] = useState(false);
  useEffect(() => {
    import("three-spritetext").then(m => { spriteTextRef.current = m.default; setSpriteReady(true); });
  }, []);

  // Graph data
  const [rawGraph, setRawGraph] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading]   = useState(true);

  // UI toggles
  const [isLight, setIsLight] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Panel geometry
  const [size, setSize] = useState({ w: INIT_W, h: INIT_H });
  const [pos,  setPos]  = useState({ x: -1, y: -1 });

  // Refs so mouse handlers stay stable
  const isLightRef   = useRef(false);
  const sizeRef      = useRef({ w: INIT_W, h: INIT_H });
  useEffect(() => { isLightRef.current = isLight; }, [isLight]);
  useEffect(() => { sizeRef.current    = size;    }, [size]);

  // Drag panel
  const dragging = useRef(false);
  const dragOff  = useRef({ dx: 0, dy: 0 });

  // Resize panel
  const resizing     = useRef(false);
  const resizeStart  = useRef({ x: 0, y: 0, w: INIT_W, h: INIT_H });

  // Initial position (bottom-right)
  useEffect(() => {
    setPos({ x: Math.max(0, window.innerWidth - INIT_W - 16), y: Math.max(0, window.innerHeight - INIT_H - 16) });
  }, []);

  // Single mouse handler for both drag and resize
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth  - sizeRef.current.w, e.clientX - dragOff.current.dx)),
          y: Math.max(0, Math.min(window.innerHeight - 50,                 e.clientY - dragOff.current.dy)),
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(MIN_W, resizeStart.current.w + (e.clientX - resizeStart.current.x)),
          h: Math.max(MIN_H, resizeStart.current.h + (e.clientY - resizeStart.current.y)),
        });
      }
    };
    const up = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const onHeaderDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOff.current  = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.preventDefault();
  };

  const onResizeDown = (e: React.MouseEvent) => {
    resizing.current    = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    e.preventDefault();
    e.stopPropagation();
  };

  // Fetch graph
  useEffect(() => {
    fetch("/api/gw/api/kg-graph")
      .then(r => r.json())
      .then(d => { setRawGraph(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Highlights ────────────────────────────────────────────────────────────

  const [hlMap, setHlMap]  = useState<Record<string, Highlight>>({});
  const hlMapRef           = useRef<Record<string, Highlight>>({});
  const timers             = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const processed          = useRef(0);

  useEffect(() => { hlMapRef.current = hlMap; }, [hlMap]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Reset when a new execution starts (events go to [])
  useEffect(() => {
    if (events.length === 0 && processed.current > 0) {
      processed.current = 0;
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      setHlMap({});
    }
  }, [events.length]);

  const hasActive = useMemo(() => Object.values(hlMap).some(h => h !== "idle"), [hlMap]);
  const hasActiveRef = useRef(false);
  useEffect(() => { hasActiveRef.current = hasActive; }, [hasActive]);

  useEffect(() => {
    const newEvs = events.slice(processed.current);
    processed.current = events.length;
    if (!newEvs.length) return;

    const updates: Record<string, Highlight> = {};
    for (const ev of newEvs) {
      const state: Highlight = ev.type === "tool_call" ? "querying" : "found";
      for (const entity of entitiesFromEvent(ev)) if (entity) updates[entity] = state;
    }
    if (!Object.keys(updates).length) return;

    setHlMap(prev => ({ ...prev, ...updates }));

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

  // ── ForceGraph3D callbacks ────────────────────────────────────────────────

  // Focused mode: hide idle nodes/links while any node is active
  const nodeVisibility = useCallback((node: any) => {
    if (showAll || !hasActiveRef.current) return true;
    return (hlMapRef.current[node.id] ?? "idle") !== "idle";
  }, [showAll, hlMap]);

  const linkVisibility = useCallback((link: any) => {
    if (showAll || !hasActiveRef.current) return true;
    const s = (link.source as any)?.id ?? link.source;
    const t = (link.target as any)?.id ?? link.target;
    return (hlMapRef.current[s] ?? "idle") !== "idle"
        && (hlMapRef.current[t] ?? "idle") !== "idle";
  }, [showAll, hlMap]);

  // Labels: appear only on lit nodes (any type)
  const nodeThreeObject = useCallback((node: any) => {
    const ST = spriteTextRef.current;
    if (!ST) return null;
    const hl = hlMapRef.current[node.id] ?? "idle";
    if (hl === "idle") return null;

    const T  = makeTheme(isLightRef.current);
    const base = NODE_COLORS[node.nodeType] ?? "#94a3b8";
    const sprite = new ST(node.label ?? node.id);
    sprite.color          = T.spriteText(base, hl);
    sprite.textHeight     = node.nodeType === "EntityClass" ? 12
                          : node.nodeType === "Axiom" || node.nodeType === "Metric" ? 9 : 7;
    sprite.fontFace       = "Arial";
    sprite.fontWeight     = "700";
    sprite.backgroundColor = T.spriteBg;
    sprite.padding        = 3;
    sprite.borderRadius   = 4;
    const sphereR = Math.cbrt(NODE_SIZES[node.nodeType] ?? 2) * 4;
    sprite.position.set(0, sphereR + sprite.textHeight + 2, 0);
    return sprite;
  }, [hlMap, spriteReady, isLight]);

  // Node sphere color
  const getNodeColor = useCallback((node: any) => {
    const hl   = hlMapRef.current[node.id] ?? "idle";
    const base = NODE_COLORS[node.nodeType] ?? "#64748b";
    if (hl === "querying") return isLightRef.current ? dimHex(base, 0.7)  : "#ffffff";
    if (hl === "found"   ) return base;
    if (hl === "visited" ) return base;
    return isLightRef.current ? lightHex(base, 0.65) : dimHex(base, 0.38);
  }, [hlMap, isLight]);

  const getNodeVal = useCallback((node: any) => NODE_SIZES[node.nodeType as string] ?? 2, []);

  // Link color (active = full, idle = dimmed)
  const getLinkColor = useCallback((link: any) => {
    const s  = (link.source as any)?.id ?? link.source;
    const t  = (link.target as any)?.id ?? link.target;
    const sh = hlMapRef.current[s] ?? "idle";
    const th = hlMapRef.current[t] ?? "idle";
    const base = LINK_COLORS[link.linkType as string] ?? "#94a3b8";
    if (sh !== "idle" || th !== "idle") return base;
    return isLightRef.current ? lightHex(base, 0.55) : dimHex(base, 0.45);
  }, [hlMap, isLight]);

  const getLinkWidth = useCallback((link: any) => {
    const s  = (link.source as any)?.id ?? link.source;
    const t  = (link.target as any)?.id ?? link.target;
    const sh = hlMapRef.current[s] ?? "idle";
    const th = hlMapRef.current[t] ?? "idle";
    const base = LINK_WIDTHS[link.linkType as string] ?? 0.8;
    return (sh !== "idle" || th !== "idle") ? base * 1.5 : base;
  }, [hlMap]);

  // Particles flow along active edges
  const getParticles = useCallback((link: any) => {
    const s  = (link.source as any)?.id ?? link.source;
    const t  = (link.target as any)?.id ?? link.target;
    const sh = hlMapRef.current[s] ?? "idle";
    const th = hlMapRef.current[t] ?? "idle";
    if (sh === "querying" || th === "querying") return 4;
    if (sh === "found"    || th === "found")    return 2;
    return 0;
  }, [hlMap]);

  const getNodeLabel = useCallback((node: any) =>
    `[${node.nodeType}] ${node.label ?? node.id}${node.rule_pt ? `\n\n${node.rule_pt}` : ""}`, []);

  // Pin node after drag so it stays put
  const onNodeDragEnd = useCallback((node: any) => {
    node.fx = node.x; node.fy = node.y; node.fz = node.z;
  }, []);

  const onEngineStop = useCallback(() => { fgRef.current?.zoomToFit(500, 80); }, []);

  if (pos.x < 0) return null;

  const GRAPH_H = size.h - HEADER_H;
  const T       = makeTheme(isLight);

  const BTN: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: 22, padding: "0 7px", gap: 4, borderRadius: 5,
    border: `1px solid ${T.btnBorder}`, background: T.btnBg,
    cursor: "pointer", color: T.btnColor, fontSize: 10, fontWeight: 600,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{
      position: "fixed", left: pos.x, top: pos.y,
      width: size.w, height: size.h, zIndex: 50,
      borderRadius: 12, border: `1px solid ${T.border}`,
      background: T.panelBg, boxShadow: T.shadow,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div onMouseDown={onHeaderDown} style={{
        height: HEADER_H, flexShrink: 0,
        display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
        borderBottom: `1px solid ${T.border}`, background: T.headerBg,
        cursor: "grab", userSelect: "none",
      }}>
        <GripHorizontal style={{ width: 13, height: 13, color: T.iconMuted }} />
        <Network        style={{ width: 14, height: 14, color: "#a855f7"   }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: T.textMain, flex: 1 }}>
          Knowledge Graph · 3D
        </span>

        {/* Legend */}
        {LEGEND.map(({ type, label }) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: NODE_COLORS[type], boxShadow: `0 0 4px ${NODE_COLORS[type]}` }} />
            <span style={{ fontSize: 9, color: T.textSub }}>{label}</span>
          </div>
        ))}

        {/* Focus / Ver tudo */}
        <button onClick={() => setShowAll(p => !p)} style={BTN}>
          {showAll
            ? <><EyeOff style={{ width: 10, height: 10 }} /> Focar</>
            : <><Eye    style={{ width: 10, height: 10 }} /> Ver tudo</>
          }
        </button>

        {/* Light / dark */}
        <button onClick={() => setIsLight(p => !p)} style={{ ...BTN, padding: "0 6px" }}>
          {isLight ? <Moon style={{ width: 11, height: 11 }} /> : <Sun style={{ width: 11, height: 11 }} />}
        </button>

        {/* Close */}
        <button onClick={onClose} aria-label="Fechar" style={{ ...BTN, padding: "0 6px" }}>
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* ── Graph canvas ── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 10, color: T.textSub }}>
          <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
          <Loader2 style={{ width: 28, height: 28, animation: "_spin 1s linear infinite" }} />
          <span style={{ fontSize: 12 }}>Carregando grafo…</span>
        </div>
      ) : (
        <ForceGraph3D
          ref={fgRef}
          graphData={rawGraph as any}
          width={size.w}
          height={GRAPH_H}
          backgroundColor={T.graphBg}
          nodeVisibility={nodeVisibility}
          linkVisibility={linkVisibility}
          nodeColor={getNodeColor}
          nodeVal={getNodeVal}
          nodeLabel={getNodeLabel}
          nodeOpacity={0.95}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkOpacity={0.75}
          linkCurvature={0.1}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalParticles={getParticles}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleWidth={2.5}
          onNodeDragEnd={onNodeDragEnd}
          cooldownTicks={200}
          onEngineStop={onEngineStop}
          showNavInfo={false}
          enablePointerInteraction
        />
      )}

      {/* ── Resize handle (bottom-right) ── */}
      <div onMouseDown={onResizeDown} style={{
        position: "absolute", bottom: 0, right: 0,
        width: 20, height: 20, cursor: "se-resize",
        background: `linear-gradient(-45deg,
          transparent 33%, ${T.resize} 33%, ${T.resize} 44%, transparent 44%,
          transparent 55%, ${T.resize} 55%, ${T.resize} 66%, transparent 66%,
          transparent 77%, ${T.resize} 77%, ${T.resize} 88%, transparent 88%)`,
      }} />
    </div>
  );
}
