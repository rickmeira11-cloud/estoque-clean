'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('profiles').select('*, church:churches(id,name,slug,city,state,is_active,created_at,updated_at)').eq('id', user.id).single()
      setProfile(data as Profile)
      setLoading(false)
    }
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])
  return { profile, loading, isAdmin: profile?.role === 'super_admin' || profile?.role === 'admin', isSuperAdmin: profile?.role === 'super_admin', canEdit: profile?.role !== 'viewer' }
}

