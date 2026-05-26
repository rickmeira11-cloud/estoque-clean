'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useStockAlerts } from '@/hooks/useStockAlerts'
import Link from 'next/link'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { Product } from '@/types'

// ── tipos ───────────────────────────────────────────────────────
type Movement = {
  id: string; type: string; quantity: number; created_at: string
  product: { name: string; category: string | null } | null
  location: { name: string } | null
}

// ── helpers ─────────────────────────────────────────────────────
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#a78bfa','#34d399','#fb923c','#60a5fa']
const tooltipStyle = { background:'var(--bg-2)', border:'1px solid var(--border-md)', borderRadius:'8px', fontSize:'12px', color:'var(--text-1)' }

function weekKey(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return monday.toISOString().split('T')[0]
}

function getCutoff(period: '7d' | '30d' | '90d') {
  const d = new Date()
  if (period === '7d')  d.setDate(d.getDate() - 7)
  if (period === '30d') d.setDate(d.getDate() - 30)
  if (period === '90d') d.setMonth(d.getMonth() - 3)
  d.setHours(0, 0, 0, 0)
  return d
}

// ── componentes ─────────────────────────────────────────────────
function Card({ label, value, sub, color, icon, href }: {
  label: string; value: string | number; sub?: string
  color: string; icon: string; href?: string
}) {
  const inner = (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '16px 20px',
      borderTop: `2px solid ${color}`,
      cursor: href ? 'pointer' : 'default',
      transition: 'transform 0.15s',
    }}
      onMouseEnter={e => { if (href) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { if (href) (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>{label}</div>
        <div style={{ fontSize: '18px' }}>{icon}</div>
      </div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-1)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '5px' }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

function PeriodBtn({ v, label, active, onClick }: { v: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: '99px', fontSize: '12px', cursor: 'pointer',
      background: active ? 'var(--brand)' : 'transparent',
      color: active ? '#fff' : 'var(--text-2)',
      border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
      transition: 'all 0.15s', fontWeight: active ? '500' : '400',
    }}>{label}</button>
  )
}

