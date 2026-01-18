"use client"

import { cn } from "@/lib/utils"

export type GroupType = "none" | "date" | "role"

interface LegendItem {
  label: string
  color: string
  key: string
}

interface GraphLegendProps {
  groupBy: GroupType
  onGroupClick?: (groupKey: string) => void
  activeGroup?: string | null
}

const DATE_GROUPS: LegendItem[] = [
  { key: "thisWeek", label: "This Week", color: "#3B82F6" },
  { key: "thisMonth", label: "This Month", color: "#22C55E" },
  { key: "last3Months", label: "Last 3 Months", color: "#EAB308" },
  { key: "earlier", label: "Earlier", color: "#6B7280" },
]

const ROLE_GROUPS: LegendItem[] = [
  { key: "engineer", label: "Engineer", color: "#3B82F6" },
  { key: "designer", label: "Designer", color: "#A855F7" },
  { key: "product", label: "Product", color: "#22C55E" },
  { key: "sales", label: "Sales", color: "#F97316" },
  { key: "founder", label: "Founder", color: "#EF4444" },
  { key: "other", label: "Other", color: "#6B7280" },
]

export function GraphLegend({ groupBy, onGroupClick, activeGroup }: GraphLegendProps) {
  if (groupBy === "none") return null

  const items = groupBy === "date" ? DATE_GROUPS : ROLE_GROUPS

  return (
    <div className="absolute bottom-4 right-4 z-40">
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            {groupBy === "date" ? "Date Groups" : "Role Groups"}
          </h4>
        </div>

        <div className="space-y-1.5">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onGroupClick?.(item.key)}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-colors",
                "hover:bg-accent/50",
                activeGroup === item.key && "bg-accent"
              )}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/20"
                style={{ backgroundColor: item.color }}
              />
              <span className={cn(
                "text-left",
                activeGroup === item.key ? "font-medium text-foreground" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function getGroupColor(groupBy: GroupType, value: string): string {
  if (groupBy === "none") return "#6B7280"

  const items = groupBy === "date" ? DATE_GROUPS : ROLE_GROUPS
  const item = items.find(i => i.key === value)
  return item?.color || "#6B7280"
}

export function getDateGroup(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = now.getTime() - date.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)

  if (diffDays <= 7) return "thisWeek"
  if (diffDays <= 30) return "thisMonth"
  if (diffDays <= 90) return "last3Months"
  return "earlier"
}

export function getRoleGroup(industry: string): string {
  const industryLower = industry.toLowerCase()

  if (industryLower.includes("cloud") || industryLower.includes("engineer")) return "engineer"
  if (industryLower.includes("design") || industryLower.includes("ux")) return "designer"
  if (industryLower.includes("product")) return "product"
  if (industryLower.includes("sales") || industryLower.includes("marketing")) return "sales"
  if (industryLower.includes("founder") || industryLower.includes("ceo")) return "founder"

  return "other"
}
