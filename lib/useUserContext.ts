'use client'

import { createClient } from './supabase-auth'
import { useEffect, useState } from 'react'

interface UserContext {
  farmIds: string[]
  isSuperAdmin: boolean
  contextLoaded: boolean
}

export function useUserContext(): UserContext {
  const supabase = createClient()
  const [farmIds, setFarmIds] = useState<string[] | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setFarmIds([]); return }

      const { data: orgUser } = await supabase
        .from('organisation_users')
        .select('role, organisation_id')
        .eq('user_id', user.id)
        .single()

      if (orgUser?.role === 'super_admin') {
        setIsSuperAdmin(true)
        setFarmIds([])
        return
      }

      if (orgUser?.role === 'org_admin') {
        // Org admin sees all farms in their org — load them explicitly
        const { data: farms } = await supabase
          .from('farms')
          .select('id')
          .eq('organisation_id', orgUser.organisation_id)
        setFarmIds((farms || []).map((f: any) => f.id))
        return
      }

      const { data: farmAccess } = await supabase
        .from('user_farm_access')
        .select('farm_id')
        .eq('user_id', user.id)

      setFarmIds((farmAccess || []).map((f: any) => f.farm_id))
    }
    load()
  }, [])

  return {
    farmIds: farmIds ?? [],
    isSuperAdmin,
    contextLoaded: farmIds !== null,
  }
}
