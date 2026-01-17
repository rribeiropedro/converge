import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getConnectionById } from "@/lib/data"
import { ArrowLeft, MapPin, Briefcase, Calendar, MessageSquare, Lightbulb, UserPlus } from "lucide-react"

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  const connection = getConnectionById(id)

  if (!connection) {
    notFound()
  }

  const formattedDate = new Date(connection.metDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="min-h-screen p-4">
      {/* Back Button - Notion style */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-1.5 mb-4 h-7 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#3F4448]">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Button>
      </Link>

      <div className="max-w-[720px] mx-auto space-y-4">
        {/* Header Card - Notion style */}
        <div className="rounded border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 rounded overflow-hidden border border-border flex-shrink-0">
              <Image
                src={connection.avatarUrl || "/placeholder.svg"}
                alt={connection.name}
                fill
                className="object-cover"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold mb-2">{connection.name}</h1>
              
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {connection.location}
                </div>
                <div className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {connection.industry}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Met {formattedDate}
                </div>
              </div>

              {/* Tags - Notion style */}
              <div className="flex flex-wrap gap-1.5">
                {connection.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded bg-[var(--notion-blue-bg)] px-2 py-0.5 text-xs font-medium text-[var(--notion-blue)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
            Generated from your conversations
          </p>
        </div>

        {/* Conversation Insights - Notion style */}
        <div className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-green-bg)]">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--notion-green)]" />
            </div>
            <h2 className="text-sm font-medium">Conversation Insights</h2>
          </div>

          <div className="rounded border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Coming soon</p>
            <p className="text-xs text-muted-foreground/70">
              Summaries, shared interests, and follow-up hooks will appear here.
            </p>
          </div>

          {/* Skeleton - Notion style */}
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <div className="h-3 w-3 rounded bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-3 w-3 rounded bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Shared Interests - Notion style */}
        <div className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-yellow-bg)]">
              <Lightbulb className="h-3.5 w-3.5 text-[var(--notion-yellow)]" />
            </div>
            <h2 className="text-sm font-medium">Shared Interests</h2>
          </div>

          <div className="rounded border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Coming soon</p>
            <p className="text-xs text-muted-foreground/70">
              Topics and interests you both discussed will appear here.
            </p>
          </div>
        </div>

        {/* Follow-up Suggestions - Notion style */}
        <div className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-purple-bg)]">
              <UserPlus className="h-3.5 w-3.5 text-[var(--notion-purple)]" />
            </div>
            <h2 className="text-sm font-medium">Follow-up Suggestions</h2>
          </div>

          <div className="rounded border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Coming soon</p>
            <p className="text-xs text-muted-foreground/70">
              AI-powered suggestions for how and when to follow up.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
