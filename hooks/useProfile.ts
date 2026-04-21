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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('*, church:churches(id,name,slug,city,state,is_active,created_at,updated_at)')
        .eq('id', session.user.id)
        .single()

      if (!data) { setLoading(false); return }

      // Bloquear usuário inativo
      if (!data.is_active) {
        await supabase.auth.signOut()
        window.location.href = '/login?motivo=inativo'
        return
      }

      setProfile(data as Profile)
      setLoading(false)
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) load()
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    profile,
    loading,
    isAdmin:      profile?.role === 'super_admin' || profile?.role === 'admin',
    isSuperAdmin: profile?.role === 'super_admin',
    canEdit:      profile?.role !== 'viewer',
  }
}
