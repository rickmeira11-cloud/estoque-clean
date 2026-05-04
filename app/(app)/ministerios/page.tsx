'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type MemberRole = 'lider' | 'lider_assistente' | 'membro'
const ROLE_LABEL: Record<MemberRole, string> = { lider: 'Líder', lider_assistente: 'Líder de Equipe', membro: 'Membro' }
const ROLE_ORDER: Record<MemberRole, number> = { lider: 0, lider_assistente: 1, membro: 2 }

type Member = { id: string; name: string; role: MemberRole; photo_url: string | null; bio: string | null; phone: string | null; email: string | null; is_active: boolean }
type Ministry = { id: string; name: string; description: string | null; meeting_schedule: string | null; location: string | null; cover_image_url: string | null; is_active: boolean; members?: Member[] }

const COLORS = ['#6366f1','#0f6e56','#854f0b','#712b13','#444441','#185fa5','#3b6d11','#993556']
function getColor(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length] }

function Avatar({ name, photo, size = 36 }: { name: string; photo: string | null; size?: number }) {
  return (
    <div ref={formRef} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: getColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600, color: '#fff' }}>
      {photo ? <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : name.charAt(0).toUpperCase()}
    </div>
  )
}

const blankMin = { name: '', description: '', meeting_schedule: '', location: '' }
const blankMem = { name: '', role: 'membro' as MemberRole, phone: '', email: '', bio: '', photo_url: null as string | null }

