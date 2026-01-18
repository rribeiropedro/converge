"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { getConnectionById, updateFollowUpHook, ApiError } from "@/lib/api"
import { transformConnection, formatDate, formatFollowUpType, getConfidenceColor } from "@/lib/transformers"
import type { FrontendConnection, FollowUpHook } from "@/lib/types"
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Calendar,
  MessageSquare,
  Lightbulb,
  UserPlus,
  Target,
  Eye,
  Building2,
  MapPinned,
} from "lucide-react"

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [connection, setConnection] = useState<FrontendConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingHooks, setUpdatingHooks] = useState<Set<number>>(new Set())

  // Fetch connection data on mount
  useEffect(() => {
    async function fetchConnection() {
      try {
        setLoading(true)
        setError(null)
        const backendConnection = await getConnectionById(id)
        const frontendConnection = transformConnection(backendConnection)
        setConnection(frontendConnection)
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError("Connection not found")
          } else {
            setError(err.message || "Failed to load connection")
          }
        } else {
          setError("An unexpected error occurred")
        }
        console.error("Error fetching connection:", err)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchConnection()
    }
  }, [id])

  // Handle follow-up hook checkbox toggle
  async function handleHookToggle(hookIndex: number, currentCompleted: boolean) {
    if (!connection) return

    try {
      setUpdatingHooks((prev) => new Set(prev).add(hookIndex))
      const backendConnection = await updateFollowUpHook(id, hookIndex, !currentCompleted)
      const updatedConnection = transformConnection(backendConnection)
      setConnection(updatedConnection)
    } catch (err) {
      console.error("Error updating follow-up hook:", err)
      // Could add toast notification here
    } finally {
      setUpdatingHooks((prev) => {
        const next = new Set(prev)
        next.delete(hookIndex)
        return next
      })
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !connection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">😕</div>
          <h1 className="text-xl font-semibold">
            {error || "Connection not found"}
          </h1>
          <p className="text-sm text-muted-foreground">
            The connection you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Button onClick={() => router.push("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      {/* Back Button - Notion style */}
      <Link href="/dashboard">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 mb-4 h-7 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#3F4448]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Button>
      </Link>

      <div className="max-w-[720px] mx-auto space-y-4">
        {/* Header Card - Notion style */}
        <div className="rounded border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 rounded overflow-hidden border border-border flex-shrink-0">
              {connection.avatarUrl ? (
                <Image
                  src={connection.avatarUrl}
                  alt={connection.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {connection.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-xl font-semibold">{connection.name}</h1>
                <Badge
                  variant="outline"
                  className={`text-xs ${getConfidenceColor(connection.nameConfidence)}`}
                >
                  {connection.nameConfidence}
                </Badge>
              </div>

              {connection.role && (
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">{connection.role}</p>
                  {connection.roleConfidence && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${getConfidenceColor(connection.roleConfidence)}`}
                    >
                      {connection.roleConfidence}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {connection.city}
                </div>
                {connection.industry && (
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {connection.industry}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Met {formatDate(connection.metDate)}
                </div>
              </div>

              {/* Tags - Notion style */}
              {connection.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {connection.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded bg-[var(--notion-blue-bg)] px-2 py-0.5 text-xs font-medium text-[var(--notion-blue)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Company info with confidence */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{connection.company}</span>
              <Badge
                variant="outline"
                className={`text-xs ${getConfidenceColor(connection.companyConfidence)}`}
              >
                {connection.companyConfidence}
              </Badge>
            </div>
          </div>
        </div>

        {/* Context: Where Met - Notion style */}
        <div className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-blue-bg)]">
              <MapPinned className="h-3.5 w-3.5 text-[var(--notion-blue)]" />
            </div>
            <h2 className="text-sm font-medium">Where We Met</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="text-xs font-medium text-muted-foreground w-20 pt-0.5">Event</div>
              <div className="flex-1">
                <div className="text-sm">{connection.eventName}</div>
                <div className="text-xs text-muted-foreground capitalize">{connection.eventType}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-xs font-medium text-muted-foreground w-20 pt-0.5">Location</div>
              <div className="flex-1">
                <div className="text-sm">{connection.location}</div>
                <div className="text-xs text-muted-foreground">{connection.city}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Visual/Appearance Data - Notion style */}
        {(connection.appearance || connection.distinctiveFeatures.length > 0) && (
          <div className="rounded border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-purple-bg)]">
                <Eye className="h-3.5 w-3.5 text-[var(--notion-purple)]" />
              </div>
              <h2 className="text-sm font-medium">Appearance</h2>
            </div>

            <div className="space-y-3">
              {connection.appearance && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                  <p className="text-sm text-foreground">{connection.appearance}</p>
                </div>
              )}

              {connection.distinctiveFeatures.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Distinctive Features
                  </div>
                  <ul className="space-y-1">
                    {connection.distinctiveFeatures.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conversation Insights - Notion style */}
        {(connection.topics.length > 0 ||
          connection.challenges.length > 0 ||
          connection.transcriptSummary) && (
          <div className="rounded border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-green-bg)]">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--notion-green)]" />
              </div>
              <h2 className="text-sm font-medium">Conversation Insights</h2>
            </div>

            <div className="space-y-4">
              {/* Transcript Summary */}
              {connection.transcriptSummary && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Summary</div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {connection.transcriptSummary}
                  </p>
                </div>
              )}

              {/* Topics Discussed */}
              {connection.topics.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Topics Discussed
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {connection.topics.map((topic, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Their Challenges */}
              {connection.challenges.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Their Challenges
                  </div>
                  <ul className="space-y-2">
                    {connection.challenges.map((challenge, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Follow-up Hooks - Notion style */}
        {connection.followUpHooks.length > 0 && (
          <div className="rounded border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-yellow-bg)]">
                <UserPlus className="h-3.5 w-3.5 text-[var(--notion-yellow)]" />
              </div>
              <h2 className="text-sm font-medium">Follow-up Actions</h2>
            </div>

            <div className="space-y-3">
              {connection.followUpHooks.map((hook, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={hook.completed}
                    disabled={updatingHooks.has(idx)}
                    onCheckedChange={() => handleHookToggle(idx, hook.completed)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {formatFollowUpType(hook.type)}
                      </Badge>
                      {hook.completed && hook.completed_at && (
                        <span className="text-xs text-muted-foreground">
                          Completed {formatDate(hook.completed_at)}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${
                        hook.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {hook.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills - Notion style */}
        {connection.skills.length > 0 && (
          <div className="rounded border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-orange-bg)]">
                <Lightbulb className="h-3.5 w-3.5 text-[var(--notion-orange)]" />
              </div>
              <h2 className="text-sm font-medium">Skills & Expertise</h2>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {connection.skills.map((skill, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for connections with no data */}
        {!connection.transcriptSummary &&
          connection.topics.length === 0 &&
          connection.challenges.length === 0 &&
          connection.followUpHooks.length === 0 &&
          !connection.appearance &&
          connection.distinctiveFeatures.length === 0 &&
          connection.skills.length === 0 && (
            <div className="rounded border border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground mb-1">No conversation data yet</p>
              <p className="text-xs text-muted-foreground/70">
                Start a conversation to capture insights about this connection.
              </p>
            </div>
          )}
      </div>
    </div>
  )
}
