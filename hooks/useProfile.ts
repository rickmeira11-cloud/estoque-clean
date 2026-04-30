'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Profile = {
  id: string
  name: string
  email: string
  role: string
  church_id: string | null
  is_active: boolean
  must_change_password: boolean
  church?: { id: string; name: string; city: string | null; state: string | null; logo_url: string | null } | null
  churches?: { id: string; name: string; city: string | null; role: string }[]
}

const ACTIVE_CHURCH_KEY = 'gestoque_active_church'

export function useProfile() {
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }

    // Buscar perfil base
    const { data: prof } = await sb
      .from('profiles')
      .select('*, church:churches(id,name,city,state,logo_url)')
      .eq('id', user.id)
      .single()

    if (!prof) { setLoading(false); return }

    // Buscar todas as igrejas vinculadas
    const { data: userChurches } = await sb
      .from('user_churches')
      .select('church_id, role, church:churches(id,name,city,state)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const churches = (userChurches || []).map((uc: any) => ({
      id: uc.church.id,
      name: uc.church.name,
      city: uc.church.city,
      role: uc.role,
    }))

    // Igreja ativa — pegar do localStorage ou usar a do perfil
    let activeChurchId = localStorage.getItem(ACTIVE_CHURCH_KEY)

    // Validar se a igreja ativa ainda é válida
    if (activeChurchId && !churches.find(c => c.id === activeChurchId)) {
      activeChurchId = null
    }

    // Se não tem igreja ativa, usar a do perfil
    if (!activeChurchId) {
      activeChurchId = prof.church_id
      if (activeChurchId) localStorage.setItem(ACTIVE_CHURCH_KEY, activeChurchId)
    }

    const activeChurch = churches.find(c => c.id === activeChurchId) || prof.church

    setProfile({
      ...prof,
      church_id: activeChurchId,
      church: activeChurch ? { ...activeChurch, logo_url: prof.church?.logo_url || null } : prof.church,
      churches,
    })
    setLoading(false)
  }

  const isAdmin   = profile?.role === 'super_admin' || profile?.role === 'admin'
  const canEdit   = profile?.role !== 'viewer'

  function switchChurch(churchId: string) {
    localStorage.setItem(ACTIVE_CHURCH_KEY, churchId)
    window.location.reload()
  }

  return { profile, loading, isAdmin, canEdit, switchChurch }
}
