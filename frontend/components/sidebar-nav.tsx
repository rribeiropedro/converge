"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Mic, Settings, ChevronRight, LogOut, Users, ClipboardCheck } from "lucide-react"
import { logoutFromAPI, getUser } from "@/lib/auth"
import { useState, useEffect } from "react"
import { getConnectionCounts, ApiError } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  badge?: number
  badgeColor?: string
}

const staticNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Connections",
    href: "/connections",
    icon: Users,
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
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [draftCount, setDraftCount] = useState(0)
  const user = getUser()

  // Fetch draft count for badge
  useEffect(() => {
    async function fetchDraftCount() {
      try {
        const counts = await getConnectionCounts()
        setDraftCount(counts.draft)
      } catch (err) {
        // Silently fail - badge just won't show
        console.error('Failed to fetch draft count:', err)
      }
    }
    fetchDraftCount()
  }, [])

  // Build nav items with dynamic badges
  const navItems: NavItem[] = staticNavItems.map(item => {
    if (item.href === '/connections' && draftCount > 0) {
      return { ...item, badge: draftCount, badgeColor: 'bg-yellow-500' }
    }
    return item
  })

  // Add Review item if there are drafts
  const allNavItems = draftCount > 0
    ? [
        ...navItems.slice(0, 2),
        {
          label: "Review Drafts",
          href: "/connections?status=draft",
          icon: ClipboardCheck,
          badge: draftCount,
          badgeColor: 'bg-yellow-500',
        } as NavItem,
        ...navItems.slice(2),
      ]
    : navItems

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logoutFromAPI(API_URL)
    router.push('/auth')
  }

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
          {allNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href.split('?')[0] + "/")
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
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    "ml-auto text-[10px] text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    item.badgeColor || "bg-primary"
                  )}>
                    {item.badge}
                  </span>
                )}
                {item.disabled && (
                  <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
      
      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {/* User info */}
        {user && (
          <div className="rounded bg-sidebar-accent px-3 py-2">
            <p className="text-[11px] font-medium text-foreground truncate">{user.email}</p>
            <p className="text-[10px] text-muted-foreground">
              Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
        
        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={cn(
            "flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm transition-colors",
            "text-muted-foreground hover:bg-[#3F4448] hover:text-sidebar-foreground",
            isLoggingOut && "opacity-50 cursor-not-allowed"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{isLoggingOut ? "Logging out..." : "Log out"}</span>
        </button>
      </div>
    </aside>
  )
}
