import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const getDeepgramClient = () => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set');
  }

  return createClient(apiKey);
};

export const createLiveTranscriptionConnection = (options = {}) => {
  const deepgram = getDeepgramClient();

  return deepgram.listen.live({
    model: 'nova-3',
    language: 'en',
    diarize: true,
    smart_format: true,
    ...options,
  });
};

export const transcribe = async (req, res) => {
  try {
    const deepgram = getDeepgramClient();
    const file = req.file;
    const hasRawBody = Buffer.isBuffer(req.body) && req.body.length > 0;

    if (!file && !hasRawBody) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const audioBuffer = file?.buffer || req.body;
    const mimetype = file?.mimetype || req.headers['content-type'];

    const options = {
      model: 'nova-3',
      language: 'en',
      smart_format: true,
      diarize: true,
      ...(mimetype ? { mimetype } : {}),
    };

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      options
    );

    if (error) {
      return res.status(502).json({ error: 'Deepgram error', details: error });
    }

    return res.json({ result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const transcribeLive = async (req, res) => {
  res.status(426).json({
    error: 'Use WebSocket for live transcription',
    endpoint: '/api/transcribe/live',
  });
};

export { LiveTranscriptionEvents };