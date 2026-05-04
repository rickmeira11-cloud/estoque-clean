// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

const blank = { name: '', description: '' }

export default function DepositosPage() {
  const { profile, isAdmin } = useProfile()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const formRef  = useRef(null)
  const firstRef = useRef(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient().from('locations').select('*').eq('church_id', profile.church_id).order('name')
    if (data) setLocations(data)
    setLoading(false)
  }

  function openNew() { setEditId(null); setForm(blank); setError(null); setShowForm(true); setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); firstRef.current?.focus() }, 100) }
  function openEdit(l) { setEditId(l.id); setForm({ name: l.name, description: l.description || '' }); setError(null); setShowForm(true); setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); firstRef.current?.focus() }, 100) }

  async function save() {
    if (!form.name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError(null)
    const payload = { church_id: profile.church_id, name: form.name.trim(), description: form.description || null }
    const { error: err } = editId
      ? await createClient().from('locations').update(payload).eq('id', editId)
      : await createClient().from('locations').insert(payload)
    if (err) setError(err.message)
    else { setShowForm(false); await load() }
    setSaving(false)
  }

  async function toggleActive(l) {
    await createClient().from('locations').update({ is_active: !l.is_active }).eq('id', l.id)
    await load()
  }

  const L = { display: 'block', fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }

  if (!isAdmin) return (
    <div><h1 style={{ fontSize: '22px', fontWeight: '600' }}>Depósitos</h1><p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '8px' }}>Sem permissão.</p></div>
  )

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Depósitos</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Locais de armazenamento dos produtos</p>
        </div>
        <button onClick={openNew} style={{ padding: '9px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', flexShrink: 0 }}>
          + Novo depósito
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="fade-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '18px' }}>{editId ? 'Editar' : 'Novo'} depósito</h2>
          {error && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'var(--empty-dim)', fontSize: '12px', color: 'var(--empty)' }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={L}>Nome *</label><input ref={firstRef} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Almoxarifado" /></div>
            <div><label style={L}>Descrição</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Depósito principal do térreo" /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '10px' }} />)}
        </div>
      ) : locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '13px', color: 'var(--text-3)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          Nenhum depósito cadastrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {locations.map(l => (
            <div key={l.id} style={{ borderRadius: '10px', background: 'var(--bg-card)', border: `1px solid ${l.is_active ? 'var(--border)' : 'rgba(255,255,255,0.03)'}`, opacity: l.is_active ? 1 : 0.5, overflow: 'hidden' }}>
              {/* Informações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{l.name}</div>
                  {l.description && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</div>}
                </div>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: l.is_active ? 'var(--ok-dim)' : 'rgba(255,255,255,0.05)', color: l.is_active ? 'var(--ok)' : 'var(--text-3)', flexShrink: 0 }}>
                  {l.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {/* Barra de ações */}
              <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openEdit(l)} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRight: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: '500' }}>
                  Editar
                </button>
                <button onClick={() => toggleActive(l)} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', fontSize: '13px', color: l.is_active ? 'var(--empty)' : 'var(--ok)', cursor: 'pointer', fontWeight: '500' }}>
                  {l.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
