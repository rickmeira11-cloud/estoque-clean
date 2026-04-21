'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product, StockMovement } from '@/types'
function Card({label,value,color,sub}:{label:string;value:number;color:string;sub?:string}) {
  return (<div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',padding:'20px',borderTop:`2px solid ${color}`}}><div style={{fontSize:'11px',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'8px'}}>{label}</div><div style={{fontSize:'30px',fontWeight:'700',color:'var(--text-1)',lineHeight:1}}>{value}</div>{sub&&<div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'6px'}}>{sub}</div>}</div>)
}
export default function DashboardPage() {
  const { profile } = useProfile()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])
  async function load() {
    const sb = createClient()
    const [{ data: prods },{ data: movs }] = await Promise.all([
      sb.from('products').select('*').eq('church_id',profile!.church_id).eq('is_active',true),
      sb.from('stock_movements').select('*,product:products(name)').eq('church_id',profile!.church_id).order('created_at',{ascending:false}).limit(8)
    ])
    if (prods) setProducts(prods as Product[])
    if (movs) setMovements(movs)
    setLoading(false)
  }
  const ok=products.filter(p=>p.quantity>p.min_stock).length
  const low=products.filter(p=>p.quantity>0&&p.quantity<=p.min_stock).length
  const empty=products.filter(p=>p.quantity===0).length
  const total=products.length
  const critical=products.filter(p=>p.quantity<=p.min_stock).sort((a,b)=>a.quantity-b.quantity).slice(0,6)
  const hora=new Date().getHours()
  const greeting=hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite'
  if (loading) return (<div><div className="skeleton" style={{width:'220px',height:'28px',marginBottom:'8px'}}/><div className="skeleton" style={{width:'160px',height:'16px',marginBottom:'32px'}}/><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>{[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:'96px',borderRadius:'12px'}}/>)}</div></div>)
  return (
    <div style={{maxWidth:'1000px'}}>
      <div style={{marginBottom:'28px'}}><h1 style={{fontSize:'22px',fontWeight:'600',color:'var(--text-1)'}}>{greeting}{profile?.name?`, ${profile.name.split(' ')[0]}`:''}.
      </h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>{profile?.church?.name} · {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',marginBottom:'24px'}}>
        <Card label="Total de itens" value={total} color="var(--brand)"/>
        <Card label="Em estoque" value={ok} color="var(--ok)" sub={total?`${Math.round(ok/total*100)}% do total`:undefined}/>
        <Card label="Estoque baixo" value={low} color="var(--low)"/>
        <Card label="Zerados" value={empty} color="var(--empty)"/>
      </div>
      {total>0&&(<div style={{display:'flex',height:'5px',borderRadius:'99px',overflow:'hidden',gap:'2px',marginBottom:'24px'}}><div style={{flex:ok,background:'var(--ok)',transition:'flex 0.5s'}}/><div style={{flex:low,background:'var(--low)',transition:'flex 0.5s'}}/><div style={{flex:empty,background:'var(--empty)',transition:'flex 0.5s'}}/></div>)}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}><span style={{fontSize:'13px',fontWeight:'500'}}>Atenção necessária</span>{critical.length>0&&<span style={{fontSize:'11px',background:'var(--empty-dim)',color:'var(--empty)',padding:'2px 8px',borderRadius:'99px'}}>{critical.length}</span>}</div>
          {critical.length===0?<div style={{fontSize:'13px',color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>Tudo em ordem ✓</div>:critical.map(p=>(
            <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',borderRadius:'8px',marginBottom:'6px',background:p.quantity===0?'var(--empty-dim)':'var(--low-dim)',border:`1px solid ${p.quantity===0?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)'}`}}>
              <div><div style={{fontSize:'13px',fontWeight:'500'}}>{p.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{p.category||'Sem categoria'}</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:'18px',fontWeight:'700',color:p.quantity===0?'var(--empty)':'var(--low)'}}>{p.quantity}</div><div style={{fontSize:'10px',color:'var(--text-3)'}}>mín {p.min_stock}</div></div>
            </div>
          ))}
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',padding:'20px'}}>
          <div style={{fontSize:'13px',fontWeight:'500',marginBottom:'14px'}}>Últimas movimentações</div>
          {movements.length===0?<div style={{fontSize:'13px',color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>Nenhuma movimentação ainda</div>:movements.map((m:any)=>(
            <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{width:'28px',height:'28px',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',background:m.type==='in'?'var(--ok-dim)':m.type==='out'?'var(--empty-dim)':'var(--info-dim)',color:m.type==='in'?'var(--ok)':m.type==='out'?'var(--empty)':'var(--info)'}}>{m.type==='in'?'↑':m.type==='out'?'↓':'⇄'}</div>
                <div><div style={{fontSize:'12px',fontWeight:'500'}}>{m.product?.name||'—'}</div><div style={{fontSize:'10px',color:'var(--text-3)'}}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div></div>
              </div>
              <div style={{fontSize:'14px',fontWeight:'700',color:m.type==='in'?'var(--ok)':m.type==='out'?'var(--empty)':'var(--text-2)'}}>{m.type==='in'?'+':m.type==='out'?'-':''}{m.quantity}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
