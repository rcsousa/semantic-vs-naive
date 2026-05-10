import { ArchitectureDiagram } from "@/components/demo/architecture-diagram";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompare, ShieldCheck } from "lucide-react";

export default function ArchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arquitetura</h1>
        <p className="text-sm text-muted-foreground">
          Tudo é container. Backends de dados ficam em rede interna. O gateway fala com MCP
          servers via JSON-RPC. O browser nunca acessa o gateway diretamente — usa o proxy
          Next.js <code className="text-xs bg-muted px-1 rounded">/api/gw/*</code>.
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
            <Row k="Proxy server-side" desc="browser → /api/gw/* → gateway interno. Sem CORS." />
          </CardContent>
        </Card>
      </div>

      {/* Módulo 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-blue-500" />
            Módulo 1 — MCP como contrato único
          </CardTitle>
          <CardDescription>
            Todo agente fala com qualquer ferramenta pelo mesmo protocolo JSON-RPC.
            O mcp-gateway agrega e prefixa as tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-3 text-xs leading-relaxed">{`POST /mcp
{
  "jsonrpc":"2.0","id":1,"method":"tools/call",
  "params":{"name":"metrics__compute","arguments":{"id":"AX-DEFAULT-90"}}
}`}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>kg__cypher_readonly</Badge>
            <Badge>ontology__get_axiom</Badge>
            <Badge>metrics__compute</Badge>
            <Badge>disambig__resolve_term</Badge>
            <Badge>rag__search</Badge>
            <Badge>eval__score</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Módulo 2 */}
      <Card className="border-emerald-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Módulo 2 — Pipeline de Governança em Runtime
          </CardTitle>
          <CardDescription>
            Calcular → Julgar → Parar. Auditabilidade como subproduto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-md border p-3 space-y-1">
              <p className="font-medium text-xs uppercase text-muted-foreground">mcp-judge</p>
              <p className="text-muted-foreground text-xs">
                Tool <code className="bg-muted px-1 rounded">judge__evaluate</code>. Verifica se a
                resposta é <em>consistent</em>, <em>inconsistent</em> ou{" "}
                <em>insufficient_evidence</em> com o axioma aplicado. LLM ancorado em ontologia,
                não vibe-check.
              </p>
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <p className="font-medium text-xs uppercase text-muted-foreground">Killswitch</p>
              <p className="text-muted-foreground text-xs">
                Lógica pura no gateway. 3 gatilhos em OR: RAGAS &lt; 0.70 · judge ≠ consistent ·
                variância das instâncias &gt; 25 p.p. Qualquer gatilho escala para revisão humana.
              </p>
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <p className="font-medium text-xs uppercase text-muted-foreground">AuditTrail</p>
              <p className="text-muted-foreground text-xs">
                Hash SHA-256 da forma canônica do trail, excluindo timestamps e durations. Dois
                runs determinísticos = mesmo hash. Drift no hash = drift real.
              </p>
            </div>
          </div>
          <pre className="rounded-md bg-muted p-3 text-xs leading-relaxed">{`POST /api/govern  →  SSE stream
  calculate  (run_semantic)
  judge      (judge__evaluate via mcp-gateway)
  killswitch (lógica pura — RAGAS + verdict + variância)
  respond    → final_governed  { text, hash }
    ou
  escalate   → escalated       { triggers, hash }`}</pre>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300">
              judge__evaluate
            </Badge>
            <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300">
              Metric:SpreadVolatil
            </Badge>
            <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300">
              03_seed_kv.sql
            </Badge>
            <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300">
              S13 · S14 · S15
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, desc }: { k: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/40 pb-2 last:border-0">
      <Badge variant="outline" className="font-mono shrink-0">
        {k}
      </Badge>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}
