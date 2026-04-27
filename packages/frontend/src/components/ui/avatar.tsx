'use client'

import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as React from 'react'

import { cn } from '@/utils'

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full',
        className,
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  onError,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image> & {
  onError?: (error: Event) => void;
}) {
  const handleError = React.useCallback((error: Event) => {
    if (onError) {
      onError(error)
    }
  }, [onError])

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      onError={handleError}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-linear-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback, AvatarImage }

