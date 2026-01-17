"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { locations } from "@/lib/data"

export interface FilterState {
  dateMode: "weeks" | "months"
  dateRange: number
  location: string | null
}

interface FilterPanelProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClear: () => void
}

export function FilterPanel({ filters, onFiltersChange, onClear }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasActiveFilters = filters.location || filters.dateRange > 0

  const weekOptions = [
    { value: 1, label: "Last 1 week" },
    { value: 2, label: "Last 2 weeks" },
    { value: 4, label: "Last 4 weeks" },
  ]

  const monthOptions = [
    { value: 1, label: "Last 1 month" },
    { value: 3, label: "Last 3 months" },
    { value: 6, label: "Last 6 months" },
    { value: 12, label: "Last 12 months" },
  ]

  return (
    <div className="relative">
      {/* Filter Button - Notion style */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "gap-1.5 h-7 px-2.5 text-xs bg-card border-border hover:bg-[#3F4448]",
          hasActiveFilters && "border-primary text-primary"
        )}
      >
        <Filter className="h-3 w-3" />
        Filter
        {hasActiveFilters && (
          <span className="flex h-4 w-4 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground ml-0.5">
            {(filters.location ? 1 : 0) + (filters.dateRange > 0 ? 1 : 0)}
          </span>
        )}
      </Button>

      {/* Filter Panel - Notion style */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-64 rounded border border-border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <h3 className="text-xs font-medium">Filters</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-3 space-y-4">
            {/* Date Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date met</Label>
              
              {/* Mode Toggle - Notion style */}
              <div className="flex rounded bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, dateMode: "weeks", dateRange: 0 })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                    filters.dateMode === "weeks"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Weeks
                </button>
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, dateMode: "months", dateRange: 0 })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                    filters.dateMode === "months"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Months
                </button>
              </div>

              {/* Range Select */}
              <Select
                value={filters.dateRange.toString()}
                onValueChange={(value) => onFiltersChange({ ...filters, dateRange: parseInt(value) })}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All time</SelectItem>
                  {(filters.dateMode === "weeks" ? weekOptions : monthOptions).map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Select
                value={filters.location || "all"}
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  location: value === "all" ? null : value 
                })}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:bg-[#3F4448]"
                onClick={() => {
                  onClear()
                  setIsOpen(false)
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
