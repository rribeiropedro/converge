"use client"

import React, { useEffect, useRef } from "react"
import { useState } from "react"
import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from "livekit-client"
import { cn } from "@/lib/utils"
import { connections } from "@/lib/data"
import { ConnectionProfileCard, type MongoDBConnection } from "@/components/connection-profile-card"

type AgentState = "idle" | "listening" | "responding" | "done"

interface Message {
  id: string
  type: "user" | "agent" | "component" | "profile"
  content: string
  componentTitle?: string
  profileData?: MongoDBConnection
  isInterim?: boolean // For live transcription
}

const promptChips = [
  "Who have I met recently?",
  "Who works in fintech?",
  "Remind me who I met in Boston.",
  "Find connections in AI/ML",
]

// Helper function to convert frontend Connection to MongoDBConnection format
const convertToMongoDBConnection = (conn: typeof connections[0]): MongoDBConnection => {
  return {
    _id: conn.id,
    name: {
      value: conn.name,
    },
    company: {
      value: conn.industry, // Using industry as company for mock data
    },
    role: conn.tags[0] ? {
      value: conn.tags[0], // Using first tag as role for mock data
    } : undefined,
    industry: conn.industry,
    tags: conn.tags,
    context: {
      location: {
        name: conn.location,
        city: conn.location,
      },
      event: {
        name: "Networking Event", // Default event name
        type: "conference",
      },
      first_met: conn.metDate,
    },
    visual: {
      headshot: {
        url: conn.avatarUrl,
      },
    },
    audio: {
      personal_details: [
        `Met at ${conn.summaryPlaceholder.toLowerCase()}`,
        `Based in ${conn.location}`,
        `Works in ${conn.industry}`,
      ],
    },
    interaction_count: (conn.id.charCodeAt(0) % 5) + 1, // Deterministic based on connection ID
    last_interaction: conn.metDate,
  }
}

const getAgentResponse = (prompt: string): { text: string; profileDataArray?: MongoDBConnection[] } => {
  const lowerPrompt = prompt.toLowerCase()
  
  // Get connections to display (default to first 4, or match based on prompt)
  let selectedConnections: typeof connections = []
  
  if (lowerPrompt.includes("recently") || lowerPrompt.includes("recent")) {
    selectedConnections = connections
      .sort((a, b) => new Date(b.metDate).getTime() - new Date(a.metDate).getTime())
      .slice(0, 4)
  } else if (lowerPrompt.includes("fintech")) {
    const fintech = connections.filter(c => c.industry.toLowerCase() === "fintech")
    selectedConnections = fintech.slice(0, 4)
    if (selectedConnections.length === 0) selectedConnections = connections.slice(0, 4)
  } else if (lowerPrompt.includes("boston")) {
    const boston = connections.filter(c => c.location === "Boston")
    selectedConnections = boston.slice(0, 4)
    if (selectedConnections.length === 0) selectedConnections = connections.slice(0, 4)
  } else if (lowerPrompt.includes("ai") || lowerPrompt.includes("ml")) {
    const aiConnections = connections.filter(c => 
      c.industry.toLowerCase().includes("ai") || 
      c.tags.some(t => t.toLowerCase().includes("ai"))
    )
    selectedConnections = aiConnections.slice(0, 4)
    if (selectedConnections.length === 0) selectedConnections = connections.slice(0, 4)
  } else {
    // Default: show first 4 connections
    selectedConnections = connections.slice(0, 4)
  }
  
  return {
    text: `Here are connections from your network:`,
    profileDataArray: selectedConnections.map(conn => convertToMongoDBConnection(conn)),
  }
}

