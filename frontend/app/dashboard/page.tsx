"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NetworkGraph } from "@/components/network-graph"
import { FilterPanel, type FilterState } from "@/components/filter-panel"
import { NodePreviewCard } from "@/components/node-preview-card"
import { connections, edges, filterConnections, type Connection } from "@/lib/data"
import { Mic } from "lucide-react"

const defaultFilters: FilterState = {
  dateMode: "months",
  dateRange: 0,
  location: null,
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)

  const filteredConnections = useMemo(() => {
    const dateRange = filters.dateRange > 0
      ? filters.dateMode === "weeks"
        ? { weeks: filters.dateRange }
        : { months: filters.dateRange }
      : undefined

    return filterConnections(dateRange, filters.location || undefined)
  }, [filters])

  const filterMode = filters.location
    ? "location"
    : filters.dateRange > 0
    ? "date"
    : null

  const handleClearFilters = () => {
    setFilters(defaultFilters)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header - Notion style */}
      <header className="h-[45px] flex items-center justify-between border-b border-border px-4 pl-[52px] md:pl-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">Your Network</h1>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {filteredConnections.length} connection{filteredConnections.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Link href="/agent">
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2 text-sm hover:bg-[#3F4448]">
            <Mic className="h-3.5 w-3.5" />
            Ask Agent
          </Button>
        </Link>
      </header>

      {/* Main Graph Area */}
      <main className="flex-1 relative overflow-hidden bg-background">
        {/* Graph Container - Notion style subtle border */}
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
          />

          {/* Preview Card */}
          {selectedConnection && (
            <NodePreviewCard
              connection={selectedConnection}
              onClose={() => setSelectedConnection(null)}
            />
          )}
        </div>
      </main>
    </div>
  )
}
