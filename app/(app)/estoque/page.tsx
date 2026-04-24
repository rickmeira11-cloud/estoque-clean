'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product } from '@/types'
const S={ok:{label:'OK',color:'var(--ok)',bg:'var(--ok-dim)'},low:{label:'Baixo',color:'var(--low)',bg:'var(--low-dim)'},empty:{label:'Zerado',color:'var(--empty)',bg:'var(--empty-dim)'}}
const getStatus=(p:Product)=>p.quantity===0?'empty':p.quantity<=p.min_stock?'low':'ok'
const blank={name:'',category:'',type:'non_perishable',container:'',unit:'un',min_stock:'1',quantity:'0',last_purchase_value:'',expiration_date:'',notes:''}
function isDirty(form:typeof blank){return form.name!==blank.name||form.category!==blank.category||form.quantity!==blank.quantity||form.notes!==blank.notes}
export default function EstoquePage() {
  const {profile,canEdit}=useProfile()
  const [products,setProducts]=useState<Product[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filterStatus,setFilterStatus]=useState('all')
  const [filterCat,setFilterCat]=useState('all')
  const [categories,setCategories]=useState<string[]>([])
  const [showModal,setShowModal]=useState(false)
  const [editItem,setEditItem]=useState<Product|null>(null)
  const [form,setForm]=useState(blank)
  const [saving,setSaving]=useState(false)
  function handleClose(){if(isDirty(form)&&!confirm('Existem dados preenchidos. Deseja fechar sem salvar?'))return;setShowModal(false);setEditItem(null);setForm(blank)}
  const [formError,setFormError]=useState<string|null>(null)
  useEffect(()=>{if(profile?.church_id)load()},[profile?.church_id])
  async function load() {
    setLoading(true)
    const {data,error}=await createClient().from('products').select('*').eq('church_id',profile!.church_id).eq('is_active',true).order('name')
    console.log('[load] data:', data, 'error:', error)
    if(data){setProducts(data as Product[]);setCategories([...new Set(data.map((p:any)=>p.category).filter(Boolean))].sort() as string[])}
    setLoading(false)
  }
  function openNew(){setEditItem(null);setForm(blank);setFormError(null);setShowModal(true)}
  function openEdit(p:Product){setEditItem(p);setForm({name:p.name,category:p.category||'',type:p.type,container:p.container||'',unit:p.unit||'un',min_stock:String(p.min_stock),quantity:String(p.quantity),last_purchase_value:p.last_purchase_value?String(p.last_purchase_value):'',expiration_date:p.expiration_date||'',notes:p.notes||''});setFormError(null);setShowModal(true)}
  async function save() {
    if(!profile?.church_id){setFormError('Perfil não carregado. Aguarde e tente novamente.');return}
    if(!form.name.trim()){setFormError('Nome obrigatório');return}
    setSaving(true);setFormError(null)
    const sb=createClient()
    const payload={church_id:profile.church_id,name:form.name.trim(),category:form.category||null,type:form.type,container:form.container||null,unit:form.unit||'un',min_stock:parseInt(form.min_stock)||0,quantity:parseInt(form.quantity)||0,last_purchase_value:form.last_purchase_value?parseFloat(form.last_purchase_value):null,expiration_date:form.expiration_date||null,notes:form.notes||null}
    console.log('[save] profile:', profile)
    console.log('[save] payload:', payload)
    const {data,error}=editItem?await sb.from('products').update(payload).eq('id',editItem.id).select():await sb.from('products').insert(payload).select()
    console.log('[save] data:', data, 'error:', error)
    if(error){setFormError(error.message);setSaving(false);return}
    if(!data||data.length===0){setFormError('Nenhum dado retornado — verifique RLS no Supabase.');setSaving(false);return}
    setShowModal(false);setSaving(false);load()
  }
  async function deactivate(id:string){await createClient().from('products').update({is_active:false}).eq('id',id);load()}
  const filtered=products.filter(p=>{const s=getStatus(p);const ms=!search||p.name.toLowerCase().includes(search.toLowerCase())||(p.category||'').toLowerCase().includes(search.toLowerCase());return ms&&(filterStatus==='all'||s===filterStatus)&&(filterCat==='all'||p.category===filterCat)})
  const L={fontSize:'11px',color:'var(--text-3)',display:'block' as const,marginBottom:'5px'}
  return (
    <div style={{maxWidth:'1100px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:'600'}}>Estoque</h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>{products.length} {products.length===1?'item':'itens'} cadastrados</p></div>
        {canEdit&&<button onClick={openNew} style={{padding:'9px 18px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>+ Novo produto</button>}
      </div>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:'180px'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',flex:1}}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">Todos os status</option><option value="ok">OK</option><option value="low">Baixo</option><option value="empty">Zerado</option></select>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
        </div>
      </div>
      {loading?(<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:'52px',borderRadius:'8px'}}/>)}</div>):(
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>{['Produto','Categoria','Qtd','Mínimo','Status','Validade',''].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length===0?(<tr><td colSpan={7} style={{padding:'40px',textAlign:'center',color:'var(--text-3)',fontSize:'13px'}}>Nenhum produto encontrado</td></tr>):filtered.map(p=>{
                const s=getStatus(p);const {label,color,bg}=S[s]
                return (<tr key={p.id} style={{borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <td style={{padding:'12px 14px'}}><div style={{fontSize:'13px',fontWeight:'500'}}>{p.name}</div>{p.notes&&<div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'2px'}}>{p.notes}</div>}</td>
                  <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-2)'}}>{p.category||'—'}</td>
                  <td style={{padding:'12px 14px',fontSize:'18px',fontWeight:'700',color}}>{p.quantity}</td>
                  <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-3)'}}>{p.min_stock}</td>
                  <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:bg,color}}>{label}</span></td>
                  <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-3)'}}>{p.expiration_date?new Date(p.expiration_date).toLocaleDateString('pt-BR'):'—'}</td>
                  <td style={{padding:'12px 14px'}}>{canEdit&&(<div style={{display:'flex',gap:'6px'}}><button onClick={()=>openEdit(p)} style={{padding:'4px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Editar</button><button onClick={()=>deactivate(p.id)} style={{padding:'4px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-3)',cursor:'pointer'}}>✕</button></div>)}</td>
                </tr>)
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'20px'}} onClick={handleClose}>
          <div className="fade-up" onClick={e=>e.stopPropagation()} style={{background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'480px',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'22px'}}>{editItem?'Editar produto':'Novo produto'}</h2>
            {formError&&<div style={{marginBottom:'14px',padding:'8px 12px',borderRadius:'8px',background:'var(--empty-dim)',fontSize:'13px',color:'var(--empty)'}}>{formError}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div style={{gridColumn:'1/-1'}}><label style={L}>Nome *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Arroz 5kg"/></div>
              <div><label style={L}>Categoria</label><input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Ex: Alimentos" list="cats-list"/><datalist id="cats-list">{categories.map(c=><option key={c} value={c}/>)}</datalist></div>
              <div><label style={L}>Tipo</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="non_perishable">Não perecível</option><option value="perishable">Perecível</option></select></div>
              <div><label style={L}>Quantidade atual</label><input type="number" min="0" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))}/></div>
              <div><label style={L}>Estoque mínimo</label><input type="number" min="0" value={form.min_stock} onChange={e=>setForm(f=>({...f,min_stock:e.target.value}))}/></div>
              <div><label style={L}>Embalagem</label><input value={form.container} onChange={e=>setForm(f=>({...f,container:e.target.value}))} placeholder="Caixa, Kg..."/></div>
              <div><label style={L}>Último preço (R$)</label><input type="number" step="0.01" value={form.last_purchase_value} onChange={e=>setForm(f=>({...f,last_purchase_value:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={L}>Validade</label><input type="date" value={form.expiration_date} onChange={e=>setForm(f=>({...f,expiration_date:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={L}>Observações</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{resize:'none',height:'68px'}}/></div>
            </div>
            <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
              <button onClick={save} disabled={saving||!profile} style={{flex:1,padding:'10px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>{saving?'Salvando...':editItem?'Salvar':'Cadastrar'}</button>
              <button onClick={handleClose} style={{padding:'10px 18px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
