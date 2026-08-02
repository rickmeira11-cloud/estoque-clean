'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { valorAtual } from '@/lib/patrimonio-calc'
import Link from 'next/link'
import {
  LineChart, Line, PieChart, Pie, Cell,
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

function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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
      borderRadius: 'var(--radius)', padding: '18px 20px',
      borderTop: `2px solid ${color}`,
      cursor: href ? 'pointer' : 'default',
      transition: 'transform 0.15s', height: '100%',
    }}
      onMouseEnter={e => { if (href) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { if (href) (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>{label}</div>
        <div style={{ fontSize: '18px' }}>{icon}</div>
      </div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-1)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

function PeriodBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

// Painel padrão (respiro consistente, cresce com o conteúdo)
const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '300px',
}
const panelHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }
const panelTitle: React.CSSProperties = { fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }

// Grids fluidos — reflow automático, sem largura fixa que aperta
const gridKpis: React.CSSProperties  = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }
const gridPanels: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }

// ── página ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile } = useProfile()

  const [products,  setProducts]  = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [patItems,  setPatItems]  = useState<any[]>([])
  const [emprestimos, setEmprestimos] = useState<any[]>([])
  const [manutAvisos, setManutAvisos] = useState<any[]>([])
  const [eventos,   setEventos]   = useState<any[]>([])
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
    const hojeStr = new Date().toISOString().split('T')[0]
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    const in7Str = in7.toISOString().split('T')[0]

    // Queries paralelas — sem waterfall (nenhum canal realtime novo)
    const [
      { data: prods },
      { data: movs },
      { data: locs },
      { data: pats },
      { data: emps },
      { data: manuts },
      { data: evs },
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
      sb.from('patrimonio')
        .select('id,acquisition_value,acquisition_date,useful_life_years,quantity,nfe_key,nfe_file_url,physical_location,status')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true),
      sb.from('patrimonio_movimentacoes')
        .select('id,expected_return_date,patrimonio:patrimonio(name,status)')
        .eq('church_id', profile!.church_id)
        .eq('type', 'emprestimo')
        .order('expected_return_date', { ascending: true }),
      sb.from('patrimonio_manutencoes')
        .select('patrimonio_id,date,next_maintenance_date,patrimonio:patrimonio(name,is_active)')
        .eq('church_id', profile!.church_id)
        .order('date', { ascending: false }),
      sb.from('events')
        .select('id,name,event_date')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true)
        .gte('event_date', hojeStr)
        .lte('event_date', in7Str)
        .order('event_date', { ascending: true }),
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

    setPatItems(pats || [])
    setEmprestimos((emps || []).filter((e: any) => e.patrimonio?.status === 'emprestado'))

    // Manutenção mais recente por bem → base do alerta de next_maintenance_date
    const recentePorBem = new Map<string, any>()
    for (const m of (manuts || [])) {
      if (!recentePorBem.has(m.patrimonio_id)) recentePorBem.set(m.patrimonio_id, m)
    }
    setManutAvisos(Array.from(recentePorBem.values()).filter((m: any) => m.next_maintenance_date && m.patrimonio?.is_active))

    setEventos(evs || [])
    setLoading(false)
  }

  // Realtime — só estoque (inalterado, sem canais novos)
  useEffect(() => {
    if (!profile?.church_id) return
    const sb = createClient()
    const channelName = 'dashboard-' + profile.church_id
    sb.removeChannel(sb.channel(channelName))
    const channel = sb.channel(channelName)
    channel.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'stock_movements', filter: 'church_id=eq.' + profile.church_id },
      () => loadAll()
    ).subscribe()
    return () => { sb.removeChannel(channel) }
  }, [profile?.church_id])

  // ── estoque: cálculos memoizados ──
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

  // Previsão de zeramento — consumo dos últimos 30 dias
  const forecast = useMemo(() => {
    const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30)
    const movs30 = movements.filter(m => new Date(m.created_at) >= cutoff30 && m.type === 'out')
    const consumoMap: Record<string, number> = {}
    movs30.forEach(m => { if (m.product?.name) consumoMap[m.product.name] = (consumoMap[m.product.name] || 0) + m.quantity })
    return products
      .filter(p => p.quantity > 0)
      .map(p => {
        const consumo30d = consumoMap[p.name] || 0
        const mediaDiaria = consumo30d / 30
        const diasParaZerar = mediaDiaria > 0 ? Math.floor(p.quantity / mediaDiaria) : null
        return { id: p.id, name: p.name, quantity: p.quantity, unit: p.unit, mediaDiaria: Math.round(mediaDiaria * 10) / 10, diasParaZerar }
      })
      .filter(p => p.diasParaZerar !== null && p.diasParaZerar <= 30)
      .sort((a, b) => (a.diasParaZerar || 999) - (b.diasParaZerar || 999))
      .slice(0, 8)
  }, [movements, products])

  const lineData = useMemo(() => {
    const weekMap: Record<string, { label: string; entradas: number; saidas: number }> = {}
    filtered.forEach(m => {
      const key = weekKey(new Date(m.created_at))
      const d = new Date(key)
      if (!weekMap[key]) weekMap[key] = { label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), entradas: 0, saidas: 0 }
      if (m.type === 'in')  weekMap[key].entradas += m.quantity
      if (m.type === 'out') weekMap[key].saidas   += m.quantity
    })
    return Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [filtered])

  // Top produtos — lista (nomes completos, truncados via CSS)
  const topProdutos = useMemo(() => {
    const prodMap: Record<string, number> = {}
    filtered.forEach(m => {
      if (m.type !== 'in' && m.type !== 'out') return
      const name = m.product?.name || 'Desconhecido'
      prodMap[name] = (prodMap[name] || 0) + m.quantity
    })
    return Object.entries(prodMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, total]) => ({ name, total }))
  }, [filtered])
  const maxTop = topProdutos[0]?.total || 1

  const pieData = useMemo(() => {
    const catMap: Record<string, number> = {}
    filtered.forEach(m => {
      if (m.type !== 'in' && m.type !== 'out') return
      const cat = m.product?.category || 'Sem categoria'
      catMap[cat] = (catMap[cat] || 0) + m.quantity
    })
    return Object.entries(catMap).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const recent = useMemo(() => movements.slice(-6).reverse(), [movements])

  // ── patrimônio: derivados ──
  const patValor = useMemo(() => patItems.reduce((s, p) => s + valorAtual(p), 0), [patItems])

  const empHoje = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
  const empVencidos = useMemo(() => {
    const hoje = empHoje()
    return emprestimos.filter(e => e.expected_return_date && new Date(e.expected_return_date) < hoje)
  }, [emprestimos])

  const manutStats = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const vencidas = manutAvisos.filter(m => new Date(m.next_maintenance_date) < hoje)
    const proximas = manutAvisos.filter(m => {
      const diff = (new Date(m.next_maintenance_date).getTime() - hoje.getTime()) / (1000*60*60*24)
      return diff >= 0 && diff <= 30
    })
    return { vencidas: vencidas.length, proximas: proximas.length }
  }, [manutAvisos])

  const pendencias = useMemo(() => {
    const semNF    = patItems.filter(p => !p.nfe_key && !p.nfe_file_url).length
    const semValor = patItems.filter(p => p.acquisition_value == null).length
    const semLocal = patItems.filter(p => !p.physical_location).length
    const total    = patItems.filter(p => (!p.nfe_key && !p.nfe_file_url) || p.acquisition_value == null || !p.physical_location).length
    return { semNF, semValor, semLocal, total }
  }, [patItems])

  const hora = new Date().getHours()
  const firstName = profile?.name?.split(' ')[0] || ''
  const NOMES_DIA = ['dom','seg','ter','qua','qui','sex','sáb']

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>
            {hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>
            {profile?.church?.name} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }} className="dashboard-period">
          <PeriodBtn label="7 dias"  active={period === '7d'}  onClick={() => setPeriod('7d')}/>
          <PeriodBtn label="30 dias" active={period === '30d'} onClick={() => setPeriod('30d')}/>
          <PeriodBtn label="3 meses" active={period === '90d'} onClick={() => setPeriod('90d')}/>
        </div>
      </div>

      {/* ═══════════ FAIXA 1 — ESTOQUE ═══════════ */}
      {/* KPIs */}
      <div style={{ ...gridKpis, marginBottom: '14px' }}>
        <Card label="Total de itens"  value={stats.total}   color="var(--border-md)"  icon="📦" href="/estoque" sub={`${stats.ok} em estoque`}/>
        <Card label="Estoque baixo"   value={stats.low}     color={stats.low > 0 ? 'var(--low)' : 'var(--border-md)'} icon="⚠️" href="/estoque" sub={`${stats.empty} zerado(s)`}/>
        <Card label={`Entradas (${period === '7d' ? '7d' : period === '30d' ? '30d' : '3m'})`} value={stats.entries} color="var(--border-md)" icon="↑" sub="unidades recebidas"/>
        <Card label={`Saídas (${period === '7d' ? '7d' : period === '30d' ? '30d' : '3m'})`}   value={stats.exits}   color="var(--border-md)" icon="↓" sub="unidades retiradas"/>
      </div>

      {/* Barra de status */}
      {stats.total > 0 && (
        <div style={{ display: 'flex', height: '4px', borderRadius: '99px', overflow: 'hidden', gap: '2px', marginBottom: '24px' }}>
          <div style={{ flex: stats.ok    || 0.01, background: 'var(--ok)',    transition: 'flex 0.6s' }}/>
          <div style={{ flex: stats.low   || 0.01, background: 'var(--low)',   transition: 'flex 0.6s' }}/>
          <div style={{ flex: stats.empty || 0.01, background: 'var(--empty)', transition: 'flex 0.6s' }}/>
        </div>
      )}

      {/* Painéis de estoque (3) */}
      <div style={{ ...gridPanels, marginBottom: '14px' }}>

        {/* Atenção necessária */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={panelTitle}>Atenção necessária</span>
            {stats.critical.length > 0 && <span style={{ fontSize: '11px', background: 'var(--empty-dim)', color: 'var(--empty)', padding: '2px 9px', borderRadius: '99px', fontWeight: '500' }}>{stats.critical.length}</span>}
          </div>
          {stats.critical.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Tudo em ordem ✓</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {stats.critical.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px', background: p.quantity === 0 ? 'var(--empty-dim)' : 'var(--low-dim)', border: `1px solid ${p.quantity === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{p.category || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: p.quantity === 0 ? 'var(--empty)' : 'var(--low)', fontFamily: 'var(--font-mono)' }}>{p.quantity}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>mín {p.min_stock}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Previsão de zeramento */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={panelTitle}>Previsão de zeramento</span>
            {forecast.length > 0 && <span style={{ fontSize: '11px', background: 'var(--low-dim)', color: 'var(--low)', padding: '2px 9px', borderRadius: '99px', fontWeight: '500' }}>{forecast.length}</span>}
          </div>
          {forecast.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhum produto crítico ✓</div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {forecast.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px',
                  background: (p.diasParaZerar||99) <= 7 ? 'var(--empty-dim)' : 'var(--low-dim)',
                  border: `1px solid ${(p.diasParaZerar||99) <= 7 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>{p.mediaDiaria} {p.unit||'un'}/dia · estoque: {p.quantity}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: (p.diasParaZerar||99) <= 7 ? 'var(--empty)' : 'var(--low)', fontFamily: 'var(--font-mono)' }}>{p.diasParaZerar}d</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>para zerar</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas movimentações */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={panelTitle}>Últimas movimentações</span>
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

      {/* Gráfico de linha (pesado — oculto no mobile via .dashboard-chart) */}
      {lineData.length > 0 && (
        <div className="dashboard-chart" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={panelTitle}>Entradas vs Saídas — por semana</span>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '2px', background: 'var(--ok)', display: 'inline-block', borderRadius: '1px' }}/>Entradas</span>
              <span style={{ fontSize: '11px', color: 'var(--empty)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '2px', background: 'var(--empty)', display: 'inline-block', borderRadius: '1px' }}/>Saídas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" padding={{ left: 8, right: 8 }}/>
              <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={32}/>
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}/>
              <Line type="monotone" dataKey="entradas" name="Entradas" stroke="var(--ok)"    strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}/>
              <Line type="monotone" dataKey="saidas"   name="Saídas"   stroke="var(--empty)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top produtos (LISTA, sempre visível) + Pizza (oculta no mobile) */}
      <div style={{ ...gridPanels, marginBottom: '28px' }}>
        <div style={{ ...panelStyle, minHeight: 'auto' }}>
          <div style={panelHeader}><span style={panelTitle}>Top produtos movimentados</span></div>
          {topProdutos.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Sem movimentações no período</div>
          ) : (
            <div>
              {topProdutos.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < topProdutos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', width: '18px', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ height: '4px', borderRadius: '99px', background: 'var(--bg-3)', marginTop: '5px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (p.total / maxTop * 100) + '%', background: 'var(--brand)', borderRadius: '99px' }}/>
                    </div>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-1)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{p.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {pieData.length > 0 && (
          <div className="dashboard-chart" style={{ ...panelStyle, minHeight: 'auto' }}>
            <div style={panelHeader}><span style={panelTitle}>Por categoria</span></div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value} un`, name]}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value, entry: any) => `${value} (${((entry.payload.value / pieData.reduce((s, d) => s + d.value, 0)) * 100).toFixed(0)}%)`}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══════════ FAIXA 2 — PATRIMÔNIO & EVENTOS ═══════════ */}
      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        Patrimônio &amp; Eventos
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }}/>
      </div>

      {/* Próximos eventos — no topo, largo e convidativo */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--brand)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: eventos.length > 0 ? '14px' : '0' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '8px' }}>📅 Próximos eventos <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '400' }}>· 7 dias</span></span>
          <Link href="/admin/eventos" style={{ fontSize: '12px', color: 'var(--brand-light)', textDecoration: 'none', fontWeight: '500' }}>Ver agenda →</Link>
        </div>
        {eventos.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-3)', padding: '4px 0' }}>Nenhum evento nos próximos 7 dias. <Link href="/admin/eventos" style={{ color: 'var(--brand-light)', textDecoration: 'none' }}>Agendar um evento →</Link></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {eventos.map(ev => {
              const d = new Date(ev.event_date + 'T12:00:00')
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '38px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--brand-light)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase' }}>{NOMES_DIA[d.getDay()]}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* KPIs de patrimônio */}
      <div style={{ ...gridKpis, marginBottom: '8px' }}>
        {/* Valor do patrimônio — informativo, neutro */}
        <Card label="Valor do patrimônio" value={fmtBRL(patValor)} color="var(--border-md)" icon="🏛️" href="/patrimonio" sub={`${patItems.length} bens ativos`}/>

        {/* Devoluções pendentes — neutro quando 0, vermelho só com vencido */}
        <Card
          label="Devoluções pendentes"
          value={emprestimos.length}
          color={empVencidos.length > 0 ? 'var(--empty)' : 'var(--border-md)'}
          icon="📤"
          href="/patrimonio"
          sub={empVencidos.length > 0 ? `🔴 ${empVencidos.length} vencida(s)` : emprestimos.length === 0 ? 'nenhum empréstimo ativo' : 'no prazo'}
        />

        {/* Manutenções a vencer/vencidas */}
        <Card
          label="Manutenções"
          value={manutStats.vencidas + manutStats.proximas}
          color={manutStats.vencidas > 0 ? 'var(--empty)' : manutStats.proximas > 0 ? 'var(--low)' : 'var(--border-md)'}
          icon="🔧"
          href="/patrimonio"
          sub={(manutStats.vencidas > 0 || manutStats.proximas > 0) ? `🔴 ${manutStats.vencidas} vencida(s) · 🟡 ${manutStats.proximas} a vencer` : 'nenhuma pendente'}
        />

        {/* Bens a regularizar — checklist de migração */}
        <Card
          label="Bens a regularizar"
          value={pendencias.total}
          color="var(--border-md)"
          icon="📋"
          href="/relatorios"
          sub={`${pendencias.semNF} s/ NF · ${pendencias.semValor} s/ valor · ${pendencias.semLocal} s/ local`}
        />
      </div>
    </div>
  )
}
