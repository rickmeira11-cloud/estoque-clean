'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ChurchRow = {
  id: string
  name: string
  slug: string | null
  city: string | null
  state: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  _users?: number
}

const toSlug=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const blank={name:'',slug:'',city:'',state:''}

export default function IgrejasPage() {
  const [churches,setChurches]=useState<ChurchRow[]>([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [editId,setEditId]=useState<string|null>(null)
  const [form,setForm]=useState(blank)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const sb=createClient()
    const {data}=await sb.from('churches').select('*').order('name')
    if(data){
      const rows = data as ChurchRow[]
      const wc:ChurchRow[]=await Promise.all(rows.map(async (c:ChurchRow)=>{
        const {count}=await sb.from('profiles').select('*',{count:'exact',head:true}).eq('church_id',c.id)
        return{...c,_users:count||0}
      }))
      setChurches(wc)
    }
    setLoading(false)
  }

  function openNew(){setEditId(null);setForm(blank);setError(null);setShowForm(true)}
  function openEdit(c:ChurchRow){setEditId(c.id);setForm({name:c.name,slug:c.slug||'',city:c.city||'',state:c.state||''});setError(null);setShowForm(true)}

  async function save(){
    if(!form.name.trim()){setError('Nome obrigatório');return}
    setSaving(true);setError(null)
    const payload={name:form.name.trim(),slug:form.slug||toSlug(form.name),city:form.city||null,state:form.state||null}
    const {error:err}=editId?await createClient().from('churches').update(payload).eq('id',editId):await createClient().from('churches').insert(payload)
    if(err)setError(err.code==='23505'?'Já existe uma igreja com esse slug.':err.message);else{setShowForm(false);await load()}
    setSaving(false)
  }

  async function toggleActive(c:ChurchRow){
    await createClient().from('churches').update({is_active:!c.is_active}).eq('id',c.id)
    await load()
  }

  const L={display:'block' as const,fontSize:'11px',color:'var(--text-3)',marginBottom:'5px'}

  return (
    <div style={{maxWidth:'800px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'600'}}>Igrejas</h1>
          <p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Organizações cadastradas no sistema</p>
        </div>
        <button onClick={openNew} style={{padding:'9px 18px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>+ Nova igreja</button>
      </div>
      {showForm&&(
        <div className="fade-up" style={{background:'var(--bg-card)',border:'1px solid var(--border-md)',borderRadius:'12px',padding:'24px',marginBottom:'20px'}}>
          <h2 style={{fontSize:'15px',fontWeight:'600',marginBottom:'18px'}}>{editId?'Editar':'Nova'} igreja</h2>
          {error&&<div style={{marginBottom:'12px',padding:'8px 12px',borderRadius:'6px',background:'var(--empty-dim)',fontSize:'12px',color:'var(--empty)'}}>{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div style={{gridColumn:'1/-1'}}><label style={L}>Nome *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value,slug:f.slug||toSlug(e.target.value)}))} placeholder="Ex: Poiema Blumenau"/></div>
            <div><label style={L}>Slug (único)</label><input value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))} style={{fontFamily:'monospace',fontSize:'13px'}} placeholder="poiema-blumenau"/></div>
            <div><label style={L}>Cidade</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} placeholder="Blumenau"/></div>
            <div><label style={L}>Estado</label><input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} placeholder="SC" maxLength={2}/></div>
          </div>
          <div style={{display:'flex',gap:'10px',marginTop:'18px'}}>
            <button onClick={save} disabled={saving} style={{padding:'9px 20px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>{saving?'Salvando...':editId?'Atualizar':'Criar'}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null)}} style={{padding:'9px 16px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}
      {loading?<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{[1,2].map(i=><div key={i} className="skeleton" style={{height:'72px',borderRadius:'12px'}}/>)}</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {churches.length===0?<div style={{textAlign:'center',padding:'40px',fontSize:'13px',color:'var(--text-3)'}}>Nenhuma igreja cadastrada.</div>:churches.map(c=>(
            <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px',borderRadius:'12px',background:'var(--bg-card)',border:`1px solid ${c.is_active?'var(--border)':'rgba(255,255,255,0.03)'}`,opacity:c.is_active?1:0.5}}>
              <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'10px',background:'var(--brand-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:'700',color:'var(--brand-light)',flexShrink:0}}>{c.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{fontSize:'14px',fontWeight:'500'}}>{c.name}</div>
                  <div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'3px',display:'flex',gap:'10px'}}>
                    <span>{[c.city,c.state].filter(Boolean).join(', ')||'Localização não informada'}</span>
                    <span style={{fontFamily:'monospace'}}>{c.slug}</span>
                    <span style={{color:'var(--text-2)'}}>{c._users} usuário(s)</span>
                  </div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'99px',background:c.is_active?'var(--ok-dim)':'rgba(255,255,255,0.05)',color:c.is_active?'var(--ok)':'var(--text-3)'}}>{c.is_active?'Ativa':'Inativa'}</span>
                <button onClick={()=>openEdit(c)} style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Editar</button>
                <button onClick={()=>toggleActive(c)} style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-3)',cursor:'pointer'}}>{c.is_active?'Desativar':'Ativar'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
