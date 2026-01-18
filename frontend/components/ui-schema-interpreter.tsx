"use client"

import React from "react"
import { ConnectionProfileCard, type MongoDBConnection } from "./connection-profile-card"
import { UISchema, ProfileCardSchema, ProfileCardGroupSchema, ActionCardSchema } from "@/lib/ui-schema"
import { Button } from "./ui/button"

interface UISchemaInterpreterProps {
  schema: UISchema
}

export function UISchemaInterpreter({ schema }: UISchemaInterpreterProps) {
  switch (schema.type) {
    case "profile_card":
      return <ProfileCardRenderer schema={schema} />
    
    case "profile_card_group":
      return <ProfileCardGroupRenderer schema={schema} />
    
    case "action_card":
      return <ActionCardRenderer schema={schema} />
    
    default:
      console.warn("Unknown schema type:", (schema as any).type)
      return null
  }
}

function ProfileCardRenderer({ schema }: { schema: ProfileCardSchema }) {
  return (
    <div className="w-full">
      <ConnectionProfileCard connection={schema.data as MongoDBConnection} />
    </div>
  )
}

function ProfileCardGroupRenderer({ schema }: { schema: ProfileCardGroupSchema }) {
  if (!schema.data || schema.data.length === 0) {
    return null
  }

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {schema.data.map((profile, index) => (
        <ConnectionProfileCard 
          key={profile._id || index} 
          connection={profile as MongoDBConnection} 
        />
      ))}
    </div>
  )
}

function ActionCardRenderer({ schema }: { schema: ActionCardSchema }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="text-sm font-semibold mb-2">{schema.data.title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{schema.data.description}</p>
      
      {schema.data.actions && schema.data.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {schema.data.actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleAction(action.action, action.actionData)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function handleAction(action: string, actionData?: any) {
  console.log("Action triggered:", action, actionData)
  // TODO: Implement action handlers
  // e.g., "send_message", "schedule_meeting", "view_profile", etc.
}

