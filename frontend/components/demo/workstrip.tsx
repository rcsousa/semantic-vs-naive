// FILE: c:\Users\ricar\OneDrive\demo-graph\frontend\components\demo\workstrip.tsx
"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn, fmtMs } from "@/lib/utils";
import {
  Brain,
  Database,
  FileSearch,
  Gauge,
  MessageSquare,
  Network,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import type { WorkstripEvent } from "@/lib/api";
import { SequenceDiagram } from "./sequence-diagram";

const ICONS: Record<string, React.ReactNode> = {
  agent_started: <Sparkles className="h-3.5 w-3.5" />,
  thinking: <Brain className="h-3.5 w-3.5" />,
  tool_call: <Zap className="h-3.5 w-3.5" />,
  tool_result: <FileSearch className="h-3.5 w-3.5" />,
  final: <MessageSquare className="h-3.5 w-3.5" />,
  eval: <Gauge className="h-3.5 w-3.5" />,
  error: <Shield className="h-3.5 w-3.5" />,
  done: <Sparkles className="h-3.5 w-3.5" />,
  started: <Sparkles className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  agent_started: "bg-secondary text-secondary-foreground",
  thinking: "bg-muted text-muted-foreground",
  tool_call: "bg-primary text-primary-foreground",
  tool_result: "bg-success text-success-foreground",
  final: "bg-foreground text-background",
  eval: "bg-warning text-warning-foreground",
  error: "bg-destructive text-destructive-foreground",
};

function nodeLabel(ev: WorkstripEvent): string {
  // Replace "LLM step N" with "Dispatch N"
  const label = ev.label.replace(/LLM step (\d+)/gi, "Dispatch $1");
  if (ev.type === "tool_call") return label;
  if (ev.type === "tool_result") return "↩ " + (label || "result");
  return label;
}

export function Workstrip({
  title,
  events,
  agentColor = "blue",
}: {
  title: string;
  events: WorkstripEvent[];
  agentColor?: "blue" | "green";
}) {
  const agentVariant = agentColor === "green" ? "semantic" : "naive";

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {events.length} eventos
        </Badge>
      </div>
      <div className="p-3">
        <SequenceDiagram events={events} agentVariant={agentVariant} />
      </div>
    </div>
  );
}
