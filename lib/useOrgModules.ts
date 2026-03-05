'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'

/**
 * Fetches the `modules` column from the organisation table.
 * Returns string[] of module slugs (e.g. ['farmscout', 'qc']).
 */
export function useOrgModules(): string[] {
  const [modules, setModules] = useState<string[]>(['farmscout'])
  const { farmIds, contextLoaded } = useUserContext()

  useEffect(() => {
    if (!contextLoaded) return

    async function load() {
      try {
        const supabase = createClient()

        // Get org_id from user's farm access
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: orgUsers } = await supabase
          .from('organisation_users')
          .select('organisation_id')
          .eq('user_id', user.id)
          .limit(1)

        if (!orgUsers?.length) return

        const { data: org } = await supabase
          .from('organisations')
          .select('modules')
          .eq('id', orgUsers[0].organisation_id)
          .single()

        if (org?.modules) {
          setModules(org.modules)
        }
      } catch {
        // Default to farmscout only
      }
    }

    load()
  }, [contextLoaded])

  return modules
}
