import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Mic, Brain, Sparkles } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Notion style: 45px height, clean */}
      <header className="h-[45px] flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
            <span className="text-xs font-semibold text-primary-foreground">N</span>
          </div>
          <span className="text-sm font-medium">Converge</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/auth">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-[#3F4448] h-7 px-2 text-sm">
              Log in
            </Button>
          </Link>
          <Link href="/auth">
            <Button size="sm" className="h-7 px-3 text-sm">Get Started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section - Notion-style centered, max-width content */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center px-4 py-20 text-center max-w-[720px] mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>AI-Powered Networking Memory</span>
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance leading-tight">
            Remember everyone you meet.
            <span className="text-primary"> Follow up effortlessly.</span>
          </h1>
          
          <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-xl text-pretty">
            Converge captures your conversations and builds a personal knowledge graph 
            of your network. Never forget a name, a connection, or a follow-up again.
          </p>
          
          <div className="mt-8 flex items-center gap-3">
            <Link href="/auth">
              <Button className="gap-2 h-9">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button variant="outline" className="gap-2 h-9 bg-transparent border-border hover:bg-[#3F4448]">
                Log in
              </Button>
            </Link>
          </div>
        </section>

        {/* How It Works - Notion-style cards */}
        <section className="px-4 py-16 border-t border-border">
          <div className="max-w-[720px] mx-auto">
            <h2 className="text-lg font-semibold mb-2">How it works</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Three simple steps to transform how you network
            </p>
            
            <div className="grid gap-3 md:grid-cols-3">
              {/* Step 1 */}
              <div className="group rounded border border-border bg-card p-4 transition-colors hover:bg-[#3F4448]">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-[var(--notion-green-bg)]">
                  <Users className="h-4 w-4 text-[var(--notion-green)]" />
                </div>
                <div className="text-[11px] font-medium text-[var(--notion-green)] uppercase tracking-wide mb-1">Step 1</div>
                <h3 className="text-sm font-medium mb-1">Meet</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have natural conversations at events, meetings, or anywhere you connect.
                </p>
              </div>

              {/* Step 2 */}
              <div className="group rounded border border-border bg-card p-4 transition-colors hover:bg-[#3F4448]">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-[var(--notion-orange-bg)]">
                  <Mic className="h-4 w-4 text-[var(--notion-orange)]" />
                </div>
                <div className="text-[11px] font-medium text-[var(--notion-orange)] uppercase tracking-wide mb-1">Step 2</div>
                <h3 className="text-sm font-medium mb-1">Capture</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our AI extracts key details automatically: names, interests, environment, and more.
                </p>
              </div>

              {/* Step 3 */}
              <div className="group rounded border border-border bg-card p-4 transition-colors hover:bg-[#3F4448]">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-[var(--notion-blue-bg)]">
                  <Brain className="h-4 w-4 text-[var(--notion-blue)]" />
                </div>
                <div className="text-[11px] font-medium text-[var(--notion-blue)] uppercase tracking-wide mb-1">Step 3</div>
                <h3 className="text-sm font-medium mb-1">Remember</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Access your network graph anytime. Get reminders to follow up.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Value Props - Notion-style bullet list */}
        <section className="px-4 py-16 border-t border-border">
          <div className="max-w-[720px] mx-auto">
            <h2 className="text-lg font-semibold mb-8">Quality over quantity</h2>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="text-sm font-medium mb-0.5">Private by design</h3>
                  <p className="text-sm text-muted-foreground">
                    Your connections are yours alone. We never share or merge profiles across users.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="text-sm font-medium mb-0.5">Context-aware AI</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask your agent anything about your network and get intelligent, contextual responses.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="text-sm font-medium mb-0.5">Visual network graph</h3>
                  <p className="text-sm text-muted-foreground">
                    See your connections as an interactive graph. Filter by time, location, or industry.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="text-sm font-medium mb-0.5">Never miss a follow-up</h3>
                  <p className="text-sm text-muted-foreground">
                    Get timely reminders based on conversation context and relationship strength.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Notion style minimal */}
      <footer className="border-t border-border px-4 py-4">
        <div className="max-w-[720px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
              <span className="text-[10px] font-semibold text-primary-foreground">N</span>
            </div>
            <span className="text-xs font-medium">Converge</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built at NexHacks 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
