'use client'
import { useRef, useState, type ReactNode } from 'react'

export type FieldDef =
  | { type: 'text' | 'date'; key: string; label: string; placeholder?: string; required?: boolean }
  | { type: 'slot'; key: string; label: string; render: (value: string, onChange: (v: string) => void) => ReactNode }

type Actions = {
  onEdit: () => void
  onDelete?: () => void
  onToggle?: () => void
}

type AdminTableProps<T extends { id: string }> = {
  title: string
  subtitle: string
  emptyIcon?: string
  emptyText?: string
  newLabel?: string
  isAdmin: boolean
  loading: boolean
  items: T[]
  fields: FieldDef[]
  initialForm: Record<string, string>
  formTitle?: (editing: boolean) => string
  onEditInit: (item: T) => Record<string, string>
  /** Returns null on success, an error string on failure. Return null (no-op) if user cancelled. */
  onSave: (form: Record<string, string>, editId: string | null) => Promise<string | null>
  /** Returns a success message string, or null if the action was cancelled (e.g. user dismissed confirm). */
  onDelete?: (item: T) => Promise<string | null>
  onToggle?: (item: T) => Promise<void>
  renderItem: (item: T, actions: Actions, isAdmin: boolean) => ReactNode
  listContainerStyle?: React.CSSProperties
}

const L: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '500',
  color: 'var(--text-3)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '20px',
}

export default function AdminTable<T extends { id: string }>({
  title, subtitle, emptyIcon, emptyText, newLabel = '+ Novo',
  isAdmin, loading, items,
  fields, initialForm, formTitle, onEditInit, onSave,
  onDelete, onToggle, renderItem, listContainerStyle,
}: AdminTableProps<T>) {
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [form,     setForm]     = useState<Record<string, string>>(initialForm)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState('')
  const formRef  = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLInputElement>(null)

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  function openNew() {
    setEditId(null); setForm(initialForm); setError(null); setShowForm(true)
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); firstRef.current?.focus() }, 100)
  }

  function openEdit(item: T) {
    setEditId(item.id); setForm(onEditInit(item)); setError(null); setShowForm(true)
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); firstRef.current?.focus() }, 100)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    const err = await onSave(form, editId)
    if (err) { setError(err); setSaving(false); return }
    setShowForm(false); setForm(initialForm); setEditId(null)
    flash(editId ? 'Atualizado!' : 'Criado!')
    setSaving(false)
  }

  async function handleDelete(item: T) {
    if (!onDelete) return
    const msg = await onDelete(item)
    if (msg) flash(msg)
  }

  const isEditing = editId !== null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>{title}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>{subtitle}</p>
        </div>
        {isAdmin && (
          <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            {newLabel}
          </button>
        )}
      </div>

      {/* Success banner */}
      {success && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '13px', fontWeight: '500' }}>
          ✓ {success}
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div ref={formRef} style={{ ...panelStyle, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
            {formTitle ? formTitle(isEditing) : isEditing ? 'Editar' : 'Novo'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {fields.map((field, i) => (
              <div key={field.key}>
                <label style={L}>{field.label}{field.required ? ' *' : ''}</label>
                {field.type === 'slot' ? (
                  field.render(form[field.key] ?? '', v => setForm(f => ({ ...f, [field.key]: v })))
                ) : (
                  <input
                    ref={i === 0 ? firstRef : undefined}
                    type={field.type}
                    value={form[field.key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={'placeholder' in field ? field.placeholder : undefined}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <div style={{ marginBottom: '10px', color: 'var(--empty)', fontSize: '13px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
          {emptyIcon && <div style={{ fontSize: '40px', marginBottom: '12px' }}>{emptyIcon}</div>}
          <div>{emptyText ?? 'Nenhum item cadastrado ainda.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', ...listContainerStyle }}>
          {items.map(item => (
            <div key={item.id}>
              {renderItem(
                item,
                {
                  onEdit:   () => openEdit(item),
                  onDelete: onDelete ? () => handleDelete(item) : undefined,
                  onToggle: onToggle ? () => onToggle(item) : undefined,
                },
                isAdmin,
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
