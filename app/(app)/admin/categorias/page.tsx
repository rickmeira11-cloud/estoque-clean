'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import AdminTable, { type FieldDef } from '@/components/AdminTable'

type Category = { id: string; name: string; color: string }

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#a78bfa','#34d399','#fb923c','#60a5fa','#f472b6','#94a3b8']

const FIELDS: FieldDef[] = [
  { type: 'text', key: 'name', label: 'Nome', placeholder: 'Ex: Alimentos, Bebidas...', required: true },
  {
    type: 'slot',
    key: 'color',
    label: 'Cor',
    render: (value, onChange) => (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '2px' }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => onChange(c)} style={{
            width: '28px', height: '28px', borderRadius: '50%', background: c,
            border: value === c ? '3px solid var(--text-1)' : '2px solid transparent',
            cursor: 'pointer', flexShrink: 0,
          }}/>
        ))}
      </div>
    ),
  },
]

const INITIAL = { name: '', color: '#6366f1' }

export default function CategoriasPage() {
  const { profile, isAdmin } = useProfile()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient()
      .from('product_categories').select('*')
      .eq('church_id', profile!.church_id)
      .order('name')
    if (data) setCategories(data as Category[])
    setLoading(false)
  }

  async function onSave(form: Record<string, string>, editId: string | null): Promise<string | null> {
    if (!form.name.trim()) return 'Nome é obrigatório'
    const sb = createClient()
    const payload = { church_id: profile!.church_id, name: form.name.trim(), color: form.color || '#6366f1' }
    const { error } = editId
      ? await sb.from('product_categories').update(payload).eq('id', editId)
      : await sb.from('product_categories').insert(payload)
    if (error) {
      if (error.code === '23505') return 'Já existe uma categoria com este nome'
      return error.message
    }
    await load()
    return null
  }

  async function onDelete(cat: Category): Promise<string | null> {
    if (!confirm(`Excluir categoria "${cat.name}"? Os produtos com esta categoria não serão afetados.`)) return null
    await createClient().from('product_categories').delete().eq('id', cat.id)
    await load()
    return 'Categoria excluída!'
  }

  return (
    <AdminTable<Category>
      title="Categorias"
      subtitle="Gerencie as categorias de produtos"
      emptyIcon="🏷️"
      emptyText="Nenhuma categoria cadastrada ainda."
      newLabel="+ Nova categoria"
      isAdmin={isAdmin}
      loading={loading}
      items={categories}
      fields={FIELDS}
      initialForm={INITIAL}
      formTitle={editing => editing ? 'Editar categoria' : 'Nova categoria'}
      onEditInit={cat => ({ name: cat.name, color: cat.color || '#6366f1' })}
      onSave={onSave}
      onDelete={onDelete}
      listContainerStyle={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', flexDirection: undefined }}
      renderItem={(cat, actions, isAdmin) => (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color || '#6366f1', flexShrink: 0 }}/>
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button onClick={actions.onEdit}   style={{ padding: '4px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
              <button onClick={actions.onDelete} style={{ padding: '4px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
            </div>
          )}
        </div>
      )}
    />
  )
}
