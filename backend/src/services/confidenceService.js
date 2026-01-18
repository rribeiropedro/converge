export const CRITICAL_FIELDS = ['name', 'company'];
export const IMPORTANT_FIELDS = ['role'];

export function calculateNeedsReview(audioData) {
  if (!audioData || !audioData.profile) {
    return true;
  }

  const profile = audioData.profile;

  for (const field of CRITICAL_FIELDS) {
    if (!profile[field] || profile[field].confidence === 'low') {
      return true;
    }
  }

  for (const field of IMPORTANT_FIELDS) {
    if (profile[field] && profile[field].confidence === 'low') {
      return true;
    }
  }

  return false;
}

export function getFieldsNeedingReview(audioData) {
  const fieldsNeedingReview = [];

  if (!audioData || !audioData.profile) {
    return [...CRITICAL_FIELDS, ...IMPORTANT_FIELDS];
  }

  const profile = audioData.profile;
  const allFields = [...CRITICAL_FIELDS, ...IMPORTANT_FIELDS];

  for (const field of allFields) {
    const fieldData = profile[field];
    if (!fieldData || fieldData.confidence === 'low' || fieldData.confidence === 'medium') {
      fieldsNeedingReview.push(field);
    }
  }

  return fieldsNeedingReview;
}

export function normalizeConfidence(confidence) {
  const validConfidences = ['high', 'medium', 'low'];
  if (validConfidences.includes(confidence)) {
    return confidence;
  }
  return 'low';
}
