# Socket Events Analysis - Overlay Data Issue

## 🔍 Current Socket Events Sent to Mobile

### From `sessionSocket.js`:
1. ✅ **session:ready** (line 171) - Status only
2. ✅ **session:audio_ready** (line 94) - Status signal
3. ✅ **session:visual_update** (line 211) - Visual data (NOT used for overlay)
4. ✅ **session:audio_update** (line 123) - Transcript data (NOT used for overlay)
5. ✅ **session:finalized** (line 326) - Final connection data
6. ❌ **session:error** - Error messages

### From `overshootController.js`:
7. ⚠️ **face_match_result** (line 425) - **ONLY EVENT THAT POPULATES OVERLAY**

---

## ⚠️ **PROBLEM IDENTIFIED**

### The Issue:
Only **ONE** socket event (`face_match_result`) populates the overlay with insights, and it only fires **ONCE** per session when:
1. Headshot is generated from screenshots
2. Face embedding is created
3. Face matching is performed against MongoDB

### Current Data Flow:
```
session:visual_update → Shows in results log, NOT in overlay
session:audio_update → Shows in results log, NOT in overlay
face_match_result → ONLY event that populates overlay ✓
```

### What the "Mock Data" Actually Is:
Lines 412-418 in `overshootController.js`:
```javascript
faceMatchResult = {
  matched: false,
  name: 'New Contact',  // ← This is NOT mock data, it's real "no match" data
  company: null,
  profileImage: null,
  insights: [
    { type: 'bullet', text: 'New person detected' },
    { type: 'bullet', text: 'No previous connection found' },
    { type: 'bullet', text: 'Professional networking context' },
    { type: 'bullet', text: 'Ready to save new connection' }
  ]
}
```

This is **legitimate data** for when no matching connection is found in the database.

---

## 🔧 **SOLUTION OPTIONS**

### Option 1: Send Real-Time Insights from Audio/Visual Updates
Modify the backend to emit enriched insights continuously:

**Changes needed:**
1. `sessionSocket.js` - Update `session:audio_update` to include AI-generated insights
2. `sessionSocket.js` - Update `session:visual_update` to include appearance insights
3. Frontend - Handle these events to update the overlay dynamically

**Example:**
```javascript
// In sessionSocket.js, session:audio event handler
socket.emit('session:audio_update', {
  transcript_chunk: transcript,
  is_final: data.is_final,
  speaker,
  accumulated_transcript: fullTranscript,
  insights: {  // ← ADD THIS
    topics: ['business', 'networking'],
    sentiment: 'positive',
    keyPoints: ['Mentioned working at Acme Corp', 'Looking for partnerships']
  }
});
```

### Option 2: Keep Current Design (Recommended)
The current design is actually correct:
- Overlay shows **face recognition results** (once per person detected)
- Live updates (audio/visual) show in **results log**
- This prevents overlay from constantly changing and distracting the user

### Option 3: Add a Second Overlay for Live Data
Create a separate overlay that shows real-time audio/visual insights while keeping the face match overlay static.

---

## 📊 Current Event → UI Mapping

| Backend Event | Frontend Handler | UI Component | Purpose |
|---------------|------------------|--------------|---------|
| `session:ready` | Line 267-276 | Results log | Session status |
| `session:visual_update` | Line 277-284 | Results log | Visual processing |
| `session:audio_update` | Line 286-304 | Results log | Live transcripts |
| **`face_match_result`** | **Line 306-323** | **Overlay** | **Face recognition** |
| `session:finalized` | Line 324-332 | Results log | Final save |
| `session:error` | Line 334-341 | Results log | Errors |

---

## 🎯 **ROOT CAUSE**

The overlay is **designed** to show face matching results, which only happens once per person detected. It's not "mock data" - it's real data showing either:
1. A matched connection from the database (with their info)
2. A new contact (no match found)

**The backend is working correctly.** The "problem" is that:
- User expects continuous overlay updates
- But design is for one-time face match result
- Audio/visual updates go to results log, not overlay

---

## ✅ **RECOMMENDATION**

If you want continuous overlay updates:

### Backend Changes:
1. Modify `session:audio_update` to include extracted insights
2. Modify `session:visual_update` to include appearance details
3. Add these insights to the socket emission payloads

### Frontend Changes:
1. Update handlers for `session:audio_update` and `session:visual_update`
2. Merge these insights with `insightsData` state
3. Show combined data in the overlay

Would you like me to implement continuous overlay updates from audio/visual streams?

