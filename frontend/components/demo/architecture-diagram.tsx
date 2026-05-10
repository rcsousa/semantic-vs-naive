"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Card } from "@/components/ui/card";
import {
  Globe,
  Monitor,
  Server,
  Shuffle,
  BookOpen,
  BarChart3,
  Network,
  CheckCircle2,
  Database,
  Sparkles,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ComponentDef {
  id: string;
  label: string;
  tech: string;
  icon: LucideIcon;
  popoverTitle: string;
  popoverDetail: string;
  network?: string;
  networkColor?: string;
  highlight?: string; // cor de borda opcional para destaque
}

interface ZoneDef {
  id: string;
  label: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  internal?: boolean;
  components: ComponentDef[];
}

const zones: ZoneDef[] = [
  {
    id: "user",
    label: "Usuário",
    borderColor: "border-slate-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-300",
    components: [
      {
        id: "browser",
        label: "Browser",
        tech: "Browser / CLI",
        icon: Globe,
        popoverTitle: "Browser / CLI",
        popoverDetail:
          "Acessa a UI via Next.js (porta 3000). Todas as chamadas ao gateway passam pelo proxy /api/gw/* do Next.js — sem CORS, sem exposição direta do gateway.",
        network: "—",
        networkColor: "bg-slate-200 text-slate-700",
      },
    ],
  },
  {
    id: "edge",
    label: "edge network",
    borderColor: "border-teal-500",
    badgeBg: "bg-teal-50 dark:bg-teal-950",
    badgeText: "text-teal-700 dark:text-teal-300",
    components: [
      {
        id: "frontend",
        label: "Frontend",
        tech: "Next.js 14 · shadcn/ui",
        icon: Monitor,
        popoverTitle: "Frontend — Next.js 14",
        popoverDetail:
          "SPA com SSE streaming. Inclui proxy server-side (/api/gw/*) que repassa chamadas para o gateway interno — elimina problemas de CORS e SSL. Dois playgrounds: Semântico (/playground) e Governança (/governance).",
        network: "edge",
        networkColor: "bg-teal-100 text-teal-700",
      },
      {
        id: "gateway",
        label: "Gateway",
        tech: "FastAPI · Python 3.12",
        icon: Server,
        popoverTitle: "Gateway — FastAPI",
        popoverDetail:
          "Módulo 1: /api/ask — orquestra Naive + Semântico em paralelo via asyncio, SSE.\nMódulo 2: /api/govern — pipeline de governança (calculate → judge → killswitch → respond/escalate). Killswitch e AuditTrail são lógica pura no gateway, não MCP.",
        network: "edge + agents + data",
        networkColor: "bg-teal-100 text-teal-700",
      },
    ],
  },
  {
    id: "agentes",
    label: "Agentes (Gateway)",
    borderColor: "border-blue-500",
    badgeBg: "bg-blue-50 dark:bg-blue-950",
    badgeText: "text-blue-700 dark:text-blue-300",
    components: [
      {
        id: "naive-agent",
        label: "Agente Naive",
        tech: "RAG · mcp-rag · Qdrant",
        icon: Database,
        popoverTitle: "Agente Naive (RAG)",
        popoverDetail:
          "Busca vetorial pura: chama mcp-rag para embeddings + Qdrant. Sem ontologia, sem axiomas, sem grafo. Demonstra onde o RAG sozinho falha — usa critérios ambíguos dos documentos.",
        network: "agents (via mcp-rag)",
        networkColor: "bg-blue-100 text-blue-700",
      },
      {
        id: "semantic-agent",
        label: "Agente Semântico",
        tech: "Ontology-aware · Multi-MCP",
        icon: Sparkles,
        popoverTitle: "Agente Semântico (Ontology-aware)",
        popoverDetail:
          "Pipeline: disambig → ontologia → métricas determinísticas → KG. Cada resposta cita o axioma aplicado (ex.: AX-DEFAULT-90). Usado no Módulo 1 (comparativo) e no Módulo 2 (pipeline governado).",
        network: "agents (multi-MCP)",
        networkColor: "bg-blue-100 text-blue-700",
      },
    ],
  },
  {
    id: "aggregator",
    label: "MCP Gateway",
    borderColor: "border-indigo-500",
    badgeBg: "bg-indigo-50 dark:bg-indigo-950",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    components: [
      {
        id: "mcp-gateway",
        label: "mcp-gateway",
        tech: "FastAPI · agrega 7 MCPs",
        icon: Server,
        popoverTitle: "MCP Gateway",
        popoverDetail:
          "Ponto único de descoberta de tools. Agrega 7 MCPs com prefixo server__tool: metrics__compute, kg__cypher_readonly, ontology__get_axiom, disambig__resolve_term, eval__score, rag__search, judge__evaluate. Backends indisponíveis são ignorados com warning.",
        network: "agents (internal)",
        networkColor: "bg-indigo-100 text-indigo-700",
      },
    ],
  },
  {
    id: "agents",
    label: "agents network",
    borderColor: "border-violet-500",
    badgeBg: "bg-violet-50 dark:bg-violet-950",
    badgeText: "text-violet-700 dark:text-violet-300",
    internal: true,
    components: [
      {
        id: "mcp-disambig",
        label: "mcp-disambig",
        tech: "Disambiguação de termos",
        icon: Shuffle,
        popoverTitle: "mcp-disambig",
        popoverDetail:
          "Resolve sinônimos e termos ambíguos contra a ontologia. Tools: suggest, resolve_term. Rede: agents (internal).",
        network: "agents (internal)",
        networkColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "mcp-ontology",
        label: "mcp-ontology",
        tech: "Ontologia bancária",
        icon: BookOpen,
        popoverTitle: "mcp-ontology",
        popoverDetail:
          "Serve axiomas e classes do banking.json. Tools: get_axiom, list_axioms, list_synonyms. Stateless — lê arquivo em memória.",
        network: "agents (internal)",
        networkColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "mcp-metrics",
        label: "mcp-metrics",
        tech: "Métricas determinísticas",
        icon: BarChart3,
        popoverTitle: "mcp-metrics",
        popoverDetail:
          "SQL puro contra as views do Postgres. Tools: compute (AX-DEFAULT-90, AX-NPL-RATIO, Metric:Spread, Metric:SpreadVolatil…). Fonte da verdade. SpreadVolatil filtra contratos KV (carteira volátil do Módulo 2).",
        network: "agents (internal)",
        networkColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "mcp-kg",
        label: "mcp-kg",
        tech: "Knowledge Graph",
        icon: Network,
        popoverTitle: "mcp-kg",
        popoverDetail:
          "Cypher read-only contra Neo4j. Tools: cypher_readonly, describe_schema. Seguro: sem writes, sem DDL.",
        network: "agents (internal)",
        networkColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "mcp-eval",
        label: "mcp-eval",
        tech: "Avaliação automática",
        icon: CheckCircle2,
        popoverTitle: "mcp-eval",
        popoverDetail:
          "Compara respostas com ground truth (SQL canônico). Tools: score, compute_truth, list_scenarios. Retorna RAGAS-style: correto, fundamentado, completo, coerente.",
        network: "agents (internal)",
        networkColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "mcp-judge",
        label: "mcp-judge",
        tech: "LLM-as-judge · Módulo 2",
        icon: Scale,
        popoverTitle: "mcp-judge — LLM-as-judge",
        popoverDetail:
          "Avalia se a resposta do agente é consistente com o axioma aplicado sobre as instâncias declaradas. Três veredictos: consistent · inconsistent · insufficient_evidence. Em modo MOCK retorna consistent deterministicamente. Tool: judge.evaluate.",
        network: "agents (internal)",
        networkColor: "bg-violet-100 text-violet-700",
        highlight: "ring-1 ring-emerald-400",
      },
    ],
  },
  {
    id: "data",
    label: "data network",
    borderColor: "border-amber-500",
    badgeBg: "bg-amber-50 dark:bg-amber-950",
    badgeText: "text-amber-700 dark:text-amber-300",
    internal: true,
    components: [
      {
        id: "neo4j",
        label: "Neo4j",
        tech: "Neo4j 5.20 · APOC",
        icon: Database,
        popoverTitle: "Neo4j 5.20",
        popoverDetail:
          "Knowledge graph: Customer, CreditContract, Payment, Collateral, Account. Relações: OWNS, HOLDS, HAS_PAYMENT, SECURED_BY.",
        network: "data (internal)",
        networkColor: "bg-amber-100 text-amber-700",
      },
      {
        id: "postgres",
        label: "Postgres",
        tech: "Postgres 16 · Alpine",
        icon: Database,
        popoverTitle: "Postgres 16",
        popoverDetail:
          "Backend determinístico. Views: v_customer_default, v_active_customer, v_exposure, v_npl_ratio, v_contract_outstanding. Seeds: 01_schema.sql · 02_seed.sql · 03_seed_kv.sql (carteira volátil do Módulo 2).",
        network: "data (internal)",
        networkColor: "bg-amber-100 text-amber-700",
      },
      {
        id: "qdrant",
        label: "Qdrant",
        tech: "Qdrant 1.9.2",
        icon: Database,
        popoverTitle: "Qdrant 1.9.2",
        popoverDetail:
          "Vector store para RAG do agente naive. Coleção banking_docs indexada com text-embedding-3-large. Não é usado pelo agente semântico nem pelo pipeline de governança.",
        network: "data (internal)",
        networkColor: "bg-amber-100 text-amber-700",
      },
    ],
  },
];

function ZoneBadge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${bg} ${text}`}>
      {label}
    </span>
  );
}

function Arrow() {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center self-center px-1">
      <div className="flex items-center">
        <div className="h-px w-8 bg-border" />
        <div className="border-y-[5px] border-l-[8px] border-y-transparent border-l-border" />
      </div>
    </div>
  );
}

function ComponentCard({ comp }: { comp: ComponentDef }) {
  const Icon = comp.icon;
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button className={`flex w-full items-center gap-2 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${comp.highlight ?? ""}`}>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight">{comp.label}</p>
            <p className="truncate text-[10px] text-muted-foreground">{comp.tech}</p>
          </div>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 w-72 rounded-lg border bg-popover p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="space-y-2">
            <p className="font-medium leading-none">{comp.popoverTitle}</p>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{comp.popoverDetail}</p>
            {comp.network && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${comp.networkColor ?? ""}`}>
                rede: {comp.network}
              </span>
            )}
          </div>
          <PopoverPrimitive.Arrow className="fill-border" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function Zone({ zone }: { zone: ZoneDef }) {
  return (
    <div className={`flex h-full flex-col gap-2 rounded-xl border-2 border-dashed p-3 ${zone.borderColor}`}>
      <ZoneBadge label={zone.label} bg={zone.badgeBg} text={zone.badgeText} />
      {zone.components.map((comp) => (
        <ComponentCard key={comp.id} comp={comp} />
      ))}
    </div>
  );
}

