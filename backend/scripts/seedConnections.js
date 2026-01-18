import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import actual models
import Connection from '../src/models/Connection.js';
import Interaction from '../src/models/Interaction.js';

const USER_ID = '696c8f5dd5e970684e62c5fe';
const COUNT = 12;

// Realistic conversation snippets that would be transcribed
const conversationTemplates = [
  {
    name: 'Sarah Chen',
    company: 'Anthropic',
    role: 'Senior ML Engineer',
    transcript: `Hey, nice to meet you! I'm Sarah, I work at Anthropic on the safety team. Yeah, we're doing some really interesting work on constitutional AI. Before this I was at DeepMind for about three years. The biggest challenge right now is scaling our evals - we need better ways to test model behavior at scale. Oh, you should definitely check out our recent paper on sleeper agents, I can send you the link. I'm actually looking to hire a few more researchers, so if you know anyone...`,
    topics: ['constitutional AI', 'AI safety', 'model evaluation', 'scaling evals'],
    challenges: ['Scaling evaluation frameworks for large language models', 'Finding researchers with both ML and safety expertise'],
    followUps: [{ type: 'resource_share', detail: 'Send link to sleeper agents paper' }, { type: 'intro_request', detail: 'Connect with ML researchers for hiring' }],
    personal: ['Previously worked at DeepMind for 3 years'],
    summary: 'Met Sarah from Anthropic who works on AI safety. She mentioned challenges with scaling evals and is actively hiring researchers.',
  },
  {
    name: 'Marcus Rodriguez',
    company: 'Stripe',
    role: 'Engineering Manager',
    transcript: `Marcus here, I run the payments infrastructure team at Stripe. We're currently rebuilding our entire async processing pipeline - moving from a monolith to event-driven microservices. It's a massive undertaking, probably our biggest project this year. I saw your talk on distributed systems earlier, really liked the point about eventual consistency. We should grab coffee sometime and chat more about how you handled the migration at your company.`,
    topics: ['payments infrastructure', 'microservices migration', 'event-driven architecture', 'distributed systems'],
    challenges: ['Migrating monolithic payments system to microservices', 'Maintaining consistency during distributed transactions'],
    followUps: [{ type: 'meeting', detail: 'Coffee chat to discuss distributed systems migration strategies' }],
    personal: ['Interested in distributed systems talks'],
    summary: 'Marcus leads payments infrastructure at Stripe. Currently working on a major microservices migration and interested in discussing distributed systems patterns.',
  },
  {
    name: 'Emily Watson',
    company: 'Figma',
    role: 'Product Designer',
    transcript: `I'm Emily, I'm a product designer at Figma working on the Dev Mode features. Super excited about bridging the gap between design and development. Before Figma I was at Airbnb for a couple years. My partner and I just got a golden retriever, his name is Pixel, he's the cutest! Anyway, we're always looking for feedback from developers on how to make the handoff process smoother. Would love to set up a user research session with you if you're interested.`,
    topics: ['design systems', 'developer experience', 'design-to-code handoff', 'Dev Mode'],
    challenges: ['Improving design-to-development handoff workflow'],
    followUps: [{ type: 'meeting', detail: 'Schedule user research session for Dev Mode feedback' }],
    personal: ['Has a golden retriever named Pixel', 'Previously worked at Airbnb'],
    summary: 'Emily is a product designer at Figma working on Dev Mode. Looking for developer feedback on design handoff tools.',
  },
  {
    name: 'James Park',
    company: 'OpenAI',
    role: 'Research Scientist',
    transcript: `James, research scientist at OpenAI. I focus on reasoning and chain-of-thought prompting. Actually just published a paper on that last month. The hardest part of my job is figuring out what capabilities emerge at scale versus what we need to explicitly train for. I run marathons on the side - just did the Chicago marathon last month. Hey, I noticed you're working on agents - we should compare notes on tool use and planning.`,
    topics: ['chain-of-thought prompting', 'emergent capabilities', 'AI reasoning', 'tool use in agents'],
    challenges: ['Predicting emergent capabilities in large models', 'Understanding reasoning limitations'],
    followUps: [{ type: 'resource_share', detail: 'Share recent paper on chain-of-thought prompting' }, { type: 'meeting', detail: 'Compare notes on agent architectures and tool use' }],
    personal: ['Runs marathons', 'Completed Chicago marathon recently'],
    summary: 'James researches reasoning at OpenAI. Published work on chain-of-thought prompting and interested in comparing notes on AI agents.',
  },
  {
    name: 'Priya Sharma',
    company: 'Databricks',
    role: 'Solutions Architect',
    transcript: `Hi! Priya from Databricks, I'm a solutions architect working with enterprise customers. Most of my day is helping companies set up their lakehouse architecture. The trickiest part is always the data governance piece - everyone wants to use AI but nobody has clean data pipelines yet. I'm actually giving a talk tomorrow on MLOps best practices if you want to check it out. Also really into pottery on weekends, just started taking classes.`,
    topics: ['lakehouse architecture', 'data governance', 'MLOps', 'enterprise data pipelines'],
    challenges: ['Helping enterprises establish proper data governance', 'Building reliable data pipelines for AI/ML workloads'],
    followUps: [{ type: 'other', detail: 'Attend her MLOps talk tomorrow' }],
    personal: ['Takes pottery classes on weekends'],
    summary: 'Priya is a solutions architect at Databricks focused on enterprise lakehouse implementations. Speaking tomorrow on MLOps.',
  },
  {
    name: 'Alex Turner',
    company: 'Vercel',
    role: 'Developer Advocate',
    transcript: `Alex Turner, dev advocate at Vercel. I basically get paid to help developers build faster websites, pretty cool gig! Been focusing a lot on the App Router and React Server Components lately. The community has had some pushback on the complexity but I think once it clicks, it really clicks. Used to be a frontend engineer at Netflix. Would love to feature your project in our next showcase if you're interested!`,
    topics: ['Next.js App Router', 'React Server Components', 'frontend performance', 'developer experience'],
    challenges: ['Helping developers understand React Server Components mental model'],
    followUps: [{ type: 'other', detail: 'Potentially feature project in Vercel showcase' }],
    personal: ['Previously frontend engineer at Netflix'],
    summary: 'Alex is a developer advocate at Vercel focusing on Next.js and RSC adoption. Interested in featuring projects in Vercel showcase.',
  },
  {
    name: 'Nina Kowalski',
    company: 'Notion',
    role: 'Staff Engineer',
    transcript: `I'm Nina, staff engineer at Notion. I work on the real-time collaboration engine - making sure when you and your team edit the same page, everything syncs correctly. CRDTs are my life now! The fun challenge is handling offline mode gracefully. I heard you're building a CRM tool - you might run into similar sync issues. Happy to chat more about our architecture if that's helpful. Also, random fact, I collect vintage typewriters.`,
    topics: ['real-time collaboration', 'CRDTs', 'offline-first architecture', 'distributed sync'],
    challenges: ['Handling offline mode and conflict resolution in collaborative editing'],
    followUps: [{ type: 'meeting', detail: 'Discuss CRDT architecture for real-time sync' }],
    personal: ['Collects vintage typewriters'],
    summary: 'Nina is a staff engineer at Notion working on real-time collaboration. Expert in CRDTs and offline-first architecture.',
  },
  {
    name: 'David Kim',
    company: 'Supabase',
    role: 'Founding Engineer',
    transcript: `David here, one of the founding engineers at Supabase. I lead our auth and edge functions teams. We're trying to make Postgres cool again! The open source community has been amazing - we just hit 50k GitHub stars. Always looking for contributors if you want to get involved. I actually went to school for music before pivoting to tech, played cello professionally for a few years. Small world - I think we have mutual friends from the YC batch.`,
    topics: ['PostgreSQL', 'edge functions', 'open source', 'authentication', 'serverless'],
    challenges: ['Scaling open source community contributions', 'Making Postgres accessible to frontend developers'],
    followUps: [{ type: 'intro_request', detail: 'Connect through mutual YC friends' }, { type: 'other', detail: 'Explore contributing to Supabase' }],
    personal: ['Former professional cellist', 'Studied music before tech'],
    summary: 'David is a founding engineer at Supabase leading auth and edge functions. Looking for open source contributors.',
  },
  {
    name: 'Rachel Foster',
    company: 'Linear',
    role: 'Head of Design',
    transcript: `Rachel, I lead design at Linear. We're obsessed with speed and keyboard shortcuts - everything needs to feel instant. Before Linear I was at Superhuman, so you can see a pattern. The hard part is maintaining that performance bar as we add more features. We're launching a new roadmap feature next month, still iterating on the UX. Would love your feedback if you want early access. I surf most weekends down in Santa Cruz.`,
    topics: ['performance-first design', 'keyboard-driven UX', 'product roadmaps', 'design systems'],
    challenges: ['Maintaining UI performance while adding features', 'Designing intuitive keyboard shortcuts'],
    followUps: [{ type: 'other', detail: 'Get early access to new roadmap feature for feedback' }],
    personal: ['Surfs in Santa Cruz on weekends', 'Previously at Superhuman'],
    summary: 'Rachel leads design at Linear with a focus on performance. Offering early access to new roadmap feature for feedback.',
  },
  {
    name: 'Tom Anderson',
    company: 'Replit',
    role: 'CTO',
    transcript: `I'm Tom, CTO at Replit. We're building the future of coding in the browser - making it so anyone can go from idea to deployed app in minutes. The AI code completion stuff has been wild, completely changed how people learn to code. Biggest challenge is keeping the IDE fast when you're running everything in the cloud. I actually started coding when I was 12 on a TI-83 calculator. If you're interested in the AI-assisted development space, we should definitely stay in touch.`,
    topics: ['cloud IDEs', 'AI code completion', 'developer tools', 'coding education'],
    challenges: ['Maintaining IDE performance in cloud environment', 'Balancing AI assistance with learning'],
    followUps: [{ type: 'meeting', detail: 'Stay in touch about AI-assisted development trends' }],
    personal: ['Started coding at age 12 on TI-83 calculator'],
    summary: 'Tom is CTO at Replit building cloud-based development tools. Very focused on AI-assisted coding and would like to stay connected.',
  },
  {
    name: 'Lisa Chang',
    company: 'Scale AI',
    role: 'VP of Engineering',
    transcript: `Lisa Chang, VP of Engineering at Scale AI. We do data labeling and AI infrastructure. The LLM fine-tuning demand has been insane this year - everyone wants custom models. Our biggest technical challenge is quality control at scale - when you have thousands of labelers, consistency is everything. I'm looking for senior engineers who can help build our automated QA systems. Do you know anyone who might be a good fit? Also I'm learning to play golf, terribly, but it's fun.`,
    topics: ['data labeling', 'LLM fine-tuning', 'quality assurance', 'AI infrastructure'],
    challenges: ['Maintaining labeling quality at massive scale', 'Building automated QA for ML datasets'],
    followUps: [{ type: 'intro_request', detail: 'Connect with senior engineers for automated QA systems roles' }],
    personal: ['Learning to play golf'],
    summary: 'Lisa is VP of Engineering at Scale AI. Hiring senior engineers for automated QA systems and dealing with massive scale challenges.',
  },
  {
    name: 'Michael Chen',
    company: 'Pinecone',
    role: 'Developer Relations Lead',
    transcript: `Hey! Michael from Pinecone, I run developer relations. Vector databases have gotten so hot this year with all the RAG applications. My job is basically helping developers understand when they need a vector DB versus when they don't - not every AI app needs embeddings! Before this I was doing DevRel at MongoDB. We should do a joint webinar sometime, your CRM use case would be perfect for showing practical RAG patterns. I'm also a huge board game nerd, have like 200 games at home.`,
    topics: ['vector databases', 'RAG architecture', 'embeddings', 'developer education'],
    challenges: ['Educating developers on when vector DBs are appropriate'],
    followUps: [{ type: 'meeting', detail: 'Collaborate on joint webinar about RAG patterns' }, { type: 'resource_share', detail: 'Share Pinecone best practices documentation' }],
    personal: ['Board game enthusiast with 200+ games', 'Previously at MongoDB DevRel'],
    summary: 'Michael leads DevRel at Pinecone. Interested in collaborating on RAG-focused content and webinars.',
  },
];

