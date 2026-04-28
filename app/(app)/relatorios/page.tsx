'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

type ReportTab = 'inventario' | 'movimentacoes' | 'criticos' | 'consumo' | 'depositos'

const TABS: { id: ReportTab; label: string; icon: string }[] = [
  { id:'inventario',    label:'Inventário',    icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id:'movimentacoes', label:'Movimentações', icon:'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  { id:'criticos',      label:'Críticos',      icon:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id:'consumo',       label:'Consumo',       icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id:'depositos',     label:'Depósitos',     icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
]

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#a78bfa','#34d399','#fb923c','#60a5fa']
const tooltipStyle = { background:'var(--bg-2)', border:'1px solid var(--border-md)', borderRadius:'8px', fontSize:'12px', color:'var(--text-1)' }

function Icon({ d, size=15 }: { d:string; size?:number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
}

export default function RelatoriosPage() {
  const { profile } = useProfile()
  const [tab,        setTab]        = useState<ReportTab>('inventario')
  const [dateFrom,   setDateFrom]   = useState(() => { const d=new Date(); d.setMonth(d.getMonth()-3); return d.toISOString().split('T')[0] })
  const [dateTo,     setDateTo]     = useState(() => new Date().toISOString().split('T')[0])
  const [filterLoc,  setFilterLoc]  = useState('all')
  const [filterCat,  setFilterCat]  = useState('all')
  const [locations,  setLocations]  = useState<{id:string,name:string}[]>([])
  const [products,   setProducts]   = useState<any[]>([])
  const [movements,  setMovements]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [balances,   setBalances]   = useState<any[]>([])

  useEffect(() => { if (profile?.church_id) loadBase() }, [profile?.church_id])
  useEffect(() => { if (profile?.church_id) loadMovements() }, [profile?.church_id, dateFrom, dateTo])
  useEffect(() => { if (profile?.church_id && tab === 'depositos') loadBalances() }, [profile?.church_id, tab, filterLoc, filterCat])

  async function loadBase() {
    const sb = createClient()
    const [{ data: locs }, { data: prods }] = await Promise.all([
      sb.from('locations').select('id,name').eq('church_id', profile!.church_id).eq('is_active', true).order('name'),
      sb.from('products').select('*').eq('church_id', profile!.church_id).eq('is_active', true).order('name'),
    ])
    if (locs)  setLocations(locs)
    if (prods) setProducts(prods)
  }

  async function loadBalances() {
    const sb = createClient()
    let q = sb.from('product_location_balance').select('*').eq('church_id', profile!.church_id)
    if (filterCat !== 'all') q = q.eq('category', filterCat)
    if (filterLoc !== 'all') q = q.eq('location_name', filterLoc)
    const { data } = await q.order('location_name').order('product_name')
    if (data) setBalances(data)
  }

  async function loadMovements() {
    setLoading(true)
    const { data } = await createClient()
      .from('stock_movements')
      .select('id,type,quantity,created_at,note,product:products(name,category),location:locations(name),dest:destination_location_id')
      .eq('church_id', profile!.church_id)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false })
    if (data) setMovements(data)
    setLoading(false)
  }

  // ── filtros aplicados ──────────────────────────────────────────
  const filteredMovs = movements.filter(m => {
    const locOk  = filterLoc === 'all' || m.location?.name === filterLoc || m.location === null
    const catOk  = filterCat === 'all' || m.product?.category === filterCat
    return locOk && catOk
  })
  const filteredProds = products.filter(p =>
    filterCat === 'all' || p.category === filterCat
  )
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
  const critical   = filteredProds.filter(p => p.quantity <= p.min_stock).sort((a:any,b:any) => a.quantity - b.quantity)

  // ── dados para gráficos ────────────────────────────────────────
  // Consumo por dia
  const dayMap: Record<string,{entradas:number;saidas:number}> = {}
  filteredMovs.forEach(m => {
    const d = m.created_at.split('T')[0]
    if (!dayMap[d]) dayMap[d] = { entradas:0, saidas:0 }
    if (m.type === 'in')  dayMap[d].entradas += m.quantity
    if (m.type === 'out') dayMap[d].saidas   += m.quantity
  })
  const lineData = Object.entries(dayMap).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([date,v])=>({
    label: new Date(date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
    ...v
  }))

  // Ranking produtos
  const prodMap: Record<string,number> = {}
  filteredMovs.forEach(m => {
    const n = m.product?.name || 'Desconhecido'
    prodMap[n] = (prodMap[n]||0) + m.quantity
  })
  const rankingData = Object.entries(prodMap).sort(([,a],[,b])=>b-a).slice(0,10).map(([name,total])=>({
    name: name.length>18 ? name.slice(0,16)+'…' : name, total
  }))

  // Por depósito
  const locMap: Record<string,{entradas:number;saidas:number;total:number}> = {}
  filteredMovs.forEach(m => {
    const loc = m.location?.name || 'Sem depósito'
    if (!locMap[loc]) locMap[loc] = { entradas:0, saidas:0, total:0 }
    if (m.type==='in')  locMap[loc].entradas += m.quantity
    if (m.type==='out') locMap[loc].saidas   += m.quantity
    locMap[loc].total += m.quantity
  })
  const locData = Object.entries(locMap).sort(([,a],[,b])=>b.total-a.total).map(([name,v])=>({ name: name.length>14?name.slice(0,12)+'…':name, ...v }))

  // ── exportações ────────────────────────────────────────────────
  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx')
    let rows: any[] = []; let sheet = ''

    if (tab === 'inventario') {
      sheet = 'Inventário'
      rows = filteredProds.map(p => ({
        'Produto':p.name, 'Categoria':p.category||'—', 'Quantidade':p.quantity,
        'Mínimo':p.min_stock, 'Status':p.quantity===0?'Zerado':p.quantity<=p.min_stock?'Baixo':'OK',
        'Unidade':p.unit||'un', 'Tipo':p.type==='perishable'?'Perecível':'Não perecível',
        'Validade':p.expiration_date?new Date(p.expiration_date).toLocaleDateString('pt-BR'):'—',
        'Último preço':p.last_purchase_value||'—',
      }))
    } else if (tab === 'criticos') {
      sheet = 'Críticos'
      rows = critical.map(p => ({
        'Produto':p.name, 'Categoria':p.category||'—',
        'Quantidade atual':p.quantity, 'Mínimo':p.min_stock,
        'Diferença':p.quantity-p.min_stock, 'Status':p.quantity===0?'Zerado':'Baixo',
      }))
    } else if (tab === 'depositos') {
      sheet = 'Depósitos'
      rows = Object.entries(locMap).map(([loc,d]) => ({
        'Depósito':loc, 'Entradas':d.entradas, 'Saídas':d.saidas, 'Total':d.total,
      }))
    } else if (tab === 'consumo') {
      sheet = 'Ranking'
      rows = Object.entries(prodMap).sort(([,a],[,b])=>b-a).map(([nome,qtd],i) => ({
        'Posição':i+1, 'Produto':nome, 'Total movimentado':qtd,
      }))
    } else {
      sheet = 'Movimentações'
      rows = filteredMovs.map(m => ({
        'Data':new Date(m.created_at).toLocaleString('pt-BR'),
        'Produto':m.product?.name||'—', 'Categoria':m.product?.category||'—',
        'Tipo':m.type==='in'?'Entrada':m.type==='out'?'Saída':'Ajuste',
        'Quantidade':m.quantity, 'Depósito':m.location?.name||'—', 'Observação':m.note||'—',
      }))
    }

    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, sheet)
    ws['!cols'] = Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,14)}))
    writeFile(wb, `${sheet.toLowerCase()}-${dateFrom}-${dateTo}.xlsx`)
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation:'landscape', format:'a4' })
    const church = profile?.church?.name || 'Poiema'
    const today  = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
    const tabLabel = TABS.find(t=>t.id===tab)?.label||''

    doc.setFillColor(17,17,19); doc.rect(0,0,297,30,'F')
    doc.setTextColor(250,250,250); doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text('Poiema · Gestão de Estoque', 14, 12)
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(161,161,170)
    doc.text(`${tabLabel} · ${church} · ${dateFrom} a ${dateTo}`, 14, 20)
    doc.text(`Gerado em ${today}`, 14, 26)

    let head: string[][] = []; let body: any[][] = []

    if (tab === 'inventario') {
      head = [['Produto','Categoria','Qtd','Mínimo','Status','Unidade']]
      body = filteredProds.map(p=>[p.name,p.category||'—',p.quantity,p.min_stock,p.quantity===0?'Zerado':p.quantity<=p.min_stock?'Baixo':'OK',p.unit||'un'])
    } else if (tab === 'criticos') {
      head = [['Produto','Categoria','Qtd atual','Mínimo','Diferença','Status']]
      body = critical.map(p=>[p.name,p.category||'—',p.quantity,p.min_stock,p.quantity-p.min_stock,p.quantity===0?'Zerado':'Baixo'])
    } else if (tab === 'depositos') {
      head = [['Depósito','Entradas','Saídas','Total']]
      body = Object.entries(locMap).sort(([,a],[,b])=>b.total-a.total).map(([loc,d])=>[loc,d.entradas,d.saidas,d.total])
    } else if (tab === 'consumo') {
      head = [['#','Produto','Total movimentado']]
      body = Object.entries(prodMap).sort(([,a],[,b])=>b-a).map(([nome,qtd],i)=>[i+1,nome,qtd])
    } else {
      head = [['Data','Produto','Tipo','Qtd','Depósito','Obs.']]
      body = filteredMovs.map(m=>[new Date(m.created_at).toLocaleString('pt-BR'),m.product?.name||'—',m.type==='in'?'Entrada':m.type==='out'?'Saída':'Ajuste',m.quantity,m.location?.name||'—',m.note||'—'])
    }

    autoTable(doc, {
      head, body, startY: 34,
      styles: { fontSize:9, cellPadding:4 },
      headStyles: { fillColor:[99,102,241], textColor:[255,255,255], fontStyle:'bold' },
      alternateRowStyles: { fillColor:[248,248,250] },
    })

    const pages = (doc as any).internal.getNumberOfPages()
    for (let i=1; i<=pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(161,161,170)
      doc.text(`Página ${i} de ${pages}`, 14, doc.internal.pageSize.height-8)
      doc.text(church, doc.internal.pageSize.width-14, doc.internal.pageSize.height-8, {align:'right'})
    }
    doc.save(`${tabLabel.toLowerCase()}-${dateFrom}-${dateTo}.pdf`)
  }

  const L = { display:'block' as const, fontSize:'11px', color:'var(--text-3)', marginBottom:'5px' }
  const count = tab==='inventario'?filteredProds.length:tab==='criticos'?critical.length:tab==='depositos'?Object.keys(locMap).length:filteredMovs.length

  return (
    <div style={{ maxWidth:'1100px' }}>
      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'600' }}>Relatórios</h1>
        <p style={{ fontSize:'13px', color:'var(--text-3)', marginTop:'4px' }}>Analise e exporte dados do estoque</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'8px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer',
            background: tab===t.id ? 'var(--brand)' : 'var(--bg-card)',
            color: tab===t.id ? '#fff' : 'var(--text-2)',
            border: tab===t.id ? '1px solid var(--brand)' : '1px solid var(--border)',
            fontSize:'13px', fontWeight: tab===t.id ? '500' : '400', transition:'all 0.15s',
          }}>
            <Icon d={t.icon} size={13}/>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px', marginBottom:'16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:'10px', alignItems:'flex-end', flexWrap:'wrap' }}>
          {(tab==='movimentacoes'||tab==='consumo'||tab==='depositos') && (
            <>
              <div><label style={L}>De</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
              <div><label style={L}>Até</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
            </>
          )}
          <div><label style={L}>Categoria</label>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="all">Todas as categorias</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(tab==='movimentacoes'||tab==='depositos') && (
            <div><label style={L}>Depósito</label>
              <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)}>
                <option value="all">Todos os depósitos</option>
                {locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
            <label style={L}>&nbsp;</label>
            <div style={{ fontSize:'12px', color:'var(--text-3)', padding:'10px 0' }}>{count} registro(s)</div>
          </div>
        </div>
      </div>

      {/* Botões exportar */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
        <button onClick={exportExcel} disabled={count===0} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 18px', background:'#1a6e3c', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:'13px', fontWeight:'500', cursor:count===0?'not-allowed':'pointer', opacity:count===0?0.5:1, transition:'all 0.15s' }}
          onMouseEnter={e=>count>0&&(e.currentTarget.style.background='#1d7d44')}
          onMouseLeave={e=>(e.currentTarget.style.background='#1a6e3c')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Exportar Excel
        </button>
        <button onClick={exportPDF} disabled={count===0} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 18px', background:'#b91c1c', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:'13px', fontWeight:'500', cursor:count===0?'not-allowed':'pointer', opacity:count===0?0.5:1, transition:'all 0.15s' }}
          onMouseEnter={e=>count>0&&(e.currentTarget.style.background='#c41e1e')}
          onMouseLeave={e=>(e.currentTarget.style.background='#b91c1c')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Exportar PDF
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:'48px', borderRadius:'8px' }}/>)}
        </div>
      ) : (
        <>
          {/* ── TAB: INVENTÁRIO ── */}
          {tab==='inventario' && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>
                Inventário completo — {filteredProds.length} produto(s)
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      {['Produto','Categoria','Qtd','Mínimo','Status','Unidade','Tipo','Último preço'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'var(--text-3)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProds.map((p:any) => {
                      const s = p.quantity===0?'empty':p.quantity<=p.min_stock?'low':'ok'
                      const sc = {ok:{l:'OK',c:'var(--ok)',b:'var(--ok-dim)'},low:{l:'Baixo',c:'var(--low)',b:'var(--low-dim)'},empty:{l:'Zerado',c:'var(--empty)',b:'var(--empty-dim)'}}[s]
                      return (
                        <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>{p.name}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-2)' }}>{p.category||'—'}</td>
                          <td style={{ padding:'10px 14px', fontSize:'15px', fontWeight:'700', color:sc.c, fontFamily:'var(--font-mono)' }}>{p.quantity}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-3)' }}>{p.min_stock}</td>
                          <td style={{ padding:'10px 14px' }}><span style={{ fontSize:'11px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:sc.b, color:sc.c }}>{sc.l}</span></td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-3)' }}>{p.unit||'un'}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-3)' }}>{p.type==='perishable'?'Perecível':'Não perecível'}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-2)', fontFamily:'var(--font-mono)' }}>{p.last_purchase_value?`R$ ${Number(p.last_purchase_value).toFixed(2)}`:'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: MOVIMENTAÇÕES ── */}
          {tab==='movimentacoes' && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>Movimentações — {filteredMovs.length} registro(s)</span>
                <div style={{ display:'flex', gap:'16px', fontSize:'12px' }}>
                  <span style={{ color:'var(--ok)' }}>↑ {filteredMovs.filter(m=>m.type==='in').reduce((a:number,m:any)=>a+m.quantity,0)} entradas</span>
                  <span style={{ color:'var(--empty)' }}>↓ {filteredMovs.filter(m=>m.type==='out').reduce((a:number,m:any)=>a+m.quantity,0)} saídas</span>
                </div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      {['Data','Produto','Categoria','Tipo','Qtd','Depósito','Observação'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'var(--text-3)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovs.map((m:any) => {
                      const tc = {in:{l:'Entrada',c:'var(--ok)',b:'var(--ok-dim)'},out:{l:'Saída',c:'var(--empty)',b:'var(--empty-dim)'},adjustment:{l:'Ajuste',c:'var(--info)',b:'var(--info-dim)'}}[m.type as string]||{l:'—',c:'var(--text-2)',b:'transparent'}
                      return (
                        <tr key={m.id} style={{ borderBottom:'1px solid var(--border)' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-3)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                          <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>{m.product?.name||'—'}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-2)' }}>{m.product?.category||'—'}</td>
                          <td style={{ padding:'10px 14px' }}><span style={{ fontSize:'11px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:tc.b, color:tc.c }}>{tc.l}</span></td>
                          <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:'700', color:tc.c, fontFamily:'var(--font-mono)' }}>{m.type==='in'?'+':m.type==='out'?'-':''}{m.quantity}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-2)' }}>{m.location?.name||'—'}</td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-3)', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.note||'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: CRÍTICOS ── */}
          {tab==='criticos' && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>Itens críticos — {critical.length} produto(s)</span>
                <span style={{ fontSize:'12px', color:'var(--empty)' }}>{critical.filter((p:any)=>p.quantity===0).length} zerado(s)</span>
              </div>
              {critical.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'var(--text-3)' }}>Nenhum item crítico — estoque em ordem ✓</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        {['Produto','Categoria','Qtd atual','Mínimo','Diferença','Status'].map(h=>(
                          <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'var(--text-3)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {critical.map((p:any) => {
                        const s = p.quantity===0?'empty':'low'
                        const sc = {low:{l:'Baixo',c:'var(--low)',b:'var(--low-dim)'},empty:{l:'Zerado',c:'var(--empty)',b:'var(--empty-dim)'}}[s]
                        return (
                          <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}
                            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                            <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>{p.name}</td>
                            <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-2)' }}>{p.category||'—'}</td>
                            <td style={{ padding:'10px 14px', fontSize:'15px', fontWeight:'700', color:sc.c, fontFamily:'var(--font-mono)' }}>{p.quantity}</td>
                            <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-3)' }}>{p.min_stock}</td>
                            <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'600', color:sc.c, fontFamily:'var(--font-mono)' }}>{p.quantity-p.min_stock}</td>
                            <td style={{ padding:'10px 14px' }}><span style={{ fontSize:'11px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:sc.b, color:sc.c }}>{sc.l}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: CONSUMO / RANKING ── */}
          {tab==='consumo' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* Gráfico de linha */}
              {lineData.length > 0 && (
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
                  <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'16px' }}>Entradas vs Saídas por dia</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:'#71717a' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize:10, fill:'#71717a' }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Line type="monotone" dataKey="entradas" name="Entradas" stroke="var(--ok)"    strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="saidas"   name="Saídas"   stroke="var(--empty)" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Ranking */}
              {rankingData.length > 0 && (
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
                  <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'16px' }}>Ranking — produtos mais movimentados</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={rankingData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false}/>
                      <XAxis type="number" tick={{ fontSize:10, fill:'#71717a' }} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#a1a1aa' }} axisLine={false} tickLine={false} width={100}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Bar dataKey="total" name="Total" radius={[0,4,4,0]}>
                        {rankingData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Tabela ranking */}
                  <div style={{ marginTop:'14px', overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          {['#','Produto','Total movimentado'].map(h=>(
                            <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:'11px', color:'var(--text-3)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(prodMap).sort(([,a],[,b])=>b-a).map(([nome,qtd],i)=>(
                          <tr key={nome} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'8px 14px', fontSize:'12px', color:'var(--text-3)', fontFamily:'var(--font-mono)', width:'40px' }}>#{i+1}</td>
                            <td style={{ padding:'8px 14px', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>{nome}</td>
                            <td style={{ padding:'8px 14px', fontSize:'15px', fontWeight:'700', color:COLORS[i%COLORS.length], fontFamily:'var(--font-mono)' }}>{qtd}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: DEPÓSITOS ── */}
          {tab==='depositos' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {locData.length > 0 && (
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' }}>
                  <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-1)', marginBottom:'16px' }}>Movimentações por depósito</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={locData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                      <XAxis dataKey="name" tick={{ fontSize:10, fill:'#71717a' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize:10, fill:'#71717a' }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Bar dataKey="entradas" name="Entradas" fill="var(--ok)"    radius={[4,4,0,0]}/>
                      <Bar dataKey="saidas"   name="Saídas"   fill="var(--empty)" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>
                  Resumo por depósito
                </div>
                {Object.keys(locMap).length === 0 ? (
                  <div style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:'var(--text-3)' }}>Nenhuma movimentação com depósito no período</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        {['Depósito','Entradas','Saídas','Total'].map(h=>(
                          <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', color:'var(--text-3)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(locMap).sort(([,a],[,b])=>b.total-a.total).map(([loc,d])=>(
                        <tr key={loc} style={{ borderBottom:'1px solid var(--border)' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:'500', color:'var(--text-1)' }}>{loc}</td>
                          <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:'700', color:'var(--ok)', fontFamily:'var(--font-mono)' }}>+{d.entradas}</td>
                          <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:'700', color:'var(--empty)', fontFamily:'var(--font-mono)' }}>-{d.saidas}</td>
                          <td style={{ padding:'10px 14px', fontSize:'14px', fontWeight:'700', color:'var(--brand-light)', fontFamily:'var(--font-mono)' }}>{d.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}