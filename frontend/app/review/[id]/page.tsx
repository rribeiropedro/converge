"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  MapPin,
  Calendar,
  Building2,
  User,
  MessageSquare,
  Lightbulb,
  UserPlus,
  Edit2,
  Save,
} from "lucide-react"
import { getConnectionById, approveConnection, deleteConnection, ApiError } from "@/lib/api"
import {
  transformConnection,
  formatDate,
  formatFollowUpType,
  getConfidenceColor,
  getConfidenceLabel,
} from "@/lib/transformers"
import type { FrontendConnection, ConfidenceLevel } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReviewPageProps {
  params: Promise<{ id: string }>
}

export default function ReviewPage({ params }: ReviewPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [connection, setConnection] = useState<FrontendConnection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Editable fields
  const [editMode, setEditMode] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [editedCompany, setEditedCompany] = useState("")
  const [editedRole, setEditedRole] = useState("")
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  useEffect(() => {
    async function fetchConnection() {
      try {
        setIsLoading(true)
        setError(null)
        const backend = await getConnectionById(id)
        const transformed = transformConnection(backend)
        setConnection(transformed)
        // Initialize edit fields
        setEditedName(transformed.name)
        setEditedCompany(transformed.company)
        setEditedRole(transformed.role || "")
        setEditedTags(transformed.tags)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError("Failed to load connection")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchConnection()
  }, [id])

  const handleApprove = async () => {
    if (!connection) return

    try {
      setIsSaving(true)
      const updates = editMode
        ? {
            name: editedName,
            company: editedCompany,
            role: editedRole || undefined,
            tags: editedTags,
          }
        : undefined

      await approveConnection(id, updates)
      router.push("/connections")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Failed to approve connection")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = async () => {
    try {
      setIsDeleting(true)
      await deleteConnection(id)
      router.push("/connections")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Failed to delete connection")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setEditedTags(editedTags.filter(t => t !== tag))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading connection...</p>
        </div>
      </div>
    )
  }

  if (error || !connection) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
          <h2 className="text-lg font-medium mb-2">Failed to load connection</h2>
          <p className="text-sm text-muted-foreground mb-4">{error || "Connection not found"}</p>
          <Link href="/connections">
            <Button>Back to Connections</Button>
          </Link>
        </div>
      </div>
    )
  }

  const initials = connection.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/connections">
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#3F4448]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Connections
          </Button>
        </Link>

        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          Draft - Needs Review
        </Badge>
      </div>

      <div className="max-w-[720px] mx-auto space-y-4">
        {/* Profile Card */}
        <div className="rounded border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative h-20 w-20 rounded overflow-hidden border border-border flex-shrink-0 bg-muted">
              {connection.avatarUrl ? (
                <Image
                  src={connection.avatarUrl}
                  alt={connection.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xl font-medium text-muted-foreground">
                  {initials}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Company</label>
                      <Input
                        value={editedCompany}
                        onChange={(e) => setEditedCompany(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Role</label>
                      <Input
                        value={editedRole}
                        onChange={(e) => setEditedRole(e.target.value)}
                        className="h-8"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl font-semibold">{connection.name}</h1>
                    <ConfidenceBadge confidence={connection.nameConfidence} />
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                    {connection.company && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{connection.company}</span>
                        <ConfidenceBadge confidence={connection.companyConfidence} small />
                      </div>
                    )}
                    {connection.role && (
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span>{connection.role}</span>
                        {connection.roleConfidence && (
                          <ConfidenceBadge confidence={connection.roleConfidence} small />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Context */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-3">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {connection.location}, {connection.city}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Met at {connection.eventName} · {formatDate(connection.metDate)}
                </div>
              </div>

              {/* Tags */}
              <div className="mt-3">
                {editMode ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {editedTags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded bg-[var(--notion-blue-bg)] px-2 py-0.5 text-xs font-medium text-[var(--notion-blue)]"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                        placeholder="Add tag..."
                        className="h-7 text-xs flex-1"
                      />
                      <Button size="sm" variant="outline" className="h-7" onClick={handleAddTag}>
                        Add
                      </Button>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            </div>

            {/* Edit Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Fields needing review indicator */}
          {connection.fieldsNeedingReview.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-yellow-500">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Fields needing review: {connection.fieldsNeedingReview.join(", ")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Conversation Topics */}
        <div className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-green-bg)]">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--notion-green)]" />
            </div>
            <h2 className="text-sm font-medium">Conversation Topics</h2>
          </div>

          {connection.topics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {connection.topics.map((topic, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs"
                >
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No topics extracted from conversation</p>
          )}

          {connection.transcriptSummary && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Summary</p>
              <p className="text-sm">{connection.transcriptSummary}</p>
            </div>
          )}
        </div>

        {/* Challenges & Interests */}
        {connection.challenges.length > 0 && (
          <div className="rounded border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-yellow-bg)]">
                <Lightbulb className="h-3.5 w-3.5 text-[var(--notion-yellow)]" />
              </div>
              <h2 className="text-sm font-medium">Their Challenges</h2>
            </div>

            <ul className="space-y-2">
              {connection.challenges.map((challenge, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground">•</span>
                  {challenge}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow-up Hooks */}
        <div className="rounded border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--notion-purple-bg)]">
              <UserPlus className="h-3.5 w-3.5 text-[var(--notion-purple)]" />
            </div>
            <h2 className="text-sm font-medium">Follow-up Actions</h2>
          </div>

          {connection.followUpHooks.length > 0 ? (
            <div className="space-y-3">
              {connection.followUpHooks.map((hook, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Checkbox
                    checked={hook.completed}
                    disabled
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {formatFollowUpType(hook.type)}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{hook.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No follow-up actions identified</p>
          )}
        </div>

        {/* Personal Details */}
        {connection.personalDetails.length > 0 && (
          <div className="rounded border border-border bg-card p-5">
            <h2 className="text-sm font-medium mb-3">Personal Details Mentioned</h2>
            <ul className="space-y-2">
              {connection.personalDetails.map((detail, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Appearance (if visual data exists) */}
        {(connection.appearance || connection.distinctiveFeatures.length > 0) && (
          <div className="rounded border border-border bg-card p-5">
            <h2 className="text-sm font-medium mb-3">Visual Notes</h2>
            {connection.appearance && (
              <p className="text-sm text-muted-foreground mb-2">{connection.appearance}</p>
            )}
            {connection.distinctiveFeatures.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {connection.distinctiveFeatures.map((feature, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          <Button
            onClick={handleApprove}
            disabled={isSaving || isDeleting}
            className="flex-1 gap-2"
          >
            {isSaving ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve Connection
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isSaving || isDeleting}
                className="gap-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                {isDeleting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Discard
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this connection?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this draft connection. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDiscard}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

// Confidence Badge Component
function ConfidenceBadge({
  confidence,
  small = false
}: {
  confidence: ConfidenceLevel
  small?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 font-medium",
        small ? "text-[9px] py-0" : "text-[10px] py-0.5",
        getConfidenceColor(confidence)
      )}
      title={getConfidenceLabel(confidence)}
    >
      {confidence === "high" ? "✓" : confidence === "medium" ? "?" : "!"}
    </span>
  )
}
