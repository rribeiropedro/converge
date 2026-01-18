# Converge Backend

## Live transcription (WebSocket)

Socket.IO namespace: `/api/transcribe/live`

Client events:
- `start` (optional) payload fields: `model`, `language`, `diarize`, `smart_format`, `encoding`, `sample_rate`, `channels`
- `audio` binary audio chunks (Buffer/Uint8Array)
- `stop` to end the stream

Server events:
- `ready` when Deepgram is connected
- `transcript` payload: `{ transcript, words, speaker, is_final }`
- `speech_started`, `utterance_end`
- `error` for failures
- `closed` when the stream ends

