'use client'

import * as React from 'react'
import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ErrorMessageProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

function ErrorMessage({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorMessageProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] p-6',
        className,
      )}
    >
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="size-6 text-destructive-foreground" />
        </div>

        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        <p className="text-sm text-muted-foreground mb-6">{message}</p>

        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

export { ErrorMessage }