const legendItems = [
  { color: "bg-teal-500", label: "edge network", desc: "Frontend + gateway — públicos" },
  { color: "bg-violet-500", label: "agents network", desc: "MCP servers — internal" },
  { color: "bg-amber-500", label: "data network", desc: "Backends de dados — internal" },
  { color: "bg-emerald-400", label: "Módulo 2", desc: "mcp-judge + govern route (novo)" },
];

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-4 border-t pt-3">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
          <span className="text-xs font-medium">{item.label}</span>
          <span className="text-xs text-muted-foreground">— {item.desc}</span>
        </div>
      ))}
    </div>
  );
}

function NaiveAgentNote() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-rose-400 bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
      <span className="mt-0.5 shrink-0 rounded-full bg-rose-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-800 dark:text-rose-200">
        naive agent
      </span>
      <p className="text-[11px] text-rose-700 dark:text-rose-300">
        O agente naive passa pelo <strong>mcp-gateway → mcp-rag → Qdrant</strong> com
        embeddings Azure text-embedding-3-large. Sem ontologia, sem axiomas, sem grafo.
      </p>
    </div>
  );
}

function GovernanceNote() {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
      <span className="mt-0.5 shrink-0 rounded-full bg-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200">
        módulo 2
      </span>
      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
        <strong>Pipeline governado</strong> — Gateway /api/govern: agente semântico →{" "}
        <strong>mcp-judge</strong> (judge__evaluate) → Killswitch (lógica pura no gateway) →
        AuditTrail SHA-256. Escalação para revisão humana quando killswitch dispara.
      </p>
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <div className="flex min-w-[720px] flex-row items-stretch gap-0">
          {zones.map((zone, idx) => (
            <div key={zone.id} className="flex flex-row items-stretch">
              <div className="flex w-44 shrink-0 flex-col">
                <Zone zone={zone} />
              </div>
              {idx < zones.length - 1 && <Arrow />}
            </div>
          ))}
        </div>

        <NaiveAgentNote />
        <GovernanceNote />
        <Legend />
      </div>
    </Card>
  );
}
