"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}
    
    if (!email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email"
    }
    
    if (!password) {
      newErrors.password = "Password is required"
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    setIsLoading(false)
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Notion style */}
      <header className="h-[45px] flex items-center px-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
            <span className="text-[10px] font-semibold text-primary-foreground">N</span>
          </div>
          <span className="text-sm font-medium">NexHacks</span>
        </Link>
      </header>

      {/* Auth Card - Notion style centered */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded border border-border bg-card p-6">
            {/* Tabs - Notion style segmented control */}
            <div className="flex rounded bg-muted p-0.5 mb-6">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={cn(
                  "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={cn(
                  "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign up
              </button>
            </div>

            {/* Title */}
            <div className="mb-5">
              <h1 className="text-xl font-semibold">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Enter your credentials to access your network"
                  : "Start building your AI-powered network memory"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                  }}
                  className={cn(
                    "h-9 bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary",
                    errors.email && "border-[var(--notion-red)]"
                  )}
                />
                {errors.email && (
                  <p className="text-xs text-[var(--notion-red)]">{errors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
                  }}
                  className={cn(
                    "h-9 bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary",
                    errors.password && "border-[var(--notion-red)]"
                  )}
                />
                {errors.password && (
                  <p className="text-xs text-[var(--notion-red)]">{errors.password}</p>
                )}
              </div>

              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground cursor-not-allowed opacity-50"
                    disabled
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-9"
                disabled={isLoading}
              >
                {isLoading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Log in"
                  : "Create account"}
              </Button>
            </form>

            {/* Footer text */}
            <p className="mt-5 text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>
                  {"Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-primary hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