// Visual descriptions matching visualParser output format
const visualTemplates = [
  { description: 'Wearing a navy blue Patagonia quarter-zip over a white t-shirt. Has short black hair and rectangular glasses.', features: ['rectangular glasses', 'short black hair', 'Patagonia quarter-zip'] },
  { description: 'Dressed in a grey blazer with a black turtleneck underneath. Has curly brown hair and a warm smile.', features: ['grey blazer', 'curly brown hair', 'black turtleneck'] },
  { description: 'Casual look with a green flannel shirt and jeans. Has a beard and wears a smartwatch.', features: ['beard', 'green flannel', 'smartwatch'] },
  { description: 'Professional attire with a light blue button-down shirt. Has straight blonde hair pulled back.', features: ['blonde hair', 'blue button-down'] },
  { description: 'Wearing a Figma branded hoodie and has colorful earrings. Short pixie haircut.', features: ['Figma hoodie', 'colorful earrings', 'pixie cut'] },
  { description: 'Simple black t-shirt with the Vercel triangle logo. Has tattoo sleeve visible on left arm.', features: ['Vercel logo shirt', 'tattoo sleeve'] },
  { description: 'Cream colored sweater with delicate gold necklace. Has long dark hair with subtle highlights.', features: ['cream sweater', 'gold necklace', 'highlighted hair'] },
  { description: 'Wearing a vintage band t-shirt under an open denim jacket. Has a nose ring and messy hair.', features: ['denim jacket', 'nose ring', 'band t-shirt'] },
  { description: 'Minimalist style with an all-black outfit. Has silver hoop earrings and a clean fade haircut.', features: ['all-black outfit', 'silver hoops', 'fade haircut'] },
  { description: 'Bright orange puffer jacket that stands out. Has round wire-frame glasses and a friendly demeanor.', features: ['orange puffer jacket', 'wire-frame glasses'] },
  { description: 'Business casual with a maroon polo shirt. Clean-shaven with a subtle tan.', features: ['maroon polo', 'clean-shaven'] },
  { description: 'Layered look with a grey cardigan over a graphic tee. Has a distinctive silver watch.', features: ['grey cardigan', 'silver watch', 'graphic tee'] },
];

