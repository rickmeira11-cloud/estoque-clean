'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type Category = { id: string; name: string; color: string }

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#a78bfa','#34d399','#fb923c','#60a5fa','#f472b6','#94a3b8']

const L: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '500',
  color: 'var(--text-3)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em'
}

export default function CategoriasPage() {
  const { profile, isAdmin } = useProfile()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editItem,   setEditItem]   = useState<Category | null>(null)
  const [name,       setName]       = useState('')
  const [color,      setColor]      = useState('#6366f1')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState('')
  const formRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient()
      .from('product_categories')
      .select('*')
      .eq('church_id', profile!.church_id)
      .order('name')
    if (data) setCategories(data as Category[])
    setLoading(false)
  }

  function openNew() {
    setEditItem(null); setName(''); setColor('#6366f1'); setError(null); setShowForm(true)
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); firstRef.current?.focus() }, 100)
  }

  function openEdit(cat: Category) {
    setEditItem(cat); setName(cat.name); setColor(cat.color || '#6366f1'); setError(null); setShowForm(true)
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); firstRef.current?.focus() }, 100)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError(null)
    const sb = createClient()

    if (editItem) {
      const { error: err } = await sb
        .from('product_categories')
        .update({ name: name.trim(), color })
        .eq('id', editItem.id)
      if (err) { setError(err.message); setSaving(false); return }
      setSuccess('Categoria atualizada!')
    } else {
      const { error: err } = await sb
        .from('product_categories')
        .insert({ church_id: profile!.church_id, name: name.trim(), color })
      if (err) {
        if (err.code === '23505') setError('Já existe uma categoria com este nome')
        else setError(err.message)
        setSaving(false); return
      }
      setSuccess('Categoria criada!')
    }

    setShowForm(false); setName(''); setColor('#6366f1'); setEditItem(null)
    setTimeout(() => setSuccess(''), 3000)
    await load()
    setSaving(false)
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Excluir categoria "${cat.name}"? Os produtos com esta categoria não serão afetados.`)) return
    await createClient().from('product_categories').delete().eq('id', cat.id)
    setSuccess('Categoria excluída!')
    setTimeout(() => setSuccess(''), 3000)
    await load()
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>Categorias</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Gerencie as categorias de produtos</p>
        </div>
        {isAdmin && (
          <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            + Nova categoria
          </button>
        )}
      </div>

      {success && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '13px', fontWeight: '500' }}>
          ✓ {success}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div ref={formRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
            {editItem ? 'Editar categoria' : 'Nova categoria'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end', marginBottom: '12px' }}>
            <div>
              <label style={L}>Nome *</label>
              <input ref={firstRef} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Alimentos, Bebidas..." onKeyDown={e => e.key === 'Enter' && handleSave()}/>
            </div>
            <div>
              <label style={L}>Cor</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text-1)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0
                  }}/>
                ))}
              </div>
            </div>
          </div>
          {error && <div style={{ marginBottom: '10px', color: 'var(--empty)', fontSize: '13px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditItem(null) }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {saving ? 'Salvando...' : editItem ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de categorias */}
      {categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏷️</div>
          <div>Nenhuma categoria cadastrada ainda.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color || '#6366f1', flexShrink: 0 }}/>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button onClick={() => openEdit(cat)} style={{ padding: '4px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(cat)} style={{ padding: '4px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
