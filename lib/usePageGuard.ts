'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useUserContext } from './useUserContext'

/**
 * Page-level access guard. Replaces `useUserContext()` in manager pages:
 *
 *   const { allowed, farmIds, isSuperAdmin, ... } = usePageGuard()
 *   if (!allowed) return null
 *
 * Redirects to `/` if the user is not allowed to view the current page.
 * Returns all `useUserContext()` values plus `allowed`.
 */
export function usePageGuard() {
  const ctx = useUserContext()
  const pathname = usePathname()
  const router = useRouter()

  const allowed = !ctx.contextLoaded || ctx.canAccess(pathname)

  useEffect(() => {
    if (ctx.contextLoaded && !ctx.canAccess(pathname)) {
      router.replace('/')
    }
  }, [ctx.contextLoaded, pathname])

  return { ...ctx, allowed }
}
