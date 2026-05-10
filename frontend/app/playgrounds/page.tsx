import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, GitCompare, ShieldCheck } from "lucide-react";

const MODULES = [
  {
    href: "/playground",
    icon: GitCompare,
    color: "text-blue-500",
    border: "border-blue-500/30 hover:border-blue-500/60",
    badge: "Módulo 1",
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    title: "Semântica Explícita",
    subtitle: "Naive vs Semântico — lado a lado",
    description:
      "Compare dois agentes respondendo à mesma pergunta: um com RAG vetorial ingênuo, outro orientado por ontologia, axiomas e métricas determinísticas. Eval automático com RAGAS em tempo real.",
    lessons: "Lições 1–8",
    scenarios: "Cenários S01–S12",
  },
  {
    href: "/governance",
    icon: ShieldCheck,
    color: "text-emerald-500",
    border: "border-emerald-500/30 hover:border-emerald-500/60",
    badge: "Módulo 2",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    title: "Governança em Runtime",
    subtitle: "Calcular → Julgar → Parar",
    description:
      "Pipeline governado com LLM-as-judge ancorado em ontologia, killswitch com 3 gatilhos independentes e trail auditável com hash SHA-256 reprodutível. Para ambiente regulado.",
    lessons: "Lições 9–12",
    scenarios: "Cenários S13–S15",
  },
];

export default function PlaygroundsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Playgrounds</h1>
        <p className="text-sm text-muted-foreground">
          Dois módulos, dois playgrounds. Cada um demonstra um conjunto de
          competências do agente em ambiente bancário regulado.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href}>
              <Card className={`h-full transition-all ${m.border} hover:shadow-md`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.badgeColor}`}
                    >
                      {m.badge}
                    </span>
                    <Icon className={`h-5 w-5 ${m.color}`} />
                  </div>
                  <CardTitle className="mt-2 text-xl">{m.title}</CardTitle>
                  <CardDescription className="font-medium">{m.subtitle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {m.description}
                  </p>
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{m.lessons}</div>
                      <div>{m.scenarios}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
