import { GovernanceDemo } from "@/components/demo/governance-demo";

export default function GovernancePage({
  searchParams,
}: {
  searchParams: { q?: string; s?: string };
}) {
  const q = (searchParams?.q || "").toString();
  const s = (searchParams?.s || "").toString() || undefined;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Governança em Runtime</h1>
        <p className="text-sm text-muted-foreground">
          Em ambiente regulado, o agente precisa de três coisas: <strong>calcular</strong>,{" "}
          <strong>julgar</strong> e <strong>parar</strong>. A auditabilidade é o que sobra quando
          as três funcionam juntas.
        </p>
      </div>
      <GovernanceDemo initialQuestion={q} initialScenarioId={s} />
    </div>
  );
}
