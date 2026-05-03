import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Cpu, Network, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 py-8">
        <Badge variant="outline" className="gap-1">
          <Cpu className="h-3 w-3" /> open source · MCP · Azure OpenAI
        </Badge>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          Agentes mais precisos quando o domínio é{" "}
          <span className="text-primary">explicitamente semântico</span>.
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
          Esta demo mostra <strong>lado a lado</strong> dois agentes respondendo as
          mesmas perguntas bancárias. O primeiro usa apenas RAG vetorial sobre documentos.
          O segundo opera sobre uma <strong>ontologia explícita</strong>, com{" "}
          <strong>axiomas</strong>, <strong>desambiguação de termos</strong>,{" "}
          <strong>knowledge graph</strong> e <strong>métricas determinísticas</strong>{" "}
          consultadas via <strong>MCP</strong>. Avaliamos cada resposta contra um{" "}
          <em>ground truth</em> calculado em SQL.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/playground">
              Ir para o Playground <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/lessons/1">
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

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Por que isto importa?</CardTitle>
            <CardDescription>
              LLMs sozinhos confundem termos de negócio. "Cliente ativo" no marketing,
              no compliance e na análise são três coisas diferentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sem ontologia, o agente erra silenciosamente — uma resposta confiante e
            errada. Com ontologia + axiomas, o agente precisa <em>justificar</em> cada
            número usando uma regra publicada.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>O que você vai ver</CardTitle>
            <CardDescription>
              Dois agentes em paralelo, com workstrip clicável e métricas em tempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cada nó do workstrip mostra a tool MCP chamada, argumentos, latência e
            payload. A diferença entre os agentes fica explícita evento a evento.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Como rodar</CardTitle>
            <CardDescription>
              Tudo em containers — frontend, gateway, MCP servers, Neo4j, Postgres,
              Qdrant — com healthchecks e rede segregada.
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
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Princípios da demo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <P k="Ontologia explícita">
              Classes, relações e atributos publicados em JSON. Não é metadata
              implícita do prompt — é contrato.
            </P>
            <P k="Axiomas como guarda-chuva">
              Inadimplência ⇔ DPD ≥ 90, Cliente Ativo ⇔ produto vivo. O agente
              aplica regras, não inventa.
            </P>
            <P k="Métricas determinísticas">
              Cada axioma tem uma query canônica. O LLM não calcula — ele lê.
            </P>
            <P k="MCP como contrato">
              Toda interação agente↔backend e agente↔agente passa pelo Model
              Context Protocol. Tools versionadas e tipadas.
            </P>
            <P k="Agent-as-tool">
              Agentes consomem outros agentes via MCP. Composição, não acoplamento.
            </P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>O domínio: crédito bancário</CardTitle>
            <CardDescription>
              Banking foi escolhido por ser denso em ambiguidade real e regulação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <P k="Cliente">Pessoa Física, PJ, segmentos, rating de risco.</P>
            <P k="Operação de crédito">PERSONAL_LOAN, MORTGAGE, OVERDRAFT, etc.</P>
            <P k="Inadimplência">DPD ≥ 90 — referência Bacen / Basel III.</P>
            <P k="Exposição (EAD)">Soma do principal em aberto, contratos vivos.</P>
            <P k="Garantia & LTV">Imóvel, veículo, fiança — relação no grafo.</P>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function P({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-primary/40 pl-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {k}
      </div>
      <div>{children}</div>
    </div>
  );
}
