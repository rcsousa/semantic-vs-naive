import Link from "next/link";
import { LESSONS } from "./lessons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default function LessonsIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Curso — 8 lições</h1>
        <p className="text-sm text-muted-foreground">
          Cada lição traz um conceito + um exercício prático que abre direto no playground.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {LESSONS.map((l) => (
          <Link key={l.id} href={`/lessons/${l.id}`}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {l.title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{l.subtitle}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
