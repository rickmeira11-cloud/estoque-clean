'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import AdminTable, { type FieldDef } from '@/components/AdminTable'

type Location = { id: string; name: string; description: string | null; is_active: boolean }

const FIELDS: FieldDef[] = [
  { type: 'text', key: 'name',        label: 'Nome',      placeholder: 'Ex: Almoxarifado', required: true },
  { type: 'text', key: 'description', label: 'Descrição', placeholder: 'Ex: Depósito principal do térreo' },
]

const INITIAL = { name: '', description: '' }

export default function DepositosPage() {
  const { profile, isAdmin } = useProfile()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient()
      .from('locations').select('*')
      .eq('church_id', profile!.church_id)
      .order('name')
    if (data) setLocations(data as Location[])
    setLoading(false)
  }

  async function onSave(form: Record<string, string>, editId: string | null): Promise<string | null> {
    if (!form.name.trim()) return 'Nome obrigatório'
    const sb = createClient()
    const payload = { church_id: profile!.church_id, name: form.name.trim(), description: form.description || null }
    const { error } = editId
      ? await sb.from('locations').update(payload).eq('id', editId)
      : await sb.from('locations').insert(payload)
    if (error) return error.message
    await load()
    return null
  }

  async function onToggle(loc: Location) {
    await createClient().from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    await load()
  }

  if (!isAdmin) return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Depósitos</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '8px' }}>Sem permissão.</p>
    </div>
  )

  return (
    <AdminTable<Location>
      title="Depósitos"
      subtitle="Locais de armazenamento dos produtos"
      emptyText="Nenhum depósito cadastrado."
      newLabel="+ Novo depósito"
      isAdmin={isAdmin}
      loading={loading}
      items={locations}
      fields={FIELDS}
      initialForm={INITIAL}
      formTitle={editing => editing ? 'Editar depósito' : 'Novo depósito'}
      onEditInit={loc => ({ name: loc.name, description: loc.description || '' })}
      onSave={onSave}
      onToggle={onToggle}
      renderItem={(loc, actions, isAdmin) => (
        <div style={{ borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${loc.is_active ? 'var(--border)' : 'rgba(255,255,255,0.03)'}`, opacity: loc.is_active ? 1 : 0.5, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{loc.name}</div>
              {loc.description && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.description}</div>}
            </div>
            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: loc.is_active ? 'var(--ok-dim)' : 'rgba(255,255,255,0.05)', color: loc.is_active ? 'var(--ok)' : 'var(--text-3)', flexShrink: 0 }}>
              {loc.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              <button onClick={actions.onEdit}   style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRight: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: '500' }}>Editar</button>
              <button onClick={actions.onToggle} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', fontSize: '13px', color: loc.is_active ? 'var(--empty)' : 'var(--ok)', cursor: 'pointer', fontWeight: '500' }}>{loc.is_active ? 'Desativar' : 'Ativar'}</button>
            </div>
          )}
        </div>
      )}
    />
  )
}
