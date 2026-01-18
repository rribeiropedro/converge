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

// Face embedding schema (128-dim, deprecated - kept for backwards compatibility)
const FaceEmbeddingSchema = z.array(z.number())
  .refine(arr => arr.length === 0 || arr.length === 128, {
    message: 'Face embedding must be empty or 128 dimensions (deprecated)',
  })
  .optional()
  .default([]);

// Appearance embedding schema (1536-dim text embeddings from OpenAI/Claude)
const AppearanceEmbeddingSchema = z.array(z.number())
  .refine(arr => arr.length === 0 || arr.length === 1536, {
    message: 'Appearance embedding must be empty or 1536 dimensions',
  })
  .optional()
  .default([]);

// Visual data schema (from visualParser)
export const VisualDataSchema = z.object({
  face_embedding: FaceEmbeddingSchema, // Deprecated: 128-dim face-api.js embeddings
  appearance_embedding: AppearanceEmbeddingSchema, // New: 1536-dim text embeddings
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
 * Validates face embedding array (128-dim, deprecated)
 * Now accepts empty arrays as valid since face embeddings are deprecated
 * @param {Array} embedding - Face embedding array
 * @returns {boolean} - True if valid (empty or 128 dimensions)
 */
export function validateFaceEmbedding(embedding) {
  try {
    if (!Array.isArray(embedding)) return false;
    // Accept empty arrays or 128-dim arrays (deprecated format)
    if (embedding.length === 0) return true;
    if (embedding.length === 128) {
      z.array(z.number()).length(128).parse(embedding);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validates appearance embedding array (1536-dim text embeddings)
 * @param {Array} embedding - Appearance embedding array
 * @returns {boolean} - True if valid (empty or 1536 dimensions)
 */
export function validateAppearanceEmbedding(embedding) {
  try {
    if (!Array.isArray(embedding)) return false;
    if (embedding.length === 0) return true;
    if (embedding.length === 1536) {
      z.array(z.number()).length(1536).parse(embedding);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validates any embedding array (supports both 128-dim and 1536-dim)
 * @param {Array} embedding - Embedding array
 * @returns {boolean} - True if valid
 */
export function validateEmbedding(embedding) {
  return validateFaceEmbedding(embedding) || validateAppearanceEmbedding(embedding);
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
