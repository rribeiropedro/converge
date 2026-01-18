# Insights System - Complete Breakdown & Customization Guide

## 📊 **What Are Insights?**

Insights are **real-time bullet points** displayed in the mobile overlay that provide actionable intelligence about the person you're talking to. They're extracted from two sources:

1. **Audio Stream** (Continuous) - From conversation transcripts
2. **Face Recognition** (One-time) - From visual matching

---

## 🎯 **Current Insight Types**

### **1. Audio-Based Insights** (Continuous Updates)

These are extracted from conversation transcripts using **Claude Sonnet 4.5** via OpenRouter API.

#### **A. Profile Information**
**Source:** `session.audio.profile` (SessionManager)
**Extraction:** LLM analyzes transcript (transcriptParser.js)

| Field | Format | Example | Confidence |
|-------|--------|---------|------------|
| **Name** | `Name mentioned: {value}` | `Name mentioned: John` | high/medium/low |
| **Company** | `Company: {value}` | `Company: Acme Corp` | high/medium/low |
| **Role** | `Role: {value}` | `Role: VP of Engineering` | high/medium/low |

**Current Limits:** All 3 shown if available (no limit)

#### **B. Topics Discussed**
**Source:** `session.audio.topics_discussed` (Array of strings)
**Format:** `Topic: {topic}`
**Example:** `Topic: AI partnerships`
**Current Limit:** Latest 3 topics

#### **C. Personal Details**
**Source:** `session.audio.personal_details` (Array of strings)
**Format:** Raw text (no prefix)
**Examples:**
- `Has two kids in college`
- `Loves hiking in Colorado`
- `Planning trip to Japan next month`

**Current Limit:** Latest 3 details

#### **D. Challenges**
**Source:** `session.audio.their_challenges` (Array of strings)
**Format:** `Challenge: {challenge}`
**Examples:**
- `Challenge: Finding technical talent`
- `Challenge: Scaling operations globally`

**Current Limit:** Latest 2 challenges

#### **E. Follow-Up Hooks** (Currently NOT shown in overlay)
**Source:** `session.audio.follow_up_hooks` (Array of objects)
**Format:** `{ type: string, detail: string }`
**Examples:**
```javascript
{ type: 'resource_share', detail: 'Send whitepaper on AI' }
{ type: 'intro_request', detail: 'Intro to VP of Sales at BigCo' }
{ type: 'meeting', detail: 'Schedule demo for next week' }
```

**Current Status:** ❌ Not displayed in overlay (but stored in session)

---

### **2. Face Match Insights** (One-Time Update)

These are generated after face recognition completes.

#### **A. Matched Connection**
When a face match is found in the database:

| Insight | Example |
|---------|---------|
| **Name** | `Name: John Doe` |
| **Company** | `Company: Acme Corp` |
| **Confidence** | `Match confidence: 87%` |
| **Status** | `Previous connection found` |

**Plus:** Profile image is displayed (circular, 80px)

#### **B. New Contact**
When no match is found:

| Insight | Example |
|---------|---------|
| **Detection** | `New person detected` |
| **Status** | `No previous connection found` |
| **Context** | `Professional networking context` |
| **Action** | `Ready to save new connection` |

---

## 🔧 **How Insights Are Generated**

### **Audio Insight Pipeline:**

```
1. User speaks → MediaRecorder captures audio
2. Audio sent to backend → Deepgram transcribes
3. Transcript accumulated in SessionManager
4. On each transcript update, insights are built:
   ↓
   sessionSocket.js:121-181
   ↓
   Reads from: session.audio.profile
               session.audio.topics_discussed  
               session.audio.personal_details
               session.audio.their_challenges
   ↓
   Formats into insights array
   ↓
   Emits: session:audio_update with insights
   ↓
5. Frontend receives & displays in overlay
```

### **LLM Extraction (Periodic):**

**Note:** Currently, LLM extraction happens only at **session end**, not in real-time.

```
Session End → Full transcript sent to transcriptParser.js
            → Claude Sonnet 4.5 extracts structured data
            → Updates session with parsed fields
            → Saves to MongoDB
```

**⚠️ Gap:** Real-time audio insights depend on SessionManager data being updated during the session, but LLM parsing only happens at the end. This means profile/topics/challenges won't be extracted in real-time unless you add periodic parsing.

---

## 🎨 **Customization Options**

### **Option 1: Change Number of Insights Shown**

**File:** `backend/src/realtime/sessionSocket.js:150-171`

```javascript
// Current limits:
const recentTopics = session.audio.topics_discussed.slice(-3);      // Latest 3
const recentDetails = session.audio.personal_details.slice(-3);      // Latest 3
const recentChallenges = session.audio.their_challenges.slice(-2);  // Latest 2

// To show more:
const recentTopics = session.audio.topics_discussed.slice(-5);      // Latest 5
const recentDetails = session.audio.personal_details.slice(-5);      // Latest 5
const recentChallenges = session.audio.their_challenges.slice(-4);  // Latest 4

// To show ALL (no limit):
const recentTopics = session.audio.topics_discussed;                 // All topics
const recentDetails = session.audio.personal_details;                // All details
const recentChallenges = session.audio.their_challenges;             // All challenges
```

