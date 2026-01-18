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
      description: `Search for connections and display their profile cards.
      
      This tool automatically sends profile cards to the UI.
      Return a brief summary to speak to the user.
      
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
          
          // Send UI schema silently via data channel
          if (formattedProfiles.length > 0) {
            try {
              const room = getJobContext().room;
              const uiSchema = {
                type: 'profile_card_group',
                data: formattedProfiles
              };
              
              const encoder = new TextEncoder();
              const data = JSON.stringify({
                type: 'ui_schema',
                schema: uiSchema
              });
              
              await room.localParticipant.publishData(
                encoder.encode(data),
                { reliable: true }
              );
            } catch (dataError) {
              console.error('Error sending UI schema:', dataError);
              // Don't fail the tool if data sending fails
            }
          }
          
          // Return ONLY what should be spoken
          const summary = connections.length === 0 
            ? 'No connections found matching your query.'
            : `I found ${connections.length} connection${connections.length > 1 ? 's' : ''} for you.`;
          
          return { summary };
        } catch (error) {
          return { error: 'Search failed', message: error.message };
        }
      },
    }),
    
    getPersonDetails: llm.tool({
      description: `Get details about a specific person and display their profile card.
      
      This tool automatically sends the profile card to the UI.
      Return a brief summary to speak to the user.
      
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
          
          // Send UI schema silently via data channel
          try {
            const room = getJobContext().room;
            const uiSchema = {
              type: 'profile_card',
              data: formattedProfile
            };
            
            const encoder = new TextEncoder();
            const data = JSON.stringify({
              type: 'ui_schema',
              schema: uiSchema
            });
            
            await room.localParticipant.publishData(
              encoder.encode(data),
              { reliable: true }
            );
          } catch (dataError) {
            console.error('Error sending UI schema:', dataError);
            // Don't fail the tool if data sending fails
          }
          
          // Return ONLY what should be spoken
          return {
            summary: `Here's ${connection.name.value}'s profile.`,
            found: true
          };
        } catch (error) {
          return { error: 'Failed to get person details', message: error.message };
        }
      },
    }),
    
    filterConnections: llm.tool({
      description: `Filter connections by time, location, event, tags, or other structured criteria.
      
      This tool automatically sends profile cards to the UI.
      Return a brief summary to speak to the user.
      
      Use this for temporal or structured queries like:
      - "Recent connections" or "Who have I met recently?"
      - "Connections from the last 14 days"
      - "People I met at [event name]"
      - "Connections in [city]"
      - "Show me people with tag [tag]"
      - "Most frequent connections"
      - "People I haven't talked to in a while"`,
      parameters: {
        type: 'object',
        properties: {
          metWithinDays: {
            type: 'number',
            description: 'Find connections you met within the last X days (e.g., 7 for last week, 30 for last month). Filters by first_met date.'
          },
          interactedWithinDays: {
            type: 'number',
            description: 'Find connections you interacted with in the last X days. Filters by last_interaction date.'
          },
          notInteractedInDays: {
            type: 'number',
            description: 'Find connections you HAVEN\'T interacted with in X days (for overdue follow-ups). Filters by last_interaction date.'
          },
          eventName: {
            type: 'string',
            description: 'Filter by event name (e.g., "NexHacks", "TechCrunch Disrupt")'
          },
          city: {
            type: 'string',
            description: 'Filter by city where you met (e.g., "San Francisco", "New York")'
          },
          industry: {
            type: 'string',
            description: 'Filter by industry (e.g., "technology", "healthcare", "finance")'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (e.g., ["investor", "potential_client"])'
          },
          sortBy: {
            type: 'string',
            enum: ['recently_met', 'oldest_met', 'recently_interacted', 'most_interactions', 'least_interactions', 'name'],
            description: 'How to sort results (default: recently_met)'
          },
          minInteractions: {
            type: 'number',
            description: 'Minimum number of interactions (for finding frequent contacts)'
          },
          maxInteractions: {
            type: 'number',
            description: 'Maximum number of interactions (for finding new/neglected connections)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return (default: 5)'
          }
        }
      },
      execute: async ({ 
        metWithinDays,
        interactedWithinDays,
        notInteractedInDays,
        eventName, 
        city, 
        industry, 
        tags, 
        sortBy = 'recently_met', 
        minInteractions,
        maxInteractions,
        limit = 5 
      }, { ctx }) => {
        try {
          const filter = {
            user_id: userId,
            status: 'approved'
          };
          
          // Time-based filtering: when they first met
          if (metWithinDays !== undefined) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - metWithinDays);
            filter['context.first_met'] = { $gte: cutoffDate };
          }
          
          // Time-based filtering: recent interactions
          if (interactedWithinDays !== undefined) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - interactedWithinDays);
            filter['last_interaction'] = { $gte: cutoffDate };
          }
          
          // Time-based filtering: overdue interactions
          if (notInteractedInDays !== undefined) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - notInteractedInDays);
            filter.$or = [
              { last_interaction: { $lte: cutoffDate } },
              { last_interaction: null }
            ];
          }
          
          // Event filtering
          if (eventName) {
            filter['context.event.name'] = { $regex: eventName, $options: 'i' };
          }
          
          // Location filtering
          if (city) {
            filter['context.location.city'] = { $regex: city, $options: 'i' };
          }
          
          // Industry filtering
          if (industry) {
            filter['industry'] = { $regex: industry, $options: 'i' };
          }
          
          // Tags filtering
          if (tags && tags.length > 0) {
            filter['tags'] = { $in: tags };
          }
          
          // Interaction count filtering
          if (minInteractions !== undefined) {
            filter['interaction_count'] = { $gte: minInteractions };
          }
          
          if (maxInteractions !== undefined) {
            if (filter['interaction_count']) {
              filter['interaction_count'] = { 
                ...filter['interaction_count'],
                $lte: maxInteractions 
              };
            } else {
              filter['interaction_count'] = { $lte: maxInteractions };
            }
          }
          
          // Build sort criteria
          let sortCriteria = {};
          switch (sortBy) {
            case 'recently_met':
              sortCriteria = { 'context.first_met': -1 };
              break;
            case 'oldest_met':
              sortCriteria = { 'context.first_met': 1 };
              break;
            case 'recently_interacted':
              sortCriteria = { last_interaction: -1 };
              break;
            case 'most_interactions':
              sortCriteria = { interaction_count: -1 };
              break;
            case 'least_interactions':
              sortCriteria = { interaction_count: 1 };
              break;
            case 'name':
              sortCriteria = { 'name.value': 1 };
              break;
            default:
              sortCriteria = { 'context.first_met': -1 };
          }
          
          // Execute query
          const connections = await Connection.find(filter)
            .limit(Math.min(limit, 20))
            .sort(sortCriteria);
          
          // Format profile data for UI schema
          const formattedProfiles = connections
            .map(c => formatConnectionForProfileCard(c))
            .filter(p => p !== null);
          
          // Send UI schema silently via data channel
          if (formattedProfiles.length > 0) {
            try {
              const room = getJobContext().room;
              const uiSchema = {
                type: 'profile_card_group',
                data: formattedProfiles
              };
              
              const encoder = new TextEncoder();
              const data = JSON.stringify({
                type: 'ui_schema',
                schema: uiSchema
              });
              
              await room.localParticipant.publishData(
                encoder.encode(data),
                { reliable: true }
              );
            } catch (dataError) {
              console.error('Error sending UI schema:', dataError);
              // Don't fail the tool if data sending fails
            }
          }
          
          // Return ONLY what should be spoken
          const summary = connections.length === 0 
            ? 'No connections found matching those criteria.'
            : `I found ${connections.length} connection${connections.length > 1 ? 's' : ''} for you.`;
          
          return { summary };
        } catch (error) {
          return { error: 'Filter failed', message: error.message };
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

When users ask about connections or people:
1. Choose the right tool:
   - searchConnections: for TEXT queries (names, companies, topics, keywords)
   - filterConnections: for TIME-BASED or STRUCTURED queries (recent, by date range, by event, by location, by tag, by interaction count)
   - getPersonDetails: for specific person lookup
   - getPendingActions: for tasks and follow-ups
2. The tool will automatically display visual profile cards in the UI
3. Say ONLY the summary returned by the tool
4. Be brief and natural - the visual cards show all details

Examples:
User: "Who have I met recently?"
→ Use filterConnections with metWithinDays: 7
Tool returns: { summary: "I found 4 connections for you." }
You say: "I found 4 connections for you."

User: "Connections from the last 2 weeks"
→ Use filterConnections with metWithinDays: 14

User: "Find Sarah"
→ Use searchConnections with query: "Sarah"

User: "People from NexHacks"
→ Use filterConnections with eventName: "NexHacks"

User: "Who works at Google?"
→ Use searchConnections with query: "Google"

User: "People I talked to this month"
→ Use filterConnections with interactedWithinDays: 30

User: "Connections I haven't talked to in 60 days"
→ Use filterConnections with notInteractedInDays: 60

User: "Tell me about Sarah"
→ Use getPersonDetails with name: "Sarah"
Tool returns: { summary: "Here's Sarah's profile." }
You say: "Here's Sarah's profile."

The UI automatically displays profile cards. Your job is to introduce them briefly.

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

