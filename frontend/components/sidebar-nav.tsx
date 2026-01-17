"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Mic, Settings, ChevronRight } from "lucide-react"

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Voice Agent",
    href: "/agent",
    icon: Mic,
  },
  {
    label: "Settings",
    href: "#",
    icon: Settings,
    disabled: true,
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header - Notion style */}
      <div className="h-[45px] flex items-center gap-2 px-3 border-b border-sidebar-border">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
          <span className="text-[10px] font-semibold text-primary-foreground">N</span>
        </div>
        <span className="text-sm font-medium">NexHacks</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
      </div>
      
      {/* Navigation - Notion style with subtle hover */}
      <nav className="flex-1 p-1.5">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-[#3F4448] hover:text-sidebar-foreground",
                  item.disabled && "pointer-events-none opacity-40"
                )}
                aria-disabled={item.disabled}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.disabled && (
                  <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
      
      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="rounded bg-sidebar-accent px-3 py-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Your network memory, powered by AI
          </p>
        </div>
      </div>
    </aside>
  )
}
