"use client"

import Image from "next/image"
import Link from "next/link"
import { MapPin, Briefcase, Calendar, Building2, User, Linkedin } from "lucide-react"
import { cn } from "@/lib/utils"

// MongoDB Connection schema interface (user-facing fields only)
export interface MongoDBConnection {
  _id: string
  name: {
    value: string
  }
  company?: {
    value: string
  }
  role?: {
    value: string
  }
  industry?: string
  tags?: string[]
  context: {
    location: {
      name: string
      city: string
    }
    event: {
      name: string
      type: string
    }
    first_met: string
  }
  visual?: {
    headshot?: {
      url?: string
      base64?: string
    }
  }
  audio?: {
    transcript_summary?: string
    topics_discussed?: string[]
    their_challenges?: string[]
    follow_up_hooks?: Array<{
      type: string
      detail: string
      completed: boolean
    }>
    personal_details?: string[]
  }
  enrichment?: {
    linkedin?: {
      url?: string
    }
    experience?: Array<{
      title?: string
      company?: string
      start_date?: string
      end_date?: string
      description?: string
    }>
    education?: Array<{
      degree?: string
      institution?: string
      start_date?: string
      end_date?: string
    }>
    skills?: string[]
  }
  interaction_count?: number
  last_interaction?: string
}

interface ConnectionProfileCardProps {
  connection: MongoDBConnection
  className?: string
}

export function ConnectionProfileCard({ connection, className }: ConnectionProfileCardProps) {
  const avatarUrl = connection.visual?.headshot?.url 
    || (connection.visual?.headshot?.base64 ? `data:image/jpeg;base64,${connection.visual.headshot.base64}` : null)
    || "/placeholder-user.jpg"

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className={cn(
      "rounded-lg border border-border bg-card overflow-hidden",
      "w-full min-w-0", // Full width of container, allow shrinking
      className
    )}>
      {/* Header Section */}
      <div className="p-2.5 border-b border-border">
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <div className="relative h-8 w-8 rounded-full overflow-hidden border border-border flex-shrink-0">
            <Image
              src={avatarUrl}
              alt={connection.name.value}
              fill
              className="object-cover"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-user.jpg"
              }}
            />
          </div>

          {/* Name and Basic Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold mb-0.5 break-words">{connection.name.value}</h3>
            
            <div className="space-y-0.5 text-[10px] text-muted-foreground">
              {connection.company?.value && (
                <div className="flex items-start gap-1 flex-wrap">
                  <Building2 className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{connection.company.value}</span>
                  {connection.role?.value && (
                    <span className="text-muted-foreground/70 break-words">• {connection.role.value}</span>
                  )}
                </div>
              )}
              
              <div className="flex items-start gap-1.5 flex-wrap">
                {connection.context.location.city && (
                  <div className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="break-words">{connection.context.location.city}</span>
                  </div>
                )}
                {connection.industry && (
                  <div className="flex items-center gap-0.5">
                    <Briefcase className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="break-words">{connection.industry}</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-1">
                <Calendar className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
                <span className="break-words leading-tight">Met {formatDate(connection.context.first_met)} at {connection.context.event.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {connection.tags && connection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {connection.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded bg-[var(--notion-blue-bg)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--notion-blue)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-2.5 space-y-2">
        {/* Personal Details */}
        {connection.audio?.personal_details && connection.audio.personal_details.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] font-medium text-muted-foreground">Personal Details</span>
            </div>
            <ul className="space-y-0.5">
              {connection.audio.personal_details.map((detail, idx) => (
                <li key={idx} className="text-[10px] text-foreground flex items-start gap-1">
                  <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>
                  <span className="break-words leading-tight">{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Interaction Info */}
        {(connection.interaction_count !== undefined || connection.last_interaction) && (
          <div className="pt-1.5 border-t border-border">
            <div className="text-[10px] text-muted-foreground">
              {connection.interaction_count !== undefined && connection.interaction_count > 0 && (
                <span>{connection.interaction_count} interaction{connection.interaction_count !== 1 ? 's' : ''}</span>
              )}
              {connection.last_interaction && (
                <span className="ml-2 break-words">
                  Last: {formatDate(connection.last_interaction)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border bg-muted/30 flex items-center justify-between">
        <Link
          href={`/profile/${connection._id}`}
          className="text-[10px] text-primary hover:underline break-words"
        >
          View full profile →
        </Link>
        {connection.enrichment?.linkedin?.url && (
          <a
            href={connection.enrichment.linkedin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Linkedin className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

