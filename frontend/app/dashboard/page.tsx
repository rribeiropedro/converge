"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { NetworkGraph } from "@/components/network-graph"
import { FilterPanel, type FilterState } from "@/components/filter-panel"
import { NodePreviewCard } from "@/components/node-preview-card"
import { edges, type Connection } from "@/lib/data"
import { getConnections, getDraftConnections, ApiError } from "@/lib/api"
import { transformConnections } from "@/lib/transformers"
import type { FrontendConnection } from "@/lib/types"
import { Mic, Users, AlertCircle, ClipboardCheck } from "lucide-react"

const defaultFilters: FilterState = {
  dateMode: "months",
  dateRange: 0,
  location: null,
  groupBy: "none",
}

// Map FrontendConnection to the simpler Connection type for NetworkGraph
function toGraphConnection(fc: FrontendConnection): Connection {
  return {
    id: fc.id,
    name: fc.name,
    avatarUrl: fc.avatarUrl || "",
    location: fc.city || fc.location,
    industry: fc.industry || "",
    metDate: fc.metDate,
    summaryPlaceholder: fc.transcriptSummary || `Met at ${fc.eventName}`,
    tags: fc.tags,
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [apiConnections, setApiConnections] = useState<FrontendConnection[]>([])
  const [totalApproved, setTotalApproved] = useState(0)
  const [draftCount, setDraftCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch connections from API
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch approved connections (with higher limit) and draft count in parallel
        const [connectionsRes, draftsRes] = await Promise.all([
          getConnections({ status: "approved", limit: 200 }),
          getDraftConnections(),
        ])

        const transformed = transformConnections(connectionsRes.connections)
        setApiConnections(transformed)
        setTotalApproved(connectionsRes.total) // Use API total for consistency
        setDraftCount(draftsRes.total)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError("Failed to load connections")
        }
        console.error("Error fetching connections:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Convert to graph format and apply filters
  const filteredConnections = useMemo(() => {
    let result = apiConnections

    // Apply date filter
    if (filters.dateRange > 0) {
      const now = new Date()
      let cutoffDate: Date

      if (filters.dateMode === "weeks") {
        cutoffDate = new Date(now.getTime() - filters.dateRange * 7 * 24 * 60 * 60 * 1000)
      } else {
        cutoffDate = new Date(now.setMonth(now.getMonth() - filters.dateRange))
      }

      result = result.filter(c => new Date(c.metDate) >= cutoffDate)
    }

    // Apply location filter
    if (filters.location) {
      result = result.filter(c => c.city === filters.location || c.location === filters.location)
    }

    // Convert to graph-compatible format
    return result.map(toGraphConnection)
  }, [apiConnections, filters])

  const filterMode = filters.location
    ? "location"
    : filters.dateRange > 0
    ? "date"
    : null

  const handleClearFilters = () => {
    setFilters(defaultFilters)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-[45px] flex items-center border-b border-border px-4">
          <h1 className="text-sm font-medium">Your Network</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner className="h-8 w-8 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading your network...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-[45px] flex items-center border-b border-border px-4">
          <h1 className="text-sm font-medium">Your Network</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
            <h2 className="text-lg font-medium mb-2">Failed to load network</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Draft Notification Banner */}
      {draftCount > 0 && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <ClipboardCheck className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-500">
              {draftCount} new connection{draftCount !== 1 ? "s" : ""} awaiting review
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => router.push("/connections?status=draft")}
          >
            Review Now
          </Button>
        </div>
      )}

      {/* Header - Notion style */}
      <header className="h-[45px] flex items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">Your Network</h1>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {filters.dateRange > 0 || filters.location
              ? `${filteredConnections.length} of ${totalApproved}`
              : `${totalApproved} connection${totalApproved !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/connections">
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2 text-sm hover:bg-[#3F4448]">
              <Users className="h-3.5 w-3.5" />
              All Connections
            </Button>
          </Link>
          <Link href="/agent">
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2 text-sm hover:bg-[#3F4448]">
              <Mic className="h-3.5 w-3.5" />
              Ask Agent
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Graph Area */}
      <main className="flex-1 relative overflow-hidden bg-background">
        {/* Empty State */}
        {filteredConnections.length === 0 && !filters.location && filters.dateRange === 0 ? (
          <div className="absolute inset-3 rounded border border-border bg-card flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-2">No connections yet</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Start networking to build your professional graph. Record conversations at events to automatically capture connections.
              </p>
              {draftCount > 0 && (
                <Button onClick={() => router.push("/connections?status=draft")}>
                  Review {draftCount} Draft{draftCount !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Graph Container - Notion style subtle border */
          <div className="absolute inset-3 rounded border border-border bg-card overflow-hidden">
            {/* Filter Button - Top Left */}
            <div className="absolute top-3 left-3 z-40">
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                onClear={handleClearFilters}
              />
            </div>

            {/* Network Graph */}
            <NetworkGraph
              connections={filteredConnections}
              edges={edges}
              onNodeClick={setSelectedConnection}
              filterMode={filterMode}
              groupBy={filters.groupBy}
            />

            {/* Preview Card */}
            {selectedConnection && (
              <NodePreviewCard
                connection={selectedConnection}
                onClose={() => setSelectedConnection(null)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
