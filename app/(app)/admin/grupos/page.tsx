'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import AdminTable, { type FieldDef } from '@/components/AdminTable'
import Link from 'next/link'

const WEEKDAY_LABEL: Record<string, string> = {
  domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça',
  quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado',
}
const ROLE_LABEL: Record<string, string> = { leader: 'Líder', host: 'Anfitrião', member: 'Membro' }
const ROLE_ORDER: Record<string, number> = { leader: 0, host: 1, member: 2 }

type GroupMember = { id: string; small_group_id: string; member_id: string; role: string; member_name: string }
type SmallGroup = { id: string; name: string; address: string | null; weekday: string; time: string; is_active: boolean; members?: GroupMember[] }
type RegisteredMember = { id: string; full_name: string }

const WEEKDAY_OPTIONS = [
  { value: 'domingo', label: 'Domingo' }, { value: 'segunda', label: 'Segunda' },
  { value: 'terca',   label: 'Terça'   }, { value: 'quarta',  label: 'Quarta'  },
  { value: 'quinta',  label: 'Quinta'  }, { value: 'sexta',   label: 'Sexta'   },
  { value: 'sabado',  label: 'Sábado'  },
]

const FIELDS: FieldDef[] = [
  { type: 'text',   key: 'name',    label: 'Nome do grupo',  placeholder: 'Ex: Grupo da Vila Nova', required: true },
  { type: 'text',   key: 'address', label: 'Endereço',       placeholder: 'Rua, bairro...' },
  { type: 'select', key: 'weekday', label: 'Dia da semana',  required: true,
    options: WEEKDAY_OPTIONS },
  { type: 'text',   key: 'time',    label: 'Horário',        placeholder: 'Ex: 19:30', required: true },
]
const INITIAL = { name: '', address: '', weekday: 'segunda', time: '' }