export default function AgentPage() {
  const [state, setState] = useState<AgentState>("idle")
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const roomRef = useRef<Room | null>(null)
  const audioElementRef = useRef<HTMLAudioElement>(null)

  // Connect to LiveKit room (only after user interaction)
  const connectToRoom = async () => {
    if (roomRef.current || isConnecting) return
    
    setIsConnecting(true)
    try {
        const roomName = `agent-room-${Date.now()}`
        const participantName = `user-${Date.now()}`

        // Get token from your API
        const tokenResponse = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName, participantName }),
        })

        if (!tokenResponse.ok) {
          throw new Error('Failed to get token')
        }

        const { token, url } = await tokenResponse.json()

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        })

        // Event handlers
        room.on(RoomEvent.Connected, () => {
          console.log('✅ Connected to LiveKit room')
          setIsConnected(true)
        })

        room.on(RoomEvent.Disconnected, () => {
          console.log('❌ Disconnected from LiveKit room')
          setIsConnected(false)
          setState("idle")
        })

        // Subscribe to agent audio
        room.on(RoomEvent.TrackSubscribed, async (
          track: RemoteTrack,
          publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          if (track.kind === Track.Kind.Audio && participant.identity.includes('agent')) {
            if (audioElementRef.current) {
              track.attach(audioElementRef.current)
              // Resume audio context and play after user interaction
              try {
                await audioElementRef.current.play()
              } catch (error) {
                console.warn('Audio playback requires user interaction:', error)
              }
              setState("responding")
            }
          }
        })

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach()
          if (state === "responding") {
            setState("idle")
          }
        })

        // Listen for data messages (transcriptions, text responses)
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const decoder = new TextDecoder()
            const data = JSON.parse(decoder.decode(payload))
            
            if (data.type === 'transcription') {
              // User transcription
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1]
                if (lastMsg?.isInterim && lastMsg.type === 'user') {
                  // Update interim transcription
                  return [...prev.slice(0, -1), { ...lastMsg, content: data.text, isInterim: !data.isFinal }]
                } else if (!data.isFinal) {
                  // New interim transcription
                  return [...prev, {
                    id: Date.now().toString(),
                    type: "user",
                    content: data.text,
                    isInterim: true,
                  }]
                } else {
                  // Final transcription
                  return [...prev.filter(m => !m.isInterim), {
                    id: Date.now().toString(),
                    type: "user",
                    content: data.text,
                    isInterim: false,
                  }]
                }
              })
            } else if (data.type === 'agent_response') {
              // Agent text response
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: "agent",
                content: data.text,
              }])
            }
          } catch (error) {
            console.error('Error parsing data message:', error)
          }
        })

        await room.connect(url, token)
        roomRef.current = room

        // Resume audio context after user interaction
        if (audioElementRef.current) {
          try {
            await audioElementRef.current.play()
          } catch (error) {
            console.warn('Audio play failed, will retry on user interaction:', error)
          }
        }

      } catch (error) {
        console.error('Failed to connect to LiveKit:', error)
        setIsConnected(false)
      } finally {
        setIsConnecting(false)
      }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Disconnect room (this will clean up all tracks automatically)
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
    }
  }, [])

  // Connect to room (triggered by user interaction)
  const handleConnect = async () => {
    if (!isConnected && !isConnecting) {
      await connectToRoom()
    }
  }

  // Toggle microphone
  const toggleMicrophone = async () => {
    // If not connected, connect first
    if (!isConnected) {
      await handleConnect()
      return
    }

    if (!roomRef.current) return

    try {
      if (!isMicEnabled) {
        // Enable microphone - setMicrophoneEnabled handles permission, track creation, and publishing
        await roomRef.current.localParticipant.setMicrophoneEnabled(true)
        setIsMicEnabled(true)
        setState("listening")
        console.log('✅ Microphone enabled')
        
        // Resume audio context for playback
        if (audioElementRef.current) {
          try {
            await audioElementRef.current.play()
          } catch (error) {
            console.warn('Audio play failed:', error)
          }
        }
      } else {
        // Disable microphone
        await roomRef.current.localParticipant.setMicrophoneEnabled(false)
        setIsMicEnabled(false)
        setState("idle")
        console.log('🔇 Microphone disabled')
      }
    } catch (error) {
      console.error('Error toggling microphone:', error)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        alert('Microphone permission is required. Please allow microphone access and try again.')
      }
    }
  }

  const handlePrompt = async (prompt: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: prompt,
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    
    setState("listening")
    await new Promise(resolve => setTimeout(resolve, 800))
    
    setState("responding")
    await new Promise(resolve => setTimeout(resolve, 1200))
    
    const response = getAgentResponse(prompt)
    
    // Add agent text message if there's text
    if (response.text) {
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "agent",
        content: response.text,
      }
      setMessages(prev => [...prev, agentMessage])
    }
    
    // Add profile cards if there's profile data array
    if (response.profileDataArray && response.profileDataArray.length > 0) {
      response.profileDataArray.forEach((profileData, index) => {
        const profileMessage: Message = {
          id: (Date.now() + 2 + index).toString(),
          type: "profile",
          content: "",
          profileData: profileData,
        }
        setMessages(prev => [...prev, profileMessage])
      })
    }
    
    setState("done")
    setTimeout(() => setState("idle"), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // If connected to LiveKit, send text message
    if (roomRef.current && isConnected) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: "user",
        content: inputValue,
      }
      setMessages(prev => [...prev, userMessage])

      try {
        const encoder = new TextEncoder()
        const data = JSON.stringify({ type: 'text_message', text: inputValue })
        await roomRef.current.localParticipant.publishData(encoder.encode(data))
        setState("responding")
      } catch (error) {
        console.error('Error sending text message:', error)
      }

      setInputValue("")
      return
    }

    // Fallback to mock implementation if not connected
    if (state === "idle") {
      handlePrompt(inputValue.trim())
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header - Notion style */}
      <header className="h-[45px] flex items-center justify-center border-b border-border px-4 pl-[52px] md:pl-4">
        <h1 className="text-sm font-medium">Network Agent</h1>
        {isConnected && (
          <span className="ml-2 text-xs text-green-500">● Connected</span>
        )}
        {isConnecting && (
          <span className="ml-2 text-xs text-yellow-500">Connecting...</span>
        )}
        {!isConnected && !isConnecting && (
          <span className="ml-2 text-xs text-muted-foreground">Click to connect</span>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-hidden">
        {/* Orb - Notion style subtle */}
        <div className="relative mb-6">
          <button
            onClick={isConnected ? toggleMicrophone : handleConnect}
            disabled={isConnecting}
            className={cn(
              "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer",
              state === "idle" && "bg-[var(--notion-blue-bg)]",
              state === "listening" && "bg-[var(--notion-blue-bg)] scale-110",
              state === "responding" && "bg-[var(--notion-blue-bg)]",
              state === "done" && "bg-[var(--notion-blue-bg)]",
              isConnecting && "opacity-50 cursor-wait"
            )}
          >
            {/* Pulse ring */}
            <div
              className={cn(
                "absolute inset-[-4px] rounded-full border border-[var(--notion-blue)]/30",
                state === "listening" && "animate-pulse"
              )}
            />
            
            {/* Inner orb */}
            <div
              className={cn(
                "w-16 h-16 rounded-full bg-primary flex items-center justify-center transition-all duration-200",
                state === "listening" && "scale-105",
                state === "responding" && "animate-pulse"
              )}
            >
              {state === "responding" ? (
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <svg
                  className="w-6 h-6 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </div>
          </button>
          
          {/* State label */}
          <p className="text-center mt-3 text-xs text-muted-foreground h-4">
            {isConnecting && "Connecting..."}
            {!isConnected && !isConnecting && "Click to connect"}
            {isConnected && state === "listening" && "Listening..."}
            {isConnected && state === "responding" && "Thinking..."}
            {isConnected && state === "idle" && "Click to speak"}
          </p>
        </div>

        {/* Prompt Chips - Notion style */}
        {messages.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md">
            {promptChips.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => handlePrompt(chip)}
                disabled={state !== "idle"}
                className="px-3 py-1.5 rounded border border-border bg-card text-xs hover:bg-[#3F4448] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Transcript Area - Notion style */}
        {messages.length > 0 && (
          <div className="w-full max-w-xl flex-1 overflow-y-auto mb-4 space-y-3 px-2">
            {messages.map((message, index) => {
              // Check if this is a profile card and if there are consecutive profile cards
              const isProfile = message.type === "profile"
              const prevMessage = messages[index - 1]
              const isProfileGroupStart = isProfile && prevMessage?.type !== "profile"
              
              // Collect consecutive profile cards if this is the start of a group
              let profileGroup: typeof messages = []
              if (isProfileGroupStart) {
                profileGroup = [message]
                let nextIdx = index + 1
                while (nextIdx < messages.length && messages[nextIdx].type === "profile") {
                  profileGroup.push(messages[nextIdx])
                  nextIdx++
                }
              }
              
              // Skip rendering if this profile card is part of a group (not the first one)
              if (isProfile && !isProfileGroupStart) {
                return null
              }
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    message.type === "profile" ? "w-full" : "max-w-[85%]",
                    message.type === "user" && "ml-auto",
                    message.type !== "user" && "mr-auto"
                  )}
                >
                  {message.type === "user" ? (
                    <div className={cn(
                      "rounded bg-primary px-3 py-2 text-sm text-primary-foreground",
                      message.isInterim && "opacity-60"
                    )}>
                      {message.content}
                      {message.isInterim && "..."}
                    </div>
                  ) : message.type === "agent" ? (
                    <div className="rounded bg-card border border-border px-3 py-2 text-sm">
                      {message.content}
                    </div>
                  ) : message.type === "profile" && message.profileData ? (
                    // Profile cards container - can fit up to 4 side by side
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {profileGroup.map((profileMsg) => 
                        profileMsg.type === "profile" && profileMsg.profileData ? (
                          <ConnectionProfileCard 
                            key={profileMsg.id} 
                            connection={profileMsg.profileData} 
                          />
                        ) : null
                      )}
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-[var(--notion-blue)]/40 bg-[var(--notion-blue-bg)] p-3 mt-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-xs font-medium text-primary">{message.componentTitle}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{message.content}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Input Form - Notion style */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl px-2">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about your network..."
              disabled={state !== "idle" || !isConnected}
              className="w-full rounded border border-border bg-card px-4 py-3 pr-12 text-sm placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || state !== "idle" || !isConnected}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>

        {/* Hidden audio element for agent audio playback */}
        <audio ref={audioElementRef} autoPlay />
      </main>
    </div>
  )
}
