'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import AdminTable, { type FieldDef } from '@/components/AdminTable'

type EventType = { id: string; name: string; is_active: boolean }

type FieldType = 'number' | 'text' | 'textarea' | 'boolean' | 'date' | 'member_relation'
const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  number: 'Número', text: 'Texto curto', textarea: 'Texto longo',
  boolean: 'Sim/Não', date: 'Data', member_relation: 'Relação com membros',
}
type TypeField = { id: string; event_type_id: string; field_key: string; label: string; field_type: FieldType; is_required: boolean; sort_order: number; is_active: boolean }

const FIELDS: FieldDef[] = [
  { type: 'text', key: 'name', label: 'Nome', placeholder: 'Ex: Culto, Batismo...', required: true },
]

const INITIAL = { name: '' }

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const blankCustomField = { label: '', field_type: 'text' as FieldType, is_required: false }

export default function TiposEventoPage() {
  const { profile, isAdmin } = useProfile()
  const [types,   setTypes]   = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EventType | null>(null)
  const [typeFields, setTypeFields] = useState<Record<string, TypeField[]>>({})

  const [showFieldForm, setShowFieldForm] = useState(false)
  const [editFieldId, setEditFieldId] = useState<string | null>(null)
  const [fieldForm, setFieldForm] = useState(blankCustomField)
  const [fieldSaving, setFieldSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(null), 3000) }

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('event_types').select('*').eq('church_id', profile!.church_id).order('name')
    if (data) {
      setTypes(data as EventType[])
      const withFields: Record<string, TypeField[]> = {}
      await Promise.all(data.map(async (t: EventType) => {
        const { data: fs } = await sb.from('event_type_fields').select('*').eq('event_type_id', t.id).order('sort_order')
        withFields[t.id] = (fs || []) as TypeField[]
      }))
      setTypeFields(withFields)
    }
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

  // ── Campos personalizados ──
  function openNewField() {
    setEditFieldId(null)
    setFieldForm(blankCustomField)
    setFieldError(null)
    setShowFieldForm(true)
  }

  function openEditField(f: TypeField) {
    setEditFieldId(f.id)
    setFieldForm({ label: f.label, field_type: f.field_type, is_required: f.is_required })
    setFieldError(null)
    setShowFieldForm(true)
  }

  async function saveField() {
    if (!selected) return
    if (!fieldForm.label.trim()) { setFieldError('Label é obrigatório'); return }
    setFieldSaving(true); setFieldError(null)
    const sb = createClient()
    const existing = typeFields[selected.id] || []

    if (editFieldId) {
      const { error } = await sb.from('event_type_fields').update({
        label: fieldForm.label.trim(),
        field_type: fieldForm.field_type,
        is_required: fieldForm.is_required,
      }).eq('id', editFieldId)
      if (error) { setFieldError(error.message); setFieldSaving(false); return }
    } else {
      const field_key = slugify(fieldForm.label)
      if (!field_key) { setFieldError('Label inválido para gerar chave do campo'); setFieldSaving(false); return }
      if (existing.some(f => f.field_key === field_key)) { setFieldError('Já existe um campo com essa chave neste tipo.'); setFieldSaving(false); return }
      const { error } = await sb.from('event_type_fields').insert({
        event_type_id: selected.id,
        field_key,
        label: fieldForm.label.trim(),
        field_type: fieldForm.field_type,
        is_required: fieldForm.is_required,
        sort_order: existing.length,
      })
      if (error) { setFieldError(error.code === '23505' ? 'Já existe um campo com essa chave neste tipo.' : error.message); setFieldSaving(false); return }
    }

    setShowFieldForm(false)
    await load()
    showFlash(editFieldId ? 'Campo atualizado!' : 'Campo criado!')
    setFieldSaving(false)
  }

  async function toggleFieldActive(f: TypeField) {
    await createClient().from('event_type_fields').update({ is_active: !f.is_active }).eq('id', f.id)
    await load()
  }

  return (
    <div>
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
        getSearchText={et => et.name}
        searchPlaceholder="Buscar tipo de evento..."
        renderItem={(et, actions, isAdmin) => (
          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${et.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity: et.is_active ? 1 : 0.6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-1)' }}>{et.name}</span>
                {!et.is_active && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-3)' }}>Inativo</span>}
                {(typeFields[et.id]?.length ?? 0) > 0 && (
                  <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>
                    {typeFields[et.id].length} campo{typeFields[et.id].length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => setSelected(selected?.id === et.id ? null : et)}
                  style={{ padding: '5px 10px', borderRadius: '6px', background: selected?.id === et.id ? 'var(--brand-dim)' : 'transparent', border: `1px solid ${selected?.id === et.id ? 'var(--brand)' : 'var(--border)'}`, color: selected?.id === et.id ? 'var(--brand-light)' : 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}
                >
                  Campos personalizados
                </button>
                {isAdmin && (
                  <>
                    <button onClick={actions.onToggle} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>{et.is_active ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={actions.onEdit}   style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
                    <button onClick={actions.onDelete} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                  </>
                )}
              </div>
            </div>

            {selected?.id === et.id && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campos personalizados</span>
                  {isAdmin && <button onClick={openNewField} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', cursor: 'pointer', fontSize: '11px' }}>+ Novo campo</button>}
                </div>

                {showFieldForm && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {fieldError && <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: 'var(--empty)', fontSize: '13px' }}>{fieldError}</div>}
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>Label *</label>
                      <input value={fieldForm.label} onChange={e => setFieldForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Quantidade de batizados"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>Tipo do campo</label>
                      <select value={fieldForm.field_type} onChange={e => setFieldForm(f => ({ ...f, field_type: e.target.value as FieldType }))} disabled={!!editFieldId}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: '13px' }}>
                        {Object.entries(FIELD_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      {editFieldId && <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>O tipo não pode ser alterado após criado.</p>}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-1)' }}>
                      <input type="checkbox" checked={fieldForm.is_required} onChange={e => setFieldForm(f => ({ ...f, is_required: e.target.checked }))} />
                      Campo obrigatório
                    </label>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowFieldForm(false)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                      <button onClick={saveField} disabled={fieldSaving} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--brand)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', opacity: fieldSaving ? 0.6 : 1 }}>{fieldSaving ? 'Salvando…' : 'Salvar'}</button>
                    </div>
                  </div>
                )}

                {(typeFields[et.id]?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {typeFields[et.id].map(f => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: f.is_active ? 1 : 0.5 }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>
                            {f.label} {f.is_required && <span style={{ color: 'var(--empty)' }}>*</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{FIELD_TYPE_LABEL[f.field_type]} · {f.field_key}{!f.is_active && ' · Inativo'}</div>
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => toggleFieldActive(f)} style={{ padding: '4px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>{f.is_active ? 'Desativar' : 'Ativar'}</button>
                            <button onClick={() => openEditField(f)} style={{ padding: '4px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !showFieldForm && <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Nenhum campo personalizado ainda.</p>
                )}
              </div>
            )}
          </div>
        )}
      />
      {flash && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '10px 18px', borderRadius: '8px', background: 'var(--ok)', color: '#fff', fontSize: '13px', fontWeight: 500, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {flash}
        </div>
      )}
    </div>
  )
}
