"use client"

import React from "react"
import { AppShell } from "@/components/app-shell"
import { ProtectedRoute } from "@/components/protected-route"

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}