// ── página ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile } = useProfile()
  const { expiryAlerts, expiryCount } = useStockAlerts()

  const [products,  setProducts]  = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [locSaldo,  setLocSaldo]  = useState<{ name: string; qty: number }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [period,    setPeriod]    = useState<'7d' | '30d' | '90d'>('90d')

  useEffect(() => {
    if (!profile?.church_id) return
    loadAll()
  }, [profile?.church_id])

  async function loadAll() {
    setLoading(true)
    const sb = createClient()
    const since = getCutoff('90d').toISOString()

    // Queries paralelas — sem waterfall
    const [
      { data: prods },
      { data: movs },
      { data: locs },
      { data: balData },
    ] = await Promise.all([
      sb.from('products')
        .select('id,name,quantity,min_stock,category,unit,expiration_date,is_active')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true)
        .order('name'),
      sb.from('stock_movements')
        .select('id,type,quantity,created_at,location_id,product:products(name,category)')
        .eq('church_id', profile!.church_id)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
      sb.from('locations')
        .select('id,name')
        .eq('church_id', profile!.church_id),
      sb.from('product_location_balance')
        .select('location_name,location_quantity')
        .eq('church_id', profile!.church_id),
    ])

    if (prods) setProducts(prods as Product[])

    if (movs && locs) {
      const locMap = new Map(locs.map((l: any) => [l.id, l.name]))
      const withLoc = movs.map((m: any) => ({
        ...m,
        location: locMap.has(m.location_id) ? { name: locMap.get(m.location_id) } : null
      }))
      setMovements(withLoc as Movement[])
    }

    if (balData) {
      const agg: Record<string, number> = {}
      balData.forEach((r: any) => {
        if (!agg[r.location_name]) agg[r.location_name] = 0
        agg[r.location_name] += (r.location_quantity || 0)
      })
      setLocSaldo(
        Object.entries(agg)
          .filter(([, q]) => q > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([name, qty]) => ({ name, qty }))
      )
    }

    setLoading(false)
  }

  // ── cálculos memoizados — só recalcula quando movements ou period mudam ──
  const filtered = useMemo(() => {
    const cutoff = getCutoff(period)
    return movements.filter(m => new Date(m.created_at) >= cutoff)
  }, [movements, period])

  const stats = useMemo(() => ({
    total:   products.length,
    ok:      products.filter(p => p.quantity > p.min_stock).length,
    low:     products.filter(p => p.quantity > 0 && p.quantity <= p.min_stock).length,
    empty:   products.filter(p => p.quantity === 0).length,
    entries: filtered.filter(m => m.type === 'in').reduce((a, m) => a + m.quantity, 0),
    exits:   filtered.filter(m => m.type === 'out').reduce((a, m) => a + m.quantity, 0),
    critical: products
      .filter(p => p.quantity <= p.min_stock)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8),
  }), [products, filtered])

  const lineData = useMemo(() => {
    const weekMap: Record<string, { label: string; entradas: number; saidas: number }> = {}
    filtered.forEach(m => {
      const key = weekKey(new Date(m.created_at))
      const d = new Date(key)
      if (!weekMap[key]) weekMap[key] = {
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        entradas: 0, saidas: 0
      }
      if (m.type === 'in')  weekMap[key].entradas += m.quantity
      if (m.type === 'out') weekMap[key].saidas   += m.quantity
    })
    return Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [filtered])

  const barData = useMemo(() => {
    const prodMap: Record<string, number> = {}
    filtered.forEach(m => {
      if (m.type !== 'in' && m.type !== 'out') return
      const name = m.product?.name || 'Desconhecido'
      prodMap[name] = (prodMap[name] || 0) + m.quantity
    })
    return Object.entries(prodMap)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, total]) => ({ name: name.length > 14 ? name.slice(0, 12) + '…' : name, total }))
  }, [filtered])

  const pieData = useMemo(() => {
    const catMap: Record<string, number> = {}
    filtered.forEach(m => {
      if (m.type !== 'in' && m.type !== 'out') return
      const cat = m.product?.category || 'Sem categoria'
      catMap[cat] = (catMap[cat] || 0) + m.quantity
    })
    return Object.entries(catMap).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const locMovData = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {}
    filtered.forEach(m => {
      const loc = m.location?.name || 'Sem depósito'
      if (!map[loc]) map[loc] = { entradas: 0, saidas: 0 }
      if (m.type === 'in')  map[loc].entradas += m.quantity
      if (m.type === 'out') map[loc].saidas   += m.quantity
    })
    return Object.entries(map).sort(([, a], [, b]) => (b.entradas + b.saidas) - (a.entradas + a.saidas))
  }, [filtered])

  // Últimas 6 movimentações — pegar do fim do array (ordem ASC)
  const recent = useMemo(() => movements.slice(-6).reverse(), [movements])

  const hora = new Date().getHours()
  const firstName = profile?.name?.split(' ')[0] || ''

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '12px' }} />
      ))}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>
            {hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>
            {profile?.church?.name} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <PeriodBtn v="7d"  label="7 dias"   active={period === '7d'}  onClick={() => setPeriod('7d')}/>
          <PeriodBtn v="30d" label="30 dias"  active={period === '30d'} onClick={() => setPeriod('30d')}/>
          <PeriodBtn v="90d" label="3 meses"  active={period === '90d'} onClick={() => setPeriod('90d')}/>
        </div>
      </div>

      {/* Cards principais */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
        <Card label="Total de itens"  value={stats.total}   color="var(--brand)"  icon="📦" href="/estoque"       sub={`${stats.ok} em estoque`}/>
        <Card label="Estoque baixo"   value={stats.low}     color="var(--low)"    icon="⚠️" href="/estoque"       sub={`${stats.empty} zerado(s)`}/>
        <Card label={`Entradas (${period === '7d' ? '7d' : period === '30d' ? '30d' : '3m'})`} value={stats.entries} color="var(--ok)"    icon="↑" sub="unidades recebidas"/>
        <Card label={`Saídas (${period === '7d' ? '7d' : period === '30d' ? '30d' : '3m'})`}   value={stats.exits}   color="var(--empty)" icon="↓" sub="unidades retiradas"/>
      </div>

      {/* Barra de status */}
      {stats.total > 0 && (
        <div style={{ display: 'flex', height: '4px', borderRadius: '99px', overflow: 'hidden', gap: '2px', marginBottom: '20px' }}>
          <div style={{ flex: stats.ok    || 0.01, background: 'var(--ok)',    transition: 'flex 0.6s' }}/>
          <div style={{ flex: stats.low   || 0.01, background: 'var(--low)',   transition: 'flex 0.6s' }}/>
          <div style={{ flex: stats.empty || 0.01, background: 'var(--empty)', transition: 'flex 0.6s' }}/>
        </div>
      )}

      {/* Grid 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '14px' }} className="bottom-grid">

        {/* Saldo por depósito — via view */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>Saldo por depósito</span>
            <Link href="/estoque" style={{ fontSize: '11px', color: 'var(--brand-light)', textDecoration: 'none' }}>Ver estoque →</Link>
          </div>
          {locSaldo.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhum saldo registrado</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {locSaldo.map(l => (
                <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-1)' }}>{l.name}</span>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>{l.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atenção necessária */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>Atenção necessária</span>
            {stats.critical.length > 0 && <span style={{ fontSize: '11px', background: 'var(--empty-dim)', color: 'var(--empty)', padding: '2px 9px', borderRadius: '99px', fontWeight: '500' }}>{stats.critical.length}</span>}
          </div>
          {stats.critical.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Tudo em ordem ✓</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {stats.critical.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px', background: p.quantity === 0 ? 'var(--empty-dim)' : 'var(--low-dim)', border: `1px solid ${p.quantity === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-1)' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{p.category || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: p.quantity === 0 ? 'var(--empty)' : 'var(--low)', fontFamily: 'var(--font-mono)' }}>{p.quantity}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>mín {p.min_stock}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Validade próxima */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>Validade próxima</span>
            {expiryCount > 0 && <span style={{ fontSize: '11px', background: 'var(--low-dim)', color: 'var(--low)', padding: '2px 9px', borderRadius: '99px', fontWeight: '500' }}>{expiryCount}</span>}
          </div>
          {expiryAlerts.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Tudo em dia ✓</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {expiryAlerts.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px', background: (p.daysUntilExpiry || 0) < 0 ? 'var(--empty-dim)' : 'var(--low-dim)', border: `1px solid ${(p.daysUntilExpiry || 0) < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>{p.category || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: (p.daysUntilExpiry || 0) < 0 ? 'var(--empty)' : 'var(--low)' }}>
                      {(p.daysUntilExpiry || 0) < 0 ? 'VENCIDO' : `${p.daysUntilExpiry}d`}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>
                      {p.expiration_date ? new Date(p.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas movimentações */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>Últimas movimentações</span>
            <Link href="/movimentacoes" style={{ fontSize: '11px', color: 'var(--brand-light)', textDecoration: 'none' }}>+ Nova →</Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhuma movimentação</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {recent.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', background: m.type === 'in' ? 'var(--ok-dim)' : m.type === 'out' ? 'var(--empty-dim)' : 'var(--info-dim)', color: m.type === 'in' ? 'var(--ok)' : m.type === 'out' ? 'var(--empty)' : 'var(--info)' }}>
                      {m.type === 'in' ? '↑' : m.type === 'out' ? '↓' : '⇄'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.product?.name || '—'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                        {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {m.location && <span> · {m.location.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', flexShrink: 0, marginLeft: '8px', fontFamily: 'var(--font-mono)', color: m.type === 'in' ? 'var(--ok)' : m.type === 'out' ? 'var(--empty)' : 'var(--text-2)' }}>
                    {m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}{m.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gráfico linha — entradas vs saídas por semana */}
      {lineData.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', marginBottom: '16px' }}>
            Entradas vs Saídas — por semana
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize: '12px' }}/>
              <Line type="monotone" dataKey="entradas" name="Entradas" stroke="var(--ok)"    strokeWidth={2} dot={false} activeDot={{ r: 4 }}/>
              <Line type="monotone" dataKey="saidas"   name="Saídas"   stroke="var(--empty)" strokeWidth={2} dot={false} activeDot={{ r: 4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grid barras + pizza */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }} className="bottom-grid">
        {barData.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', marginBottom: '16px' }}>Top produtos movimentados</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={110}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="total" name="Qtd" fill="var(--brand)" radius={[0, 4, 4, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {pieData.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', marginBottom: '16px' }}>Distribuição por categoria</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} style={{ fontSize: '10px' }}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
