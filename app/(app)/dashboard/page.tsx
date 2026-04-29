'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { Product } from '@/types'

// ── tipos ──────────────────────────────────────────────────────
type Movement = {
  id: string; type: string; quantity: number; created_at: string
  product: { name: string; category: string | null } | null
  location: { name: string } | null
}

// ── helpers ────────────────────────────────────────────────────
function weekLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function startOf3Months() {
  const d = new Date(); d.setMonth(d.getMonth() - 3); d.setHours(0,0,0,0); return d
}

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#a78bfa','#34d399','#fb923c','#60a5fa']

function Card({ label, value, sub, color, icon, href }: { label:string; value:string|number; sub?:string; color:string; icon:string; href?:string }) {
  const inner = (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px 20px', borderTop:`2px solid ${color}`, cursor: href ? 'pointer' : 'default', transition:'transform 0.15s', textDecoration:'none' }}
      onMouseEnter={e => { if (href) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { if (href) (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
        <div style={{ fontSize:'10px', color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'600' }}>{label}</div>
        <div style={{ fontSize:'18px' }}>{icon}</div>
      </div>
      <div style={{ fontSize:'26px', fontWeight:'700', color:'var(--text-1)', lineHeight:1, fontFamily:'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize:'11px', color:'var(--text-3)', marginTop:'5px' }}>{sub}</div>}
    </div>
  )
}

const tooltipStyle = { background:'var(--bg-2)', border:'1px solid var(--border-md)', borderRadius:'8px', fontSize:'12px', color:'var(--text-1)' }

export default function DashboardPage() {
  const { profile } = useProfile()
  const [products,   setProducts]   = useState<Product[]>([])
  const [movements,  setMovements]  = useState<Movement[]>([])
  const [loading,    setLoading]    = useState(true)
  const [period,     setPeriod]     = useState<'7d'|'30d'|'90d'>('90d')

  useEffect(() => {
    if (!profile?.church_id) return
    loadAll()
  }, [profile?.church_id])

  async function loadAll() {
    setLoading(true)
    const sb = createClient()
    const since = startOf3Months().toISOString()

    const [{ data: prods }, { data: movs }] = await Promise.all([
      sb.from('products')
        .select('id,name,quantity,min_stock,category,type,container,unit,last_purchase_value,expiration_date,notes,is_active,created_at,updated_at')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true),
      sb.from('stock_movements')
        .select('id,type,quantity,created_at,location_id,product:products(name,category)')
        .eq('church_id', profile!.church_id)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
    ])
    if (prods) setProducts(prods as Product[])
    if (movs) {
      const { data: locs } = await sb.from('locations').select('id,name').eq('church_id', profile!.church_id)
      const withLoc = movs.map((m: any) => ({
        ...m,
        location: locs?.find((l: any) => l.id === m.location_id) || null
      }))
      setMovements(withLoc as Movement[])
    }
    setLoading(false)
  }

  // ── filtro de período ──────────────────────────────────────
  const cutoff = new Date()
  if (period === '7d')  cutoff.setDate(cutoff.getDate() - 7)
  if (period === '30d') cutoff.setDate(cutoff.getDate() - 30)
  if (period === '90d') cutoff.setMonth(cutoff.getMonth() - 3)
  const filtered = movements.filter(m => new Date(m.created_at) >= cutoff)

  // ── stats gerais ───────────────────────────────────────────
  const total   = products.length
  const ok      = products.filter(p => p.quantity > p.min_stock).length
  const low     = products.filter(p => p.quantity > 0 && p.quantity <= p.min_stock).length
  const empty   = products.filter(p => p.quantity === 0).length
  const entries = filtered.filter(m => m.type === 'in').reduce((a, m) => a + m.quantity, 0)
  const exits   = filtered.filter(m => m.type === 'out').reduce((a, m) => a + m.quantity, 0)
  const critical = products.filter(p => p.quantity <= p.min_stock).sort((a,b) => a.quantity - b.quantity).slice(0, 4)

  // ── gráfico de linha: entradas vs saídas por semana ────────
  const weekMap: Record<string, { label:string; entradas:number; saidas:number }> = {}
  filtered.forEach(m => {
    const d = new Date(m.created_at)
    const day = d.getDay()
    const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const key = monday.toISOString().split('T')[0]
    if (!weekMap[key]) weekMap[key] = { label: weekLabel(monday), entradas: 0, saidas: 0 }
    if (m.type === 'in')  weekMap[key].entradas += m.quantity
    if (m.type === 'out') weekMap[key].saidas   += m.quantity
  })
  const lineData = Object.entries(weekMap).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v)

  // ── gráfico de barras: top 8 produtos mais movimentados ────
  const prodMap: Record<string, number> = {}
  filtered.forEach(m => {
    const name = m.product?.name || 'Desconhecido'
    prodMap[name] = (prodMap[name] || 0) + m.quantity
  })
  const barData = Object.entries(prodMap).sort(([,a],[,b]) => b - a).slice(0, 8).map(([name, total]) => ({ name: name.length > 18 ? name.slice(0,16)+'…' : name, total }))

  // ── gráfico de pizza: por categoria ───────────────────────
  const catMap: Record<string, number> = {}
  filtered.forEach(m => {
    const cat = m.product?.category || 'Sem categoria'
    catMap[cat] = (catMap[cat] || 0) + m.quantity
  })
  const pieData = Object.entries(catMap).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name, value }))

  // ── tabela: movimentações por depósito ─────────────────────
  const locMap: Record<string, { entradas:number; saidas:number }> = {}
  filtered.forEach(m => {
    const loc = m.location?.name || 'Sem depósito'
    if (!locMap[loc]) locMap[loc] = { entradas: 0, saidas: 0 }
    if (m.type === 'in')  locMap[loc].entradas += m.quantity
    if (m.type === 'out') locMap[loc].saidas   += m.quantity
  })
  const locData = Object.entries(locMap).sort(([,a],[,b]) => (b.entradas+b.saidas) - (a.entradas+a.saidas))

  // ── últimas movimentações ──────────────────────────────────
  const recent = [...movements].reverse().slice(0, 4)

  const hora = new Date().getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile?.name?.split(' ')[0] || ''

  const PeriodBtn = ({ v, label }: { v: typeof period; label: string }) => (
    <button onClick={() => setPeriod(v)} style={{
      padding: '5px 12px', borderRadius: '99px', fontSize: '12px', cursor: 'pointer',
      background: period === v ? 'var(--brand)' : 'transparent',
      color: period === v ? '#fff' : 'var(--text-2)',
      border: period === v ? '1px solid var(--brand)' : '1px solid var(--border)',
      transition: 'all 0.15s', fontWeight: period === v ? '500' : '400',
    }}>{label}</button>
  )

  if (loading) return (
    <div>
      <div style={{ marginBottom:'24px' }}>
        <div className="skeleton" style={{ width:'240px', height:'28px', marginBottom:'8px' }}/>
        <div className="skeleton" style={{ width:'180px', height:'13px' }}/>
      </div>
      <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:'90px', borderRadius:'12px' }}/>)}
      </div>
      <div className="skeleton" style={{ height:'280px', borderRadius:'12px', marginBottom:'16px' }}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        <div className="skeleton" style={{ height:'240px', borderRadius:'12px' }}/>
        <div className="skeleton" style={{ height:'240px', borderRadius:'12px' }}/>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'22px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'600', letterSpacing:'-0.02em' }}>
            Você está feliz{firstName ? `, ${firstName}` : ''}?
          </h1>
          <p style={{ fontSize:'13px', color:'var(--text-3)', marginTop:'4px' }}>
            {profile?.church?.name} · {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          <PeriodBtn v="7d"  label="7 dias"/>
          <PeriodBtn v="30d" label="30 dias"/>
          <PeriodBtn v="90d" label="3 meses"/>
        </div>
      </div>

      {/* Cards */}
      <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'14px' }}>
        <Card label="Total de itens"  value={total}   color="var(--brand)"  icon="📦" href="/estoque" sub={`${ok} em estoque`}/>
        <Card label="Estoque baixo"   value={low}     color="var(--low)"    icon="⚠️" href="/estoque" sub={`${empty} zerado(s)`}/>
        <Card label={`Entradas (${period === '7d' ? '7d' : period === '30d' ? '30d' : '3m'})`} value={entries} color="var(--ok)" icon="↑" sub="unidades recebidas"/>
        <Card label={`Saídas (${period === '7d' ? '7d' : period === '30d' ? '30d' : '3m'})`}   value={exits}   color="var(--empty)" icon="↓" sub="unidades retiradas"/>
      </div>

      {/* Barra de status */}
      {total > 0 && (
        <div style={{ display:'flex', height:'4px', borderRadius:'99px', overflow:'hidden', gap:'2px', marginBottom:'20px' }}>
          <div style={{ flex:ok||0.01,    background:'var(--ok)',    transition:'flex 0.6s' }}/>
          <div style={{ flex:low||0.01,   background:'var(--low)',   transition:'flex 0.6s' }}/>
          <div style={{ flex:empty||0.01, background:'var(--empty)', transition:'flex 0.6s' }}/>
        </div>
      )}

      {/* Grid: depósitos + atenção + últimas movimentações */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }} className="bottom-grid">

        {/* Saldo por depósito */}
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
          <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'14px' }}>Saldo por depósito</div>
          {(() => {
            const saldo: Record<string,number> = {}
            filtered.forEach((m:any) => {
              const loc = m.location?.name
              if (!loc) return
              if (!saldo[loc]) saldo[loc] = 0
              if (m.type==='in')  saldo[loc] += m.quantity
              if (m.type==='out') saldo[loc] -= m.quantity
              if (m.type==='transfer') saldo[loc] -= m.quantity
            })
            const entries = Object.entries(saldo).filter(([,q]) => q > 0).sort(([,a],[,b]) => b-a)
            const maxShow = 4
            if (entries.length === 0) return <div style={{ fontSize:'12px', color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>Nenhum saldo por depósito</div>
            return (<><div style={{maxHeight:'220px',overflowY:'auto'}}>{entries.slice(0,maxShow).map(([loc, qty]) => (
              <a key={loc} href="/estoque" style={{ display:'block', textDecoration:'none', marginBottom:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:'var(--radius-sm)', background:'var(--bg-3)', border:'1px solid var(--border)', cursor:'pointer', transition:'border-color 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--brand)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'var(--brand-dim)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>{loc}</span>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'var(--ok)', fontFamily:'var(--font-mono)' }}>{qty}</div>
                    <div style={{ fontSize:'9px', color:'var(--text-3)' }}>unidades</div>
                  </div>
                </div>
              </a>
            ))}</div>{entries.length > maxShow && <div style={{fontSize:'11px',color:'var(--text-3)',textAlign:'center',marginTop:'8px',cursor:'pointer'}} onClick={()=>{}}>+{entries.length - maxShow} depósito(s) — ver todos no Estoque</div>}</>) 
          })()}
        </div>
                {/* Atenção necessária */}
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <span style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>Atenção necessária</span>
            {critical.length > 0 && <span style={{ fontSize:'11px', background:'var(--empty-dim)', color:'var(--empty)', padding:'2px 9px', borderRadius:'99px', fontWeight:'500' }}>{critical.length}</span>}
          </div>
          {critical.length === 0 ? (
            <div style={{ fontSize:'13px', color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>Tudo em ordem ✓</div>
          ) : critical.map(p => (
            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:'var(--radius-sm)', marginBottom:'6px', background:p.quantity===0?'var(--empty-dim)':'var(--low-dim)', border:`1px solid ${p.quantity===0?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)'}` }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:'500', color:'var(--text-1)' }}>{p.name}</div>
                <div style={{ fontSize:'10px', color:'var(--text-3)' }}>{p.category||'—'}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'16px', fontWeight:'700', color:p.quantity===0?'var(--empty)':'var(--low)', fontFamily:'var(--font-mono)' }}>{p.quantity}</div>
                <div style={{ fontSize:'9px', color:'var(--text-3)' }}>mín {p.min_stock}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Últimas movimentações */}
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
          <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'14px' }}>Últimas movimentações</div>
          {recent.length === 0 ? (
            <div style={{ fontSize:'13px', color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>Nenhuma movimentação</div>
          ) : recent.map(m => (
            <div key={m.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                <div style={{ width:'26px', height:'26px', borderRadius:'7px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', background:m.type==='in'?'var(--ok-dim)':m.type==='out'?'var(--empty-dim)':'var(--info-dim)', color:m.type==='in'?'var(--ok)':m.type==='out'?'var(--empty)':'var(--info)' }}>
                  {m.type==='in'?'↑':m.type==='out'?'↓':'⇄'}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'11px', fontWeight:'500', color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.product?.name||'—'}</div>
                  <div style={{ fontSize:'10px', color:'var(--text-3)' }}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
              <div style={{ fontSize:'13px', fontWeight:'700', flexShrink:0, marginLeft:'8px', fontFamily:'var(--font-mono)', color:m.type==='in'?'var(--ok)':m.type==='out'?'var(--empty)':'var(--text-2)' }}>
                {m.type==='in'?'+':m.type==='out'?'-':''}{m.quantity}
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Gráfico de linha — entradas vs saídas por semana */}
      {lineData.length > 0 && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px', marginBottom:'14px' }}>
          <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'16px' }}>
            Entradas vs Saídas — por semana
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
              <XAxis dataKey="label" tick={{ fontSize:11, fill:'#71717a' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'#71717a' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize:'12px' }}/>
              <Line type="monotone" dataKey="entradas" name="Entradas" stroke="var(--ok)"    strokeWidth={2} dot={false} activeDot={{ r:4 }}/>
              <Line type="monotone" dataKey="saidas"   name="Saídas"   stroke="var(--empty)" strokeWidth={2} dot={false} activeDot={{ r:4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}


      {/* Grid: barras + pizza */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }} className="bottom-grid">

        {/* Top produtos */}
        {barData.length > 0 && (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'16px' }}>Top produtos movimentados</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize:10, fill:'#71717a' }} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#a1a1aa' }} axisLine={false} tickLine={false} width={120}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="total" name="Qtd" fill="var(--brand)" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pizza por categoria */}
        {pieData.length > 0 && (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'16px' }}>Distribuição por categoria</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{ fontSize:'10px' }}>
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
