'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import AdminTable, { type FieldDef } from '@/components/AdminTable'

type EventType = { id: string; name: string; is_active: boolean }

const FIELDS: FieldDef[] = [
  { type: 'text', key: 'name', label: 'Nome', placeholder: 'Ex: Culto, Batismo...', required: true },
]

const INITIAL = { name: '' }

export default function TiposEventoPage() {
  const { profile, isAdmin } = useProfile()
  const [types,   setTypes]   = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient()
      .from('event_types').select('*')
      .eq('church_id', profile!.church_id)
      .order('name')
    if (data) setTypes(data as EventType[])
    setLoading(false)
  }

  async function onSave(form: Record<string, string>, editId: string | null): Promise<string | null> {
    if (!form.name.trim()) return 'Nome é obrigatório'
    const sb = createClient()
    const payload = { church_id: profile!.church_id, name: form.name.trim() }
    const { error } = editId
      ? await sb.from('event_types').update(payload).eq('id', editId)
      : await sb.from('event_types').insert(payload)
    if (error) return error.message
    await load()
    return null
  }

  async function onDelete(et: EventType): Promise<string | null> {
    if (!confirm(`Excluir tipo "${et.name}"? Eventos vinculados perderão o tipo.`)) return null
    await createClient().from('event_types').delete().eq('id', et.id)
    await load()
    return 'Tipo excluído!'
  }

  async function onToggle(et: EventType) {
    await createClient().from('event_types').update({ is_active: !et.is_active }).eq('id', et.id)
    await load()
  }

  return (
    <AdminTable<EventType>
      title="Tipos de Evento"
      subtitle="Tipos disponíveis ao criar eventos"
      emptyIcon="🏷️"
      emptyText="Nenhum tipo cadastrado."
      newLabel="+ Novo tipo"
      isAdmin={isAdmin}
      loading={loading}
      items={types}
      fields={FIELDS}
      initialForm={INITIAL}
      formTitle={editing => editing ? 'Editar tipo' : 'Novo tipo'}
      onEditInit={et => ({ name: et.name })}
      onSave={onSave}
      onDelete={onDelete}
      onToggle={onToggle}
      renderItem={(et, actions, isAdmin) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${et.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity: et.is_active ? 1 : 0.6, gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-1)' }}>{et.name}</span>
            {!et.is_active && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-3)' }}>Inativo</span>}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={actions.onToggle} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>{et.is_active ? 'Desativar' : 'Ativar'}</button>
              <button onClick={actions.onEdit}   style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
              <button onClick={actions.onDelete} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
            </div>
          )}
        </div>
      )}
    />
  )
}