const environments = [
  { description: 'Standing near the main stage during the keynote break. Conference banners visible in background.', landmarks: ['main stage', 'conference banners'] },
  { description: 'At a high-top table in the networking area with coffee cups around.', landmarks: ['networking area', 'high-top tables'] },
  { description: 'By the sponsor booth area, near the Anthropic booth specifically.', landmarks: ['sponsor booths', 'Anthropic booth'] },
  { description: 'Outside on the terrace with city skyline visible behind.', landmarks: ['terrace', 'city skyline'] },
  { description: 'In the hallway near the registration desk between sessions.', landmarks: ['registration desk', 'conference hallway'] },
  { description: 'At the coffee station during the afternoon break.', landmarks: ['coffee station'] },
  { description: 'Near the demo pods in the startup showcase area.', landmarks: ['demo pods', 'startup showcase'] },
  { description: 'By the large windows in the main convention hall.', landmarks: ['convention hall', 'large windows'] },
];

const events = [
  { name: 'TechCrunch Disrupt 2025', type: 'conference' },
  { name: 'AI Summit San Francisco', type: 'conference' },
  { name: 'NexHacks 2026', type: 'hackathon' },
  { name: 'React Conf 2025', type: 'conference' },
  { name: 'SF Tech Meetup', type: 'meetup' },
  { name: 'YC Demo Day W26', type: 'conference' },
  { name: 'Startup Grind Global', type: 'conference' },
];

