import { SideBySide } from "@/components/demo/side-by-side";

export default function PlaygroundPage({
  searchParams,
}: {
  searchParams: { q?: string; s?: string };
}) {
  const q = (searchParams?.q || "").toString();
  const s = (searchParams?.s || "").toString() || undefined;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um cenário com eval automático, ou escreva sua própria pergunta.
        </p>
      </div>
      <SideBySide initialQuestion={q} initialScenarioId={s} />
    </div>
  );
}
