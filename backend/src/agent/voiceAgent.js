import {
  WorkerOptions,
  cli,
  defineAgent,
  voice,
  llm,
  getJobContext,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import Connection from '../models/Connection.js';
import Interaction from '../models/Interaction.js';
import Event from '../models/Event.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB before defining agent
await connectDB();

// Helper function to format MongoDB Connection document to MongoDBConnection schema
function formatConnectionForProfileCard(connectionDoc) {
  if (!connectionDoc) return null;
  
  return {
    _id: connectionDoc._id.toString(),
    name: {
      value: connectionDoc.name?.value || '',
    },
    company: connectionDoc.company?.value ? {
      value: connectionDoc.company.value,
    } : undefined,
    role: connectionDoc.role?.value ? {
      value: connectionDoc.role.value,
    } : undefined,
    industry: connectionDoc.industry,
    tags: connectionDoc.tags || [],
    context: {
      location: {
        name: connectionDoc.context?.location?.name || '',
        city: connectionDoc.context?.location?.city || '',
      },
      event: {
        name: connectionDoc.context?.event?.name || '',
        type: connectionDoc.context?.event?.type || 'other',
      },
      first_met: connectionDoc.context?.first_met 
        ? connectionDoc.context.first_met.toISOString() 
        : new Date().toISOString(),
    },
    visual: connectionDoc.visual?.headshot ? {
      headshot: {
        url: connectionDoc.visual.headshot.url,
        base64: connectionDoc.visual.headshot.base64,
      },
    } : undefined,
    audio: {
      transcript_summary: connectionDoc.audio?.transcript_summary,
      topics_discussed: connectionDoc.audio?.topics_discussed || [],
      their_challenges: connectionDoc.audio?.their_challenges || [],
      follow_up_hooks: connectionDoc.audio?.follow_up_hooks?.map(hook => ({
        type: hook.type,
        detail: hook.detail,
        completed: hook.completed || false,
      })) || [],
      personal_details: connectionDoc.audio?.personal_details || [],
    },
    enrichment: connectionDoc.enrichment ? {
      linkedin: connectionDoc.enrichment.linkedin?.url ? {
        url: connectionDoc.enrichment.linkedin.url,
      } : undefined,
      experience: connectionDoc.enrichment.experience?.map(exp => ({
        title: exp.title,
        company: exp.company,
        start_date: exp.start_date?.toISOString(),
        end_date: exp.end_date?.toISOString(),
        description: exp.description,
      })) || [],
      education: connectionDoc.enrichment.education?.map(edu => ({
        degree: edu.degree,
        institution: edu.institution,
        start_date: edu.start_date?.toISOString(),
        end_date: edu.end_date?.toISOString(),
      })) || [],
      skills: connectionDoc.enrichment.skills || [],
    } : undefined,
    interaction_count: connectionDoc.interaction_count || 0,
    last_interaction: connectionDoc.last_interaction?.toISOString(),
  };
}

// Define database query tools using LiveKit's llm.tool() format
function createTools(userId) {
  return {
    searchConnections: llm.tool({
      description: `CRITICAL: You MUST use this tool for ANY question about connections or people.
      
      This tool returns:
      - A brief SUMMARY (e.g., "I found 4 connections for you.")
      - A UI_SCHEMA that renders beautiful profile cards showing ALL connection details
      
      USAGE PATTERN:
      1. Call this tool
      2. Say ONLY the summary returned by the tool
      3. Include the ui_schema EXACTLY as returned
      4. DO NOT describe individual connections - the cards show everything!
      
      Searches across names, companies, roles, industries, events, topics discussed, and any other text. 
      
      Examples: "Find Sarah", "Who works at Google?", "People interested in AI", 
      "Who did I meet at NexHacks?", "Find investors", "Who have I met recently?", 
      "Show me connections with pending actions"`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for - name, company, topic, event, industry, or any text'
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return (default: 5)'
          }
        },
        required: ['query']
      },
      execute: async ({ query, limit = 5 }, { ctx }) => {
        try {
          // Use MongoDB text search across all indexed fields - get full documents
          let connections = await Connection.find({
            user_id: userId,
            status: 'approved',
            $text: { $search: query }
          })
          .limit(Math.min(limit, 20))
          .sort({ score: { $meta: 'textScore' } });
          
          if (connections.length === 0) {
            // Fallback to regex if text search fails
            connections = await Connection.find({
              user_id: userId,
              status: 'approved',
              $or: [
                { 'name.value': { $regex: query, $options: 'i' } },
                { 'company.value': { $regex: query, $options: 'i' } },
                { 'industry': { $regex: query, $options: 'i' } },
                { 'context.event.name': { $regex: query, $options: 'i' } }
              ]
            }).limit(Math.min(limit, 20));
          }
          
          // Format profile data for UI schema
          const formattedProfiles = connections
            .map(c => formatConnectionForProfileCard(c))
            .filter(p => p !== null);
          
          // Create UI schema for profile cards
          const uiSchema = {
            type: 'profile_card_group',
            data: formattedProfiles
          };
          
          // Return the UI schema wrapped in markdown code blocks
          // The agent MUST include this in its response for the UI to render it
          const uiSchemaString = '```ui-schema\n' + JSON.stringify(uiSchema, null, 2) + '\n```';
          
          // Minimal summary - let the UI cards show the details
          const summary = connections.length === 0 
            ? 'No connections found matching your query.'
            : `I found ${connections.length} connection${connections.length > 1 ? 's' : ''} for you.`;
          
          // Return minimal summary and UI schema
          return {
            summary,
            ui_schema: uiSchemaString,
            instruction: 'IMPORTANT: Say ONLY the summary, then include the ui_schema. DO NOT describe the connections - the UI cards will show all details.'
          };
        } catch (error) {
          return { error: 'Search failed', message: error.message };
        }
      },
    }),
    
    getPersonDetails: llm.tool({
      description: `CRITICAL: Use this tool when user asks about a specific person.
      
      This tool returns:
      - A brief SUMMARY (e.g., "Here's Sarah's profile.")
      - A UI_SCHEMA that renders a beautiful profile card showing ALL details
      
      USAGE PATTERN:
      1. Call this tool
      2. Say ONLY the summary returned by the tool
      3. Include the ui_schema EXACTLY as returned
      4. DO NOT describe the person - the card shows everything!
      
      The profile card displays where you met, what you discussed, their challenges, 
      follow-up items, and all conversation context automatically.`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The person\'s name (can be partial or fuzzy match)'
          }
        },
        required: ['name']
      },
      execute: async ({ name }, { ctx }) => {
        try {
          const connection = await Connection.findOne({
            user_id: userId,
            status: 'approved',
            'name.value': { $regex: name, $options: 'i' }
          });
          
          if (!connection) {
            return { 
              found: false, 
              message: `No connection found matching "${name}". Try searching first to see available names.` 
            };
          }
          
          // Get interaction history
          const interactions = await Interaction.find({
            connection_id: connection._id
          })
          .sort({ timestamp: -1 })
          .limit(5)
          .select('type timestamp duration_seconds transcript_summary topics_discussed');
          
          // Format profile data for UI schema
          const formattedProfile = formatConnectionForProfileCard(connection);
          
          // Create UI schema for single profile card
          const uiSchema = {
            type: 'profile_card',
            data: formattedProfile
          };
          
          // Return the UI schema wrapped in markdown code blocks
          const uiSchemaString = '```ui-schema\n' + JSON.stringify(uiSchema, null, 2) + '\n```';
          
          // Minimal summary - let the UI card show all the details
          const summary = `Here's ${connection.name.value}'s profile.`;
          
          return {
            summary,
            ui_schema: uiSchemaString,
            instruction: 'IMPORTANT: Say ONLY the summary, then include the ui_schema. DO NOT describe details - the UI card shows everything.'
          };
        } catch (error) {
          return { error: 'Failed to get person details', message: error.message };
        }
      },
    }),
    
    getPendingActions: llm.tool({
      description: `Get all pending follow-ups and action items across your network. 
      Shows who you need to contact, what you promised to do, and overdue tasks.
      
      Use this when the user asks about tasks, to-dos, follow-ups, or what they need to do.`,
      parameters: {
        type: 'object',
        properties: {
          includeOverdueOnly: {
            type: 'boolean',
            description: 'If true, only show connections not contacted in 30+ days (default: false)'
          }
        }
      },
      execute: async ({ includeOverdueOnly = false }, { ctx }) => {
        try {
          const filter = {
            user_id: userId,
            status: 'approved'
          };
          
          if (includeOverdueOnly) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filter['context.first_met'] = { $lte: thirtyDaysAgo };
            filter.$or = [
              { last_contacted: { $lte: thirtyDaysAgo } },
              { last_contacted: null }
            ];
          } else {
            filter['audio.follow_up_hooks'] = { 
              $elemMatch: { completed: false } 
            };
          }
          
          const connections = await Connection.find(filter)
            .select('name company audio.follow_up_hooks context.first_met last_contacted')
            .sort({ 'context.first_met': 1 }); // Oldest first
          
          const results = [];
          for (const conn of connections) {
            const pendingFollowUps = conn.audio.follow_up_hooks?.filter(f => !f.completed) || [];
            
            if (pendingFollowUps.length > 0 || includeOverdueOnly) {
              const daysSinceMeeting = Math.floor((Date.now() - conn.context.first_met) / (1000 * 60 * 60 * 24));
              const daysSinceContact = conn.last_contacted 
                ? Math.floor((Date.now() - conn.last_contacted) / (1000 * 60 * 60 * 24))
                : daysSinceMeeting;
              
              results.push({
                name: conn.name.value,
                company: conn.company.value,
                days_since_meeting: daysSinceMeeting,
                days_since_contact: daysSinceContact,
                is_overdue: daysSinceContact > 30,
                pending_actions: pendingFollowUps.map(f => ({
                  type: f.type,
                  detail: f.detail
                }))
              });
            }
          }
          
          return {
            total_people_with_actions: results.length,
            overdue_count: results.filter(r => r.is_overdue).length,
            connections: results.sort((a, b) => b.days_since_contact - a.days_since_contact)
          };
        } catch (error) {
          return { error: 'Failed to get pending actions', message: error.message };
        }
      },
    }),
  };
}