const locations = [
  { name: 'Moscone Center', city: 'San Francisco' },
  { name: 'Fort Mason Center', city: 'San Francisco' },
  { name: 'Computer History Museum', city: 'Mountain View' },
  { name: 'Stanford Faculty Club', city: 'Palo Alto' },
  { name: 'WeWork Labs', city: 'San Francisco' },
];

// Helpers
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomConfidence = () => pick(['high', 'high', 'high', 'medium', 'low']);
const randomDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
};

async function fetchRandomUsers(count) {
  const url = `https://randomuser.me/api/?results=${count}&nat=us,gb,ca`;
  const response = await fetch(url);
  const data = await response.json();
  return data.results;
}

async function seedConnections() {
  console.log('🌱 Seeding database with realistic LLM-style data...\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI environment variable is required');
    console.error('   Please set MONGODB_URI in your .env file');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  console.log('🔄 Fetching profile photos from randomuser.me...');
  const randomUsers = await fetchRandomUsers(COUNT);
  console.log(`✅ Got ${randomUsers.length} photos\n`);

  const connections = [];
  const interactions = [];

  for (let i = 0; i < COUNT; i++) {
    const template = conversationTemplates[i];
    const photo = randomUsers[i];
    const visual = visualTemplates[i];
    const env = pick(environments);
    const event = pick(events);
    const location = pick(locations);
    const firstMetDate = randomDate(120);
    const isDraft = i < 2; // First 2 are drafts needing review

    // Simulating what transcriptParser returns
    const audioData = {
      topics_discussed: template.topics,
      their_challenges: template.challenges,
      follow_up_hooks: template.followUps.map(f => ({
        type: f.type,
        detail: f.detail,
        completed: !isDraft && Math.random() < 0.3,
        completed_at: null,
      })),
      personal_details: template.personal,
      transcript_summary: template.summary,
    };

    // Simulating what visualParser returns
    const visualData = {
      face_embedding: [], // Would normally come from face-api.js
      appearance: {
        description: visual.description,
        distinctive_features: visual.features,
      },
      environment: {
        description: env.description,
        landmarks: env.landmarks,
      },
      headshot: {
        url: photo.picture.large,
      },
    };

    const connection = {
      user_id: new mongoose.Types.ObjectId(USER_ID),
      status: isDraft ? 'draft' : 'approved',
      name: {
        value: template.name,
        confidence: randomConfidence(),
        source: 'livekit',
      },
      company: {
        value: template.company,
        confidence: randomConfidence(),
        source: 'livekit',
      },
      role: {
        value: template.role,
        confidence: randomConfidence(),
        source: 'livekit',
      },
      visual: visualData,
      audio: audioData,
      context: {
        event: { name: event.name, type: event.type },
        location: { name: location.name, city: location.city },
        first_met: firstMetDate,
      },
      tags: [
        template.company.toLowerCase().replace(/\s+/g, '-'),
        template.role.toLowerCase().includes('engineer') ? 'engineer' :
          template.role.toLowerCase().includes('design') ? 'designer' : 'other',
        ...template.topics.slice(0, 2).map(t => t.split(' ')[0].toLowerCase()),
      ].slice(0, 4),
      industry: template.topics[0].includes('AI') ? 'AI/ML' :
                template.topics[0].includes('design') ? 'Design' :
                template.topics[0].includes('data') ? 'Data Infrastructure' : 'Developer Tools',
      needs_review: isDraft,
      fields_needing_review: isDraft ? ['company', 'role'] : [],
      interaction_count: isDraft ? 1 : 1 + Math.floor(Math.random() * 3),
      last_interaction: firstMetDate,
    };

    connections.push(connection);

    // Create first meeting interaction
    interactions.push({
      user_id: new mongoose.Types.ObjectId(USER_ID),
      connection_id: null, // Will be filled after insert
      _connectionIndex: i,
      type: 'first_meeting',
      timestamp: firstMetDate,
      duration_seconds: 180 + Math.floor(Math.random() * 420), // 3-10 minutes
      transcript_summary: template.transcript.substring(0, 200) + '...',
      topics_discussed: template.topics.slice(0, 2),
      context: {
        event: { name: event.name, type: event.type },
        location: { name: location.name, city: location.city },
      },
      visual_snapshot: {
        appearance_at_time: visual.description,
        environment_at_time: env.description,
      },
    });

    // Add follow-up interactions for approved connections
    if (!isDraft && Math.random() > 0.5) {
      const followUpDate = new Date(firstMetDate);
      followUpDate.setDate(followUpDate.getDate() + 7 + Math.floor(Math.random() * 21));

      if (followUpDate < new Date()) {
        interactions.push({
          user_id: new mongoose.Types.ObjectId(USER_ID),
          connection_id: null,
          _connectionIndex: i,
          type: pick(['follow_up', 'meeting', 'call']),
          timestamp: followUpDate,
          duration_seconds: 300 + Math.floor(Math.random() * 900),
          transcript_summary: `Followed up with ${template.name.split(' ')[0]} about ${template.topics[0]}. Good conversation, they shared some insights about ${template.challenges[0] || template.topics[1]}.`,
          topics_discussed: template.topics.slice(1, 3),
          context: {
            location: { name: pick(['Zoom call', 'Google Meet', 'Coffee at Blue Bottle', 'Phone call']), city: location.city },
          },
        });
      }
    }
  }

  console.log('💾 Inserting connections...');
  const insertedConnections = await Connection.insertMany(connections);
  console.log(`✅ Created ${insertedConnections.length} connections`);

  // Link interactions to connection IDs
  const interactionsWithIds = interactions.map(interaction => {
    const { _connectionIndex, ...rest } = interaction;
    return {
      ...rest,
      connection_id: insertedConnections[_connectionIndex]._id,
    };
  });

  console.log('💬 Inserting interactions...');
  const insertedInteractions = await Interaction.insertMany(interactionsWithIds);
  console.log(`✅ Created ${insertedInteractions.length} interactions`);

  // Summary
  const drafts = connections.filter(c => c.status === 'draft').length;
  console.log(`\n📋 Summary:`);
  console.log(`   • ${insertedConnections.length - drafts} approved connections`);
  console.log(`   • ${drafts} draft connections (need review)`);
  console.log(`   • ${insertedInteractions.length} total interactions\n`);

  console.log('👥 Connections created:');
  insertedConnections.forEach((c, i) => {
    const t = conversationTemplates[i];
    console.log(`   ${i + 1}. ${t.name} (${t.role} @ ${t.company}) ${connections[i].status === 'draft' ? '📝 DRAFT' : '✅'}`);
  });

  await mongoose.disconnect();
  console.log('\n✨ Done! Refresh your frontend to see the data.');
}

seedConnections().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
