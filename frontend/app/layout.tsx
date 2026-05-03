import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Semantic Agents Demo — naive vs ontology-aware",
  description:
    "Demonstração open-source de como agentes Azure OpenAI ficam mais precisos quando o domínio tem ontologia explícita, axiomas e métricas determinísticas via MCP.",
};

const NAV = [
  { href: "/", label: "Início" },
  { href: "/lessons/1", label: "Curso" },
  { href: "/playground", label: "Playground" },
  { href: "/architecture", label: "Arquitetura" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
            <div className="container flex h-14 items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Semantic Agents Demo
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {n.label}
                  </Link>
                ))}
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main className="container py-6">{children}</main>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            Open source · MCP-first · Azure OpenAI · Neo4j · Postgres · Qdrant
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