class NetworkAssistant extends voice.Agent {
  constructor(userId) {
    super({
      instructions: `You are an intelligent network assistant helping users manage their professional connections.

CRITICAL UI SCHEMA RULES:
1. When user asks about connections/people, you MUST call searchConnections or getPersonDetails tools
2. These tools return a "ui_schema" field containing a markdown code block
3. You MUST include this EXACT ui_schema block in your spoken response
4. The ui_schema will automatically render visual profile cards in the chat
5. DO NOT verbally describe details that are shown in the UI cards - let the cards speak for themselves

RESPONSE PATTERN - KEEP IT MINIMAL:
- Call the appropriate tool (searchConnections or getPersonDetails)
- Say ONLY the summary provided by the tool (e.g., "I found 4 connections for you.")
- Include the ui_schema EXACTLY as returned
- DO NOT list names, companies, or other details - the UI cards show everything

CORRECT EXAMPLES:
User: "Who have I met recently?"
Tool returns: { summary: "I found 4 connections for you.", ui_schema: "..." }
Your response: "I found 4 connections for you. \`\`\`ui-schema\\n{...}\\n\`\`\`"
❌ WRONG: "I found 4 connections: Sarah from Google, John from Microsoft..." (redundant!)

User: "Tell me about Sarah"  
Tool returns: { summary: "Here's Sarah's profile.", ui_schema: "..." }
Your response: "Here's Sarah's profile. \`\`\`ui-schema\\n{...}\\n\`\`\`"
❌ WRONG: "Sarah works at TechCorp and you met her at..." (redundant - card shows this!)

REMEMBER: The UI cards are beautiful and show ALL the details. Your job is just to introduce them briefly.

Be conversational, friendly, and proactive. Always use tools to query the database.`,
      tools: createTools(userId),
    });
    this.userId = userId;
  }
}

