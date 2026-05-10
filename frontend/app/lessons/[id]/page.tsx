import Link from "next/link";
import { notFound } from "next/navigation";
import { LESSONS } from "../lessons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Beaker, GitCompare, ShieldCheck } from "lucide-react";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: String(l.id) }));
}

function playgroundHref(lesson: (typeof LESSONS)[number]) {
  const base = lesson.id <= 8 ? "/playground" : "/governance";
  if (!lesson.exercise) return base;
  const q = encodeURIComponent(lesson.exercise.question);
  const s = lesson.exercise.scenario_id ? `&s=${lesson.exercise.scenario_id}` : "";
  return `${base}?q=${q}${s}`;
}

const MODULE_META: Record<number, { label: string; color: string; Icon: React.ElementType }> = {
  1: { label: "Módulo 1 · Semântica Explícita", color: "text-blue-500", Icon: GitCompare },
  2: { label: "Módulo 2 · Governança em Runtime", color: "text-emerald-500", Icon: ShieldCheck },
};

export default function LessonPage({ params }: { params: { id: string } }) {
  const lesson = LESSONS.find((l) => String(l.id) === params.id);
  if (!lesson) notFound();

  const prev = LESSONS.find((l) => l.id === lesson.id - 1);
  const next = LESSONS.find((l) => l.id === lesson.id + 1);

  const moduleNum = lesson.id <= 8 ? 1 : 2;
  const mod = MODULE_META[moduleNum];
  const ModIcon = mod.Icon;

  const playgroundBase = lesson.id <= 8 ? "/playground" : "/governance";
  const playgroundLabel = lesson.id <= 8 ? "Playground Semântico" : "Playground Governança";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ModIcon className={`h-4 w-4 ${mod.color}`} />
          <span className="text-xs text-muted-foreground">{mod.label}</span>
        </div>
        <Badge variant="outline">Lição {lesson.id} de {LESSONS.length}</Badge>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="text-base text-muted-foreground">{lesson.subtitle}</p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none [&>pre]:rounded-md [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_code]:break-all">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.body}</ReactMarkdown>
      </div>

      {lesson.exercise && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-primary" />
              {lesson.exercise.title}
            </CardTitle>
            <CardDescription>
              Pergunta sugerida — abre no {playgroundLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Pergunta:</span>{" "}
              <span>{lesson.exercise.question}</span>
            </div>
            <p className="text-sm">
              <span className="font-medium">O que esperar:</span>{" "}
              {lesson.exercise.expectation_pt}
            </p>
            <Button asChild>
              <Link href={playgroundHref(lesson)}>
                Abrir no {playgroundLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        {prev ? (
          <Button asChild variant="ghost">
            <Link href={`/lessons/${prev.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> {prev.title}
            </Link>
          </Button>
        ) : <div />}
        {next ? (
          <Button asChild>
            <Link href={`/lessons/${next.id}`}>
              {next.title} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href={playgroundBase}>
              Ir para o {playgroundLabel} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}
