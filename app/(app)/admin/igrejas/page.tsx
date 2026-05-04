// @ts-nocheck
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const toSlug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const blank = { name: '', slug: '', city: '', state: '' }
const CHURCH_ID_BNU = '8db14705-9da8-4844-8b01-a73845297831'

export default function IgrejasPage() {
  const [churches,     setChurches]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(blank)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  const [logoFile,     setLogoFile]     = useState(null)
  const [logoPreview,  setLogoPreview]  = useState(null)
  const [uploadingLogo,setUploadingLogo]= useState(false)
  const [showWizard,   setShowWizard]   = useState(false)
  const [newChurchId,  setNewChurchId]  = useState(null)
  const [newChurchName,setNewChurchName]= useState('')
  const formRef  = useRef(null)
  const firstRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('churches').select('*').order('name')
    if (data) {
      const wc = await Promise.all(data.map(async (c) => {
        const { count } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('church_id', c.id)
        return { ...c, _users: count || 0 }
      }))
      setChurches(wc)
    }
    setLoading(false)
  }

  function openNew() { setEditId(null); setForm(blank); setLogoFile(null); setLogoPreview(null); setError(null); setShowForm(true) }
  function openEdit(c) {
    setEditId(c.id)
    setForm({ name: c.name, slug: c.slug || '', city: c.city || '', state: c.state || '' })
    setLogoPreview(c.logo_url || null)
    setLogoFile(null)
    setError(null)
    setShowForm(true)
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); firstRef.current?.focus() }, 100)
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result)
    reader.readAsDataURL(file)
  }

  async function uploadLogo(churchId) {
    if (!logoFile) return null
    setUploadingLogo(true)
    const ext = logoFile.name.split('.').pop()
    const path = `${churchId}/logo.${ext}`
    const sb = createClient()
    const { error: upErr } = await sb.storage.from('church-logos').upload(path, logoFile, { upsert: true })
    setUploadingLogo(false)
    if (upErr) return null
    const { data } = sb.storage.from('church-logos').getPublicUrl(path)
    return data.publicUrl
  }

  async function save() {
    if (!form.name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const payload = {
      name: form.name.trim(),
      slug: form.slug || toSlug(form.name),
      city: form.city || null,
      state: form.state || null,
    }

    if (editId) {
      // Upload logo se tiver novo arquivo
      if (logoFile) {
        const logoUrl = await uploadLogo(editId)
        if (logoUrl) payload.logo_url = logoUrl
      }
      const { error: err } = await sb.from('churches').update(payload).eq('id', editId)
      if (err) { setError(err.code === '23505' ? 'Slug já em uso.' : err.message); setSaving(false); return }
      setShowForm(false)
      await load()
    } else {
      // Criar igreja
      const { data: newChurch, error: err } = await sb.from('churches').insert(payload).select().single()
      if (err) { setError(err.code === '23505' ? 'Slug já em uso.' : err.message); setSaving(false); return }
      // Upload logo
      if (logoFile && newChurch) {
        const logoUrl = await uploadLogo(newChurch.id)
        if (logoUrl) await sb.from('churches').update({ logo_url: logoUrl }).eq('id', newChurch.id)
      }
      setShowForm(false)
      setNewChurchId(newChurch.id)
      setNewChurchName(newChurch.name)
      setShowWizard(true)
      await load()
    }
    setSaving(false)
  }

  async function toggleActive(c) {
    await createClient().from('churches').update({ is_active: !c.is_active }).eq('id', c.id)
    await load()
  }

  const L = { display: 'block', fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Igrejas</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Organizações cadastradas no sistema</p>
        </div>
        <button onClick={openNew} style={{ padding: '9px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', flexShrink: 0 }}>
          + Nova igreja
        </button>
      </div>

      {/* Wizard de onboarding */}
      {showWizard && (
        <div className="fade-up" style={{ marginBottom: '20px', padding: '20px 24px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--brand-light)', marginBottom: '6px' }}>
                🎉 Igreja "{newChurchName}" criada com sucesso!
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>
                Próximo passo: crie o usuário administrador desta igreja.
              </div>
              <a
                href={`/admin/usuarios?church=${newChurchId}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--brand)', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Criar usuário admin
              </a>
            </div>
            <button onClick={() => setShowWizard(false)} style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="fade-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '18px' }}>{editId ? 'Editar' : 'Nova'} igreja</h2>
          {error && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', background: 'var(--empty-dim)', fontSize: '12px', color: 'var(--empty)' }}>{error}</div>}

          {/* Upload de logo */}
          <div style={{ marginBottom: '16px' }}>
            <label style={L}>Logo da igreja</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ width: '64px', height: '64px', borderRadius: '12px', background: 'var(--bg-3)', border: '2px dashed var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-md)'}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                )}
              </div>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer' }}>
                  {logoPreview ? 'Trocar logo' : 'Enviar logo'}
                </button>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>PNG, JPG ou SVG • Recomendado 200×200px</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={L}>Nome *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || toSlug(e.target.value) }))} placeholder="Ex: Poiema Blumenau" /></div>
            <div><label style={L}>Slug (único)</label><input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} style={{ fontFamily: 'monospace', fontSize: '13px' }} placeholder="poiema-blumenau" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '10px' }}>
              <div><label style={L}>Cidade</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Blumenau" /></div>
              <div><label style={L}>Estado</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="SC" maxLength={2} /></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button onClick={save} disabled={saving || uploadingLogo} style={{ padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving || uploadingLogo ? 0.7 : 1 }}>
              {uploadingLogo ? 'Enviando logo...' : saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar igreja'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '12px' }} />)}
        </div>
      ) : churches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '13px', color: 'var(--text-3)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          Nenhuma igreja cadastrada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {churches.map(c => (
            <div key={c.id} style={{ borderRadius: '12px', background: 'var(--bg-card)', border: `1px solid ${c.is_active ? 'var(--border)' : 'rgba(255,255,255,0.03)'}`, opacity: c.is_active ? 1 : 0.5, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                {/* Logo ou inicial */}
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--brand-light)' }}>{c.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(c.city || c.state) && <span>{[c.city, c.state].filter(Boolean).join(', ')}</span>}
                    <span style={{ fontFamily: 'monospace' }}>{c.slug}</span>
                    <span style={{ color: 'var(--text-2)' }}>{c._users} usuário(s)</span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: c.is_active ? 'var(--ok-dim)' : 'rgba(255,255,255,0.05)', color: c.is_active ? 'var(--ok)' : 'var(--text-3)', flexShrink: 0 }}>
                  {c.is_active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              {/* Barra de ações */}
              <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openEdit(c)} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRight: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: '500' }}>
                  Editar
                </button>
                <button onClick={() => toggleActive(c)} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', fontSize: '13px', color: c.is_active ? 'var(--empty)' : 'var(--ok)', cursor: 'pointer', fontWeight: '500' }}>
                  {c.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
