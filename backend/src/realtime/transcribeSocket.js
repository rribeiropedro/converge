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

  console.log(`🔌 WebSocket namespace registered: ${LIVE_NAMESPACE}`);

  namespace.on('connection', (socket) => {
    console.log(`✅ Client connected to live transcription: ${socket.id}`);
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
      if (connection) {
        console.log(`⚠️  Connection already exists for ${socket.id}`);
        return;
      }

      console.log(`🎤 Starting Deepgram connection for ${socket.id} with options:`, pickLiveOptions(options));

      try {
        connection = createLiveTranscriptionConnection(pickLiveOptions(options));
      } catch (error) {
        console.error(`❌ Error creating Deepgram connection for ${socket.id}:`, error);
        socket.emit('error', { message: error.message });
        return;
      }

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`✅ Deepgram connection opened for ${socket.id}`);
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

        console.log(`📝 Transcript (${data.is_final ? 'final' : 'interim'}) for ${socket.id}:`, transcript.substring(0, 50));

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
        console.error(`❌ Deepgram error for ${socket.id}:`, error);
        socket.emit('error', {
          message: error?.message || 'Deepgram error',
          details: error,
        });
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log(`🔌 Deepgram connection closed for ${socket.id}`);
        socket.emit('closed');
        closeConnection();
      });
    };

    socket.on('start', (options) => {
      console.log(`▶️  Start event received from ${socket.id}`);
      startConnection(options);
    });

    socket.on('audio', (chunk) => {
      if (!connection) {
        console.log(`🎤 Audio received without connection, starting connection for ${socket.id}`);
        startConnection();
      }
      const buffer = toBuffer(chunk);
      if (!buffer) {
        console.warn(`⚠️  Invalid audio chunk received from ${socket.id}`);
        return;
      }
      if (!connection) {
        console.warn(`⚠️  No connection available for ${socket.id}`);
        return;
      }
      // Log first audio chunk only to avoid spam
      if (!socket._firstAudioLogged) {
        console.log(`🎵 First audio chunk received from ${socket.id}, size: ${buffer.length} bytes`);
        socket._firstAudioLogged = true;
      }
      connection.send(buffer);
    });

    socket.on('stop', () => {
      console.log(`⏹️  Stop event received from ${socket.id}`);
      closeConnection();
      socket.emit('closed');
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      closeConnection();
    });
  });
};

