'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { StockMovement } from '@/types'
const T={in:{label:'Entrada',color:'var(--ok)',bg:'var(--ok-dim)',icon:'↑'},out:{label:'Saída',color:'var(--empty)',bg:'var(--empty-dim)',icon:'↓'},adjustment:{label:'Ajuste',color:'var(--info)',bg:'var(--info-dim)',icon:'⇄'}}
const PER=30
export default function HistoricoPage() {
  const {profile}=useProfile()
  const [rows,setRows]=useState<StockMovement[]>([])
  const [loading,setLoading]=useState(true)
  const [filterType,setFilterType]=useState('all')
  const [page,setPage]=useState(0)
  useEffect(()=>{if(profile?.church_id)load()},[profile?.church_id,filterType,page])
  async function load(){
    setLoading(true)
    let q=createClient().from('stock_movements').select('*,product:products(name,category),profile:profiles(name,email)').eq('church_id',profile!.church_id).order('created_at',{ascending:false}).range(page*PER,(page+1)*PER-1)
    if(filterType!=='all')q=q.eq('type',filterType)
    const {data}=await q
    if(data)setRows(data as any)
    setLoading(false)
  }
  return (
    <div style={{maxWidth:'900px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:'600'}}>Histórico</h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Registro de todas as movimentações</p></div>
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);setPage(0)}} style={{minWidth:'150px'}}><option value="all">Todos os tipos</option><option value="in">Entradas</option><option value="out">Saídas</option><option value="adjustment">Ajustes</option></select>
      </div>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:'1px solid var(--border)'}}>{['Data','Produto','Tipo','Qtd','Usuário','Obs.'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}</tr></thead>
          <tbody>
            {loading?[...Array(6)].map((_,i)=><tr key={i}><td colSpan={6} style={{padding:'12px 14px'}}><div className="skeleton" style={{height:'16px',borderRadius:'4px'}}/></td></tr>):rows.length===0?<tr><td colSpan={6} style={{padding:'40px',textAlign:'center',fontSize:'13px',color:'var(--text-3)'}}>Nenhuma movimentação encontrada</td></tr>:rows.map((m:any)=>{
              const t=T[m.type as keyof typeof T]||T.in
              return (<tr key={m.id} style={{borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-3)',fontFamily:'monospace',whiteSpace:'nowrap'}}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                <td style={{padding:'10px 14px'}}><div style={{fontSize:'13px',fontWeight:'500'}}>{m.product?.name||'—'}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{m.product?.category||''}</div></td>
                <td style={{padding:'10px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:t.bg,color:t.color}}>{t.icon} {t.label}</span></td>
                <td style={{padding:'10px 14px',fontSize:'16px',fontWeight:'700',fontFamily:'monospace',color:t.color}}>{m.type==='in'?'+':m.type==='out'?'-':''}{m.quantity}</td>
                <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-2)'}}>{m.profile?.name||m.profile?.email||'—'}</td>
                <td style={{padding:'10px 14px',fontSize:'12px',color:'var(--text-3)',maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.note||'—'}</td>
              </tr>)
            })}
          </tbody>
        </table>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderTop:'1px solid var(--border)'}}>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{padding:'6px 14px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:page===0?'var(--text-3)':'var(--text-2)',cursor:page===0?'default':'pointer'}}>← Anterior</button>
          <span style={{fontSize:'12px',color:'var(--text-3)'}}>Página {page+1}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={rows.length<PER} style={{padding:'6px 14px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:rows.length<PER?'var(--text-3)':'var(--text-2)',cursor:rows.length<PER?'default':'pointer'}}>Próxima →</button>
        </div>
      </div>
    </div>
  )
}
