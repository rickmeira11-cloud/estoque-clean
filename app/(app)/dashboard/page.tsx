'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product } from '@/types'

function Card({label,value,color,sub}:{label:string;value:number;color:string;sub?:string}) {
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px 20px',borderTop:`2px solid ${color}`}}>
      <div style={{fontSize:'10px',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'10px',fontWeight:'600'}}>{label}</div>
      <div style={{fontSize:'28px',fontWeight:'700',color:'var(--text-1)',lineHeight:1,fontFamily:'var(--font-mono)'}}>{value}</div>
      {sub&&<div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'6px'}}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { profile } = useProfile()
  const [products,  setProducts]  = useState<Product[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!profile?.church_id) return
    const sb = createClient()
    Promise.all([
      sb.from('products').select('id,name,quantity,min_stock,category').eq('church_id',profile.church_id).eq('is_active',true),
      sb.from('stock_movements').select('id,type,quantity,created_at,product:products(name)').eq('church_id',profile.church_id).order('created_at',{ascending:false}).limit(8)
    ]).then(([{data:prods},{data:movs}]) => {
      if (prods) setProducts(prods as Product[])
      if (movs)  setMovements(movs)
      setLoading(false)
    })
  }, [profile?.church_id])

  const ok       = products.filter(p=>p.quantity>p.min_stock).length
  const low      = products.filter(p=>p.quantity>0&&p.quantity<=p.min_stock).length
  const empty    = products.filter(p=>p.quantity===0).length
  const total    = products.length
  const critical = products.filter(p=>p.quantity<=p.min_stock).sort((a,b)=>a.quantity-b.quantity).slice(0,5)
  const hora     = new Date().getHours()
  const greeting = hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite'

  if (loading) return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <div className="skeleton" style={{width:'220px',height:'26px',marginBottom:'8px'}}/>
        <div className="skeleton" style={{width:'180px',height:'13px'}}/>
      </div>
      <div className="stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'12px'}}>
        {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:'88px',borderRadius:'var(--radius)'}}/>)}
      </div>
      <div className="bottom-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginTop:'14px'}}>
        <div className="skeleton" style={{height:'220px',borderRadius:'var(--radius)'}}/>
        <div className="skeleton" style={{height:'220px',borderRadius:'var(--radius)'}}/>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:'22px'}}>
        <h1 style={{fontSize:'22px',fontWeight:'600',color:'var(--text-1)',letterSpacing:'-0.02em'}}>
          {greeting}{profile?.name?`, ${profile.name.split(' ')[0]}`:''}.
        </h1>
        <p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>
          {profile?.church?.name} · {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'12px'}}>
        <Card label="Total" value={total} color="var(--brand)"/>
        <Card label="Em estoque" value={ok} color="var(--ok)" sub={total?`${Math.round(ok/total*100)}%`:undefined}/>
        <Card label="Baixo" value={low} color="var(--low)"/>
        <Card label="Zerado" value={empty} color="var(--empty)"/>
      </div>

      {/* Barra */}
      {total>0&&(
        <div style={{display:'flex',height:'4px',borderRadius:'99px',overflow:'hidden',gap:'2px',marginBottom:'20px'}}>
          <div style={{flex:ok||0.01,background:'var(--ok)',transition:'flex 0.6s'}}/>
          <div style={{flex:low||0.01,background:'var(--low)',transition:'flex 0.6s'}}/>
          <div style={{flex:empty||0.01,background:'var(--empty)',transition:'flex 0.6s'}}/>
        </div>
      )}

      {/* Grid inferior */}
      <div className="bottom-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>

        {/* Críticos */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <span style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>Atenção necessária</span>
            {critical.length>0&&<span style={{fontSize:'11px',background:'var(--empty-dim)',color:'var(--empty)',padding:'2px 9px',borderRadius:'99px',fontWeight:'500'}}>{critical.length}</span>}
          </div>
          {critical.length===0
            ?<div style={{fontSize:'13px',color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>Tudo em ordem ✓</div>
            :critical.map(p=>(
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:'var(--radius-sm)',marginBottom:'6px',background:p.quantity===0?'var(--empty-dim)':'var(--low-dim)',border:`1px solid ${p.quantity===0?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)'}`}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{p.name}</div>
                  <div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'1px'}}>{p.category||'Sem categoria'}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:'20px',fontWeight:'700',color:p.quantity===0?'var(--empty)':'var(--low)',fontFamily:'var(--font-mono)'}}>{p.quantity}</div>
                  <div style={{fontSize:'10px',color:'var(--text-3)'}}>mín {p.min_stock}</div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Movimentações */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px'}}>
          <div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)',marginBottom:'14px'}}>Últimas movimentações</div>
          {movements.length===0
            ?<div style={{fontSize:'13px',color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>Nenhuma movimentação ainda</div>
            :movements.map((m:any)=>(
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
                  <div style={{
                    width:'30px',height:'30px',borderRadius:'8px',flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',
                    background:m.type==='in'?'var(--ok-dim)':m.type==='out'?'var(--empty-dim)':'var(--info-dim)',
                    color:m.type==='in'?'var(--ok)':m.type==='out'?'var(--empty)':'var(--info)',
                  }}>{m.type==='in'?'↑':m.type==='out'?'↓':'⇄'}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.product?.name||'—'}</div>
                    <div style={{fontSize:'10px',color:'var(--text-3)',marginTop:'1px'}}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
                <div style={{fontSize:'14px',fontWeight:'700',flexShrink:0,marginLeft:'10px',fontFamily:'var(--font-mono)',color:m.type==='in'?'var(--ok)':m.type==='out'?'var(--empty)':'var(--text-2)'}}>
                  {m.type==='in'?'+':m.type==='out'?'-':''}{m.quantity}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
