import { createLiveTranscriptionConnection, LiveTranscriptionEvents } from '../controllers/transcribeController.js';

const LIVE_NAMESPACE = '/api/transcribe/live';
const ALLOWED_OPTIONS = new Set([
  'model',
  'language',
  'diarize',
  'smart_format',
  'encoding',
  'sample_rate',
  'channels',
  'punctuate',
  'interim_results',
]);

const pickLiveOptions = (payload = {}) => {
  const options = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (!ALLOWED_OPTIONS.has(key) || value === undefined) return;
    options[key] = value;
  });

  return options;
};

const toBuffer = (chunk) => {
  if (!chunk) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if (ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer);
  return Buffer.from(chunk);
};

export const registerTranscribeLiveSocket = (io) => {
  const namespace = io.of(LIVE_NAMESPACE);

  namespace.on('connection', (socket) => {
    let connection = null;

    const closeConnection = () => {
      if (!connection) return;
      try {
        connection.finish?.();
      } catch (error) {
        // Ignore cleanup errors
      }
      try {
        connection.close?.();
      } catch (error) {
        // Ignore cleanup errors
      }
      connection = null;
    };

    const startConnection = (options = {}) => {
      if (connection) return;

      try {
        connection = createLiveTranscriptionConnection(pickLiveOptions(options));
      } catch (error) {
        socket.emit('error', { message: error.message });
        return;
      }

      connection.on(LiveTranscriptionEvents.Open, () => {
        socket.emit('ready');
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alternative = data.channel?.alternatives?.[0];
        const transcript = alternative?.transcript || '';
        const words = alternative?.words || [];
        const speakers = new Set(
          words.map((word) => word.speaker).filter((speaker) => speaker !== undefined)
        );
        const speaker = speakers.size > 1 ? `${words[0]?.speaker}+` : words[0]?.speaker;

        if (!transcript) return;

        socket.emit('transcript', {
          transcript,
          words,
          speaker,
          is_final: data.is_final,
        });
      });

      connection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
        socket.emit('utterance_end', data);
      });

      connection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
        socket.emit('speech_started', data);
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        socket.emit('error', {
          message: error?.message || 'Deepgram error',
          details: error,
        });
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        socket.emit('closed');
        closeConnection();
      });
    };

    socket.on('start', (options) => {
      startConnection(options);
    });

    socket.on('audio', (chunk) => {
      if (!connection) startConnection();
      const buffer = toBuffer(chunk);
      if (!buffer || !connection) return;
      connection.send(buffer);
    });

    socket.on('stop', () => {
      closeConnection();
      socket.emit('closed');
    });

    socket.on('disconnect', () => {
      closeConnection();
    });
  });
};

