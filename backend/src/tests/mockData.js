export const mockTranscript = `
[Speaker 1 - User]: Hey, nice to meet you! I'm at the NexHacks booth. What brings you here today?

[Speaker 2 - Contact]: Hi! Great to meet you too. I'm Sarah Chen, I work at Stripe as a Senior Product Manager. I'm really interested in what you guys are building with AI networking.

[Speaker 1 - User]: Oh awesome! Stripe is doing some cool stuff. What's your focus area there?

[Speaker 2 - Contact]: I'm working on our developer experience team - specifically on API documentation and SDK tooling. We're actually exploring using AI to help developers onboard faster. That's why your product caught my eye.

[Speaker 1 - User]: That's really interesting! We should definitely connect on that. What challenges are you running into?

[Speaker 2 - Contact]: The main thing is context - developers have different skill levels and use cases, so a one-size-fits-all approach doesn't work. We need something more personalized. Also, I have a golden retriever named Max who I need to get back to tonight, he's probably wondering where I am!

[Speaker 1 - User]: Ha! Dogs are the best. I'd love to share some of our research on contextual AI. Can I send you our latest whitepaper?

[Speaker 2 - Contact]: Absolutely! Here's my card. Also, do you know anyone at OpenAI? We're looking to partner with them on some inference optimization.

[Speaker 1 - User]: Actually I do - I can intro you to my friend Jake who's on their platform team.

[Speaker 2 - Contact]: That would be amazing! Let's grab coffee next week to discuss further.
`;

export const mockVisualData = {
  face_embedding: new Array(128).fill(0).map(() => Math.random() * 2 - 1),
  raw_appearance: "Woman in mid-30s, black blazer over white blouse, silver necklace, short dark hair",
  raw_environment: "Conference booth area, NexHacks banner visible, coffee station nearby, standing near demo table",
  headshot: {
    url: "https://storage.nexhacks.io/headshots/abc123.jpg",
    base64: null
  }
};

export const mockContext = {
  event: {
    name: "NexHacks 2026",
    type: "hackathon"
  },
  location: {
    name: "Moscone Center",
    city: "San Francisco"
  }
};

export const mockParsedAudioData = {
  profile: {
    name: { value: "Sarah Chen", confidence: "high" },
    company: { value: "Stripe", confidence: "high" },
    role: { value: "Senior Product Manager", confidence: "high" }
  },
  topics_discussed: [
    "AI networking",
    "Developer experience",
    "API documentation",
    "SDK tooling",
    "AI onboarding",
    "Contextual personalization"
  ],
  their_challenges: [
    "One-size-fits-all approach doesn't work for different developer skill levels",
    "Need more personalized onboarding experience"
  ],
  follow_up_hooks: [
    { type: "resource_share", detail: "Send whitepaper on contextual AI research" },
    { type: "intro_request", detail: "Intro to Jake at OpenAI platform team for inference optimization partnership" },
    { type: "meeting", detail: "Coffee next week to discuss further" }
  ],
  personal_details: [
    "Has a golden retriever named Max"
  ],
  transcript_summary: "Met Sarah Chen, Senior PM at Stripe working on developer experience. She's exploring AI for developer onboarding and interested in our contextual AI approach. Agreed to share whitepaper, intro to OpenAI contact, and meet for coffee next week."
};

export const mockParsedVisualData = {
  face_embedding: new Array(512).fill(0).map(() => Math.random() * 2 - 1),
  appearance: {
    description: "Professional woman in her mid-30s wearing a black blazer over a white blouse with a silver necklace. Has short, dark hair styled neatly.",
    distinctive_features: ["black blazer", "silver necklace", "short dark hair"]
  },
  environment: {
    description: "NexHacks conference booth area with branded banners visible. Standing near a demo table with a coffee station in the background.",
    landmarks: ["NexHacks banner", "demo table", "coffee station"]
  },
  headshot: {
    url: "https://storage.nexhacks.io/headshots/abc123.jpg",
    base64: null
  }
};
