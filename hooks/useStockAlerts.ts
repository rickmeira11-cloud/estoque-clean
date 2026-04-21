'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product } from '@/types'

export function useStockAlerts() {
  const { profile } = useProfile()
  const [alerts, setAlerts] = useState<Product[]>([])

  useEffect(() => {
    if (!profile?.church_id) return
    async function load() {
      const { data } = await createClient()
        .from('products')
        .select('id,name,quantity,min_stock,category')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true)
        .lte('quantity', 'min_stock')
        .order('quantity')
      // Filtrar no client pois lte com coluna não funciona direto
      const { data: all } = await createClient()
        .from('products')
        .select('id,name,quantity,min_stock,category,type,container,unit,last_purchase_value,expiration_date,notes,is_active,created_at,updated_at')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true)
      if (all) setAlerts((all as Product[]).filter(p => p.quantity <= p.min_stock))
    }
    load()
    // Recarregar a cada 5 minutos
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [profile?.church_id])

  return { alerts, count: alerts.length, hasAlerts: alerts.length > 0 }
}
