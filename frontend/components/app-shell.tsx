"use client"

import React, { useState } from "react"
import { SidebarNav } from "./sidebar-nav"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()

  return (
    <div className="min-h-screen bg-background">
      <SidebarNav open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      {/* Mobile toggle button - aligned with header center */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "fixed top-[6.5px] left-3 z-50 h-8 w-8 bg-card border border-border shadow-sm",
            "hover:bg-accent"
          )}
          onClick={() => setSidebarOpen(true)}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Open sidebar</span>
        </Button>
      )}

      <main className={cn(
        "transition-all",
        isMobile ? "pl-0" : "pl-64"
      )}>
        {children}
      </main>
    </div>
  )
}
