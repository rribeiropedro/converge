'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

interface LoadingSpinnerProps {
  message?: string
  className?: string
  overlay?: boolean
}

function LoadingSpinner({
  message,
  className,
  overlay = false,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px]',
        overlay && 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
        className,
      )}
    >
      <Spinner className="size-8 text-primary" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}

export { LoadingSpinner }
