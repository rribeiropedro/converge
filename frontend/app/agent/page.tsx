"use client"

import React from "react"
import { useState } from "react"
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && state === "idle") {
      handlePrompt(inputValue.trim())
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header - Notion style */}
      <header className="h-[45px] flex items-center justify-center border-b border-border px-4 pl-[52px] md:pl-4">
        <h1 className="text-sm font-medium">Network Agent</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-hidden">
        {/* Orb - Notion style subtle */}
        <div className="relative mb-6">
          <div
            className={cn(
              "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
              state === "idle" && "bg-[var(--notion-blue-bg)]",
              state === "listening" && "bg-[var(--notion-blue-bg)] scale-110",
              state === "responding" && "bg-[var(--notion-blue-bg)]",
              state === "done" && "bg-[var(--notion-blue-bg)]"
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
          </div>
          
          {/* State label */}
          <p className="text-center mt-3 text-xs text-muted-foreground h-4">
            {state === "listening" && "Listening..."}
            {state === "responding" && "Thinking..."}
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
                    <div className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {message.content}
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
              disabled={state !== "idle"}
              className="w-full rounded border border-border bg-card px-4 py-3 pr-12 text-sm placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || state !== "idle"}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