export default defineAgent({
  // Prewarm VAD model for better performance (optional but recommended)
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  
  entry: async (ctx) => {
    console.log('🎤 Agent entry called');

    try {
      // Connect to room first - this is required before accessing room properties
      await ctx.connect();
      
      console.log('✅ Agent connected to room:', ctx.room.name);
      console.log('Room SID:', ctx.room.sid);
      
      // Extract userId from participant metadata
      let userId = null;
      
      // Check existing participants
      const participants = Array.from(ctx.room.remoteParticipants.values());
      console.log('Initial participants count:', participants.length);
      const userParticipant = participants.find(p => !p.identity.includes('agent'));
      
      if (userParticipant?.metadata) {
        try {
          const metadata = JSON.parse(userParticipant.metadata);
          userId = metadata.userId;
        } catch (e) {
          console.error('Failed to parse participant metadata:', e);
        }
      }
      
      // If not found, wait for participant to join
      if (!userId) {
        console.log('Waiting for user participant...');
        console.log('Current participants:', Array.from(ctx.room.remoteParticipants.values()).map(p => ({
          identity: p.identity,
          hasMetadata: !!p.metadata
        })));
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            const currentParticipants = Array.from(ctx.room.remoteParticipants.values());
            console.error('Timeout - Current participants:', currentParticipants.map(p => ({
              identity: p.identity,
              metadata: p.metadata
            })));
            reject(new Error('Timeout waiting for participant with userId'));
          }, 15000); // Increased timeout to 15 seconds
          
          const checkParticipant = (participant) => {
            // Check if this is a user participant (not agent)
            if (participant && !participant.identity.includes('agent')) {
              console.log('Found user participant:', participant.identity, 'Metadata:', participant.metadata);
              
              if (participant.metadata) {
                try {
                  const metadata = JSON.parse(participant.metadata);
                  console.log('Parsed metadata:', metadata);
                  
                  if (metadata.userId) {
                    userId = metadata.userId;
                    clearTimeout(timeout);
                    ctx.room.off('participantConnected', checkParticipant);
                    ctx.room.off('participantMetadataChanged', checkParticipant);
                    resolve(userId);
                    return;
                  }
                } catch (e) {
                  console.error('Failed to parse participant metadata:', e, participant.metadata);
                }
              }
            }
            
            // Also check all existing participants
            const currentParticipants = Array.from(ctx.room.remoteParticipants.values());
            const currentUserParticipant = currentParticipants.find(p => !p.identity.includes('agent'));
            
            if (currentUserParticipant?.metadata) {
              try {
                const metadata = JSON.parse(currentUserParticipant.metadata);
                if (metadata.userId) {
                  userId = metadata.userId;
                  clearTimeout(timeout);
                  ctx.room.off('participantConnected', checkParticipant);
                  ctx.room.off('participantMetadataChanged', checkParticipant);
                  resolve(userId);
                }
              } catch (e) {
                console.error('Failed to parse metadata in check:', e);
              }
            }
          };
          
          // Listen for both connection and metadata changes
          ctx.room.on('participantConnected', checkParticipant);
          ctx.room.on('participantMetadataChanged', checkParticipant);
          
          // Check immediately in case participant already joined
          const existingParticipants = Array.from(ctx.room.remoteParticipants.values());
          existingParticipants.forEach(p => checkParticipant(p));
        });
      }
      
      // Validate userId
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('User not authenticated - invalid userId');
      }
      
      console.log('👤 Agent serving user:', userId);
      
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
        agent: new NetworkAssistant(userId), // Pass userId to agent
        room: ctx.room,
        // Send transcriptions immediately when available, before audio plays
        outputOptions: {
          syncTranscription: false, // false = text appears before audio, true = synchronized with audio
        },
      });

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

