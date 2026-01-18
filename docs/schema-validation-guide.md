# Schema Validation Guide: Ensuring LLM Output Matches MongoDB Schema

## Overview

We use **Zod** for runtime schema validation to ensure LLM-extracted data aligns perfectly with our MongoDB Connection schema before it reaches the database.

## Validation Flow

```
LLM Response (JSON)
    ↓
JSON.parse() - Basic parsing
    ↓
Zod Schema Validation (schemaValidator.js)
    ├─ Validates enum values (confidence, follow_up_hooks types)
    ├─ Validates data types (strings, arrays, numbers)
    ├─ Applies defaults for missing fields
    └─ Throws detailed errors if invalid
    ↓
Normalization (adds MongoDB-specific fields)
    ├─ Adds 'source: livekit' to profile fields
    ├─ Adds 'completed: false' to follow_up_hooks
    └─ Ensures proper structure
    ↓
Mongoose Validation (final check)
    └─ Catches any remaining issues
```

## Zod Schemas

### Audio Data Schema
**Location**: `backend/src/services/schemaValidator.js`

```javascript
AudioDataSchema = {
  profile: {
    name: { value: string | null, confidence: 'high'|'medium'|'low' },
    company: { value: string | null, confidence: 'high'|'medium'|'low' },
    role: { value: string | null, confidence: 'high'|'medium'|'low' } (optional)
  },
  topics_discussed: string[] (default: [])
  their_challenges: string[] (default: [])
  follow_up_hooks: [{ type: enum, detail: string }] (default: [])
  personal_details: string[] (default: [])
  transcript_summary: string (default: '')
}
```

### Visual Data Schema
```javascript
VisualDataSchema = {
  face_embedding: number[128] (optional, default: [])
  appearance: {
    description: string (default: '')
    distinctive_features: string[] (default: [])
  } (optional)
  environment: {
    description: string (default: '')
    landmarks: string[] (default: [])
  } (optional)
  headshot: {
    url: string | null (optional)
    base64: string | null (optional)
  } (optional)
}
```

## What Gets Validated

### ✅ Enum Values
- **confidence**: Must be 'high', 'medium', or 'low'
- **follow_up_hooks.type**: Must be 'resource_share', 'intro_request', 'meeting', or 'other'

### ✅ Data Types
- **Strings**: Ensured to be strings (converts if needed)
- **Arrays**: Ensured to be arrays (defaults to [] if missing)
- **Numbers**: Validated for face embeddings (must be 128 numbers)

### ✅ Required Fields
- **profile.name** and **profile.company**: Required (but can be null)
- **profile.role**: Optional

### ✅ Defaults Applied
- Missing arrays default to `[]`
- Missing strings default to `''`
- Missing optional fields are handled gracefully

## Error Messages

Zod provides detailed error messages:

```
Audio data validation failed: 
  profile.name.confidence: Invalid enum value. Expected 'high' | 'medium' | 'low', received 'invalid'
  follow_up_hooks[0].type: Invalid enum value. Expected 'resource_share' | 'intro_request' | 'meeting' | 'other', received 'wrong_type'
```

This makes debugging LLM output issues much easier!

## Integration Points

### 1. transcriptParser.js
```javascript
const parsed = JSON.parse(jsonMatch[0]);
const validated = validateAudioData(parsed); // Zod validates here
return normalizeForMongoDB(validated); // Adds 'source' field
```

### 2. visualParser.js
```javascript
const mergedVisual = { ...visualInput, ...parsedVisual };
const validatedVisual = validateVisualData(mergedVisual); // Zod validates here
return normalizeVisualData(validatedVisual);
```

### 3. processingService.js
The validated data is then used to create Connection documents, which Mongoose validates one final time.

## Benefits

1. **Early Error Detection**: Catch schema mismatches before Mongoose save
2. **Clear Error Messages**: Know exactly which field failed and why
3. **Type Safety**: Ensures data types match schema expectations
4. **Automatic Defaults**: Missing optional fields get sensible defaults
5. **Enum Validation**: Invalid enum values caught immediately

## Testing

To test validation:

```javascript
import { validateAudioData } from './services/schemaValidator.js';

// Valid data
const valid = {
  profile: {
    name: { value: 'Test', confidence: 'high' },
    company: { value: 'Co', confidence: 'high' }
  }
};
const validated = validateAudioData(valid); // ✅ Passes

// Invalid data
const invalid = {
  profile: {
    name: { value: 'Test', confidence: 'wrong' }
  }
};
validateAudioData(invalid); // ❌ Throws: "Invalid enum value..."
```

## Comparison: Before vs After

### Before (Manual Validation)
```javascript
function normalizeField(field) {
  if (!field) return { value: null, confidence: 'low' };
  return {
    value: field.value || null,
    confidence: ['high', 'medium', 'low'].includes(field.confidence) 
      ? field.confidence 
      : 'low',
  };
}
```
**Issues**: 
- No type checking
- Silent failures (defaults to 'low')
- No detailed error messages

### After (Zod Validation)
```javascript
const validated = validateAudioData(parsed);
// ✅ Type-checked
// ✅ Enum-validated
// ✅ Detailed errors if invalid
// ✅ Automatic defaults
```
**Benefits**:
- Strong type validation
- Clear error messages
- Automatic normalization
- Schema alignment guaranteed

## Schema Alignment Guarantee

With Zod validation, we can be **confident** that:

1. ✅ All enum values match MongoDB schema
2. ✅ All data types are correct
3. ✅ Required fields are present (or have defaults)
4. ✅ Array fields are arrays
5. ✅ String fields are strings
6. ✅ Face embeddings are 128 numbers (if present)

**Result**: LLM output → Zod validation → MongoDB schema = **Perfect alignment!** 🎯
