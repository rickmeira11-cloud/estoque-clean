'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import AdminTable, { type FieldDef } from '@/components/AdminTable'

type Event = { id: string; name: string; event_date: string | null; description: string | null; is_active: boolean }

const FIELDS: FieldDef[] = [
  { type: 'text', key: 'name', label: 'Nome', placeholder: 'Ex: Culto Domingo, Retiro Jovens...', required: true },
  { type: 'date', key: 'date', label: 'Data do evento' },
  { type: 'text', key: 'desc', label: 'Descrição', placeholder: 'Opcional' },
]

const INITIAL = { name: '', date: '', desc: '' }

export default function EventosPage() {
  const { profile, isAdmin } = useProfile()
  const [events,  setEvents]  = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient()
      .from('events').select('*')
      .eq('church_id', profile!.church_id)
      .order('event_date', { ascending: false })
    if (data) setEvents(data as Event[])
    setLoading(false)
  }

  async function onSave(form: Record<string, string>, editId: string | null): Promise<string | null> {
    if (!form.name.trim()) return 'Nome é obrigatório'
    const sb = createClient()
    const payload = { church_id: profile!.church_id, name: form.name.trim(), event_date: form.date || null, description: form.desc || null }
    const { error } = editId
      ? await sb.from('events').update(payload).eq('id', editId)
      : await sb.from('events').insert(payload)
    if (error) return error.message
    await load()
    return null
  }

  async function onDelete(ev: Event): Promise<string | null> {
    if (!confirm(`Excluir "${ev.name}"?`)) return null
    await createClient().from('events').delete().eq('id', ev.id)
    await load()
    return 'Evento excluído!'
  }

  async function onToggle(ev: Event) {
    await createClient().from('events').update({ is_active: !ev.is_active }).eq('id', ev.id)
    await load()
  }

  return (
    <AdminTable<Event>
      title="Eventos"
      subtitle="Gerencie os eventos para vincular movimentações"
      emptyIcon="📅"
      emptyText="Nenhum evento cadastrado ainda."
      newLabel="+ Novo evento"
      isAdmin={isAdmin}
      loading={loading}
      items={events}
      fields={FIELDS}
      initialForm={INITIAL}
      formTitle={editing => editing ? 'Editar evento' : 'Novo evento'}
      onEditInit={ev => ({ name: ev.name, date: ev.event_date || '', desc: ev.description || '' })}
      onSave={onSave}
      onDelete={onDelete}
      onToggle={onToggle}
      renderItem={(ev, actions, isAdmin) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${ev.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity: ev.is_active ? 1 : 0.6, gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{ev.name}</span>
              {!ev.is_active && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-3)' }}>Inativo</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {ev.event_date && <span>📅 {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
              {ev.description && <span>· {ev.description}</span>}
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={actions.onToggle} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>{ev.is_active ? 'Desativar' : 'Ativar'}</button>
              <button onClick={actions.onEdit}   style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
              <button onClick={actions.onDelete} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
            </div>
          )}
        </div>
      )}
    />
  )
}
