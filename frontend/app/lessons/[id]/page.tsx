import Link from "next/link";
import { notFound } from "next/navigation";
import { LESSONS } from "../lessons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Beaker } from "lucide-react";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: String(l.id) }));
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const lesson = LESSONS.find((l) => String(l.id) === params.id);
  if (!lesson) notFound();

  const prev = LESSONS.find((l) => l.id === lesson.id - 1);
  const next = LESSONS.find((l) => l.id === lesson.id + 1);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
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
            <CardDescription>Pergunta sugerida — abre no playground.</CardDescription>
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
              <Link
                href={`/playground?q=${encodeURIComponent(lesson.exercise.question)}${
                  lesson.exercise.scenario_id ? `&s=${lesson.exercise.scenario_id}` : ""
                }`}
              >
                Abrir no Playground <ArrowRight className="ml-2 h-4 w-4" />
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
            <Link href="/playground">Ir para o Playground <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        )}
      </div>
    </article>
  );
}