export default function GruposPage() {
  const { profile, isAdmin } = useProfile()
  const [groups,     setGroups]     = useState<SmallGroup[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<SmallGroup | null>(null)
  const [memberOptions, setMemberOptions] = useState<RegisteredMember[]>([])

  // member form state
  const [showMemForm,  setShowMemForm]  = useState(false)
  const [memSearch,    setMemSearch]    = useState('')
  const [memResults,   setMemResults]   = useState<RegisteredMember[]>([])
  const [showDrop,     setShowDrop]     = useState(false)
  const [memForm,      setMemForm]      = useState({ member_id: '', role: 'member' })
  const [selectedName, setSelectedName] = useState('')
  const [memSaving,    setMemSaving]    = useState(false)
  const [memError,     setMemError]     = useState<string | null>(null)
  const [flash,        setFlash]        = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.church_id) { load(); loadMemberOptions() }
  }, [profile?.church_id])

  // close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(null), 3000) }

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data: gs } = await sb.from('small_groups').select('*').eq('church_id', profile!.church_id).order('weekday').order('time')
    if (gs) {
      const withMembers = await Promise.all(gs.map(async g => {
        const { data: mems } = await sb
          .from('small_group_members')
          .select('id, small_group_id, member_id, role, members(full_name)')
          .eq('small_group_id', g.id)
        const members: GroupMember[] = (mems || []).map((m: any) => ({
          id: m.id, small_group_id: m.small_group_id, member_id: m.member_id,
          role: m.role, member_name: m.members?.full_name ?? '—',
        })).sort((a: GroupMember, b: GroupMember) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
        return { ...g, members }
      }))
      setGroups(withMembers)
      if (selected) {
        const updated = withMembers.find(g => g.id === selected.id)
        if (updated) setSelected(updated)
      }
    }
    setLoading(false)
  }

  async function loadMemberOptions() {
    const { data } = await createClient().from('members').select('id, full_name').eq('church_id', profile!.church_id).eq('is_active', true).order('full_name')
    if (data) setMemberOptions(data)
  }

  async function onSave(form: Record<string, string>, editId: string | null): Promise<string | null> {
    if (!form.name.trim()) return 'Nome é obrigatório'
    if (!form.weekday)     return 'Dia da semana é obrigatório'
    if (!form.time.trim()) return 'Horário é obrigatório'
    const sb = createClient()
    const payload = {
      church_id: profile!.church_id,
      name:      form.name.trim(),
      address:   form.address || null,
      weekday:   form.weekday,
      time:      form.time.trim(),
    }
    const { error } = editId
      ? await sb.from('small_groups').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
      : await sb.from('small_groups').insert(payload)
    if (error) return error.message
    await load()
    return null
  }

  async function onToggle(g: SmallGroup) {
    await createClient().from('small_groups').update({ is_active: !g.is_active, updated_at: new Date().toISOString() }).eq('id', g.id)
    await load()
  }

  // ── Member search ──
  function handleSearch(val: string) {
    setMemSearch(val)
    setSelectedName('')
    setMemForm(f => ({ ...f, member_id: '' }))
    if (val.length < 2) { setMemResults([]); setShowDrop(false); return }
    const q = val.toLowerCase()
    setMemResults(memberOptions.filter(o => o.full_name.toLowerCase().includes(q)).slice(0, 8))
    setShowDrop(true)
  }

  function pickMember(o: RegisteredMember) {
    setMemForm(f => ({ ...f, member_id: o.id }))
    setSelectedName(o.full_name)
    setMemSearch(o.full_name)
    setShowDrop(false)
    setMemResults([])
  }

  function openMemForm() {
    setMemForm({ member_id: '', role: 'member' })
    setMemSearch(''); setSelectedName(''); setMemResults([]); setShowDrop(false)
    setMemError(null); setShowMemForm(true)
  }

  async function saveMem() {
    if (!selected) return
    if (!memForm.member_id) { setMemError('Selecione um membro cadastrado'); return }
    setMemSaving(true); setMemError(null)
    const { error } = await createClient().from('small_group_members').insert({
      small_group_id: selected.id,
      member_id: memForm.member_id,
      role: memForm.role,
    })
    if (error) {
      setMemError(error.code === '23505' ? 'Este membro já está neste grupo.' : error.message)
    } else {
      setShowMemForm(false)
      await load()
      showFlash('Membro adicionado!')
    }
    setMemSaving(false)
  }

  async function removeMem(memId: string) {
    if (!confirm('Remover este membro do grupo?')) return
    await createClient().from('small_group_members').delete().eq('id', memId)
    await load()
    showFlash('Membro removido.')
  }

  const selectedUpdated = selected ? groups.find(g => g.id === selected.id) ?? selected : null

  return (
    <div>
      <AdminTable<SmallGroup>
        title="Grupos 2ou+"
        subtitle="Grupos de conexão e comunidade"
        emptyIcon="👥"
        emptyText="Nenhum grupo cadastrado ainda."
        newLabel="+ Novo grupo"
        isAdmin={isAdmin}
        loading={loading}
        items={groups}
        fields={FIELDS}
        initialForm={INITIAL}
        formTitle={editing => editing ? 'Editar grupo' : 'Novo grupo'}
        onEditInit={g => ({ name: g.name, address: g.address || '', weekday: g.weekday, time: g.time })}
        onSave={onSave}
        onToggle={onToggle}
        getSearchText={g => g.name + ' ' + (g.address || '')}
        searchPlaceholder="Buscar grupo..."
        renderItem={(g, actions, isAdmin) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${g.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity: g.is_active ? 1 : 0.6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{g.name}</span>
                  {!g.is_active && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-3)' }}>Inativo</span>}
                  <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>
                    {WEEKDAY_LABEL[g.weekday]} · {g.time.slice(0,5)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {g.address && <span>📍 {g.address}</span>}
                  <span>👥 {g.members?.length ?? 0} {g.members?.length === 1 ? 'membro' : 'membros'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelected(selected?.id === g.id ? null : g)}
                  style={{ padding: '5px 10px', borderRadius: '6px', background: selected?.id === g.id ? 'var(--brand-dim)' : 'transparent', border: `1px solid ${selected?.id === g.id ? 'var(--brand)' : 'var(--border)'}`, color: selected?.id === g.id ? 'var(--brand-light)' : 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}
                >
                  Membros
                </button>
                {isAdmin && <>
                  <button onClick={actions.onToggle} style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>{g.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={actions.onEdit}   style={{ padding: '5px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px' }}>Editar</button>
                </>}
              </div>
            </div>

            {/* Painel de membros inline */}
            {selected?.id === g.id && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Membros do grupo</span>
                  {isAdmin && (
                    <button onClick={openMemForm} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', cursor: 'pointer', fontSize: '11px' }}>+ Adicionar</button>
                  )}
                </div>

                {/* Form adicionar membro */}
                {showMemForm && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {memError && <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: 'var(--empty)', fontSize: '13px' }}>{memError}</div>}
                    <div ref={dropRef} style={{ position: 'relative' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>Membro *</label>
                      <input
                        value={memSearch}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Buscar por nome..."
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                      {showDrop && memResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', overflow: 'hidden', marginTop: '2px' }}>
                          {memResults.map(o => (
                            <button key={o.id} onClick={() => pickMember(o)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >{o.full_name}</button>
                          ))}
                        </div>
                      )}
                      {memSearch.length >= 2 && memResults.length === 0 && !memForm.member_id && (
                        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '6px' }}>
                          Nenhum resultado.{' '}
                          <Link href="/membros" style={{ color: 'var(--brand-light)' }}>Cadastre o membro primeiro</Link>.
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>Papel no grupo</label>
                      <select value={memForm.role} onChange={e => setMemForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: '13px' }}>
                        <option value="leader">Líder</option>
                        <option value="host">Anfitrião</option>
                        <option value="member">Membro</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowMemForm(false)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                      <button onClick={saveMem} disabled={memSaving} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--brand)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', opacity: memSaving ? 0.6 : 1 }}>{memSaving ? 'Salvando…' : 'Adicionar'}</button>
                    </div>
                  </div>
                )}

                {/* Lista de membros */}
                {selectedUpdated?.members && selectedUpdated.members.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedUpdated.members.map(mem => (
                      <div key={mem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--brand-light)', flexShrink: 0 }}>
                            {mem.member_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>{mem.member_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{ROLE_LABEL[mem.role]}</div>
                          </div>
                        </div>
                        {isAdmin && (
                          <button onClick={() => removeMem(mem.id)} style={{ padding: '4px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--empty)', cursor: 'pointer', fontSize: '11px' }}>Remover</button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !showMemForm && <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>Nenhum membro vinculado ainda.</p>
                )}
              </div>
            )}
          </div>
        )}
      />

      {/* Flash message */}
      {flash && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '10px 18px', borderRadius: '8px', background: 'var(--ok)', color: '#fff', fontSize: '13px', fontWeight: 500, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {flash}
        </div>
      )}
    </div>
  )
}
