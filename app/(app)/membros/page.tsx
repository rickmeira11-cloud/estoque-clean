'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type Member = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  birth_state: string | null
  spouse_name: string | null
  children_info: string | null
  address_street: string | null
  address_complement: string | null
  neighborhood: string | null
  city: string | null
  small_group: string | null
  wants_to_host_group: string | null
  serves_in_ministry: string | null
  wants_to_serve_other_ministry: string | null
  accepts_communication: boolean
  is_active: boolean
  submitted_at: string | null
  updated_at: string
}

type EditForm = {
  full_name: string
  birth_date: string
  phone: string
  neighborhood: string
  city: string
  address_street: string
  address_complement: string
  birth_state: string
  spouse_name: string
  children_info: string
  small_group: string
  wants_to_host_group: string
  serves_in_ministry: string
  wants_to_serve_other_ministry: string
  accepts_communication: boolean
  is_active: boolean
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('pt-BR')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d > 1 ? 's' : ''}`
}

function Avatar({ name, size = 36, inactive }: { name: string; size?: number; inactive?: boolean }) {
  const COLORS = ['#6366f1','#0f6e56','#854f0b','#185fa5','#993556','#3b6d11','#712b13','#534ab7']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const bg = inactive ? '#71717a' : COLORS[Math.abs(hash) % COLORS.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0, opacity: inactive ? 0.6 : 1 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function FormField({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div style={{ gridColumn: half ? 'span 1' : 'span 2', marginBottom: '2px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '7px 10px', background: 'var(--bg-3)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: '13px', color: 'var(--text-1)', boxSizing: 'border-box', outline: 'none',
}

export default function MembrosPage() {
  const { profile, isAdmin } = useProfile()
  const [members,  setMembers]  = useState<Member[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadErr,  setLoadErr]  = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [form,     setForm]     = useState<EditForm | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [saveErr,  setSaveErr]  = useState<string | null>(null)
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState<string | null>(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    setLoadErr(null)
    const sb = createClient()
    const { data, error } = await sb
      .from('members')
      .select('*')
      .eq('church_id', profile!.church_id)
      .order('full_name')
    if (error) {
      console.error('[membros] load error:', error)
      setLoadErr(error.message)
    }
    setMembers(data || [])
    setLoading(false)
  }

  function openEdit(m: Member) {
    setForm({
      full_name: m.full_name,
      birth_date: m.birth_date || '',
      phone: m.phone || '',
      neighborhood: m.neighborhood || '',
      city: m.city || '',
      address_street: m.address_street || '',
      address_complement: m.address_complement || '',
      birth_state: m.birth_state || '',
      spouse_name: m.spouse_name || '',
      children_info: m.children_info || '',
      small_group: m.small_group || '',
      wants_to_host_group: m.wants_to_host_group || '',
      serves_in_ministry: m.serves_in_ministry || '',
      wants_to_serve_other_ministry: m.wants_to_serve_other_ministry || '',
      accepts_communication: m.accepts_communication,
      is_active: m.is_active,
    })
    setEditing(true)
    setSaveErr(null)
  }

  function set(field: keyof EditForm, value: string | boolean) {
    setForm(f => f ? { ...f, [field]: value } : f)
  }

  async function handleSave() {
    if (!form || !selected || !profile) return
    setSaving(true)
    setSaveErr(null)
    const sb = createClient()

    const payload: Partial<Member> = {
      full_name: form.full_name.trim(),
      birth_date: form.birth_date.trim() || null,
      phone: form.phone.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      address_street: form.address_street.trim() || null,
      address_complement: form.address_complement.trim() || null,
      birth_state: form.birth_state.trim() || null,
      spouse_name: form.spouse_name.trim() || null,
      children_info: form.children_info.trim() || null,
      small_group: form.small_group.trim() || null,
      wants_to_host_group: form.wants_to_host_group.trim() || null,
      serves_in_ministry: form.serves_in_ministry.trim() || null,
      wants_to_serve_other_ministry: form.wants_to_serve_other_ministry.trim() || null,
      accepts_communication: form.accepts_communication,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }

    const { error } = await sb.from('members').update(payload).eq('id', selected.id)

    if (error) {
      setSaveErr(error.message)
      setSaving(false)
      return
    }

    // Diff para audit_log
    const changed: Record<string, { de: unknown; para: unknown }> = {}
    for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
      if (key === 'updated_at') continue
      const oldVal = selected[key as keyof Member]
      const newVal = payload[key]
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        changed[key] = { de: oldVal ?? null, para: newVal ?? null }
      }
    }

    try {
      await sb.from('audit_log').insert({
        church_id: profile.church_id,
        user_id: profile.id,
        action: 'member_updated',
        entity: 'members',
        entity_id: selected.id,
        description: `Editou membro ${selected.full_name}`,
        old_data: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.de])),
        new_data: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.para])),
      })
    } catch (_) {}

    setSaving(false)
    setEditing(false)
    setSelected(null)
    await load()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/members/sync', { method: 'POST', credentials: 'same-origin' })
      const json = await res.json()
      if (!json.ok) {
        setSyncMsg('Erro: ' + (json.error || 'falha desconhecida'))
      } else {
        const { inserted = 0, updated = 0, skipped = 0, total = 0 } = json
        setSyncMsg(`Concluído — ${inserted} novo(s), ${updated} atualizado(s), ${skipped} pulado(s). Total: ${total}`)
        await load()
      }
    } catch (e: any) {
      setSyncMsg('Erro de rede: ' + e.message)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 8000)
    }
  }

  const lastSync = useMemo(() => {
    if (!members.length) return null
    return members.reduce((best, m) => m.updated_at > best ? m.updated_at : best, members[0].updated_at)
  }, [members])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return members.filter(m =>
      !q ||
      m.full_name.toLowerCase().includes(q) ||
      (m.neighborhood || '').toLowerCase().includes(q) ||
      (m.serves_in_ministry || '').toLowerCase().includes(q)
    )
  }, [members, search])

  const activeCount = members.filter(m => m.is_active).length

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Membros</h1>
            {!loading && (
              <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontWeight: '600' }}>
                {activeCount} ativo{activeCount !== 1 ? 's' : ''}
              </span>
            )}
            {!loading && members.length !== activeCount && (
              <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-3)', fontWeight: '500' }}>
                {members.length - activeCount} inativo{members.length - activeCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {lastSync && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>Último sync {timeAgo(lastSync)}</div>}
        </div>

        {isAdmin && (
          <button onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: syncing ? 'var(--bg-3)' : 'var(--brand)', color: '#fff', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: syncing ? 0.7 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>
        )}
      </div>

      {/* Toast sync */}
      {syncMsg && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: syncMsg.startsWith('Erro') ? 'var(--empty-dim)' : 'var(--ok-dim)', border: '1px solid var(--border-md)', color: syncMsg.startsWith('Erro') ? 'var(--empty)' : 'var(--ok)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {syncMsg.startsWith('Erro') ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> : <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}
          </svg>
          {syncMsg}
        </div>
      )}

      {/* Busca */}
      <div style={{ marginBottom: '12px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, bairro ou ministério..."
          style={{ width: '100%', padding: '8px 14px 8px 34px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-dim)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
        />
        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>}
      </div>

      {/* Erro de leitura */}
      {loadErr && <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--empty-dim)', border: '1px solid var(--border-md)', color: 'var(--empty)', fontSize: '13px' }}>Erro ao carregar: {loadErr}</div>}

      {/* Tabela */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: '48px', background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', opacity: 0.6 }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: '14px' }}>
          {search ? `Nenhum resultado para "${search}".` : 'Nenhum membro cadastrado. Clique em "Sincronizar agora" para importar.'}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {/* Header da tabela */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 90px', gap: '0', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', padding: '8px 14px', fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Nome</span>
            <span>Bairro</span>
            <span>Telefone</span>
            <span>Ministério</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>

          {filtered.map((m, idx) => (
            <div
              key={m.id}
              onClick={() => { setSelected(m); setEditing(false); setSaveErr(null) }}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 90px', gap: '0', padding: '10px 14px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: 'var(--bg-card)', alignItems: 'center', opacity: m.is_active ? 1 : 0.55, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Avatar name={m.full_name} size={32} inactive={!m.is_active}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</div>
                  {m.email && <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.neighborhood || '—'}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.phone || '—'}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.serves_in_ministry ? m.serves_in_ministry.split(',')[0].trim() : '—'}</span>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: m.is_active ? 'var(--ok-dim)' : 'var(--bg-3)', color: m.is_active ? 'var(--ok)' : 'var(--text-3)', fontWeight: '500' }}>
                  {m.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalhe / edição */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && !saving && (setSelected(null), setEditing(false))}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Header do modal */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
              <Avatar name={selected.full_name} size={48} inactive={!selected.is_active}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-1)' }}>{selected.full_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                  {selected.email}
                  {selected.submitted_at && <> · Cadastro: {fmtDate(selected.submitted_at)}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {isAdmin && !editing && (
                  <button onClick={() => openEdit(selected)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                    Editar
                  </button>
                )}
                <button onClick={() => !saving && (setSelected(null), setEditing(false))} style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Corpo */}
            <div style={{ padding: '16px 20px 20px', overflowY: 'auto', flex: 1 }}>
              {!editing ? (
                // Modo leitura
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    {[
                      ['Telefone', selected.phone],
                      ['Bairro', selected.neighborhood],
                      ['Cidade', selected.city],
                      ['Endereço', [selected.address_street, selected.address_complement].filter(Boolean).join(', ')],
                      ['Naturalidade', selected.birth_state],
                      ['Nascimento', fmtDate(selected.birth_date)],
                      ['Cônjuge', selected.spouse_name],
                      ['Filhos', selected.children_info],
                      ['2OU+', selected.small_group],
                      ['Ministra em', selected.serves_in_ministry],
                      ['Deseja servir em', selected.wants_to_serve_other_ministry],
                      ['Deseja sediar grupo', selected.wants_to_host_group],
                    ].map(([label, val]) => val ? (
                      <div key={label as string} style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-1)' }}>{val}</div>
                      </div>
                    ) : null)}
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selected.accepts_communication && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--info-dim)', color: 'var(--info)', fontWeight: '500' }}>Aceita comunicação</span>}
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: selected.is_active ? 'var(--ok-dim)' : 'var(--bg-3)', color: selected.is_active ? 'var(--ok)' : 'var(--text-3)', fontWeight: '500' }}>{selected.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-3)' }}>Atualizado {timeAgo(selected.updated_at)}</div>
                </>
              ) : form && (
                // Modo edição
                <>
                  {saveErr && <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--empty-dim)', color: 'var(--empty)', fontSize: '12px' }}>Erro: {saveErr}</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                    <FormField label="Nome completo">
                      <input value={form.full_name} onChange={e => set('full_name', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Telefone" half>
                      <input value={form.phone} onChange={e => set('phone', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Bairro" half>
                      <input value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Cidade" half>
                      <input value={form.city} onChange={e => set('city', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Rua / Endereço" half>
                      <input value={form.address_street} onChange={e => set('address_street', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Complemento" half>
                      <input value={form.address_complement} onChange={e => set('address_complement', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Nascimento (AAAA-MM-DD)" half>
                      <input value={form.birth_date} onChange={e => set('birth_date', e.target.value)} placeholder="ex: 1990-05-20" style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Naturalidade" half>
                      <input value={form.birth_state} onChange={e => set('birth_state', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Cônjuge" half>
                      <input value={form.spouse_name} onChange={e => set('spouse_name', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Filhos">
                      <input value={form.children_info} onChange={e => set('children_info', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Grupo (2OU+)">
                      <input value={form.small_group} onChange={e => set('small_group', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Ministra em">
                      <input value={form.serves_in_ministry} onChange={e => set('serves_in_ministry', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Deseja servir em">
                      <input value={form.wants_to_serve_other_ministry} onChange={e => set('wants_to_serve_other_ministry', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>
                    <FormField label="Deseja sediar grupo">
                      <input value={form.wants_to_host_group} onChange={e => set('wants_to_host_group', e.target.value)} style={INPUT_STYLE}
                        onFocus={e => e.target.style.borderColor = 'var(--brand)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
                    </FormField>

                    {/* Toggles */}
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '24px', marginTop: '4px' }}>
                      {[
                        { field: 'accepts_communication' as const, label: 'Aceita comunicação' },
                        { field: 'is_active' as const, label: 'Membro ativo' },
                      ].map(({ field, label }) => (
                        <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-1)' }}>
                          <div onClick={() => set(field, !form[field])} style={{ width: '36px', height: '20px', borderRadius: '10px', background: form[field] ? 'var(--brand)' : 'var(--bg-3)', border: '1px solid ' + (form[field] ? 'var(--brand)' : 'var(--border)'), position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
                            <div style={{ position: 'absolute', top: '2px', left: form[field] ? '17px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }}/>
                          </div>
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer do modal (modo edição) */}
            {editing && form && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => setEditing(false)} disabled={saving} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.full_name.trim()} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: (saving || !form.full_name.trim()) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
