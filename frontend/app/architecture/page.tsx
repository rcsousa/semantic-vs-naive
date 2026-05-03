import { ArchitectureDiagram } from "@/components/demo/architecture-diagram";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ArchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arquitetura</h1>
        <p className="text-sm text-muted-foreground">
          Tudo é container. Backends de dados ficam em rede interna (não acessíveis pela
          web). O gateway só fala com MCP servers via JSON-RPC.
        </p>
      </div>

      <ArchitectureDiagram />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Redes Docker</CardTitle>
            <CardDescription>Segregação por responsabilidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="edge" desc="frontend ↔ gateway. Única rede com bind para o host." />
            <Row k="agents" desc="gateway ↔ MCP servers. Internal: nenhum acesso externo." />
            <Row k="data" desc="MCP servers ↔ backends. Internal." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Princípios de engenharia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Single responsibility" desc="cada container tem um único papel." />
            <Row k="Healthchecks" desc="todos os serviços; depends_on espera saúde." />
            <Row k="Read-only mounts" desc="dados/ontology/seed montados read-only." />
            <Row k="Immutable images" desc="versões fixadas (Neo4j 5.20, Qdrant 1.9.2…)." />
            <Row k="Defaults sãos" desc="modo MOCK quando Azure OpenAI ausente." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCP como contrato único</CardTitle>
          <CardDescription>
            Todo agente fala com qualquer ferramenta — incluindo outros agentes — pelo
            mesmo protocolo (JSON-RPC sobre HTTP). Isto torna a topologia trocável.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-3 text-xs leading-relaxed">{`POST /mcp
{
  "jsonrpc":"2.0","id":1,"method":"tools/call",
  "params":{"name":"compute","arguments":{"id":"AX-DEFAULT-90"}}
}`}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>kg.cypher_readonly</Badge>
            <Badge>ontology.get_axiom</Badge>
            <Badge>metrics.compute</Badge>
            <Badge>disambig.resolve_term</Badge>
            <Badge>eval.score</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, desc }: { k: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/40 pb-2 last:border-0">
      <Badge variant="outline" className="font-mono">
        {k}
      </Badge>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}
