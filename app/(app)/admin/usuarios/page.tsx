'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, Church, UserRole } from '@/types'

const ROLES: Record<UserRole,string> = {super_admin:'Super Admin',admin:'Administrador',operator:'Operador',viewer:'Visualizador'}
const RC: Record<UserRole,{bg:string;color:string}> = {super_admin:{bg:'rgba(139,92,246,0.15)',color:'#a78bfa'},admin:{bg:'var(--info-dim)',color:'var(--info)'},operator:{bg:'var(--ok-dim)',color:'var(--ok)'},viewer:{bg:'rgba(255,255,255,0.06)',color:'var(--text-3)'}}
const blankNew = {name:'',email:'',password:'',role:'operator' as UserRole,church_id:''}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token || ''
}

export default function UsuariosPage() {
  const {profile:me,isAdmin,isSuperAdmin} = useProfile()
  const [profiles,setProfiles] = useState<(Profile&{church:Church|null})[]>([])
  const [churches,setChurches] = useState<Church[]>([])
  const [loading,setLoading] = useState(true)
  const [showNew,setShowNew] = useState(false)
  const [newForm,setNewForm] = useState(blankNew)
  const [editId,setEditId] = useState<string|null>(null)
  const [editForm,setEditForm] = useState<{name:string;role:UserRole;church_id:string;is_active:boolean}>({name:'',role:'operator',church_id:'',is_active:true})
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState<string|null>(null)
  const [success,setSuccess] = useState<string|null>(null)

  useEffect(() => { if (me) load() }, [me])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const [{data:p},{data:c}] = await Promise.all([
      sb.from('profiles').select('*,church:churches(*)').order('created_at',{ascending:false}),
      sb.from('churches').select('*').eq('is_active',true).order('name')
    ])
    if (p) setProfiles(p as any)
    if (c) setChurches(c as Church[])
    setLoading(false)
  }

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3500) }

  async function createUser() {
    if (!newForm.name.trim() || !newForm.email.trim() || !newForm.password.trim()) { setError('Nome, email e senha são obrigatórios'); return }
    setSaving(true); setError(null)
    const token = await getToken()
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newForm)
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowNew(false); setNewForm(blankNew)
    flash('Usuário criado com sucesso!')
    await load()
    setSaving(false)
  }

  function startEdit(p: Profile) {
    setEditId(p.id)
    setEditForm({name:p.name||'',role:p.role,church_id:p.church_id||'',is_active:p.is_active})
  }

  async function saveEdit(id: string) {
    setSaving(true); setError(null)
    const {error:err} = await createClient().from('profiles').update({
      name:editForm.name, role:editForm.role,
      church_id:editForm.church_id||null,
      is_active:editForm.is_active,
      updated_at:new Date().toISOString()
    }).eq('id',id)
    if (err) { setError(err.message); setSaving(false); return }
    setEditId(null); flash('Usuário atualizado!'); await load(); setSaving(false)
  }

  async function inativar(id: string) {
    if (!confirm('Inativar este usuário?')) return
    const token = await getToken()
    const res = await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({userId: id})
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    flash('Usuário inativado.'); await load()
  }

  async function reativar(id: string) {
    await createClient().from('profiles').update({is_active:true}).eq('id',id)
    flash('Usuário reativado.'); await load()
  }

  if (!isAdmin) return (
    <div style={{maxWidth:'600px'}}>
      <h1 style={{fontSize:'22px',fontWeight:'600'}}>Usuários</h1>
      <p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'8px'}}>Você não tem permissão para acessar esta página.</p>
    </div>
  )

  const noChurch = profiles.filter(p => !p.church_id).length
  const L = {display:'block' as const,fontSize:'11px',color:'var(--text-3)',marginBottom:'5px'}

  return (
    <div style={{maxWidth:'980px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'600'}}>Usuários</h1>
          <p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Gerencie acessos e vínculos com igrejas</p>
        </div>
        <button onClick={()=>{setShowNew(true);setError(null)}} style={{padding:'9px 18px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>+ Novo usuário</button>
      </div>

      {success&&<div className="fade-up" style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:'var(--ok-dim)',border:'1px solid rgba(34,197,94,0.2)',fontSize:'13px',color:'var(--ok)'}}>{success}</div>}
      {error&&<div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:'var(--empty-dim)',fontSize:'13px',color:'var(--empty)'}}>{error}<button onClick={()=>setError(null)} style={{marginLeft:'10px',background:'none',border:'none',color:'var(--empty)',cursor:'pointer'}}>✕</button></div>}
      {noChurch>0&&<div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:'var(--low-dim)',border:'1px solid rgba(245,158,11,0.2)',fontSize:'13px',color:'var(--low)'}}>{noChurch} usuário(s) sem igreja vinculada.</div>}

      {showNew&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'20px'}} onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="fade-up" style={{background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'440px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'22px'}}>Novo usuário</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              <div><label style={L}>Nome completo *</label><input value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} placeholder="Ex: João Silva"/></div>
              <div><label style={L}>E-mail *</label><input type="email" value={newForm.email} onChange={e=>setNewForm(f=>({...f,email:e.target.value}))} placeholder="joao@email.com"/></div>
              <div><label style={L}>Senha inicial *</label><input type="password" value={newForm.password} onChange={e=>setNewForm(f=>({...f,password:e.target.value}))} placeholder="Mínimo 6 caracteres"/></div>
              <div><label style={L}>Igreja</label>
                <select value={newForm.church_id} onChange={e=>setNewForm(f=>({...f,church_id:e.target.value}))}>
                  <option value="">— Sem vínculo —</option>
                  {churches.map(c=><option key={c.id} value={c.id}>{c.name}{c.city?` · ${c.city}`:''}</option>)}
                </select>
              </div>
              <div><label style={L}>Papel</label>
                <select value={newForm.role} onChange={e=>setNewForm(f=>({...f,role:e.target.value as UserRole}))}>
                  {isSuperAdmin&&<option value="super_admin">Super Admin</option>}
                  <option value="admin">Administrador</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
              <button onClick={createUser} disabled={saving} style={{flex:1,padding:'10px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>{saving?'Criando...':'Criar usuário'}</button>
              <button onClick={()=>{setShowNew(false);setError(null)}} style={{padding:'10px 18px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden'}}>
        {loading?(
          <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:'10px'}}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:'52px',borderRadius:'8px'}}/>)}</div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>{['Usuário','Igreja','Papel','Status',''].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}</tr></thead>
            <tbody>
              {profiles.map(p=>(
                <tr key={p.id} style={{borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  {editId===p.id?(
                    <>
                      <td style={{padding:'10px 14px'}}><input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} style={{fontSize:'13px'}}/><div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'4px'}}>{p.email}</div></td>
                      <td style={{padding:'10px 14px'}}><select value={editForm.church_id} onChange={e=>setEditForm(f=>({...f,church_id:e.target.value}))} style={{fontSize:'12px'}}><option value="">— Sem vínculo —</option>{churches.map(c=><option key={c.id} value={c.id}>{c.name}{c.city?` · ${c.city}`:''}</option>)}</select></td>
                      <td style={{padding:'10px 14px'}}><select value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value as UserRole}))} style={{fontSize:'12px'}}>{isSuperAdmin&&<option value="super_admin">Super Admin</option>}<option value="admin">Administrador</option><option value="operator">Operador</option><option value="viewer">Visualizador</option></select></td>
                      <td style={{padding:'10px 14px'}}><label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}><input type="checkbox" checked={editForm.is_active} onChange={e=>setEditForm(f=>({...f,is_active:e.target.checked}))} style={{width:'auto'}}/>Ativo</label></td>
                      <td style={{padding:'10px 14px'}}><div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}><button onClick={()=>saveEdit(p.id)} disabled={saving} style={{padding:'5px 12px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>{saving?'...':'Salvar'}</button><button onClick={()=>setEditId(null)} style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Cancelar</button></div></td>
                    </>
                  ):(
                    <>
                      <td style={{padding:'12px 14px'}}><div style={{display:'flex',alignItems:'center',gap:'10px'}}><div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--brand-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'600',color:'var(--brand-light)',flexShrink:0}}>{(p.name||p.email||'?').charAt(0).toUpperCase()}</div><div><div style={{fontSize:'13px',fontWeight:'500'}}>{p.name||'(sem nome)'}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{p.email}</div></div></div></td>
                      <td style={{padding:'12px 14px'}}>{p.church?<div><div style={{fontSize:'13px'}}>{p.church.name}</div>{p.church.city&&<div style={{fontSize:'11px',color:'var(--text-3)'}}>{p.church.city}, {p.church.state}</div>}</div>:<span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:'var(--low-dim)',color:'var(--low)'}}>Sem vínculo</span>}</td>
                      <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',...RC[p.role]}}>{ROLES[p.role]}</span></td>
                      <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'99px',background:p.is_active?'var(--ok-dim)':'rgba(255,255,255,0.05)',color:p.is_active?'var(--ok)':'var(--text-3)'}}>{p.is_active?'Ativo':'Inativo'}</span></td>
                      <td style={{padding:'12px 14px'}}>
                        {p.id!==me?.id&&(
                          <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                            <button onClick={()=>startEdit(p)} style={{padding:'5px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Editar</button>
                            {p.is_active
                              ?<button onClick={()=>inativar(p.id)} style={{padding:'5px 10px',background:'transparent',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'6px',fontSize:'12px',color:'var(--empty)',cursor:'pointer'}}>Inativar</button>
                              :<button onClick={()=>reativar(p.id)} style={{padding:'5px 10px',background:'transparent',border:'1px solid rgba(34,197,94,0.3)',borderRadius:'6px',fontSize:'12px',color:'var(--ok)',cursor:'pointer'}}>Reativar</button>
                            }
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
