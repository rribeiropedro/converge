'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] p-6',
        className,
      )}
    >
      <div className="flex flex-col items-center text-center max-w-md">
        {icon && (
          <div className="flex items-center justify-center size-16 rounded-full bg-muted/50 mb-4 text-muted-foreground">
            {icon}
          </div>
        )}

        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        {description && (
          <p className="text-sm text-muted-foreground mb-6">{description}</p>
        )}

        {action && (
          <Button onClick={action.onClick} variant="outline" size="sm">
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}

export { EmptyState }