---

### **Option 2: Add Follow-Up Hooks to Overlay**

**File:** `backend/src/realtime/sessionSocket.js:172` (add after challenges)

```javascript
// Add follow-up hooks (latest 2)
if (session.audio.follow_up_hooks.length > 0) {
  const recentHooks = session.audio.follow_up_hooks.slice(-2);
  recentHooks.forEach(hook => {
    const icon = {
      'resource_share': '📄',
      'intro_request': '🤝',
      'meeting': '📅',
      'other': '🔖'
    }[hook.type] || '•';
    insights.push({ 
      type: 'bullet', 
      text: `${icon} ${hook.detail}` 
    });
  });
}
```

---

### **Option 3: Change Insight Formatting**

**File:** `backend/src/realtime/sessionSocket.js:128-171`

#### **Add Emojis:**
```javascript
// Before:
insights.push({ type: 'bullet', text: `Name mentioned: ${value}` });

// After:
insights.push({ type: 'bullet', text: `👤 ${value}` });
insights.push({ type: 'bullet', text: `🏢 ${company}` });
insights.push({ type: 'bullet', text: `💼 ${role}` });
insights.push({ type: 'bullet', text: `💬 ${topic}` });
insights.push({ type: 'bullet', text: `⚠️ ${challenge}` });
```

#### **Remove Prefixes:**
```javascript
// Before:
insights.push({ type: 'bullet', text: `Topic: ${topic}` });

// After:
insights.push({ type: 'bullet', text: topic });  // Just the topic text
```

#### **Add Confidence Indicators:**
```javascript
// Show confidence visually
const confidenceIcon = {
  'high': '✓✓✓',
  'medium': '✓✓',
  'low': '✓'
}[confidence];

insights.push({ 
  type: 'bullet', 
  text: `Name: ${value} ${confidenceIcon}` 
});
```

---

### **Option 4: Prioritize/Order Insights**

**File:** `backend/src/realtime/sessionSocket.js:124-173`

**Current Order:**
1. Profile (name, company, role)
2. Topics (latest 3)
3. Personal details (latest 3)
4. Challenges (latest 2)

**Change to prioritize challenges:**
```javascript
const insights = [];

// 1. Challenges FIRST (most actionable)
if (session.audio.their_challenges.length > 0) {
  const recentChallenges = session.audio.their_challenges.slice(-2);
  recentChallenges.forEach(challenge => {
    insights.push({ type: 'bullet', text: `⚠️ Challenge: ${challenge}` });
  });
}

// 2. Profile info
if (session.audio.profile.name?.value) {
  insights.push({ type: 'bullet', text: `Name: ${session.audio.profile.name.value}` });
}

// 3. Topics
// 4. Personal details
```

---

### **Option 5: Add Real-Time LLM Parsing**

**Problem:** Currently, LLM extraction only happens at session end.

**Solution:** Parse transcript periodically during the session.

**File:** `backend/src/realtime/sessionSocket.js` (add new function)

```javascript
// Add periodic parsing (every 30 seconds with 3+ final transcripts)
let lastParseTime = 0;
const PARSE_INTERVAL_MS = 30 * 1000; // 30 seconds

deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
  // ... existing code ...
  
  // Periodic LLM parsing for real-time insights
  const now = Date.now();
  const finalTranscripts = session.audio.transcript_chunks.filter(c => c.is_final);
  
  if (now - lastParseTime > PARSE_INTERVAL_MS && finalTranscripts.length >= 3) {
    lastParseTime = now;
    
    // Parse accumulated transcript in background
    const fullTranscript = finalTranscripts.map(c => c.transcript).join(' ');
    
    parseTranscript(fullTranscript)
      .then(parsed => {
        // Update session with LLM-extracted data
        SessionManager.updateAudio(currentSessionId, parsed);
        console.log('[SessionSocket] Real-time LLM parse complete');
      })
      .catch(err => {
        console.warn('[SessionSocket] Real-time parsing failed:', err.message);
      });
  }
});
```

**Note:** This will make real-time insights much more accurate but adds LLM API cost.

---

### **Option 6: Add Visual Insights to Overlay**

**File:** `backend/src/realtime/sessionSocket.js:211-218`

**Current:** Visual updates go to results log, not overlay

**Change to send visual insights:**

```javascript
// In session:visual event handler
socket.emit('session:visual_update', {
  visual: {
    face_embedding: session.visual.face_embedding.length > 0,
    appearance: session.visual.appearance.description,
    environment: session.visual.environment.description
  },
  message: 'Visual intel locked',
  insights: [  // ← ADD THIS
    { type: 'bullet', text: `Appearance: ${session.visual.appearance.description}` },
    { type: 'bullet', text: `Environment: ${session.visual.environment.description}` }
  ]
});
```

**Then update frontend** (`CameraRecorder.jsx:277-284`):
```javascript
sessionSocket.on('session:visual_update', (data) => {
  // ... existing result log code ...
  
  // Add visual insights to overlay
  if (data.insights && data.insights.length > 0) {
    setInsightsData(prev => ({
      items: [...prev.items, ...data.insights]
    }));
    setShowInsightsOverlay(true);
  }
});
```

