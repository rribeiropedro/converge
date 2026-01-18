// TypeScript types matching backend Connection schema

// Confidence-based field type (used for AI-extracted data)
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type DataSource = 'livekit' | 'manual'

export interface ConfidenceField<T> {
  value: T
  confidence: ConfidenceLevel
  source: DataSource
}

// Connection status
export type ConnectionStatus = 'draft' | 'temporary_draft' | 'approved' | 'archived'

// Follow-up hook types
export type FollowUpType = 'resource_share' | 'intro_request' | 'meeting' | 'other'

export interface FollowUpHook {
  type: FollowUpType
  detail: string
  completed: boolean
  completed_at: string | null
}

// Visual data from Overshoot/face recognition
export interface FaceEmbeddingHistory {
  vector: number[]
  captured_at: string
  event?: string
  quality_score?: number
}

export interface VisualData {
  face_embedding: number[]
  face_embedding_history: FaceEmbeddingHistory[]
  appearance: {
    description: string
    distinctive_features: string[]
  }
  environment: {
    description: string
    landmarks: string[]
  }
  headshot: {
    url?: string
    base64?: string
  }
}

// Audio data from transcription
export interface AudioData {
  topics_discussed: string[]
  their_challenges: string[]
  follow_up_hooks: FollowUpHook[]
  personal_details: string[]
  transcript_summary: string
}

// Context data (where/when met)
export type EventType = 'hackathon' | 'conference' | 'meetup' | 'other'

export interface ContextData {
  event: {
    name: string
    type: EventType
  }
  location: {
    name: string
    city: string
  }
  first_met: string
}

// Enrichment data (LinkedIn, experience, etc.)
export interface Experience {
  title?: string
  company?: string
  start_date?: string
  end_date?: string
  description?: string
}

export interface Education {
  degree?: string
  institution?: string
  start_date?: string
  end_date?: string
}

export interface EnrichmentData {
  linkedin?: {
    url?: string
    id?: string
  }
  experience: Experience[]
  education: Education[]
  skills: string[]
}

// Full backend Connection model
export interface BackendConnection {
  _id: string
  user_id: string
  status: ConnectionStatus
  is_student?: boolean // true if connection is a student, false if professional
  name: ConfidenceField<string>
  company?: ConfidenceField<string> // Now optional (was required)
  role?: ConfidenceField<string>
  institution?: ConfidenceField<string> // Education field for students
  major?: ConfidenceField<string> // Education field for students
  visual: VisualData
  audio: AudioData
  context: ContextData
  tags: string[]
  industry?: string
  relationship_type?: string
  enrichment?: EnrichmentData
  needs_review: boolean
  fields_needing_review: string[]
  interaction_count: number
  last_interaction: string | null
  last_contacted: string | null
  created_at: string
  updated_at: string
}

// Simplified frontend Connection for UI components
export interface FrontendConnection {
  id: string
  name: string
  nameConfidence: ConfidenceLevel
  isStudent?: boolean // true if connection is a student
  company?: string // Now optional
  companyConfidence?: ConfidenceLevel
  role?: string
  roleConfidence?: ConfidenceLevel
  institution?: string // Education field for students
  institutionConfidence?: ConfidenceLevel
  major?: string // Education field for students
  majorConfidence?: ConfidenceLevel
  avatarUrl?: string
  location: string
  city: string
  industry?: string
  metDate: string
  eventName: string
  eventType: EventType
  tags: string[]
  status: ConnectionStatus
  needsReview: boolean
  fieldsNeedingReview: string[]

  // Audio summary data
  topics: string[]
  challenges: string[]
  followUpHooks: FollowUpHook[]
  personalDetails: string[]
  transcriptSummary: string

  // Visual data
  appearance?: string
  distinctiveFeatures: string[]
  environment?: string
  landmarks: string[]

  // Enrichment
  linkedinUrl?: string
  skills: string[]

  // Interaction tracking
  interactionCount: number
  lastInteraction: string | null
  lastContacted: string | null
  createdAt: string
  updatedAt: string
}

// API response types
export interface ConnectionsListResponse {
  connections: BackendConnection[]
  total: number
  limit: number
  offset: number
}

export interface ConnectionResponse {
  connection: BackendConnection
}

// Query params for listing connections
export interface ConnectionsQueryParams {
  status?: ConnectionStatus
  search?: string
  event?: string
  limit?: number
  offset?: number
}

// Approve request body
export interface ApproveConnectionRequest {
  updates?: Partial<{
    name: string
    company: string
    role: string
    institution: string
    major: string
    tags: string[]
    industry: string
    is_student: boolean
  }>
}

export interface NetworkAnalyticsMetrics {
  totalConnections: number
  newConnectionsThisMonth: number
  followUpCompletionRate: number
  needsReviewCount: number
  averageInteractions: number
  activeConnectionsCount: number
}

export interface GrowthDataPoint {
  date: string
  count: number
  cumulative: number
}

export interface CategoryCount {
  name: string
  value: number
}

export interface LocationCount {
  city: string
  count: number
}

export interface CompanyCount {
  company: string
  count: number
}

export interface EventTypeCount {
  type: string
  count: number
}

export interface FollowUpStatusData {
  type: string
  completed: number
  pending: number
}

export interface TopicCount {
  topic: string
  count: number
}

export interface NetworkAnalyticsData {
  metrics: NetworkAnalyticsMetrics
  growthData: GrowthDataPoint[]
  industryData: CategoryCount[]
  locationData: LocationCount[]
  companyData: CompanyCount[]
  eventTypeData: EventTypeCount[]
  followUpData: FollowUpStatusData[]
  topicsData: TopicCount[]
}

export interface NetworkRecommendation {
  type: 'action' | 'insight' | 'warning' | 'opportunity'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  actionableStep?: string
  relatedConnection?: string
}
