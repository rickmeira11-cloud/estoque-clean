'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type FieldType = 'number' | 'text' | 'textarea' | 'boolean' | 'date' | 'member_relation'
const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  number: 'Número', text: 'Texto curto', textarea: 'Texto longo',
  boolean: 'Sim/Não', date: 'Data', member_relation: 'Relação com membros',
}
type TypeField = { id: string; event_type_id: string; field_key: string; label: string; field_type: FieldType; is_required: boolean; sort_order: number; is_active: boolean }
type EventType = { id: string; name: string }
type Event = { id: string; name: string; event_date: string | null; description: string | null; is_active: boolean; event_type_id: string | null; event_type?: EventType | null }
type RegisteredMember = { id: string; full_name: string }
type Attachment = { id: string; file_url: string; file_name: string; file_size: number | null; created_at: string }

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '7px 10px', background: 'var(--bg-3)',
  border: '1px solid var(--border)', borderRadius: '6px',
  fontSize: '13px', color: 'var(--text-1)', boxSizing: 'border-box', outline: 'none',
}
const L: React.CSSProperties = { fontSize: '12px', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }

const blankForm = { name: '', date: '', event_type_id: '', desc: '' }

export default function EventosPage() {
  const { profile, isAdmin } = useProfile()
  const [events,     setEvents]     = useState<Event[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading,    setLoading]    = useState(true)
  const [memberOptions, setMemberOptions] = useState<RegisteredMember[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [form,     setForm]     = useState(blankForm)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [flash,    setFlash]    = useState<string | null>(null)
  const formRef  = useRef<HTMLDivElement>(null)

  const [customFieldDefs, setCustomFieldDefs] = useState<TypeField[]>([])
  const [customValues,  setCustomValues]  = useState<Record<string, string>>({})
  const [customMembers, setCustomMembers] = useState<Record<string, string[]>>({})
  const [memberSearch,  setMemberSearch]  = useState<Record<string, string>>({})
  const [memberResults, setMemberResults] = useState<Record<string, RegisteredMember[]>>({})

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading,    setUploading]  = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (profile?.church_id) { load(); loadTypes(); loadMemberOptions() } }, [profile?.church_id])

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(null), 3000) }

  async function loadTypes() {
    const { data } = await createClient()
      .from('event_types').select('id, name')
      .eq('church_id', profile!.church_id)
      .eq('is_active', true)
      .order('name')
    if (data) setEventTypes(data)
  }

  async function loadMemberOptions() {
    const { data } = await createClient().from('members').select('id, full_name').eq('church_id', profile!.church_id).eq('is_active', true).order('full_name')
    if (data) setMemberOptions(data)
  }

  async function load() {
    setLoading(true)
    const { data } = await createClient()
      .from('events').select('*, event_type:event_types(id, name)')
      .eq('church_id', profile!.church_id)
      .order('event_date', { ascending: false })
    if (data) setEvents(data as Event[])
    setLoading(false)
  }

  async function loadFieldDefs(eventTypeId: string): Promise<TypeField[]> {
    if (!eventTypeId) return []
    const { data } = await createClient()
      .from('event_type_fields').select('*')
      .eq('event_type_id', eventTypeId).eq('is_active', true)
      .order('sort_order')
    return (data || []) as TypeField[]
  }

  async function handleTypeChange(eventTypeId: string) {
    setForm(f => ({ ...f, event_type_id: eventTypeId }))
    const defs = await loadFieldDefs(eventTypeId)
    setCustomFieldDefs(defs)
    setCustomValues(prev => {
      const next: Record<string, string> = {}
      for (const d of defs) if (prev[d.id] !== undefined) next[d.id] = prev[d.id]
      return next
    })
    setCustomMembers(prev => {
      const next: Record<string, string[]> = {}
      for (const d of defs) if (prev[d.id] !== undefined) next[d.id] = prev[d.id]
      return next
    })
  }

  function resetCustomState() {
    setCustomFieldDefs([])
    setCustomValues({})
    setCustomMembers({})
    setMemberSearch({})
    setMemberResults({})
    setAttachments([])
  }

  function openNew() {
    setEditId(null)
    setForm(blankForm)
    setError(null)
    resetCustomState()
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function openEdit(ev: Event) {
    setEditId(ev.id)
    setForm({ name: ev.name, date: ev.event_date || '', event_type_id: ev.event_type_id || '', desc: ev.description || '' })
    setError(null)
    resetCustomState()
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    const sb = createClient()
    if (ev.event_type_id) {
      const defs = await loadFieldDefs(ev.event_type_id)
      setCustomFieldDefs(defs)

      const { data: values } = await sb.from('event_field_values').select('*').eq('event_id', ev.id)
      const valMap: Record<string, string> = {}
      for (const v of values || []) {
        const def = defs.find(d => d.id === v.field_id)
        if (!def) continue
        if (def.field_type === 'number')  valMap[v.field_id] = v.value_number != null ? String(v.value_number) : ''
        else if (def.field_type === 'boolean') valMap[v.field_id] = v.value_boolean ? 'true' : 'false'
        else if (def.field_type === 'date') valMap[v.field_id] = v.value_date || ''
        else valMap[v.field_id] = v.value_text || ''
      }
      setCustomValues(valMap)

      const { data: mems } = await sb.from('event_field_members').select('field_id, member_id').eq('event_id', ev.id)
      const memMap: Record<string, string[]> = {}
      for (const m of mems || []) {
        memMap[m.field_id] = [...(memMap[m.field_id] || []), m.member_id]
      }
      setCustomMembers(memMap)
    }

    const { data: atts } = await sb.from('event_attachments').select('*').eq('event_id', ev.id).order('created_at', { ascending: false })
    setAttachments((atts || []) as Attachment[])
  }

  function setCustomValue(fieldId: string, value: string) {
    setCustomValues(v => ({ ...v, [fieldId]: value }))
  }

  function handleMemberSearch(fieldId: string, val: string) {
    setMemberSearch(s => ({ ...s, [fieldId]: val }))
    if (val.length < 2) { setMemberResults(r => ({ ...r, [fieldId]: [] })); return }
    const q = val.toLowerCase()
    const selected = customMembers[fieldId] || []
    setMemberResults(r => ({ ...r, [fieldId]: memberOptions.filter(o => o.full_name.toLowerCase().includes(q) && !selected.includes(o.id)).slice(0, 8) }))
  }

  function addMember(fieldId: string, memberId: string) {
    setCustomMembers(m => ({ ...m, [fieldId]: [...(m[fieldId] || []), memberId] }))
    setMemberSearch(s => ({ ...s, [fieldId]: '' }))
    setMemberResults(r => ({ ...r, [fieldId]: [] }))
  }

  function removeMember(fieldId: string, memberId: string) {
    setCustomMembers(m => ({ ...m, [fieldId]: (m[fieldId] || []).filter(id => id !== memberId) }))
  }

  function validateCustomFields(): string | null {
    for (const def of customFieldDefs) {
      if (!def.is_required) continue
      if (def.field_type === 'member_relation') {
        if (!(customMembers[def.id] || []).length) return `O campo "${def.label}" é obrigatório.`
      } else {
        const v = customValues[def.id]
        if (v === undefined || v === '') return `O campo "${def.label}" é obrigatório.`
      }
    }
    return null
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    const customErr = validateCustomFields()
    if (customErr) { setError(customErr); return }

    setSaving(true); setError(null)
    const sb = createClient()
    const payload = {
      church_id:     profile!.church_id,
      name:          form.name.trim(),
      event_date:    form.date || null,
      event_type_id: form.event_type_id || null,
      description:   form.desc || null,
    }

    let eventId = editId
    if (editId) {
      const { error: err } = await sb.from('events').update(payload).eq('id', editId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data, error: err } = await sb.from('events').insert(payload).select('id').single()
      if (err) { setError(err.message); setSaving(false); return }
      eventId = data!.id
    }

    for (const def of customFieldDefs) {
      if (def.field_type === 'member_relation') {
        const memberIds = customMembers[def.id] || []
        await sb.from('event_field_members').delete().eq('event_id', eventId!).eq('field_id', def.id)
        if (memberIds.length) {
          await sb.from('event_field_members').insert(memberIds.map(mid => ({ event_id: eventId, field_id: def.id, member_id: mid })))
        }
        continue
      }
      const raw = customValues[def.id]
      if (raw === undefined || raw === '') {
        await sb.from('event_field_values').delete().eq('event_id', eventId!).eq('field_id', def.id)
        continue
      }
      const row: Record<string, unknown> = { event_id: eventId, field_id: def.id, value_text: null, value_number: null, value_boolean: null, value_date: null }
      if (def.field_type === 'number') row.value_number = Number(raw)
      else if (def.field_type === 'boolean') row.value_boolean = raw === 'true'
      else if (def.field_type === 'date') row.value_date = raw
      else row.value_text = raw
      await sb.from('event_field_values').upsert(row, { onConflict: 'event_id,field_id' })
    }

    setSaving(false)
    setShowForm(false)
    await load()
    showFlash(editId ? 'Evento atualizado!' : 'Evento criado!')
  }

  async function onDelete(ev: Event) {
    if (!confirm(`Excluir "${ev.name}"?`)) return
    await createClient().from('events').delete().eq('id', ev.id)
    await load()
    showFlash('Evento excluído!')
  }

  async function onToggle(ev: Event) {
    await createClient().from('events').update({ is_active: !ev.is_active }).eq('id', ev.id)
    await load()
  }

  async function handleUpload(file: File) {
    if (!editId || !profile) return
    setUploading(true)
    const sb = createClient()
    const path = `${profile.church_id}/${editId}/${Date.now()}_${file.name}`
    const { error: upErr } = await sb.storage.from('event-attachments').upload(path, file)
    if (upErr) { setError('Erro no upload: ' + upErr.message); setUploading(false); return }
    const { data: urlData } = sb.storage.from('event-attachments').getPublicUrl(path)
    const { data: inserted, error: insErr } = await sb.from('event_attachments').insert({
      event_id: editId,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: profile.id,
    }).select('*').single()
    if (insErr) { setError(insErr.message); setUploading(false); return }
    setAttachments(a => [inserted as Attachment, ...a])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function removeAttachment(att: Attachment) {
    if (!confirm(`Remover anexo "${att.file_name}"?`)) return
    await createClient().from('event_attachments').delete().eq('id', att.id)
    setAttachments(a => a.filter(x => x.id !== att.id))
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>Eventos</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Gerencie os eventos para vincular movimentações</p>
        </div>
        {isAdmin && (
          <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: '6px', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            + Novo evento
          </button>
        )}
      </div>

      {showForm && (
        <div ref={formRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>{editId ? 'Editar evento' : 'Novo evento'}</h3>
          {error && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: 'var(--empty)', fontSize: '13px' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={L}>Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Culto Domingo, Retiro Jovens..." style={INPUT_STYLE} />
            </div>
            <div>
              <label style={L}>Data do evento</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={INPUT_STYLE} />
            </div>
            <div>
              <label style={L}>Tipo de evento</label>
              <select value={form.event_type_id} onChange={e => handleTypeChange(e.target.value)} style={INPUT_STYLE}>
                <option value="">— Sem tipo —</option>
                {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Descrição</label>
              <input value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Opcional" style={INPUT_STYLE} />
            </div>
          </div>

          {/* Campos personalizados do tipo */}
          {customFieldDefs.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Campos do tipo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {customFieldDefs.map(def => (
                  <div key={def.id}>
                    <label style={L}>{def.label}{def.is_required ? ' *' : ''}</label>
                    {def.field_type === 'number' && (
                      <input type="number" value={customValues[def.id] ?? ''} onChange={e => setCustomValue(def.id, e.target.value)} style={INPUT_STYLE} />
                    )}
                    {def.field_type === 'text' && (
                      <input type="text" value={customValues[def.id] ?? ''} onChange={e => setCustomValue(def.id, e.target.value)} style={INPUT_STYLE} />
                    )}
                    {def.field_type === 'textarea' && (
                      <textarea value={customValues[def.id] ?? ''} onChange={e => setCustomValue(def.id, e.target.value)} rows={4} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
                    )}
                    {def.field_type === 'date' && (
                      <input type="date" value={customValues[def.id] ?? ''} onChange={e => setCustomValue(def.id, e.target.value)} style={INPUT_STYLE} />
                    )}
                    {def.field_type === 'boolean' && (
                      <select value={customValues[def.id] ?? ''} onChange={e => setCustomValue(def.id, e.target.value)} style={INPUT_STYLE}>
                        <option value="">— Não informado —</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    )}
                    {def.field_type === 'member_relation' && (
                      <div>
                        <input
                          value={memberSearch[def.id] ?? ''}
                          onChange={e => handleMemberSearch(def.id, e.target.value)}
                          placeholder="Buscar membro por nome..."
                          style={INPUT_STYLE}
                        />
                        {(memberResults[def.id] || []).length > 0 && (
                          <div style={{ marginTop: '4px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                            {memberResults[def.id].map(o => (
                              <button key={o.id} onClick={() => addMember(def.id, o.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'var(--bg-card)', border: 'none', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}>
                                {o.full_name}
                              </button>
                            ))}
                          </div>
                        )}
                        {memberSearch[def.id] && memberSearch[def.id].length >= 2 && (memberResults[def.id] || []).length === 0 && (
                          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '6px' }}>
                            Nenhum resultado. <a href="/membros" style={{ color: 'var(--brand-light)' }}>Cadastre o membro primeiro</a>.
                          </p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {(customMembers[def.id] || []).map(mid => {
                            const m = memberOptions.find(o => o.id === mid)
                            return (
                              <span key={mid} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontSize: '12px' }}>
                                {m?.full_name || mid}
                                <button onClick={() => removeMember(def.id, mid)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anexos */}
          {editId && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Anexos</div>
              <input ref={fileInputRef} type="file" accept="application/pdf,image/*" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
                style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '10px' }} />
              {uploading && <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Enviando...</p>}
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachments.map(att => (
                    <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      <a href={att.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--brand-light)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</a>
                      <button onClick={() => removeAttachment(att)} style={{ padding: '3px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button onClick={() => setShowForm(false)} disabled={saving} style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--brand)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      )}

      {flash && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '13px', fontWeight: '500' }}>✓ {flash}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '48px', background: 'var(--bg-3)', borderRadius: '8px', opacity: 0.6 }} />)}
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: '14px' }}>📅 Nenhum evento cadastrado ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map(ev => (
            <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${ev.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity: ev.is_active ? 1 : 0.6, gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{ev.name}</span>
                  {!ev.is_active && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-3)' }}>Inativo</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {ev.event_date && <span>📅 {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
                  {ev.event_type && <span style={{ padding: '1px 7px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontSize: '11px' }}>{ev.event_type.name}</span>}
                  {ev.description && <span>· {ev.description}</span>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => onToggle(ev)} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>{ev.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => openEdit(ev)} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
                  <button onClick={() => onDelete(ev)} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
