// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

const ROLES = { super_admin: 'Super Admin', admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }
const blank = { name: '', email: '', role: 'operator', church_id: '' }

export default function UsuariosPage() {
  const { profile, isAdmin } = useProfile()
  const [users, setUsers] = useState([])
  const [churches, setChurches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [senhaGerada, setSenhaGerada] = useState('')

  useEffect(() => { if (profile?.church_id) loadAll() }, [profile?.church_id])

  async function loadAll() {
    setLoading(true)
    const sb = createClient()
    const isSuperAdmin = profile?.role === 'super_admin'
    const [{ data: usersData }, { data: churchesData }] = await Promise.all([
      isSuperAdmin
        ? sb.from('profiles').select('*, church:churches(id,name,city,state)').order('name')
        : sb.from('profiles').select('*, church:churches(id,name,city,state)').eq('church_id', profile.church_id).order('name'),
      sb.from('churches').select('id,name').eq('is_active', true).order('name'),
    ])
    if (usersData) setUsers(usersData)
    if (churchesData) setChurches(churchesData)
    setLoading(false)
  }

  function openNew() { setEditId(null); setForm({ ...blank, church_id: profile?.church_id || '' }); setError(null); setShowForm(true) }
  function openEdit(u) { setEditId(u.id); setForm({ name: u.name || '', email: u.email || '', role: u.role, church_id: u.church_id || '' }); setError(null); setShowForm(true) }

  async function save() {
    if (!form.name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError(null)
    if (editId) {
      const { error: err } = await createClient().from('profiles').update({ name: form.name.trim(), role: form.role, church_id: form.church_id || null }).eq('id', editId)
      if (err) setError(err.message)
      else { setShowForm(false); await loadAll() }
    } else {
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { session } } = await createClient().auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Erro ao criar usuário')
      else { setSenhaGerada(data.tempPassword || ''); setShowForm(false); await loadAll() }
    }
    setSaving(false)
  }

  async function toggleActive(u) {
    await createClient().from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    await loadAll()
  }

  const L = { display: 'block', fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }

  if (!isAdmin) return (
    <div><h1 style={{ fontSize: '22px', fontWeight: '600' }}>Usuários</h1><p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '8px' }}>Sem permissão.</p></div>
  )

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Usuários</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Gerencie acessos e vínculos com igrejas</p>
        </div>
        <button onClick={openNew} style={{ padding: '9px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', flexShrink: 0 }}>
          + Novo usuário
        </button>
      </div>

      {showForm && (
        <div className="fade-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '18px' }}>{editId ? 'Editar' : 'Novo'} usuário</h2>
          {error && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'var(--empty-dim)', fontSize: '12px', color: 'var(--empty)' }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={L}>Nome *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" /></div>
            {!editId && <div><label style={L}>E-mail *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@poiema.com" /></div>}
            <div>
              <label style={L}>Papel</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Igreja</label>
              <select value={form.church_id} onChange={e => setForm(f => ({ ...f, church_id: e.target.value }))}>
                <option value="">Sem vínculo</option>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!editId && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--info-dim)', fontSize: '12px', color: 'var(--info)', border: '1px solid rgba(99,102,241,0.2)' }}>
                Uma senha temporária será enviada por e-mail.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar usuário'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {senhaGerada && (
        <div className="fade-up" style={{ marginBottom:'16px', padding:'16px 20px', borderRadius:'12px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.3)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--brand-light)', marginBottom:'4px' }}>Usuário criado com sucesso!</div>
              <div style={{ fontSize:'12px', color:'var(--text-2)' }}>Senha temporária gerada — copie e envie ao usuário:</div>
              <div style={{ fontFamily:'monospace', fontSize:'16px', fontWeight:'700', color:'var(--text-1)', marginTop:'8px', padding:'8px 12px', background:'var(--bg-3)', borderRadius:'6px', letterSpacing:'0.05em' }}>{senhaGerada}</div>
              <div style={{ fontSize:'11px', color:'var(--text-3)', marginTop:'6px' }}>O usuário deve trocar a senha no primeiro acesso.</div>
            </div>
            <button onClick={() => setSenhaGerada('')} style={{ padding:'6px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', color:'var(--text-3)', cursor:'pointer', flexShrink:0, marginLeft:'16px' }}>Fechar</button>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />)}
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '13px', color: 'var(--text-3)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          Nenhum usuário cadastrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map(u => (
            <div key={u.id} style={{ borderRadius: '12px', background: 'var(--bg-card)', border: `1px solid ${u.is_active ? 'var(--border)' : 'rgba(255,255,255,0.03)'}`, opacity: u.is_active ? 1 : 0.5, overflow: 'hidden' }}>
              {/* Informações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: 'var(--brand-light)', flexShrink: 0 }}>
                  {(u.name || u.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '(sem nome)'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  {u.church && (
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.church.name}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {ROLES[u.role] || u.role}
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: u.is_active ? 'var(--ok-dim)' : 'rgba(255,255,255,0.05)', color: u.is_active ? 'var(--ok)' : 'var(--text-3)' }}>
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
              {/* Barra de ações */}
              <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openEdit(u)} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRight: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: '500' }}>
                  Editar
                </button>
                <button onClick={() => toggleActive(u)} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', fontSize: '13px', color: u.is_active ? 'var(--empty)' : 'var(--ok)', cursor: 'pointer', fontWeight: '500' }}>
                  {u.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
