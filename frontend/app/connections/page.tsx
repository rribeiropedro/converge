"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  LayoutGrid,
  List,
  Search,
  ArrowLeft,
  MapPin,
  Calendar,
  Building2,
  AlertCircle
} from "lucide-react"
import { getConnections, getConnectionCounts, ApiError } from "@/lib/api"
import { transformConnections, formatDate, getRelativeTime } from "@/lib/transformers"
import type { FrontendConnection, ConnectionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list"

export default function ConnectionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<FrontendConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [searchQuery, setSearchQuery] = useState("")
  // Use API counts for consistency with sidebar/dashboard
  const [statusCounts, setStatusCounts] = useState({ all: 0, draft: 0, approved: 0, archived: 0 })

  // Read status from URL query param (e.g., /connections?status=draft)
  const urlStatus = searchParams.get("status") as ConnectionStatus | null
  const [statusFilter, setStatusFilter] = useState<ConnectionStatus | "all">("all")

  // Sync statusFilter with URL when it changes (for client-side navigation)
  useEffect(() => {
    if (urlStatus && ["draft", "approved", "archived"].includes(urlStatus)) {
      setStatusFilter(urlStatus)
    } else {
      setStatusFilter("all")
    }
  }, [urlStatus])

  useEffect(() => {
    async function fetchConnections() {
      try {
        setIsLoading(true)
        setError(null)
        // Fetch connections and counts in parallel for consistency
        const [response, counts] = await Promise.all([
          getConnections({ limit: 100 }), // Fetch more to avoid pagination issues
          getConnectionCounts()
        ])
        const transformed = transformConnections(response.connections)
        setConnections(transformed)
        setStatusCounts({
          all: counts.total,
          draft: counts.draft,
          approved: counts.approved,
          archived: counts.archived
        })
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError("Failed to load connections")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchConnections()
  }, [])

  // Filter connections based on search and status
  const filteredConnections = useMemo(() => {
    let result = connections

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(c => c.status === statusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.company.toLowerCase().includes(query) ||
        c.role?.toLowerCase().includes(query) ||
        c.tags.some(t => t.toLowerCase().includes(query))
      )
    }

    return result
  }, [connections, searchQuery, statusFilter])


  const handleConnectionClick = (connection: FrontendConnection) => {
    if (connection.status === "draft") {
      router.push(`/review/${connection.id}`)
    } else {
      router.push(`/profile/${connection.id}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading connections...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
          <h2 className="text-lg font-medium mb-2">Failed to load connections</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-[45px] flex items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#3F4448]">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <h1 className="text-sm font-medium">Connections</h1>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {filteredConnections.length} of {connections.length}
          </span>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0",
              viewMode === "grid" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0",
              viewMode === "list" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          {(["all", "approved", "draft", "archived"] as const).map((status) => (
            <Button
              key={status}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs gap-1.5",
                statusFilter === status && "bg-muted"
              )}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="text-muted-foreground">
                {statusCounts[status]}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        {filteredConnections.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium mb-1">No connections found</h3>
              <p className="text-xs text-muted-foreground">
                {searchQuery ? "Try a different search term" : "Start networking to build your connections"}
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredConnections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onClick={() => handleConnectionClick(connection)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConnections.map((connection) => (
              <ConnectionListItem
                key={connection.id}
                connection={connection}
                onClick={() => handleConnectionClick(connection)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Grid Card Component
function ConnectionCard({
  connection,
  onClick
}: {
  connection: FrontendConnection
  onClick: () => void
}) {
  const initials = connection.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      onClick={onClick}
      className="rounded border border-border bg-card p-4 cursor-pointer hover:bg-[#3F4448] transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={connection.avatarUrl} alt={connection.name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{connection.name}</h3>
            {connection.status === "draft" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                Draft
              </Badge>
            )}
            {connection.needsReview && connection.status !== "draft" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-500 border-orange-500/20">
                Review
              </Badge>
            )}
          </div>

          {(connection.company || connection.role) && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {connection.role && connection.company
                ? `${connection.role} at ${connection.company}`
                : connection.company || connection.role
              }
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{connection.city || connection.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{connection.eventName} · {getRelativeTime(connection.metDate)}</span>
        </div>
      </div>

      {connection.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {connection.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center rounded bg-[var(--notion-blue-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--notion-blue)]"
            >
              {tag}
            </span>
          ))}
          {connection.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{connection.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// List Item Component
function ConnectionListItem({
  connection,
  onClick,
}: {
  connection: FrontendConnection
  onClick: () => void
}) {
  const initials = connection.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded px-3 py-2 cursor-pointer hover:bg-[#3F4448] transition-colors"
    >
      <Avatar className="h-8 w-8 border border-border">
        <AvatarImage src={connection.avatarUrl} alt={connection.name} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 flex items-center gap-4">
        <div className="min-w-[180px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{connection.name}</span>
            {connection.status === "draft" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                Draft
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[150px]">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{connection.company || "—"}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[120px]">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{connection.city || connection.location}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[140px]">
          <Calendar className="h-3 w-3" />
          <span className="truncate">{getRelativeTime(connection.metDate)}</span>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {connection.tags.slice(0, 2).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center rounded bg-[var(--notion-blue-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--notion-blue)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
