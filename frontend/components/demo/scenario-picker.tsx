// FILE: c:\Users\ricar\OneDrive\demo-graph\frontend\components\demo\scenario-picker.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { listScenarios } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ListFilter, X } from "lucide-react";

export type Scenario = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
};

function difficultyClass(difficulty: string): string {
  switch (difficulty) {
    case "easy":
      return "text-emerald-600 dark:text-emerald-400";
    case "hard":
      return "text-red-600 dark:text-red-400";
    case "edge":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

export function ScenarioPicker({
  selected,
  onSelect,
  filter,
}: {
  selected: string | null;
  onSelect: (s: Scenario | null) => void;
  filter?: (s: Scenario) => boolean;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listScenarios()
      .then((d) => {
        const all: Scenario[] = d.scenarios || [];
        setScenarios(filter ? all.filter(filter) : all);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedScenario = selected
    ? scenarios.find((s) => s.id === selected) ?? null
    : null;

  const triggerLabel = selectedScenario ? (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-[10px] shrink-0 bg-muted px-1 py-0.5 rounded">
        {selectedScenario.id}
      </span>
      <span className="truncate text-xs text-muted-foreground max-w-[180px]">
        {selectedScenario.question}
      </span>
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">
      Selecionar cenário com eval...
    </span>
  );

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      {/* Main trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm hover:bg-accent transition-colors min-w-0 max-w-xs"
      >
        <ListFilter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 min-w-0">{triggerLabel}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Clear button — only when something is selected */}
      {selected && (
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setOpen(false);
          }}
          className="flex items-center justify-center h-6 w-6 rounded-md border bg-background hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
          aria-label="Limpar cenário"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Floating dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[560px] max-h-72 overflow-y-auto rounded-lg border bg-card shadow-lg">
          <div className="p-2 grid gap-1 sm:grid-cols-2">
            {scenarios.length === 0 && (
              <div className="col-span-2 py-4 text-center text-xs text-muted-foreground">
                Carregando cenários…
              </div>
            )}
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                className={`flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-accent ${
                  selected === s.id ? "border-primary bg-accent" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1 py-0 h-4"
                  >
                    {s.id}
                  </Badge>
                  <span
                    className={`text-[10px] font-medium ${difficultyClass(s.difficulty)}`}
                  >
                    {s.difficulty}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.category}
                  </span>
                </div>
                <div className="text-xs leading-snug line-clamp-2">
                  {s.question}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
