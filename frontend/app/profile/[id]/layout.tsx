"use client"

import React from "react"
import { AppShell } from "@/components/app-shell"
import { ProtectedRoute } from "@/components/protected-route"

export default function ProfileLayout({
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
