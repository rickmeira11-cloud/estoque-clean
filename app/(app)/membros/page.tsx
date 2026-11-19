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
  submitted_at: string | null
  updated_at: string
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

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const COLORS = ['#6366f1','#0f6e56','#854f0b','#185fa5','#993556','#3b6d11','#712b13','#534ab7']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const bg = COLORS[Math.abs(hash) % COLORS.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Tag({ children, color = 'var(--brand-light)', bg = 'var(--brand-dim)' }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: bg, color, fontWeight: '500', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

export default function MembrosPage() {
  const { profile } = useProfile()
  const [members,  setMembers]  = useState<Member[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState<string | null>(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb
      .from('members')
      .select('*')
      .eq('church_id', profile!.church_id)
      .order('full_name')
    setMembers(data || [])
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/members/sync', {
        method: 'POST',
        credentials: 'same-origin',
      })
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
    if (!search.trim()) return members
    const q = search.toLowerCase().trim()
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      (m.neighborhood || '').toLowerCase().includes(q) ||
      (m.serves_in_ministry || '').toLowerCase().includes(q)
    )
  }, [members, search])

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
                Membros
              </h1>
              {!loading && (
                <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)', fontWeight: '600' }}>
                  {members.length}
                </span>
              )}
            </div>
            {lastSync && (
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
                Último sync {timeAgo(lastSync)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              background: syncing ? 'var(--bg-3)' : 'var(--brand)',
              color: '#fff', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: '500', transition: 'all 0.15s',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>
        </div>
      </div>

      {/* Toast de resultado do sync */}
      {syncMsg && (
        <div style={{
          marginBottom: '16px', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
          background: syncMsg.startsWith('Erro') ? 'var(--empty-dim)' : 'var(--ok-dim)',
          border: '1px solid ' + (syncMsg.startsWith('Erro') ? 'var(--border-md)' : 'var(--border-md)'),
          color: syncMsg.startsWith('Erro') ? 'var(--empty)' : 'var(--ok)',
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {syncMsg.startsWith('Erro')
              ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
              : <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
            }
          </svg>
          {syncMsg}
        </div>
      )}

      {/* Busca */}
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, bairro ou ministério..."
          style={{
            width: '100%', padding: '9px 14px 9px 34px',
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text-1)',
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-dim)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Estado de carregamento */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height: '100px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', opacity: 0.6 }}/>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: '14px' }}>
          {search ? 'Nenhum membro encontrado para esta busca.' : 'Nenhum membro cadastrado. Clique em "Sincronizar agora" para importar.'}
        </div>
      ) : (
        <>
          {search && (
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '10px' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {filtered.map(m => (
              <div
                key={m.id}
                onClick={() => setSelected(m)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <Avatar name={m.full_name} size={42}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.full_name}
                    </div>
                    {m.neighborhood && (
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{m.neighborhood}{m.city ? ` · ${m.city}` : ''}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {m.serves_in_ministry && (
                    <Tag>{m.serves_in_ministry.split(',')[0].trim()}{m.serves_in_ministry.includes(',') ? ' +' : ''}</Tag>
                  )}
                  {m.small_group && <Tag bg="var(--ok-dim)" color="var(--ok)">2OU+</Tag>}
                  {m.accepts_communication && <Tag bg="var(--info-dim)" color="var(--info)">Comunicação ✓</Tag>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de detalhe */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Cabeçalho do modal */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
              <Avatar name={selected.full_name} size={52}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{selected.full_name}</div>
                {selected.email && <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' }}>{selected.email}</div>}
                {selected.phone && <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '1px' }}>{selected.phone}</div>}
              </div>
              <button onClick={() => setSelected(null)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Corpo do modal com scroll */}
            <div style={{ padding: '16px 20px 20px', overflowY: 'auto', flex: 1 }}>

              {/* Tags de envolvimento */}
              {(selected.serves_in_ministry || selected.small_group || selected.accepts_communication) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  {selected.serves_in_ministry && selected.serves_in_ministry.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                    <Tag key={i}>{s}</Tag>
                  ))}
                  {selected.small_group && <Tag bg="var(--ok-dim)" color="var(--ok)">2OU+: {selected.small_group}</Tag>}
                  {selected.accepts_communication && <Tag bg="var(--info-dim)" color="var(--info)">Aceita comunicação</Tag>}
                </div>
              )}

              {/* Dados pessoais */}
              <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Dados pessoais</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <Field label="Data de nascimento" value={fmtDate(selected.birth_date)}/>
                  <Field label="Naturalidade" value={selected.birth_state}/>
                  <Field label="Cônjuge" value={selected.spouse_name}/>
                  <Field label="Filhos" value={selected.children_info}/>
                </div>
              </div>

              {/* Endereço */}
              {(selected.address_street || selected.neighborhood || selected.city) && (
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Endereço</div>
                  <Field label="Rua" value={[selected.address_street, selected.address_complement].filter(Boolean).join(', ')}/>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Field label="Bairro" value={selected.neighborhood}/>
                    <Field label="Cidade" value={selected.city}/>
                  </div>
                </div>
              )}

              {/* Ministério */}
              {(selected.wants_to_host_group || selected.wants_to_serve_other_ministry) && (
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Envolvimento</div>
                  <Field label="Deseja sediar grupo" value={selected.wants_to_host_group}/>
                  <Field label="Deseja servir em" value={selected.wants_to_serve_other_ministry}/>
                </div>
              )}

              {/* Rodapé com data */}
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                {selected.submitted_at && <>Formulário enviado em {fmtDate(selected.submitted_at)} · </>}
                Atualizado {timeAgo(selected.updated_at)}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
