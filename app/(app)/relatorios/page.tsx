'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product, StockMovement } from '@/types'

type ReportType = 'inventory' | 'movements' | 'critical'

const REPORT_CONFIG = {
  inventory:  { label:'Inventário completo',    desc:'Todos os produtos com quantidades e status', icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  movements:  { label:'Histórico de movimentações', desc:'Entradas, saídas e ajustes por período', icon:'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  critical:   { label:'Itens críticos',         desc:'Produtos abaixo do estoque mínimo',       icon:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
}

export default function RelatoriosPage() {
  const { profile } = useProfile()
  const [reportType, setReportType] = useState<ReportType>('inventory')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [previewLoaded, setPreviewLoaded] = useState(false)

  useEffect(() => { if (profile?.church_id) loadPreview() }, [profile?.church_id, reportType, dateFrom, dateTo])

  async function loadPreview() {
    if (!profile?.church_id) return
    setLoading(true)
    const sb = createClient()

    if (reportType === 'inventory') {
      const { data } = await sb.from('products').select('name,category,quantity,min_stock,unit,type,expiration_date,last_purchase_value,notes').eq('church_id', profile.church_id).eq('is_active', true).order('category').order('name')
      setPreview(data || [])
    } else if (reportType === 'critical') {
      const { data } = await sb.from('products').select('name,category,quantity,min_stock,unit').eq('church_id', profile.church_id).eq('is_active', true).lte('quantity', sb.from('products').select('min_stock')).order('quantity')
      const { data: prods } = await sb.from('products').select('name,category,quantity,min_stock,unit').eq('church_id', profile.church_id).eq('is_active', true).order('quantity')
      setPreview((prods || []).filter((p: any) => p.quantity <= p.min_stock))
    } else {
      const { data } = await sb.from('stock_movements')
        .select('created_at,type,quantity,note,product:products(name,category),profile:profiles(name)')
        .eq('church_id', profile.church_id)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })
      setPreview(data || [])
    }
    setPreviewLoaded(true)
    setLoading(false)
  }

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx')
    let rows: any[] = []
    let filename = ''

    if (reportType === 'inventory') {
      filename = `inventario-${new Date().toISOString().split('T')[0]}.xlsx`
      rows = preview.map(p => ({
        'Produto': p.name,
        'Categoria': p.category || '',
        'Quantidade': p.quantity,
        'Mínimo': p.min_stock,
        'Status': p.quantity === 0 ? 'Zerado' : p.quantity <= p.min_stock ? 'Baixo' : 'OK',
        'Unidade': p.unit || 'un',
        'Tipo': p.type === 'perishable' ? 'Perecível' : 'Não perecível',
        'Validade': p.expiration_date ? new Date(p.expiration_date).toLocaleDateString('pt-BR') : '',
        'Último preço (R$)': p.last_purchase_value || '',
        'Observações': p.notes || '',
      }))
    } else if (reportType === 'critical') {
      filename = `itens-criticos-${new Date().toISOString().split('T')[0]}.xlsx`
      rows = preview.map(p => ({
        'Produto': p.name,
        'Categoria': p.category || '',
        'Quantidade atual': p.quantity,
        'Estoque mínimo': p.min_stock,
        'Diferença': p.quantity - p.min_stock,
        'Status': p.quantity === 0 ? 'Zerado' : 'Baixo',
      }))
    } else {
      filename = `movimentacoes-${dateFrom}-${dateTo}.xlsx`
      rows = preview.map((m: any) => ({
        'Data': new Date(m.created_at).toLocaleString('pt-BR'),
        'Produto': m.product?.name || '',
        'Categoria': m.product?.category || '',
        'Tipo': m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Saída' : 'Ajuste',
        'Quantidade': m.quantity,
        'Usuário': m.profile?.name || '',
        'Observação': m.note || '',
      }))
    }

    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Dados')

    // Largura das colunas
    const cols = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }))
    ws['!cols'] = cols

    writeFile(wb, filename)
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
    const church = profile?.church?.name || 'Poiema'
    const today = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })

    // Header
    doc.setFillColor(17, 17, 19)
    doc.rect(0, 0, 297, 30, 'F')
    doc.setTextColor(250, 250, 250)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Poiema · Gestão de Estoque', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(161, 161, 170)
    doc.text(`${REPORT_CONFIG[reportType].label} · ${church}`, 14, 20)
    doc.text(`Gerado em ${today}`, 14, 26)

    let head: string[][] = []
    let body: any[][] = []

    if (reportType === 'inventory') {
      head = [['Produto','Categoria','Qtd','Mínimo','Status','Unidade','Tipo','Validade']]
      body = preview.map(p => [
        p.name, p.category||'—', p.quantity, p.min_stock,
        p.quantity===0?'Zerado':p.quantity<=p.min_stock?'Baixo':'OK',
        p.unit||'un',
        p.type==='perishable'?'Perecível':'Não perecível',
        p.expiration_date?new Date(p.expiration_date).toLocaleDateString('pt-BR'):'—',
      ])
    } else if (reportType === 'critical') {
      head = [['Produto','Categoria','Quantidade atual','Estoque mínimo','Diferença','Status']]
      body = preview.map(p => [
        p.name, p.category||'—', p.quantity, p.min_stock,
        p.quantity - p.min_stock,
        p.quantity===0?'Zerado':'Baixo',
      ])
    } else {
      head = [['Data','Produto','Categoria','Tipo','Qtd','Usuário','Observação']]
      body = preview.map((m: any) => [
        new Date(m.created_at).toLocaleString('pt-BR'),
        m.product?.name||'—', m.product?.category||'—',
        m.type==='in'?'Entrada':m.type==='out'?'Saída':'Ajuste',
        m.quantity, m.profile?.name||'—', m.note||'—',
      ])
    }

    autoTable(doc, {
      head, body,
      startY: 34,
      styles: { fontSize: 9, cellPadding: 4, font: 'helvetica', textColor: [30,30,30] },
      headStyles: { fillColor: [99,102,241], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248,248,250] },
      columnStyles: reportType === 'inventory'
        ? { 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center'} }
        : reportType === 'critical'
        ? { 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center'} }
        : { 3:{halign:'center'}, 4:{halign:'center'} },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && (reportType === 'inventory' || reportType === 'critical')) {
          const statusCol = reportType === 'inventory' ? 4 : 5
          if (data.column.index === statusCol) {
            const val = data.cell.text[0]
            if (val === 'Zerado') doc.setTextColor(239,68,68)
            else if (val === 'Baixo') doc.setTextColor(245,158,11)
            else doc.setTextColor(34,197,94)
          }
        }
      },
    })

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(161,161,170)
      doc.text(`Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 8)
      doc.text(church, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' })
    }

    doc.save(`${reportType}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const L = { fontSize:'11px', color:'var(--text-3)', display:'block' as const, marginBottom:'5px' }

  return (
    <div style={{maxWidth:'1100px'}}>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'22px',fontWeight:'600'}}>Relatórios</h1>
        <p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Exporte dados do estoque em PDF ou Excel</p>
      </div>

      {/* Tipo de relatório */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'20px'}}>
        {(Object.entries(REPORT_CONFIG) as [ReportType, typeof REPORT_CONFIG.inventory][]).map(([key, cfg]) => (
          <button key={key} onClick={() => setReportType(key)} style={{
            padding:'16px', borderRadius:'var(--radius)', cursor:'pointer', textAlign:'left',
            background: reportType===key ? 'var(--bg-3)' : 'var(--bg-card)',
            border: reportType===key ? '1.5px solid var(--brand)' : '1px solid var(--border)',
            transition:'all 0.15s',
          }}>
            <div style={{marginBottom:'8px',color:reportType===key?'var(--brand-light)':'var(--text-3)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={cfg.icon}/></svg>
            </div>
            <div style={{fontSize:'13px',fontWeight:'600',color:reportType===key?'var(--text-1)':'var(--text-1)',marginBottom:'3px'}}>{cfg.label}</div>
            <div style={{fontSize:'11px',color:'var(--text-3)'}}>{cfg.desc}</div>
          </button>
        ))}
      </div>

      {/* Filtro de data para movimentações */}
      {reportType === 'movements' && (
        <div style={{display:'flex',gap:'12px',marginBottom:'20px',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px',alignItems:'flex-end'}}>
          <div style={{flex:1}}>
            <label style={L}>De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/>
          </div>
          <div style={{flex:1}}>
            <label style={L}>Até</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/>
          </div>
          <div style={{fontSize:'13px',color:'var(--text-3)',paddingBottom:'10px',whiteSpace:'nowrap'}}>
            {preview.length} registro(s)
          </div>
        </div>
      )}

      {/* Botões de exportação */}
      <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
        <button onClick={exportExcel} disabled={loading||preview.length===0} style={{
          display:'flex',alignItems:'center',gap:'8px',
          padding:'10px 20px',background:'#1a6e3c',color:'#fff',
          border:'none',borderRadius:'var(--radius-sm)',fontSize:'13px',fontWeight:'500',
          cursor:preview.length===0?'not-allowed':'pointer',opacity:preview.length===0?0.5:1,transition:'all 0.15s',
        }}
          onMouseEnter={e=>preview.length>0&&(e.currentTarget.style.background='#1d7d44')}
          onMouseLeave={e=>(e.currentTarget.style.background='#1a6e3c')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Exportar Excel
        </button>
        <button onClick={exportPDF} disabled={loading||preview.length===0} style={{
          display:'flex',alignItems:'center',gap:'8px',
          padding:'10px 20px',background:'#b91c1c',color:'#fff',
          border:'none',borderRadius:'var(--radius-sm)',fontSize:'13px',fontWeight:'500',
          cursor:preview.length===0?'not-allowed':'pointer',opacity:preview.length===0?0.5:1,transition:'all 0.15s',
        }}
          onMouseEnter={e=>preview.length>0&&(e.currentTarget.style.background='#c41e1e')}
          onMouseLeave={e=>(e.currentTarget.style.background='#b91c1c')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Exportar PDF
        </button>
        <button onClick={loadPreview} disabled={loading} style={{
          display:'flex',alignItems:'center',gap:'8px',
          padding:'10px 16px',background:'transparent',
          border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',
          fontSize:'13px',color:'var(--text-2)',cursor:'pointer',transition:'all 0.15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* Preview da tabela */}
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>
            {REPORT_CONFIG[reportType].label}
          </span>
          <span style={{fontSize:'12px',color:'var(--text-3)'}}>
            {preview.length} {preview.length===1?'registro':'registros'}
          </span>
        </div>

        {loading ? (
          <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:'8px'}}>
            {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:'40px',borderRadius:'6px'}}/>)}
          </div>
        ) : preview.length === 0 ? (
          <div style={{padding:'40px',textAlign:'center',fontSize:'13px',color:'var(--text-3)'}}>
            Nenhum dado encontrado para este relatório.
          </div>
        ) : reportType === 'inventory' || reportType === 'critical' ? (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['Produto','Categoria','Qtd','Mínimo','Status','Unidade'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((p:any,i:number)=>{
                  const s = p.quantity===0?'empty':p.quantity<=p.min_stock?'low':'ok'
                  const sc = {ok:{l:'OK',c:'var(--ok)',b:'var(--ok-dim)'},low:{l:'Baixo',c:'var(--low)',b:'var(--low-dim)'},empty:{l:'Zerado',c:'var(--empty)',b:'var(--empty-dim)'}}[s]
                  return (
                    <tr key={i} style={{borderBottom:'1px solid var(--border)'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{padding:'10px 14px',fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{p.name}</td>
                      <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-2)'}}>{p.category||'—'}</td>
                      <td style={{padding:'10px 14px',fontSize:'15px',fontWeight:'700',color:sc.c,fontFamily:'var(--font-mono)'}}>{p.quantity}</td>
                      <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-3)'}}>{p.min_stock}</td>
                      <td style={{padding:'10px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:sc.b,color:sc.c}}>{sc.l}</span></td>
                      <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-3)'}}>{p.unit||'un'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['Data','Produto','Tipo','Qtd','Usuário','Obs.'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((m:any,i:number)=>{
                  const tc = {in:{l:'Entrada',c:'var(--ok)',b:'var(--ok-dim)',s:'+'},out:{l:'Saída',c:'var(--empty)',b:'var(--empty-dim)',s:'-'},adjustment:{l:'Ajuste',c:'var(--info)',b:'var(--info-dim)',s:''}}[m.type as string]||{l:'—',c:'var(--text-2)',b:'transparent',s:''}
                  return (
                    <tr key={i} style={{borderBottom:'1px solid var(--border)'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-3)',fontFamily:'var(--font-mono)',whiteSpace:'nowrap'}}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                      <td style={{padding:'10px 14px',fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{m.product?.name||'—'}</td>
                      <td style={{padding:'10px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:tc.b,color:tc.c}}>{tc.l}</span></td>
                      <td style={{padding:'10px 14px',fontSize:'15px',fontWeight:'700',color:tc.c,fontFamily:'var(--font-mono)'}}>{tc.s}{m.quantity}</td>
                      <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-2)'}}>{m.profile?.name||'—'}</td>
                      <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-3)',maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.note||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
