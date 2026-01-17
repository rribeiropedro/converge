"use client"

import React from "react"

import { SidebarNav } from "./sidebar-nav"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <SidebarNav />
      <main className="pl-64">
        {children}
      </main>
    </div>
  )
}