export default function MinisteriosAdminPage() {
  const { profile, isAdmin } = useProfile()
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ministry | null>(null)
  const [showMinForm, setShowMinForm] = useState(false)
  const [showMemForm, setShowMemForm] = useState(false)
  const [editMinId, setEditMinId] = useState<string | null>(null)
  const [editMemId, setEditMemId] = useState<string | null>(null)
  const [minForm, setMinForm] = useState(blankMin)
  const [memForm, setMemForm] = useState(blankMem)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const formRef  = useRef(null)
  const firstRef = useRef(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const modalPhotoRef = useRef<HTMLInputElement>(null)
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data: mins } = await sb.from('ministries').select('*').eq('church_id', profile!.church_id).order('name')
    if (mins) {
      const withMembers = await Promise.all(mins.map(async m => {
        const { data: members } = await sb.from('ministry_members').select('*').eq('ministry_id', m.id).order('role')
        return { ...m, members: (members || []).sort((a: Member, b: Member) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) }
      }))
      setMinistries(withMembers)
      if (selected) {
        const updated = withMembers.find(m => m.id === selected.id)
        if (updated) setSelected(updated)
      }
    }
    setLoading(false)
  }

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  // ── Ministérios ──
  function openNewMin() { setEditMinId(null); setMinForm(blankMin); setError(null); setShowMinForm(true) }
  function openEditMin(m: Ministry) { setEditMinId(m.id); setMinForm({ name: m.name, description: m.description || '', meeting_schedule: m.meeting_schedule || '', location: m.location || '' }); setError(null); setShowMinForm(true) }

  async function saveMin() {
    if (!minForm.name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const payload = { church_id: profile!.church_id, name: minForm.name.trim(), description: minForm.description || null, meeting_schedule: minForm.meeting_schedule || null, location: minForm.location || null }
    const { error: err } = editMinId ? await sb.from('ministries').update(payload).eq('id', editMinId) : await sb.from('ministries').insert(payload)
    if (err) setError(err.message)
    else { setShowMinForm(false); await load(); flash(editMinId ? 'Ministério atualizado!' : 'Ministério criado!') }
    setSaving(false)
  }

  async function toggleMinActive(m: Ministry) {
    await createClient().from('ministries').update({ is_active: !m.is_active }).eq('id', m.id)
    await load()
  }

  // ── Membros ──
  function openNewMem() { setEditMemId(null); setMemForm(blankMem); setModalPhotoPreview(null); setError(null); setShowMemForm(true) }
  function openEditMem(mem: Member) { setEditMemId(mem.id); setMemForm({ name: mem.name, role: mem.role, phone: mem.phone || '', email: mem.email || '', bio: mem.bio || '', photo_url: mem.photo_url }); setModalPhotoPreview(mem.photo_url); setError(null); setShowMemForm(true) }

  async function saveMem() {
    if (!selected) return
    if (!memForm.name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    let photo_url = memForm.photo_url || null

    // Upload de foto se selecionada no modal
    const modalFile = modalPhotoRef.current?.files?.[0]
    if (modalFile) {
      const ext = modalFile.name.split('.').pop()
      const tempId = editMemId || crypto.randomUUID()
      const path = `${profile!.church_id}/${tempId}.${ext}`
      const { error: upErr } = await sb.storage.from('ministry-photos').upload(path, modalFile, { upsert: true })
      if (upErr) { setError('Erro no upload: ' + upErr.message); setSaving(false); return }
      const { data: urlData } = sb.storage.from('ministry-photos').getPublicUrl(path)
      photo_url = urlData.publicUrl
    }

    const payload = { ministry_id: selected.id, church_id: profile!.church_id, name: memForm.name.trim(), role: memForm.role, phone: memForm.phone || null, email: memForm.email || null, bio: memForm.bio || null, photo_url }
    const { error: err } = editMemId ? await sb.from('ministry_members').update(payload).eq('id', editMemId) : await sb.from('ministry_members').insert(payload)
    if (err) setError(err.message)
    else { setShowMemForm(false); setModalPhotoPreview(null); await load(); flash(editMemId ? 'Membro atualizado!' : 'Membro adicionado!') }
    setSaving(false)
  }

  async function removeMem(id: string) {
    if (!confirm('Remover este membro do ministério?')) return
    await createClient().from('ministry_members').update({ is_active: false }).eq('id', id)
    await load()
    flash('Membro removido.')
  }

  async function uploadPhoto(memberId: string, file: File) {
    setUploading(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${profile!.church_id}/${memberId}.${ext}`
    const { error: upErr } = await sb.storage.from('ministry-photos').upload(path, file, { upsert: true })
    if (upErr) { setError('Erro no upload: ' + upErr.message); setUploading(false); return }
    const { data: urlData } = sb.storage.from('ministry-photos').getPublicUrl(path)
    await sb.from('ministry_members').update({ photo_url: urlData.publicUrl }).eq('id', memberId)
    await load()
    setUploading(false)
    flash('Foto atualizada!')
  }

  const L = { display: 'block' as const, fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }

  if (!isAdmin) return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Ministérios</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '8px' }}>Você não tem permissão para gerenciar ministérios.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Ministérios</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Gerencie ministérios e seus membros</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/ministerios" target="_blank" style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
            Ver mural público
          </a>
          <button onClick={openNewMin} style={{ padding: '9px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            + Novo ministério
          </button>
        </div>
      </div>

      {success && <div className="fade-up" style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: 'var(--ok-dim)', border: '1px solid rgba(34,197,94,0.2)', fontSize: '13px', color: 'var(--ok)' }}>{success}</div>}
      {error && <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: 'var(--empty-dim)', fontSize: '13px', color: 'var(--empty)' }}>{error}<button onClick={() => setError(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--empty)', cursor: 'pointer' }}>✕</button></div>}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap: '16px' }}>
        {/* Lista de ministérios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '10px' }}/>)
          ) : ministries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: '13px', color: 'var(--text-3)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              Nenhum ministério cadastrado.<br/>Clique em "+ Novo ministério" para começar.
            </div>
          ) : ministries.map(m => (
            <div key={m.id}
              onClick={() => setSelected(m)}
              style={{ background: 'var(--bg-card)', border: `1px solid ${selected?.id === m.id ? 'var(--brand)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.15s', opacity: m.is_active ? 1 : 0.5 }}>
              <div style={{ padding: '12px 14px' }} onClick={() => setSelected(m)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px', display: 'flex', gap: '10px' }}>
                    {m.meeting_schedule && <span>{m.meeting_schedule}</span>}
                    <span>{m.members?.length || 0} membro(s)</span>
                  </div>
                </div>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: m.is_active ? 'var(--ok-dim)' : 'rgba(255,255,255,0.05)', color: m.is_active ? 'var(--ok)' : 'var(--text-3)', flexShrink: 0 }}>
                  {m.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              </div>
              {/* Barra de ações */}
              <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                <button onClick={e => { e.stopPropagation(); openEditMin(m) }} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRight: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontWeight: '500' }}>
                  Editar
                </button>
                <button onClick={e => { e.stopPropagation(); toggleMinActive(m) }} style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', fontSize: '13px', color: m.is_active ? 'var(--empty)' : 'var(--ok)', cursor: 'pointer', fontWeight: '500' }}>
                  {m.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Detalhe do ministério selecionado */}
        {selected && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ height: '80px', background: selected.cover_image_url ? `url(${selected.cover_image_url}) center/cover` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', display: 'flex', alignItems: 'flex-end', padding: '12px 16px', position: 'relative' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: '10px', right: '10px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>
                  Membros ({selected.members?.filter(m => m.is_active).length || 0})
                </div>
                <button onClick={openNewMem} style={{ padding: '6px 14px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                  + Membro
                </button>
              </div>

              {/* Lista de membros */}
              {(selected.members || []).filter(m => m.is_active).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', fontSize: '13px', color: 'var(--text-3)' }}>
                  Nenhum membro cadastrado.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(selected.members || []).filter(m => m.is_active).map(mem => (
                    <div key={mem.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      {/* Avatar clicável para upload */}
                      <div style={{ position: 'relative', cursor: 'pointer' }} title="Clique para trocar foto" onClick={() => { setEditMemId(mem.id); photoRef.current?.click() }}>
                        <Avatar name={mem.name} photo={mem.photo_url} size={40}/>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', fontSize: '16px' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.4)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>{mem.name}</div>
                        <div style={{ fontSize: '11px', marginTop: '2px' }}>
                          <span style={{ color: mem.role === 'lider' ? 'var(--brand-light)' : mem.role === 'lider_assistente' ? '#a78bfa' : 'var(--text-3)' }}>
                            {ROLE_LABEL[mem.role]}
                          </span>
                          {mem.bio && <span style={{ color: 'var(--text-3)', marginLeft: '8px' }}>{mem.bio}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => openEditMem(mem)} style={{ padding: '4px 9px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-2)', cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => removeMem(mem.id)} style={{ padding: '4px 9px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '11px', color: 'var(--empty)', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Input de foto oculto */}
              <input ref={firstRef} ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (file && editMemId) await uploadPhoto(editMemId, file)
                  e.target.value = ''
                }}
              />
              {uploading && <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-3)' }}>Enviando foto...</div>}
            </div>
          </div>
        )}
      </div>

      {/* Modal — Ministério */}
      {showMinForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && setShowMinForm(false)}>
          <div className="fade-up" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>{editMinId ? 'Editar' : 'Novo'} ministério</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={L}>Nome *</label><input value={minForm.name} onChange={e => setMinForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Ministério de Louvor"/></div>
              <div><label style={L}>Descrição</label><textarea value={minForm.description} onChange={e => setMinForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'none', height: '72px' }} placeholder="Breve descrição do ministério"/></div>
              <div><label style={L}>Horário dos encontros</label><input value={minForm.meeting_schedule} onChange={e => setMinForm(f => ({ ...f, meeting_schedule: e.target.value }))} placeholder="Ex: Sábados às 19h"/></div>
              <div><label style={L}>Local</label><input value={minForm.location} onChange={e => setMinForm(f => ({ ...f, location: e.target.value }))} placeholder="Ex: Sala 3"/></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={saveMin} disabled={saving} style={{ flex: 1, padding: '10px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : editMinId ? 'Salvar' : 'Criar ministério'}
              </button>
              <button onClick={() => setShowMinForm(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Membro */}
      {showMemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && setShowMemForm(false)}>
          <div className="fade-up" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>{editMemId ? 'Editar' : 'Adicionar'} membro</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Avatar com preview e clique para upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => modalPhotoRef.current?.click()}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-md)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 600, color: '#fff' }}
                    style={{ background: modalPhotoPreview ? 'transparent' : '#6366f1' }}>
                    {modalPhotoPreview
                      ? <img src={modalPhotoPreview} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : (memForm.name.charAt(0).toUpperCase() || '?')
                    }
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '22px', height: '22px', background: 'var(--brand)', borderRadius: '50%', border: '2px solid var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>Foto do membro</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Clique no avatar para selecionar</div>
                  <input ref={modalPhotoRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) setModalPhotoPreview(URL.createObjectURL(file))
                    }}
                  />
                </div>
              </div>
              <div><label style={L}>Nome *</label><input value={memForm.name} onChange={e => setMemForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo"/></div>
              <div>
                <label style={L}>Papel no ministério</label>
                <select value={memForm.role} onChange={e => setMemForm(f => ({ ...f, role: e.target.value as MemberRole }))}>
                  <option value="lider">Líder</option>
                  <option value="lider_assistente">Líder de Equipe</option>
                  <option value="membro">Membro</option>
                </select>
              </div>
              <div><label style={L}>Bio / função</label><input value={memForm.bio} onChange={e => setMemForm(f => ({ ...f, bio: e.target.value }))} placeholder="Ex: Guitarrista, Vocal..."/></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={L}>Telefone</label><input value={memForm.phone} onChange={e => setMemForm(f => ({ ...f, phone: e.target.value }))} placeholder="(47) 9xxxx-xxxx"/></div>
                <div><label style={L}>E-mail</label><input value={memForm.email} onChange={e => setMemForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..."/></div>
              </div>
            </div>
            {error && <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: 'var(--empty-dim)', fontSize: '13px', color: 'var(--empty)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={saveMem} disabled={saving} style={{ flex: 1, padding: '10px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : editMemId ? 'Salvar' : 'Adicionar'}
              </button>
              <button onClick={() => setShowMemForm(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
