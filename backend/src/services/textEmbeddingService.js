/**
 * Text Embedding Service
 * Generates text embeddings using OpenAI's text-embedding-3-small model via OpenRouter API
 */

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/**
 * Generates a text embedding for the given input text
 * @param {string} text - The text to embed (e.g., name + appearance description)
 * @returns {Promise<number[]>} - The embedding array (1536 dimensions)
 * @throws {Error} - If the API call fails or returns an invalid response
 */
export async function generateTextEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY environment variable is not set');
  }

  try {
    const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid response structure: missing data array');
    }

    const embedding = data.data[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid response structure: missing embedding array');
    }

    return embedding;
  } catch (error) {
    if (error.message.includes('OpenRouter API error') ||
        error.message.includes('Invalid')) {
      throw error;
    }
    throw new Error(`Failed to generate text embedding: ${error.message}`);
  }
}

export default { generateTextEmbedding };
