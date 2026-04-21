'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product } from '@/types'
type MovType='in'|'out'|'adjustment'
const CFG={in:{label:'Entrada',color:'var(--ok)',icon:'↑',desc:'Adicionar ao estoque'},out:{label:'Saída',color:'var(--empty)',icon:'↓',desc:'Retirar do estoque'},adjustment:{label:'Ajuste',color:'var(--info)',icon:'⇄',desc:'Definir quantidade exata'}}
export default function MovimentacoesPage() {
  const {profile,canEdit}=useProfile()
  const [products,setProducts]=useState<Product[]>([])
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<Product|null>(null)
  const [type,setType]=useState<MovType>('in')
  const [qty,setQty]=useState('')
  const [note,setNote]=useState('')
  const [saving,setSaving]=useState(false)
  const [success,setSuccess]=useState(false)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{if(profile?.church_id)load()},[profile?.church_id])
  async function load(){const {data}=await createClient().from('products').select('*').eq('church_id',profile!.church_id).eq('is_active',true).order('name');if(data)setProducts(data as Product[])}
  async function submit(){
    if(!selected||!qty||parseInt(qty)<=0)return
    const n=parseInt(qty)
    if(type==='out'&&n>selected.quantity){setError(`Estoque insuficiente. Disponível: ${selected.quantity}`);return}
    setSaving(true);setError(null)
    const {error:err}=await createClient().from('stock_movements').insert({church_id:profile!.church_id,product_id:selected.id,user_id:profile!.id,type,quantity:n,note:note||null})
    if(err){setError(err.message);setSaving(false);return}
    setSuccess(true);setQty('');setNote('');setSelected(null);setSearch('');await load()
    setTimeout(()=>setSuccess(false),3500);setSaving(false)
  }
  const filtered=products.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||(p.category||'').toLowerCase().includes(search.toLowerCase()))
  const preview=selected&&qty&&parseInt(qty)>0?(type==='in'?selected.quantity+parseInt(qty):type==='out'?selected.quantity-parseInt(qty):parseInt(qty)):null
  if(!canEdit)return(<div style={{maxWidth:'600px'}}><h1 style={{fontSize:'22px',fontWeight:'600'}}>Movimentar</h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'8px'}}>Você não tem permissão para movimentar o estoque.</p></div>)
  return (
    <div style={{maxWidth:'720px'}}>
      <div style={{marginBottom:'24px'}}><h1 style={{fontSize:'22px',fontWeight:'600'}}>Movimentar estoque</h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Registre entradas, saídas e ajustes</p></div>
      {success&&<div className="fade-up" style={{marginBottom:'16px',padding:'12px 16px',borderRadius:'10px',background:'var(--ok-dim)',border:'1px solid rgba(34,197,94,0.2)',fontSize:'13px',color:'var(--ok)'}}>Movimentação registrada com sucesso!</div>}
      {error&&<div style={{marginBottom:'16px',padding:'12px 16px',borderRadius:'10px',background:'var(--empty-dim)',border:'1px solid rgba(239,68,68,0.2)',fontSize:'13px',color:'var(--empty)'}}>{error}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'20px'}}>
        {(Object.entries(CFG) as [MovType,typeof CFG.in][]).map(([k,c])=>(
          <button key={k} onClick={()=>setType(k)} style={{padding:'14px 12px',borderRadius:'10px',cursor:'pointer',textAlign:'left',background:type===k?'var(--bg-3)':'var(--bg-card)',border:type===k?`1.5px solid ${c.color}`:'1px solid var(--border)',transition:'all 0.15s'}}>
            <div style={{fontSize:'18px',color:c.color,marginBottom:'6px'}}>{c.icon}</div>
            <div style={{fontSize:'13px',fontWeight:'600',color:type===k?c.color:'var(--text-1)'}}>{c.label}</div>
            <div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'2px'}}>{c.desc}</div>
          </button>
        ))}
      </div>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',padding:'22px'}}>
        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'11px',color:'var(--text-3)',marginBottom:'6px'}}>Produto *</label>
          <input placeholder="Buscar produto..." value={selected?selected.name:search} onChange={e=>{setSearch(e.target.value);setSelected(null)}}/>
          {!selected&&search&&(<div style={{background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'8px',overflow:'hidden',maxHeight:'200px',overflowY:'auto',marginTop:'4px'}}>
            {filtered.length===0?<div style={{padding:'12px',fontSize:'13px',color:'var(--text-3)'}}>Nenhum produto</div>:filtered.map(p=>(
              <div key={p.id} onClick={()=>{setSelected(p);setSearch(p.name)}} style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)',fontSize:'13px'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <span style={{fontWeight:'500'}}>{p.name}</span><span style={{fontSize:'11px',color:'var(--text-3)',marginLeft:'10px'}}>{p.category||'Sem categoria'} · Qtd: {p.quantity}</span>
              </div>
            ))}
          </div>)}
        </div>
        {selected&&(<div style={{padding:'10px 14px',borderRadius:'8px',background:'var(--bg-3)',border:'1px solid var(--border-md)',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontSize:'13px',fontWeight:'500'}}>{selected.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{selected.category||'Sem categoria'}</div></div>
          <div style={{textAlign:'right'}}><div style={{fontSize:'11px',color:'var(--text-3)'}}>Estoque atual</div><div style={{fontSize:'22px',fontWeight:'700',fontFamily:'monospace'}}>{selected.quantity}</div></div>
        </div>)}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}}>
          <div>
            <label style={{display:'block',fontSize:'11px',color:'var(--text-3)',marginBottom:'6px'}}>Quantidade * {type==='adjustment'&&<span style={{color:'var(--info)'}}>(valor final)</span>}</label>
            <input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" style={{fontSize:'20px',fontFamily:'monospace'}}/>
          </div>
          {preview!==null&&(<div style={{padding:'12px',borderRadius:'8px',background:'var(--bg-3)',border:'1px solid var(--border)',display:'flex',flexDirection:'column',justifyContent:'center'}}>
            <div style={{fontSize:'11px',color:'var(--text-3)'}}>Após movimentação</div>
            <div style={{fontSize:'26px',fontWeight:'700',fontFamily:'monospace',marginTop:'4px',color:preview<0?'var(--empty)':preview<=(selected?.min_stock||0)?'var(--low)':'var(--ok)'}}>{Math.max(0,preview)}</div>
            {preview<0&&<div style={{fontSize:'11px',color:'var(--empty)'}}>Insuficiente</div>}
          </div>)}
        </div>
        <div style={{marginBottom:'18px'}}><label style={{display:'block',fontSize:'11px',color:'var(--text-3)',marginBottom:'6px'}}>Observação (opcional)</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex: Doação recebida, consumido no evento..."/></div>
        <button onClick={submit} disabled={saving||!selected||!qty||parseInt(qty)<=0} style={{width:'100%',padding:'12px',background:(!selected||!qty)?'var(--bg-3)':CFG[type].color,color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'600',cursor:(!selected||!qty||saving)?'not-allowed':'pointer',opacity:saving?0.7:1,transition:'all 0.15s'}}>
          {saving?'Registrando...':`Registrar ${CFG[type].label}`}
        </button>
      </div>
    </div>
  )
}
