import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Cpu, GitCompare, Network, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="space-y-4 py-8">
        <Badge variant="outline" className="gap-1">
          <Cpu className="h-3 w-3" /> open source · MCP · Azure OpenAI
        </Badge>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          Agentes que <span className="text-primary">calculam</span>,{" "}
          <span className="text-primary">julgam</span> e{" "}
          <span className="text-primary">param</span> na hora certa.
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
          Dois módulos sobre como construir agentes LLM confiáveis em domínios regulados.
          O primeiro compara agentes com e sem ontologia explícita. O segundo demonstra
          governança em runtime — judge, killswitch e trail auditável.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/playgrounds">
              Ver os Playgrounds <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/lessons">
              <BookOpen className="mr-2 h-4 w-4" /> Começar o curso
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/architecture">
              <Network className="mr-2 h-4 w-4" /> Ver a arquitetura
            </Link>
          </Button>
        </div>
      </section>

      {/* Dois módulos */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-blue-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-blue-500" />
              <Badge variant="outline" className="text-blue-600 border-blue-400">Módulo 1</Badge>
            </div>
            <CardTitle className="mt-1">Semântica Explícita</CardTitle>
            <CardDescription>Naive vs Semântico — lado a lado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Dois agentes respondendo as mesmas perguntas bancárias. O primeiro usa
              RAG vetorial ingênuo. O segundo opera sobre{" "}
              <strong className="text-foreground">ontologia explícita</strong>, com axiomas,
              desambiguação de termos, knowledge graph e métricas determinísticas via MCP.
              Eval automático com RAGAS em tempo real.
            </p>
            <div className="space-y-1 text-xs">
              <P k="8 lições">Ontologia, desambiguação, axiomas, KG, RAGAS.</P>
              <P k="12 cenários">S01–S12, domínio de crédito bancário.</P>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/playground">
                Abrir Playground <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <Badge variant="outline" className="text-emerald-600 border-emerald-400">Módulo 2</Badge>
            </div>
            <CardTitle className="mt-1">Governança em Runtime</CardTitle>
            <CardDescription>Calcular → Julgar → Parar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Em ambiente regulado, calcular corretamente não basta. O agente precisa de
              um <strong className="text-foreground">judge ancorado em ontologia</strong>,
              um <strong className="text-foreground">killswitch</strong> com 3 gatilhos
              independentes e um <strong className="text-foreground">trail auditável</strong>{" "}
              com hash SHA-256 reprodutível. A auditabilidade é o subproduto.
            </p>
            <div className="space-y-1 text-xs">
              <P k="4 lições">Judge, killswitch, variância, trail.</P>
              <P k="3 cenários">S13 caminho feliz · S14 recap · S15 jewel.</P>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/governance">
                Abrir Playground <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Detalhes */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Como rodar</CardTitle>
            <CardDescription>
              Tudo em Docker Compose com healthchecks e rede segregada.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <pre className="rounded-md bg-muted p-3 text-xs">
              {`cp .env.example .env
docker compose up -d --build
docker compose run --rm seeder
open http://localhost:3000`}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stack técnica</CardTitle>
            <CardDescription>
              Frontend Next.js 14 · Gateway FastAPI · MCP servers · Azure OpenAI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <P k="Dados">Postgres 16 · Neo4j 5.20 · Qdrant 1.9</P>
            <P k="Semântica">Ontologia JSON · Axiomas · Desambiguação</P>
            <P k="Governança">mcp-judge · Killswitch · AuditTrail SHA-256</P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Domínio: crédito bancário</CardTitle>
            <CardDescription>
              Denso em ambiguidades reais e regulação Bacen / Basel III.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <P k="Inadimplência">DPD ≥ 90 — referência regulatória.</P>
            <P k="Exposição (EAD)">Principal em aberto, contratos vivos.</P>
            <P k="LTV">Imóvel, veículo — relação no grafo.</P>
            <P k="Spread">Taxa − CDI, dispersão por carteira.</P>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function P({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-primary/40 pl-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
      <div>{children}</div>
    </div>
  );
}
