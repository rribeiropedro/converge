// UI Schema Types - Agent can output these JSON schemas to render components

export interface ProfileCardSchema {
  type: "profile_card"
  data: {
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
}

export interface ProfileCardGroupSchema {
  type: "profile_card_group"
  data: ProfileCardSchema["data"][]
}

export interface ActionCardSchema {
  type: "action_card"
  data: {
    title: string
    description: string
    actions: Array<{
      label: string
      action: string
      actionData?: any
    }>
  }
}

export type UISchema = ProfileCardSchema | ProfileCardGroupSchema | ActionCardSchema

// UI Schema Marker - Agent should wrap JSON in this format
export const UI_SCHEMA_START = "```ui-schema"
export const UI_SCHEMA_END = "```"

// Helper to detect and extract UI schemas from text
export function extractUISchemas(text: string): {
  schemas: UISchema[]
  textWithoutSchemas: string
} {
  const schemas: UISchema[] = []
  let remainingText = text

  // Match ```ui-schema ... ```
  const schemaRegex = /```ui-schema\s*([\s\S]*?)```/g
  let match

  while ((match = schemaRegex.exec(text)) !== null) {
    try {
      const schemaJson = match[1].trim()
      const schema = JSON.parse(schemaJson) as UISchema
      schemas.push(schema)
    } catch (error) {
      console.error("Failed to parse UI schema:", error)
    }
  }

  // Remove all schema blocks from text
  remainingText = text.replace(schemaRegex, "").trim()

  return {
    schemas,
    textWithoutSchemas: remainingText,
  }
}

// Validate UI schema
export function isValidUISchema(obj: any): obj is UISchema {
  if (!obj || typeof obj !== "object") return false
  
  const validTypes = ["profile_card", "profile_card_group", "action_card"]
  return validTypes.includes(obj.type) && obj.data !== undefined
}

