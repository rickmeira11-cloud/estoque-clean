'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type Member = {
  id: string
  name: string
  role: 'lider' | 'lider_assistente' | 'membro'
  photo_url: string | null
  bio: string | null
}

type Ministry = {
  id: string
  name: string
  description: string | null
  meeting_schedule: string | null
  location: string | null
  cover_image_url: string | null
  members: Member[]
}

const ROLE_LABEL = { lider: 'Líder', lider_assistente: 'Líder de Equipe', membro: 'Membro' }
const ROLE_ORDER = { lider: 0, lider_assistente: 1, membro: 2 }

const COLORS = [
  '#6366f1','#0f6e56','#854f0b','#712b13','#444441',
  '#185fa5','#3b6d11','#993556','#a32d2d','#534ab7',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function Avatar({ member, size = 56 }: { member: Member; size?: number }) {
  const isLeader = member.role === 'lider' || member.role === 'lider_assistente'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        border: isLeader ? '2.5px solid #6366f1' : '2px solid rgba(255,255,255,0.08)',
        boxShadow: isLeader ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
      }}>
        {member.photo_url ? (
          <Image src={member.photo_url} alt={member.name} width={size} height={size} style={{ objectFit: 'cover', width: '100%', height: '100%' }}/>
        ) : (
          <div style={{ width: '100%', height: '100%', background: getColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 600, color: '#fff' }}>
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {isLeader && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, background: '#6366f1', borderRadius: '50%', border: '2px solid #09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
      )}
    </div>
  )
}

export default function MinisteriosPublicPage() {
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Ministry | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const sb = createClient()
    const { data: minsData } = await sb
      .from('ministries')
      .select('id, name, description, meeting_schedule, location, cover_image_url')
      .eq('is_active', true)
      .order('name')

    if (!minsData) { setLoading(false); return }

    const withMembers = await Promise.all(
      minsData.map(async (m) => {
        const { data: members } = await sb
          .from('ministry_members')
          .select('id, name, role, photo_url, bio')
          .eq('ministry_id', m.id)
          .eq('is_active', true)
          .order('role')
        return {
          ...m,
          members: (members || []).sort((a, b) => ROLE_ORDER[a.role as keyof typeof ROLE_ORDER] - ROLE_ORDER[b.role as keyof typeof ROLE_ORDER])
        }
      })
    )
    const sorted = withMembers.sort((a, b) => {
      const aFirst = a.name.toLowerCase().includes('poiema church') ? -1 : 0
      const bFirst = b.name.toLowerCase().includes('poiema church') ? -1 : 0
      if (aFirst !== bFirst) return aFirst - bFirst
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    setMinistries(sorted)
    setLoading(false)
  }

  const filtered = ministries.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header público */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(17,17,19,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#111827', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
              <Image src="/logo.png" alt="Poiema" width={20} height={20} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1) opacity(0.85)' }}/>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fafafa', lineHeight: 1 }}>Poiema</div>
              <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>Ministérios</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              placeholder="Buscar ministério..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: '200px', padding: '7px 12px', fontSize: '13px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fafafa', outline: 'none' }}
            />
            <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px', color: '#a1a1aa', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              Voltar ao app
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 20px' }}>
        {/* Hero */}
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em', margin: 0 }}>
            Ministérios
          </h1>
          <p style={{ fontSize: '14px', color: '#52525b', marginTop: '6px' }}>
            Conheça as pessoas que servem na Poiema Blumenau
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '16px' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: '200px', background: '#18181b', borderRadius: '12px', animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, #18181b 25%, #111113 50%, #18181b 75%)' }}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#52525b', fontSize: '14px' }}>
            Nenhum ministério encontrado.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: '16px' }}>
            {filtered.map(m => (
              <div key={m.id}
                onClick={() => setSelected(m)}
                style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}>

                {/* Cover */}
                <div style={{ height: '72px', background: m.cover_image_url ? `url(${m.cover_image_url}) center/cover` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', display: 'flex', alignItems: 'flex-end', padding: '10px 14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{m.name}</div>
                </div>

                <div style={{ padding: '14px' }}>
                  {/* Meta */}
                  {(m.meeting_schedule || m.location) && (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {m.meeting_schedule && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#71717a' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          {m.meeting_schedule}
                        </div>
                      )}
                      {m.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#71717a' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {m.location}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Membros — fotos circulares */}
                  {m.members.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#52525b' }}>Nenhum membro cadastrado</div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {m.members.slice(0, 8).map(mem => (
                          <div key={mem.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '52px' }}>
                            <Avatar member={mem} size={44}/>
                            <div style={{ fontSize: '9px', fontWeight: '500', color: '#a1a1aa', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '52px' }}>
                              {mem.name.split(' ')[0]}
                            </div>
                          </div>
                        ))}
                        {m.members.length > 8 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '52px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#27272a', border: '2px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: '#71717a' }}>
                              +{m.members.length - 8}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#52525b', marginTop: '10px' }}>
                        {m.members.length} {m.members.length === 1 ? 'membro' : 'membros'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalhe do ministério */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Cover do modal */}
            <div style={{ height: '100px', background: selected.cover_image_url ? `url(${selected.cover_image_url}) center/cover` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: '12px', right: '12px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>✕</button>
              <div style={{ position: 'absolute', bottom: '12px', left: '16px' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>{selected.name}</div>
              </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Meta */}
              {(selected.meeting_schedule || selected.location) && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  {selected.meeting_schedule && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#71717a' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      {selected.meeting_schedule}
                    </div>
                  )}
                  {selected.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#71717a' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {selected.location}
                    </div>
                  )}
                </div>
              )}

              {selected.description && (
                <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: '1.6', marginBottom: '18px' }}>{selected.description}</p>
              )}

              {/* Líderes */}
              {selected.members.filter(m => m.role === 'lider' || m.role === 'lider_assistente').length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Liderança</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {selected.members.filter(m => m.role === 'lider' || m.role === 'lider_assistente').map(mem => (
                      <div key={mem.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '10px 14px', flex: '1', minWidth: '180px' }}>
                        <Avatar member={mem} size={44}/>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fafafa' }}>{mem.name}</div>
                          <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '1px' }}>{ROLE_LABEL[mem.role]}</div>
                          {mem.bio && <div style={{ fontSize: '11px', color: '#71717a', marginTop: '3px', lineHeight: '1.4' }}>{mem.bio}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Membros */}
              {selected.members.filter(m => m.role === 'membro').length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Membros ({selected.members.filter(m => m.role === 'membro').length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {selected.members.filter(m => m.role === 'membro').map(mem => (
                      <div key={mem.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '60px' }}>
                        <Avatar member={mem} size={48}/>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#a1a1aa', textAlign: 'center', lineHeight: 1.2 }}>
                          {mem.name.split(' ')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}