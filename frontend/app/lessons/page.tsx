import Link from "next/link";
import { LESSONS } from "./lessons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, GitCompare, ShieldCheck } from "lucide-react";

const CHAPTERS = [
  {
    id: 1,
    icon: GitCompare,
    color: "text-blue-500",
    badge: "Módulo 1",
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    title: "Semântica Explícita",
    subtitle: "Por que ontologia + axiomas + métricas determinísticas mudam o resultado.",
    playgroundHref: "/playground",
    playgroundLabel: "Playground Semântico",
    lessonRange: [1, 8],
  },
  {
    id: 2,
    icon: ShieldCheck,
    color: "text-emerald-500",
    badge: "Módulo 2",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    title: "Governança em Runtime",
    subtitle: "Calcular não basta. O agente que sabe quando não entregar.",
    playgroundHref: "/governance",
    playgroundLabel: "Playground Governança",
    lessonRange: [9, 12],
  },
];

export default function LessonsIndex() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Curso</h1>
        <p className="text-sm text-muted-foreground">
          12 lições em 2 módulos. Cada lição traz um conceito e um exercício que abre
          no playground do módulo correspondente.
        </p>
      </div>

      {CHAPTERS.map((chapter) => {
        const Icon = chapter.icon;
        const lessons = LESSONS.filter(
          (l) => l.id >= chapter.lessonRange[0] && l.id <= chapter.lessonRange[1]
        );
        return (
          <section key={chapter.id} className="space-y-4">
            {/* Chapter header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${chapter.color}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${chapter.badgeColor}`}
                    >
                      {chapter.badge}
                    </span>
                    <h2 className="text-lg font-semibold">{chapter.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{chapter.subtitle}</p>
                </div>
              </div>
              <Link
                href={chapter.playgroundHref}
                className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {chapter.playgroundLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Lesson cards */}
            <div className="grid gap-3 md:grid-cols-2">
              {lessons.map((l) => (
                <Link key={l.id} href={`/lessons/${l.id}`}>
                  <Card className="h-full transition-colors hover:bg-accent">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        {l.title}
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription>{l.subtitle}</CardDescription>
                    </CardHeader>
                    {l.exercise && (
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground truncate">
                          Exercício: {l.exercise.question}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
