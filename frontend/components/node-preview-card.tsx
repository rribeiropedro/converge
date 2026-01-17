"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { X, MapPin, Briefcase } from "lucide-react"
import { type Connection } from "@/lib/data"

interface NodePreviewCardProps {
  connection: Connection
  onClose: () => void
}

export function NodePreviewCard({ connection, onClose }: NodePreviewCardProps) {
  return (
    <div className="absolute right-3 top-3 w-72 rounded border border-border bg-card shadow-lg z-50 overflow-hidden">
      {/* Header - Notion style */}
      <div className="flex items-start justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="relative h-10 w-10 rounded overflow-hidden border border-border flex-shrink-0">
            <Image
              src={connection.avatarUrl || "/placeholder.svg"}
              alt={connection.name}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium">{connection.name}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {connection.location}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs">
          <Briefcase className="h-3 w-3 text-muted-foreground" />
          <span>{connection.industry}</span>
        </div>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          {connection.summaryPlaceholder}
        </p>

        {/* Tags - Notion style */}
        <div className="flex flex-wrap gap-1">
          {connection.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center rounded bg-[var(--notion-blue-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--notion-blue)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <Link href={`/profile/${connection.id}`}>
          <Button size="sm" className="w-full h-7 text-xs">Open profile</Button>
        </Link>
      </div>
    </div>
  )
}
