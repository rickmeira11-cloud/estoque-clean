// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

const ROLES = { super_admin: 'Super Admin', admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }
const blank = { name: '', email: '', role: 'operator' }

export default function UsuariosPage() {
  const { profile, isAdmin } = useProfile()
  const [users,        setUsers]        = useState([])
  const [churches,     setChurches]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(blank)
  const [userChurches, setUserChurches] = useState([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  const [senhaGerada,  setSenhaGerada]  = useState('')

  useEffect(() => { if (profile?.church_id) loadAll() }, [profile?.church_id])

  async function loadAll() {
    setLoading(true)
    const sb = createClient()
    const isSuperAdmin = profile?.role === 'super_admin'
    const [{ data: usersData }, { data: churchesData }] = await Promise.all([
      isSuperAdmin
        ? sb.from('profiles').select('*, church:churches(id,name,city,state)').order('name')
        : sb.from('profiles').select('*, church:churches(id,name,city,state)').eq('church_id', profile.church_id).order('name'),
      sb.from('churches').select('id,name,city,state').eq('is_active', true).order('name'),
    ])
    if (usersData) setUsers(usersData)
    if (churchesData) setChurches(churchesData)
    setLoading(false)
  }

  async function loadUserChurches(userId) {
    const { data } = await createClient()
      .from('user_churches')
      .select('id, church_id, role, is_active, church:churches(id,name,city,state)')
      .eq('user_id', userId)
    return data || []
  }

  async function openNew() {
    setEditId(null); setForm(blank)
    setUserChurches([{ church_id: profile.church_id, role: 'operator', is_active: true, church: churches.find(c => c.id === profile.church_id) }])
    setError(null); setShowForm(true)
  }

  async function openEdit(u) {
    setEditId(u.id); setForm({ name: u.name || '', email: u.email || '', role: u.role }); setError(null)
    const uc = await loadUserChurches(u.id)
    setUserChurches(uc.length > 0 ? uc : [{ church_id: profile.church_id, role: u.role, is_active: true, church: churches.find(c => c.id === profile.church_id) }])
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Nome obrigatorio'); return }
    if (userChurches.length === 0) { setError('Vincule pelo menos uma igreja'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    if (editId) {
      await sb.from('profiles').update({ name: form.name.trim(), role: form.role }).eq('id', editId)
      await sb.from('user_churches').delete().eq('user_id', editId)
      for (const uc of userChurches) {
        await sb.from('user_churches').insert({ user_id: editId, church_id: uc.church_id, role: uc.role, is_active: uc.is_active !== false })
      }
      setShowForm(false); await loadAll()
    } else {
      if (!form.email.trim()) { setError('E-mail obrigatorio'); setSaving(false); return }
      const { data: { session } } = await sb.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ ...form, church_id: userChurches[0]?.church_id || profile?.church_id })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar usuario'); setSaving(false); return }
      for (const uc of userChurches) {
        await sb.from('user_churches').upsert({ user_id: data.id, church_id: uc.church_id, role: uc.role, is_active: true }, { onConflict: 'user_id,church_id' })
      }
      setSenhaGerada(data.tempPassword || ''); setShowForm(false); await loadAll()
    }
    setSaving(false)
  }

  async function toggleActive(u) {
    await createClient().from('profiles').update({ is_active: !u.is_active }).eq('id', u.id); await loadAll()
  }

  function addChurch() {
    const rem = churches.filter(c => !userChurches.find(uc => uc.church_id === c.id))
    if (!rem.length) return
    setUserChurches(p => [...p, { church_id: rem[0].id, role: 'operator', is_active: true, church: rem[0] }])
  }

  function removeChurch(idx) {
    if (userChurches.length === 1) { setError('Necessario pelo menos uma igreja'); return }
    setUserChurches(p => p.filter((_, i) => i !== idx))
  }

  function updateChurch(idx, field, value) {
    setUserChurches(p => p.map((uc, i) => {
      if (i !== idx) return uc
      if (field === 'church_id') return { ...uc, church_id: value, church: churches.find(c => c.id === value) }
      return { ...uc, [field]: value }
    }))
  }

  const L = { display: 'block', fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }
  if (!isAdmin) return <div><h1>Usuarios</h1><p>Sem permissao.</p></div>

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px', gap:'12px' }}>
        <div><h1 style={{ fontSize:'22px', fontWeight:'600' }}>Usuarios</h1><p style={{ fontSize:'13px', color:'var(--text-3)', marginTop:'4px' }}>Gerencie acessos e vinculos com igrejas</p></div>
        <button onClick={openNew} style={{ padding:'9px 18px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', flexShrink:0 }}>+ Novo usuario</button>
      </div>

      {senhaGerada && (
        <div style={{ marginBottom:'16px', padding:'16px 20px', borderRadius:'12px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.3)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--brand-light)', marginBottom:'4px' }}>Usuario criado!</div>
              <div style={{ fontSize:'12px', color:'var(--text-2)' }}>Senha temporaria:</div>
              <div style={{ fontFamily:'monospace', fontSize:'16px', fontWeight:'700', color:'var(--text-1)', marginTop:'8px', padding:'8px 12px', background:'var(--bg-3)', borderRadius:'6px', letterSpacing:'0.05em' }}>{senhaGerada}</div>
            </div>
            <button onClick={() => setSenhaGerada('')} style={{ padding:'6px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', color:'var(--text-3)', cursor:'pointer', marginLeft:'16px' }}>Fechar</button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-md)', borderRadius:'12px', padding:'24px', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'15px', fontWeight:'600', marginBottom:'18px' }}>{editId ? 'Editar' : 'Novo'} usuario</h2>
          {error && <div style={{ marginBottom:'12px', padding:'8px 12px', borderRadius:'6px', background:'var(--empty-dim)', fontSize:'12px', color:'var(--empty)' }}>{error}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div><label style={L}>Nome *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" /></div>
            {!editId && <div><label style={L}>E-mail *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@poiema.com" /></div>}
            <div><label style={L}>Papel padrao</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{Object.entries(ROLES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                <label style={{ fontSize:'12px', fontWeight:'500', color:'var(--text-2)' }}>Igrejas vinculadas</label>
                <button type="button" onClick={addChurch} disabled={churches.length === userChurches.length} style={{ padding:'3px 10px', background:'var(--brand-dim)', border:'1px solid var(--brand)', borderRadius:'6px', fontSize:'11px', color:'var(--brand-light)', cursor:'pointer' }}>+ Adicionar igreja</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {userChurches.map((uc, idx) => (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 150px auto', gap:'8px', alignItems:'center', padding:'10px 12px', borderRadius:'8px', background:'var(--bg-3)', border:'1px solid var(--border)' }}>
                    <select value={uc.church_id} onChange={e => updateChurch(idx, 'church_id', e.target.value)}>{churches.map(c => <option key={c.id} value={c.id} disabled={userChurches.some((u,i) => i !== idx && u.church_id === c.id)}>{c.name}{c.city ? ' - ' + c.city : ''}</option>)}</select>
                    <select value={uc.role} onChange={e => updateChurch(idx, 'role', e.target.value)}>{Object.entries(ROLES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <button type="button" onClick={() => removeChurch(idx)} style={{ padding:'6px 10px', background:'transparent', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', color:'var(--empty)', cursor:'pointer' }}>x</button>
                  </div>
                ))}
              </div>
            </div>
            {!editId && <div style={{ padding:'10px 12px', borderRadius:'8px', background:'var(--info-dim)', fontSize:'12px', color:'var(--info)', border:'1px solid rgba(99,102,241,0.2)' }}>Uma senha temporaria sera gerada apos a criacao.</div>}
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'18px' }}>
            <button onClick={save} disabled={saving} style={{ padding:'9px 20px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', opacity:saving?0.7:1 }}>{saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar usuario'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding:'9px 16px', background:'transparent', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px', color:'var(--text-2)', cursor:'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:'80px', borderRadius:'12px' }} />)}</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', fontSize:'13px', color:'var(--text-3)', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'12px' }}>Nenhum usuario.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {users.map(u => (
            <div key={u.id} style={{ borderRadius:'12px', background:'var(--bg-card)', border:"1px solid " + (u.is_active ? 'var(--border)' : 'rgba(255,255,255,0.03)'), opacity:u.is_active?1:0.5, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'var(--brand-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:'var(--brand-light)', flexShrink:0 }}>{(u.name||u.email||'?').charAt(0).toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:'600', color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name||'(sem nome)'}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-3)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
                  {u.church && <div style={{ fontSize:'11px', color:'var(--text-3)', marginTop:'1px' }}>{u.church.name}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', flexShrink:0 }}>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'99px', background:'var(--brand-dim)', color:'var(--brand-light)', fontWeight:'500' }}>{ROLES[u.role]||u.role}</span>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'99px', background:u.is_active?'var(--ok-dim)':'rgba(255,255,255,0.05)', color:u.is_active?'var(--ok)':'var(--text-3)' }}>{u.is_active?'Ativo':'Inativo'}</span>
                </div>
              </div>
              <div style={{ display:'flex', borderTop:'1px solid var(--border)' }}>
                <button onClick={() => openEdit(u)} style={{ flex:1, padding:'10px', background:'transparent', border:'none', borderRight:'1px solid var(--border)', fontSize:'13px', color:'var(--text-2)', cursor:'pointer', fontWeight:'500' }}>Editar</button>
                <button onClick={() => toggleActive(u)} style={{ flex:1, padding:'10px', background:'transparent', border:'none', fontSize:'13px', color:u.is_active?'var(--empty)':'var(--ok)', cursor:'pointer', fontWeight:'500' }}>{u.is_active?'Desativar':'Ativar'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}