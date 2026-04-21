'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, Church, UserRole } from '@/types'
const ROLES:Record<UserRole,string>={super_admin:'Super Admin',admin:'Administrador',operator:'Operador',viewer:'Visualizador'}
const RC:Record<UserRole,{bg:string;color:string}>={super_admin:{bg:'rgba(139,92,246,0.15)',color:'#a78bfa'},admin:{bg:'var(--info-dim)',color:'var(--info)'},operator:{bg:'var(--ok-dim)',color:'var(--ok)'},viewer:{bg:'rgba(255,255,255,0.06)',color:'var(--text-3)'}}
export default function UsuariosPage() {
  const {profile:me,isSuperAdmin}=useProfile()
  const [profiles,setProfiles]=useState<(Profile&{church:Church|null})[]>([])
  const [churches,setChurches]=useState<Church[]>([])
  const [loading,setLoading]=useState(true)
  const [editId,setEditId]=useState<string|null>(null)
  const [form,setForm]=useState<{name:string;role:UserRole;church_id:string;is_active:boolean}>({name:'',role:'operator',church_id:'',is_active:true})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{if(me)load()},[me])
  async function load(){
    setLoading(true)
    const sb=createClient()
    const [{data:p},{data:c}]=await Promise.all([sb.from('profiles').select('*,church:churches(*)').order('created_at',{ascending:false}),sb.from('churches').select('*').eq('is_active',true).order('name')])
    if(p)setProfiles(p as any);if(c)setChurches(c as Church[])
    setLoading(false)
  }
  function startEdit(p:Profile){setEditId(p.id);setForm({name:p.name||'',role:p.role,church_id:p.church_id||'',is_active:p.is_active})}
  async function saveEdit(id:string){
    setSaving(true);setError(null)
    const {error:err}=await createClient().from('profiles').update({name:form.name,role:form.role,church_id:form.church_id||null,is_active:form.is_active,updated_at:new Date().toISOString()}).eq('id',id)
    if(err)setError(err.message);else{setEditId(null);await load()}
    setSaving(false)
  }
  const noChurch=profiles.filter(p=>!p.church_id).length
  return (
    <div style={{maxWidth:'960px'}}>
      <div style={{marginBottom:'24px'}}><h1 style={{fontSize:'22px',fontWeight:'600'}}>Usuários</h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Vincule usuários às igrejas e gerencie papéis</p></div>
      {error&&<div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:'var(--empty-dim)',fontSize:'13px',color:'var(--empty)'}}>{error}</div>}
      {noChurch>0&&<div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:'var(--low-dim)',border:'1px solid rgba(245,158,11,0.2)',fontSize:'13px',color:'var(--low)'}}>{noChurch} usuário(s) sem igreja vinculada.</div>}
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden'}}>
        {loading?<div style={{padding:'20px',display:'flex',flexDirection:'column',gap:'10px'}}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:'52px',borderRadius:'8px'}}/>)}</div>:(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>{['Usuário','Igreja','Papel','Status',''].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}</tr></thead>
            <tbody>{profiles.map(p=>(
              <tr key={p.id} style={{borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                {editId===p.id?(
                  <><td style={{padding:'10px 14px'}}><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nome" style={{fontSize:'13px'}}/><div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'4px'}}>{p.email}</div></td>
                  <td style={{padding:'10px 14px'}}><select value={form.church_id} onChange={e=>setForm(f=>({...f,church_id:e.target.value}))} style={{fontSize:'12px'}}><option value="">— Sem vínculo —</option>{churches.map(c=><option key={c.id} value={c.id}>{c.name}{c.city?` · ${c.city}`:''}</option>)}</select></td>
                  <td style={{padding:'10px 14px'}}><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as UserRole}))} style={{fontSize:'12px'}}>{isSuperAdmin&&<option value="super_admin">Super Admin</option>}<option value="admin">Administrador</option><option value="operator">Operador</option><option value="viewer">Visualizador</option></select></td>
                  <td style={{padding:'10px 14px'}}><label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}><input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{width:'auto'}}/>Ativo</label></td>
                  <td style={{padding:'10px 14px'}}><div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}><button onClick={()=>saveEdit(p.id)} disabled={saving} style={{padding:'5px 12px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>{saving?'...':'Salvar'}</button><button onClick={()=>setEditId(null)} style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Cancelar</button></div></td></>
                ):(
                  <><td style={{padding:'12px 14px'}}><div style={{display:'flex',alignItems:'center',gap:'10px'}}><div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--brand-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'600',color:'var(--brand-light)',flexShrink:0}}>{(p.name||p.email||'?').charAt(0).toUpperCase()}</div><div><div style={{fontSize:'13px',fontWeight:'500'}}>{p.name||'(sem nome)'}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{p.email}</div></div></div></td>
                  <td style={{padding:'12px 14px'}}>{p.church?<div><div style={{fontSize:'13px'}}>{p.church.name}</div>{p.church.city&&<div style={{fontSize:'11px',color:'var(--text-3)'}}>{p.church.city}, {p.church.state}</div>}</div>:<span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:'var(--low-dim)',color:'var(--low)'}}>Sem vínculo</span>}</td>
                  <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',...RC[p.role]}}>{ROLES[p.role]}</span></td>
                  <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'99px',background:p.is_active?'var(--ok-dim)':'rgba(255,255,255,0.05)',color:p.is_active?'var(--ok)':'var(--text-3)'}}>{p.is_active?'Ativo':'Inativo'}</span></td>
                  <td style={{padding:'12px 14px',textAlign:'right'}}>{p.id!==me?.id&&<button onClick={()=>startEdit(p)} style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Editar</button>}</td></>
                )}
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}

