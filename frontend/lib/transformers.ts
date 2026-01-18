// Backend → Frontend data transformation utilities

import type { BackendConnection, FrontendConnection, ConfidenceLevel } from './types'

/**
 * Transform a single backend connection to frontend format
 * This flattens the nested confidence-based fields for easier UI consumption
 */
export function transformConnection(backend: BackendConnection): FrontendConnection {
  return {
    // Core identity
    id: backend._id,
    name: backend.name.value,
    nameConfidence: backend.name.confidence,
    isStudent: backend.is_student ?? false,
    company: backend.company?.value,
    companyConfidence: backend.company?.confidence,
    role: backend.role?.value,
    roleConfidence: backend.role?.confidence,
    institution: backend.institution?.value,
    institutionConfidence: backend.institution?.confidence,
    major: backend.major?.value,
    majorConfidence: backend.major?.confidence,

    // Visual/avatar
    avatarUrl: backend.visual?.headshot?.url || backend.visual?.headshot?.base64,

    // Location from context
    location: backend.context.location.name,
    city: backend.context.location.city,

    // Event info
    metDate: backend.context.first_met,
    eventName: backend.context.event.name,
    eventType: backend.context.event.type,

    // Classification
    industry: backend.industry,
    tags: backend.tags || [],
    status: backend.status,
    needsReview: backend.needs_review,
    fieldsNeedingReview: backend.fields_needing_review || [],

    // Audio/conversation data
    topics: backend.audio?.topics_discussed || [],
    challenges: backend.audio?.their_challenges || [],
    followUpHooks: backend.audio?.follow_up_hooks || [],
    personalDetails: backend.audio?.personal_details || [],
    transcriptSummary: backend.audio?.transcript_summary || '',

    // Visual description
    appearance: backend.visual?.appearance?.description,
    distinctiveFeatures: backend.visual?.appearance?.distinctive_features || [],
    environment: backend.visual?.environment?.description,
    landmarks: backend.visual?.environment?.landmarks || [],

    // Enrichment
    linkedinUrl: backend.enrichment?.linkedin?.url,
    skills: backend.enrichment?.skills || [],

    // Interaction tracking
    interactionCount: backend.interaction_count || 0,
    lastInteraction: backend.last_interaction,
    lastContacted: backend.last_contacted,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
  }
}

/**
 * Transform an array of backend connections
 */
export function transformConnections(backends: BackendConnection[]): FrontendConnection[] {
  return backends.map(transformConnection)
}

/**
 * Get confidence badge color based on confidence level
 */
export function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'text-green-500 bg-green-500/10'
    case 'medium':
      return 'text-yellow-500 bg-yellow-500/10'
    case 'low':
      return 'text-red-500 bg-red-500/10'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

/**
 * Get confidence label text
 */
export function getConfidenceLabel(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Needs verification'
    case 'low':
      return 'Low confidence'
    default:
      return 'Unknown'
  }
}

/**
 * Format the follow-up hook type for display
 */
export function formatFollowUpType(type: string): string {
  switch (type) {
    case 'resource_share':
      return 'Share Resource'
    case 'intro_request':
      return 'Make Introduction'
    case 'meeting':
      return 'Schedule Meeting'
    case 'other':
      return 'Follow Up'
    default:
      return type
  }
}

/**
 * Format event type for display
 */
export function formatEventType(type: string): string {
  switch (type) {
    case 'hackathon':
      return 'Hackathon'
    case 'conference':
      return 'Conference'
    case 'meetup':
      return 'Meetup'
    case 'other':
      return 'Event'
    default:
      return type
  }
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}
