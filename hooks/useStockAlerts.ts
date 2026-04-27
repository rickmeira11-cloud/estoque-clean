'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

export type StockAlert = {
  id: string
  name: string
  quantity: number
  min_stock: number
  category: string | null
  expiration_date: string | null
  alertType: 'low_stock' | 'expiring' | 'expired'
  daysUntilExpiry?: number
}

export function useStockAlerts() {
  const { profile } = useProfile()
  const [stockAlerts,    setStockAlerts]    = useState<StockAlert[]>([])
  const [expiryAlerts,   setExpiryAlerts]   = useState<StockAlert[]>([])

  useEffect(() => {
    if (!profile?.church_id) return
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [profile?.church_id])

  async function load() {
    const { data } = await createClient()
      .from('products')
      .select('id,name,quantity,min_stock,category,expiration_date')
      .eq('church_id', profile!.church_id)
      .eq('is_active', true)

    if (!data) return

    const today = new Date(); today.setHours(0,0,0,0)
    const in30   = new Date(today); in30.setDate(today.getDate() + 30)

    const low: StockAlert[] = []
    const exp: StockAlert[] = []

    data.forEach(p => {
      // Estoque baixo ou zerado
      if (p.quantity <= p.min_stock) {
        low.push({ ...p, alertType: p.quantity === 0 ? 'low_stock' : 'low_stock' })
      }
      // Validade
      if (p.expiration_date) {
        const expDate = new Date(p.expiration_date)
        const diff = Math.ceil((expDate.getTime() - today.getTime()) / (1000*60*60*24))
        if (diff <= 30) {
          exp.push({ ...p, alertType: diff < 0 ? 'expired' : 'expiring', daysUntilExpiry: diff })
        }
      }
    })

    setStockAlerts(low)
    setExpiryAlerts(exp.sort((a,b) => (a.daysUntilExpiry||0) - (b.daysUntilExpiry||0)))
  }

  const totalCount = stockAlerts.length + expiryAlerts.length

  return {
    alerts:       stockAlerts,
    expiryAlerts,
    count:        totalCount,
    stockCount:   stockAlerts.length,
    expiryCount:  expiryAlerts.length,
    hasAlerts:    totalCount > 0,
  }
}
