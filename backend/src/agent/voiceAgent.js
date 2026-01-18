import {
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class NetworkAssistant extends voice.Agent {
  constructor() {
    super({
      instructions: `You are a helpful network assistant that helps users 
      find and remember their professional connections. You can answer 
      questions about who they've met, where they met them, what industries 
      they work in, and help them recall details about their network. 
      Be conversational, friendly, and helpful.`,
    });
  }
}

export default defineAgent({
  // Prewarm VAD model for better performance (optional but recommended)
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  
  entry: async (ctx) => {
    console.log('🎤 Agent joining room:', ctx.room.name);

    try {
      const vad = ctx.proc.userData.vad;
      
      const session = new voice.AgentSession({
        vad,
        stt: 'assemblyai/universal-streaming:en',
        llm: 'openai/gpt-4o-mini',
        tts: 'cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
        // Interruption configuration to prevent false positives
        allowInterruptions: true, // Allow real interruptions
        minInterruptionDuration: 0.5, // Require 0.5 seconds of speech before interrupting (prevents noise from interrupting)
        minInterruptionWords: 2, // Require at least 2 words before interrupting
        falseInterruptionTimeout: 1.0, // Wait 1 second to detect false interruptions
        resumeFalseInterruption: true, // Resume speaking if it was a false interruption
      });

      await session.start({
        agent: new NetworkAssistant(),
        room: ctx.room,
      });

      await ctx.connect();

      // Optional: Send a greeting
      const handle = session.generateReply({
        instructions: 'Greet the user warmly and ask how you can help them with their professional network.',
      });
      
      // Wait for the greeting to finish playing (optional)
      await handle.waitForPlayout();

      console.log('✅ Agent connected to room');
    } catch (error) {
      console.error('❌ Error in agent session:', error);
      throw error;
    }
  },
});

// Start the agent server using CLI
cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));

