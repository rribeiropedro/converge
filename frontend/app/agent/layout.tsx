import React from "react"
import { AppShell } from "@/components/app-shell"

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
