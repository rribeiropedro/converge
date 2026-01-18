'use client'

import * as React from 'react'
import { MapPin, Calendar, Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { FrontendConnection } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface ConnectionCardProps {
  connection: FrontendConnection
  onClick?: () => void
}

function ConnectionCard({ connection, onClick }: ConnectionCardProps) {
  const initials = connection.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const formattedDate = new Date(connection.metDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Get confidence badge color
  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return 'bg-[#354C4B] text-[#4DAB9A]' // Notion green
      case 'medium':
        return 'bg-[#59563B] text-[#FFDC49]' // Notion yellow
      case 'low':
        return 'bg-[#594141] text-[#FF7369]' // Notion red
    }
  }

  return (
    <Card
      className={cn(
        'w-full max-w-[280px] p-4 gap-3 cursor-pointer transition-all duration-75 hover:bg-[#3F4448] hover:shadow-md',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      {/* Header: Avatar + Name + Confidence */}
      <div className="flex items-start gap-3">
        <Avatar className="size-12 shrink-0">
          {connection.avatarUrl && (
            <AvatarImage src={connection.avatarUrl} alt={connection.name} />
          )}
          <AvatarFallback className="bg-muted text-foreground text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {connection.name}
            </h3>
            {connection.nameConfidence !== 'high' && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-4 border-0',
                  getConfidenceColor(connection.nameConfidence),
                )}
              >
                {connection.nameConfidence}
              </Badge>
            )}
          </div>

          {/* Company + Role */}
          <div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">
              {connection.company}
              {connection.role && ` • ${connection.role}`}
            </span>
          </div>
        </div>
      </div>

      {/* Location */}
      {connection.location && (
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">
            {connection.city || connection.location}
          </span>
        </div>
      )}

      {/* Event + Date */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Calendar className="size-3 shrink-0" />
        <span className="truncate">
          {connection.eventName} • {formattedDate}
        </span>
      </div>

      {/* Tags */}
      {connection.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {connection.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-5 bg-[#454B4E] text-secondary-foreground border-0"
            >
              {tag}
            </Badge>
          ))}
          {connection.tags.length > 3 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-5 bg-[#454B4E] text-muted-foreground border-0"
            >
              +{connection.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Status Indicators */}
      <div className="flex items-center gap-2">
        {connection.status === 'draft' && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 bg-[#59563B] text-[#FFDC49] border-0"
          >
            Draft
          </Badge>
        )}
        {connection.needsReview && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 bg-[#594141] text-[#FF7369] border-0"
          >
            Needs Review
          </Badge>
        )}
      </div>
    </Card>
  )
}

export { ConnectionCard }