---

### **Option 7: Filter by Confidence**

**File:** `backend/src/realtime/sessionSocket.js:128-147`

**Show only high-confidence insights:**

```javascript
// Only show profile info with high confidence
if (session.audio.profile.name?.value && session.audio.profile.name.confidence === 'high') {
  insights.push({
    type: 'bullet',
    text: `Name: ${session.audio.profile.name.value}`
  });
}
```

---

### **Option 8: Add Timestamp or Source Tags**

```javascript
// Add when insight was captured
insights.push({ 
  type: 'bullet', 
  text: `Topic: ${topic}`,
  timestamp: new Date().toISOString(),
  source: 'audio'  // or 'face_match', 'visual'
});
```

**Then in frontend CSS** (`CameraRecorder.css`), add timestamp display.

---

### **Option 9: Deduplicate Similar Insights**

**File:** `backend/src/realtime/sessionSocket.js:124`

```javascript
// Smart deduplication (normalize and compare)
function addInsightIfUnique(insights, newInsight) {
  const normalized = newInsight.text.toLowerCase().trim();
  const exists = insights.some(existing => 
    existing.text.toLowerCase().trim().includes(normalized) ||
    normalized.includes(existing.text.toLowerCase().trim())
  );
  
  if (!exists) {
    insights.push(newInsight);
  }
}

// Use it:
addInsightIfUnique(insights, { type: 'bullet', text: `Name: ${name}` });
```

---

### **Option 10: Add Context/Event Information**

```javascript
// Add event context to insights
if (session.context.event?.name) {
  insights.unshift({ 
    type: 'bullet', 
    text: `📍 ${session.context.event.name}` 
  });
}
```

---

## 📝 **LLM Prompt Customization**

**File:** `backend/src/services/transcriptParser.js:29-61`

### **Current Extraction Categories:**
1. Name, company, role
2. Topics discussed
3. Challenges/problems
4. Follow-up hooks
5. Personal details
6. Transcript summary

### **Add New Categories:**

```javascript
const EXTRACTION_PROMPT = `You are an AI assistant that extracts structured profile data from conversation transcripts.

Analyze the following conversation transcript and extract:
1. The person's name (if mentioned)
2. Their company/organization (if mentioned)
3. Their role/job title (if mentioned)
4. Topics discussed during the conversation
5. Challenges or problems they mentioned
6. Follow-up hooks (things to follow up on)
7. Personal details (hobbies, pets, travel plans, etc.)
8. **THEIR GOALS/OBJECTIVES** ← NEW
9. **PAIN POINTS** ← NEW
10. **BUDGET/TIMELINE MENTIONED** ← NEW
11. **DECISION-MAKING AUTHORITY** ← NEW

...

Return ONLY valid JSON in this exact format:
{
  "profile": { ... },
  "topics_discussed": [...],
  "their_challenges": [...],
  "follow_up_hooks": [...],
  "personal_details": [...],
  "their_goals": [...],  ← NEW
  "pain_points": [...],  ← NEW
  "budget_timeline": { "budget": "...", "timeline": "..." },  ← NEW
  "decision_authority": "high|medium|low",  ← NEW
  "transcript_summary": "..."
}`;
```

**Then update:**
1. `schemaValidator.js` - Add Zod schema fields
2. `SessionManager.js` - Add to audio object structure
3. `sessionSocket.js` - Add to insights builder

---

## 🎛️ **Quick Customization Checklist**

| What You Want | File to Edit | Difficulty |
|---------------|--------------|------------|
| Change number of insights shown | `sessionSocket.js:150-171` | ⭐ Easy |
| Add follow-up hooks to overlay | `sessionSocket.js:172` | ⭐ Easy |
| Change insight text/emojis | `sessionSocket.js:128-171` | ⭐ Easy |
| Reorder insight priority | `sessionSocket.js:124-173` | ⭐ Easy |
| Filter by confidence | `sessionSocket.js:128-147` | ⭐⭐ Medium |
| Add visual insights | `sessionSocket.js:211` + frontend | ⭐⭐ Medium |
| Add real-time LLM parsing | `sessionSocket.js` (new function) | ⭐⭐⭐ Hard |
| Add new extraction categories | `transcriptParser.js:29-61` | ⭐⭐⭐ Hard |
| Change LLM model | `transcriptParser.js:14` | ⭐ Easy |
| Add timestamps/source tags | `sessionSocket.js:125` | ⭐⭐ Medium |

---

## 🚀 **Recommended Improvements**

### **Priority 1: Add Real-Time LLM Parsing** ⭐⭐⭐
Currently, insights won't populate in real-time because LLM parsing only happens at session end.

### **Priority 2: Add Follow-Up Hooks** ⭐
These are valuable but not currently displayed.

### **Priority 3: Add Visual Insights** ⭐⭐
Show appearance/environment in overlay alongside audio insights.

### **Priority 4: Improve Deduplication** ⭐⭐
Prevent redundant insights from showing multiple times.

---

Would you like me to implement any of these customizations?

