"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUser, isAuthenticated, logoutFromAPI, type User } from "@/lib/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  refreshAuth: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const refreshAuth = () => {
    if (typeof window === "undefined") return

    const authenticated = isAuthenticated()
    const currentUser = getUser()

    setUser(currentUser)
    setIsAuthChecked(true)
    setIsLoading(false)
  }

  const signOut = async () => {
    setIsLoading(true)

    try {
      await logoutFromAPI(API_URL)
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setUser(null)
      setIsLoading(false)
      router.push("/auth")
    }
  }

  // Check auth on mount (client-side only)
  useEffect(() => {
    refreshAuth()
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    refreshAuth,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
