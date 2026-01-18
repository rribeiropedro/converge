import { z } from 'zod';

/**
 * Zod schemas that match the MongoDB Connection schema
 * These ensure LLM output aligns with our database structure
 */

// Profile field schema (name, company, role)
const ProfileFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
}).nullable().optional();

// Follow-up hook schema
const FollowUpHookSchema = z.object({
  type: z.enum(['resource_share', 'intro_request', 'meeting', 'other']),
  detail: z.string(),
});

// Audio data schema (from transcriptParser)
export const AudioDataSchema = z.object({
  profile: z.object({
    name: ProfileFieldSchema,
    company: ProfileFieldSchema,
    role: ProfileFieldSchema,
    institution: ProfileFieldSchema, // Education: school/university
    major: ProfileFieldSchema,       // Education: field of study
  }).optional(),
  topics_discussed: z.array(z.string()).optional().default([]),
  their_challenges: z.array(z.string()).optional().default([]),
  follow_up_hooks: z.array(FollowUpHookSchema).optional().default([]),
  personal_details: z.array(z.string()).optional().default([]),
  transcript_summary: z.string().optional().default(''),
}).passthrough(); // Allow extra fields but validate known ones

// Live insight extraction schema (from liveInsightEngine)
export const LiveInsightSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  institution: z.string().optional(),
  major: z.string().optional(),
  topics: z.array(z.string()).optional().default([]),
  challenges: z.array(z.string()).optional().default([]),
  hooks: z.array(z.string()).optional().default([]),
  personal: z.array(z.string()).optional().default([]),
}).passthrough();

// Visual appearance schema
const AppearanceSchema = z.object({
  description: z.string().default(''),
  distinctive_features: z.array(z.string()).default([]),
});

// Environment schema
const EnvironmentSchema = z.object({
  description: z.string().default(''),
  landmarks: z.array(z.string()).default([]),
});

// Headshot schema
const HeadshotSchema = z.object({
  url: z.string().url().nullable().optional(),
  base64: z.string().nullable().optional(),
}).optional();

// Visual data schema (from visualParser)
export const VisualDataSchema = z.object({
  face_embedding: z.array(z.number()).optional().default([]),
  appearance: AppearanceSchema.optional(),
  environment: EnvironmentSchema.optional(),
  headshot: HeadshotSchema.optional(),
}).passthrough(); // Allow extra fields but validate known ones

/**
 * Validates and normalizes audio data from LLM
 * @param {Object} data - Raw LLM response data
 * @returns {Object} - Validated and normalized audio data
 * @throws {Error} - If validation fails
 */
export function validateAudioData(data) {
  // Use Zod's safeParse to get detailed errors
  const result = AudioDataSchema.safeParse(data);
  
  if (!result.success && result.error) {
    const errorMessages = result.error.issues.map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    }).join(', ');
    throw new Error(`Audio data validation failed: ${errorMessages}`);
  }
  
  if (!result.success) {
    throw new Error('Audio data validation failed: Unknown error');
  }
  
  // Zod automatically applies defaults and normalizes
  return result.data;
}

/**
 * Validates and normalizes visual data from LLM
 * @param {Object} data - Raw LLM response data
 * @returns {Object} - Validated and normalized visual data
 * @throws {Error} - If validation fails
 */
export function validateVisualData(data) {
  const result = VisualDataSchema.safeParse(data);
  
  if (!result.success && result.error) {
    const errorMessages = result.error.issues.map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    }).join(', ');
    throw new Error(`Visual data validation failed: ${errorMessages}`);
  }
  
  if (!result.success) {
    throw new Error('Visual data validation failed: Unknown error');
  }
  
  return result.data;
}

/**
 * Validates face embedding array
 * @param {Array} embedding - Face embedding array
 * @returns {boolean} - True if valid
 */
export function validateFaceEmbedding(embedding) {
  try {
    z.array(z.number()).length(128).parse(embedding);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes profile field to match MongoDB schema
 * Adds 'source' field and ensures proper structure
 */
export function normalizeProfileField(field, source = 'livekit') {
  if (!field || !field.value) {
    return {
      value: null,
      confidence: 'low',
      source: source,
    };
  }
  
  return {
    value: typeof field.value === 'string' ? field.value.trim() : String(field.value),
    confidence: ['high', 'medium', 'low'].includes(field.confidence) 
      ? field.confidence 
      : 'low',
    source: source,
  };
}

/**
 * Normalizes follow-up hook to match MongoDB schema
 * Adds 'completed' and 'completed_at' fields
 */
export function normalizeFollowUpHook(hook) {
  return {
    type: ['resource_share', 'intro_request', 'meeting', 'other'].includes(hook.type)
      ? hook.type
      : 'other',
    detail: hook.detail || '',
    completed: false,
    completed_at: null,
  };
}
