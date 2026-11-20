'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import dynamic from 'next/dynamic'
const RelatoriosBarChart = dynamic(() => import('@/components/charts/RelatoriosBarChart'), { ssr: false })
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Tab = 'membros' | 'ministerios' | 'grupos' | 'eventos'
const TABS: { id: Tab; label: string }[] = [
  { id: 'membros',     label: 'Membros' },
  { id: 'ministerios', label: 'Ministérios' },
  { id: 'grupos',      label: '2ou+' },
  { id: 'eventos',     label: 'Eventos' },
]

type Member = { id: string; full_name: string; is_active: boolean; neighborhood: string | null; birth_date: string | null }
type Ministry = { id: string; name: string; is_active: boolean }
type MinistryMember = { ministry_id: string; member_id: string; is_active: boolean }
type SmallGroup = { id: string; name: string; is_active: boolean }
type GroupMember = { small_group_id: string; member_id: string }
type EventType = { id: string; name: string }
type EventTypeField = { id: string; event_type_id: string; field_key: string; label: string; field_type: string }
type EventRow = { id: string; name: string; event_date: string | null; event_type_id: string | null }
type Attachment = { id: string; event_id: string; file_url: string; file_name: string }

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const panelStyle: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }
const panelTitle: React.CSSProperties = { fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '14px' }
const miniTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-3)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: '13px', color: 'var(--text-1)', borderBottom: '1px solid var(--border)' }

function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '13px' }}>{children}</div>
}

export default function IgrejaReports() {
  const { profile } = useProfile()
  const [tab, setTab] = useState<Tab>('membros')

  const [members, setMembers] = useState<Member[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [ministryMembers, setMinistryMembers] = useState<MinistryMember[]>([])
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)

  const [birthMonth, setBirthMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => { if (profile?.church_id) loadBase() }, [profile?.church_id])

  async function loadBase() {
    setLoading(true)
    const sb = createClient()
    const [
      { data: mem }, { data: mins }, { data: minMem },
      { data: groups }, { data: grpMem }, { data: types },
    ] = await Promise.all([
      sb.from('members').select('id, full_name, is_active, neighborhood, birth_date').eq('church_id', profile!.church_id),
      sb.from('ministries').select('id, name, is_active').eq('church_id', profile!.church_id),
      sb.from('ministry_members').select('ministry_id, member_id, is_active'),
      sb.from('small_groups').select('id, name, is_active').eq('church_id', profile!.church_id),
      sb.from('small_group_members').select('small_group_id, member_id'),
      sb.from('event_types').select('id, name').eq('church_id', profile!.church_id),
    ])
    setMembers(mem || [])
    setMinistries(mins || [])
    setMinistryMembers((minMem || []).filter((m: any) => m.is_active))
    setSmallGroups(groups || [])
    setGroupMembers(grpMem || [])
    setEventTypes(types || [])
    setLoading(false)
  }

  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members])
  const inactiveCount = members.length - activeMembers.length

  const birthdays = useMemo(() => {
    return activeMembers
      .filter(m => {
        if (!m.birth_date) return false
        const month = parseInt(m.birth_date.slice(5, 7), 10)
        return month === birthMonth
      })
      .map(m => ({ ...m, day: parseInt(m.birth_date!.slice(8, 10), 10) }))
      .sort((a, b) => a.day - b.day)
  }, [activeMembers, birthMonth])

  const bairroDist = useMemo(() => {
    const map: Record<string, number> = {}
    activeMembers.forEach(m => {
      const b = m.neighborhood?.trim() || 'Não informado'
      map[b] = (map[b] || 0) + 1
    })
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))
  }, [activeMembers])

  const activeMinistryMemberIds = useMemo(() => new Set(ministryMembers.map(m => m.member_id)), [ministryMembers])
  const activeGroupMemberIds = useMemo(() => new Set(groupMembers.map(m => m.member_id)), [groupMembers])

  const membersWithoutMinistry = useMemo(() => activeMembers.filter(m => !activeMinistryMemberIds.has(m.id)), [activeMembers, activeMinistryMemberIds])
  const membersWithoutGroup    = useMemo(() => activeMembers.filter(m => !activeGroupMemberIds.has(m.id)), [activeMembers, activeGroupMemberIds])

  const ministryCounts = useMemo(() => {
    return ministries.filter(m => m.is_active).map(m => ({
      name: m.name.length > 16 ? m.name.slice(0, 14) + '…' : m.name,
      value: ministryMembers.filter(mm => mm.ministry_id === m.id).length,
    })).sort((a, b) => b.value - a.value)
  }, [ministries, ministryMembers])

  const ministriesEmpty = useMemo(() => {
    const withMembers = new Set(ministryMembers.map(m => m.ministry_id))
    return ministries.filter(m => m.is_active && !withMembers.has(m.id))
  }, [ministries, ministryMembers])

  const activeGroups = useMemo(() => smallGroups.filter(g => g.is_active), [smallGroups])
  const groupCounts = useMemo(() => {
    return activeGroups.map(g => ({
      name: g.name,
      count: groupMembers.filter(gm => gm.small_group_id === g.id).length,
    })).sort((a, b) => b.count - a.count)
  }, [activeGroups, groupMembers])

  if (loading) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px' }}/>)}</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            background: tab === t.id ? 'var(--brand)' : 'var(--bg-card)',
            color: tab === t.id ? '#fff' : 'var(--text-2)',
            border: tab === t.id ? '1px solid var(--brand)' : '1px solid var(--border)',
            fontSize: '13px', fontWeight: tab === t.id ? '500' : '400',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'membros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ ...panelStyle, flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Membros ativos</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--ok)' }}>{activeMembers.length}</div>
            </div>
            <div style={{ ...panelStyle, flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Membros inativos</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-3)' }}>{inactiveCount}</div>
            </div>
          </div>

          <Notice>Lista completa de membros disponível em <a href="/membros" style={{ color: 'var(--brand-light)' }}>Membros</a>.</Notice>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={panelTitle}>Aniversariantes de {MONTHS[birthMonth - 1]}</span>
              <select value={birthMonth} onChange={e => setBirthMonth(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {birthdays.length === 0 ? <Notice>Nenhum aniversariante em {MONTHS[birthMonth - 1]}.</Notice> : (
              <table style={miniTable}>
                <thead><tr><th style={thStyle}>Dia</th><th style={thStyle}>Nome</th></tr></thead>
                <tbody>{birthdays.map(m => <tr key={m.id}><td style={tdStyle}>{m.day}</td><td style={tdStyle}>{m.full_name}</td></tr>)}</tbody>
              </table>
            )}
          </div>

          <div style={{ ...panelStyle, height: '320px', display: 'flex', flexDirection: 'column' }}>
            <span style={panelTitle}>Distribuição por bairro</span>
            {bairroDist.length === 0 ? <Notice>Sem dados.</Notice> : <div style={{ flex: 1 }}><RelatoriosBarChart data={bairroDist} /></div>}
          </div>

          <div style={panelStyle}>
            <span style={panelTitle}>Membros sem ministério ({membersWithoutMinistry.length})</span>
            {membersWithoutMinistry.length === 0 ? <Notice>Todos os membros ativos estão em algum ministério.</Notice> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {membersWithoutMinistry.map(m => <span key={m.id} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-2)' }}>{m.full_name}</span>)}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <span style={panelTitle}>Membros sem 2ou+ ({membersWithoutGroup.length})</span>
            {membersWithoutGroup.length === 0 ? <Notice>Todos os membros ativos estão em algum grupo.</Notice> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {membersWithoutGroup.map(m => <span key={m.id} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-2)' }}>{m.full_name}</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'ministerios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...panelStyle, height: '320px', display: 'flex', flexDirection: 'column' }}>
            <span style={panelTitle}>Membros por ministério</span>
            {ministryCounts.length === 0 ? <Notice>Nenhum ministério cadastrado.</Notice> : <div style={{ flex: 1 }}><RelatoriosBarChart data={ministryCounts} /></div>}
          </div>
          <div style={panelStyle}>
            <span style={panelTitle}>Ministérios sem nenhum membro vinculado ({ministriesEmpty.length})</span>
            {ministriesEmpty.length === 0 ? <Notice>Todos os ministérios têm ao menos um membro.</Notice> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ministriesEmpty.map(m => <span key={m.id} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-2)' }}>{m.name}</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'grupos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...panelStyle, maxWidth: '220px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Grupos ativos</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-light)' }}>{activeGroups.length}</div>
          </div>
          <div style={panelStyle}>
            <span style={panelTitle}>Membros por grupo</span>
            {groupCounts.length === 0 ? <Notice>Nenhum grupo cadastrado.</Notice> : (
              <table style={miniTable}>
                <thead><tr><th style={thStyle}>Grupo</th><th style={thStyle}>Membros</th></tr></thead>
                <tbody>{groupCounts.map(g => <tr key={g.name}><td style={tdStyle}>{g.name}</td><td style={tdStyle}>{g.count}</td></tr>)}</tbody>
              </table>
            )}
          </div>
          <div style={panelStyle}>
            <span style={panelTitle}>Membros sem 2ou+ ({membersWithoutGroup.length})</span>
            {membersWithoutGroup.length === 0 ? <Notice>Todos os membros ativos estão em algum grupo.</Notice> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {membersWithoutGroup.map(m => <span key={m.id} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '99px', background: 'var(--bg-3)', color: 'var(--text-2)' }}>{m.full_name}</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'eventos' && <EventosReport eventTypes={eventTypes} />}
    </div>
  )
}

// ── Sub-componente: relatório de eventos ──────────────────────────
type PeriodOpt = 'month' | 'quarter' | 'year' | 'custom'

function periodRange(opt: PeriodOpt, from: string, to: string): { from: string; to: string } {
  const now = new Date()
  if (opt === 'custom') return { from, to }
  const start = new Date(now)
  if (opt === 'month') start.setDate(1)
  else if (opt === 'quarter') { start.setMonth(Math.floor(now.getMonth() / 3) * 3); start.setDate(1) }
  else if (opt === 'year') { start.setMonth(0); start.setDate(1) }
  return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

function EventosReport({ eventTypes }: { eventTypes: EventType[] }) {
  const { profile } = useProfile()
  const [periodOpt, setPeriodOpt] = useState<PeriodOpt>('month')
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0])
  const { from, to } = periodRange(periodOpt, customFrom, customTo)

  const [events, setEvents] = useState<EventRow[]>([])
  const [allFields, setAllFields] = useState<EventTypeField[]>([])
  const [fieldValues, setFieldValues] = useState<any[]>([])
  const [fieldMembers, setFieldMembers] = useState<any[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [ataSearch, setAtaSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id, from, to])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data: evs } = await sb.from('events').select('id, name, event_date, event_type_id')
      .eq('church_id', profile!.church_id)
      .gte('event_date', from).lte('event_date', to)
    const evList = evs || []
    setEvents(evList)

    const typeIds = eventTypes.map(t => t.id)
    const { data: fields } = typeIds.length
      ? await sb.from('event_type_fields').select('id, event_type_id, field_key, label, field_type').in('event_type_id', typeIds)
      : { data: [] as EventTypeField[] }
    setAllFields(fields || [])

    const eventIds = evList.map(e => e.id)
    if (eventIds.length) {
      const [{ data: vals }, { data: mems }, { data: atts }] = await Promise.all([
        sb.from('event_field_values').select('*').in('event_id', eventIds),
        sb.from('event_field_members').select('*').in('event_id', eventIds),
        sb.from('event_attachments').select('id, event_id, file_url, file_name').in('event_id', eventIds),
      ])
      setFieldValues(vals || [])
      setFieldMembers(mems || [])
      setAttachments(atts || [])

      const memberIds = [...new Set((mems || []).map((m: any) => m.member_id))]
      if (memberIds.length) {
        const { data: memData } = await sb.from('members').select('id, full_name').in('id', memberIds)
        const map: Record<string, string> = {}
        ;(memData || []).forEach((m: any) => { map[m.id] = m.full_name })
        setMemberNames(map)
      } else setMemberNames({})
    } else {
      setFieldValues([]); setFieldMembers([]); setAttachments([]); setMemberNames({})
    }
    setLoading(false)
  }

  const byType = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => {
      const name = eventTypes.find(t => t.id === e.event_type_id)?.name || 'Sem tipo'
      map[name] = (map[name] || 0) + 1
    })
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))
  }, [events, eventTypes])

  const cultoType = useMemo(() => eventTypes.find(t => t.name.toLowerCase().includes('culto')), [eventTypes])
  const cultoFields = useMemo(() => allFields.filter(f => f.event_type_id === cultoType?.id), [allFields, cultoType])
  const adultosField = cultoFields.find(f => f.field_key === 'adultos')
  const criancasField = cultoFields.find(f => f.field_key === 'criancas')

  const cultoChartData = useMemo(() => {
    if (!cultoType || !adultosField || !criancasField) return []
    const cultoEvents = events.filter(e => e.event_type_id === cultoType.id).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    return cultoEvents.map(e => {
      const adultos = fieldValues.find(v => v.event_id === e.id && v.field_id === adultosField.id)?.value_number ?? 0
      const criancas = fieldValues.find(v => v.event_id === e.id && v.field_id === criancasField.id)?.value_number ?? 0
      return { label: e.event_date ? new Date(e.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—', adultos, criancas }
    })
  }, [cultoType, adultosField, criancasField, events, fieldValues])

  const batismoType = useMemo(() => eventTypes.find(t => t.name.toLowerCase().includes('batismo')), [eventTypes])
  const batismoFields = useMemo(() => allFields.filter(f => f.event_type_id === batismoType?.id), [allFields, batismoType])
  const qtdBatizadosField = batismoFields.find(f => f.field_key === 'quantidade_batizados')
  const membrosBatizadosField = batismoFields.find(f => f.field_type === 'member_relation')

  const batismoTotal = useMemo(() => {
    if (!batismoType || !qtdBatizadosField) return null
    const batismoEvents = events.filter(e => e.event_type_id === batismoType.id)
    return batismoEvents.reduce((sum, e) => sum + (fieldValues.find(v => v.event_id === e.id && v.field_id === qtdBatizadosField.id)?.value_number ?? 0), 0)
  }, [batismoType, qtdBatizadosField, events, fieldValues])

  const batizadosList = useMemo(() => {
    if (!batismoType || !membrosBatizadosField) return []
    const batismoEventIds = new Set(events.filter(e => e.event_type_id === batismoType.id).map(e => e.id))
    return fieldMembers
      .filter((fm: any) => batismoEventIds.has(fm.event_id) && fm.field_id === membrosBatizadosField.id)
      .map((fm: any) => ({ name: memberNames[fm.member_id] || fm.member_id, eventId: fm.event_id }))
  }, [batismoType, membrosBatizadosField, events, fieldMembers, memberNames])

  const ataFieldsAllTypes = useMemo(() => allFields.filter(f => f.field_key === 'ata' && f.field_type === 'textarea'), [allFields])

  const atas = useMemo(() => {
    if (!ataFieldsAllTypes.length) return []
    const fieldIdsByType: Record<string, string> = {}
    ataFieldsAllTypes.forEach(f => { fieldIdsByType[f.event_type_id] = f.id })
    return events
      .filter(e => e.event_type_id && fieldIdsByType[e.event_type_id])
      .map(e => {
        const fieldId = fieldIdsByType[e.event_type_id!]
        const val = fieldValues.find(v => v.event_id === e.id && v.field_id === fieldId)?.value_text || ''
        const atts = attachments.filter(a => a.event_id === e.id)
        return { event: e, text: val, attachments: atts }
      })
      .filter(a => !ataSearch.trim() || a.text.toLowerCase().includes(ataSearch.toLowerCase()))
  }, [ataFieldsAllTypes, events, fieldValues, attachments, ataSearch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...panelStyle, display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }}>Período</div>
          <select value={periodOpt} onChange={e => setPeriodOpt(e.target.value as PeriodOpt)}>
            <option value="month">Este mês</option>
            <option value="quarter">Este trimestre</option>
            <option value="year">Este ano</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        {periodOpt === 'custom' && (
          <>
            <div><div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }}>De</div><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></div>
            <div><div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '5px' }}>Até</div><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px' }}/>)}</div>
      ) : (
        <>
          <div style={{ ...panelStyle, height: '320px', display: 'flex', flexDirection: 'column' }}>
            <span style={panelTitle}>Eventos por tipo ({events.length} no período)</span>
            {byType.length === 0 ? <Notice>Nenhum evento no período.</Notice> : <div style={{ flex: 1 }}><RelatoriosBarChart data={byType} /></div>}
          </div>

          <div style={{ ...panelStyle, height: '320px', display: 'flex', flexDirection: 'column' }}>
            <span style={panelTitle}>Cultos — Adultos x Crianças</span>
            {!cultoType ? <Notice>Nenhum tipo de evento chamado "Culto" encontrado.</Notice>
              : (!adultosField || !criancasField) ? <Notice>Campo{!adultosField && !criancasField ? 's' : ''} "{!adultosField ? 'adultos' : 'criancas'}"{!adultosField && !criancasField ? ' e "criancas"' : ''} não configurado{!adultosField && !criancasField ? 's' : ''} para o tipo Culto. Cadastre em Tipos de Evento.</Notice>
              : cultoChartData.length === 0 ? <Notice>Nenhum culto no período.</Notice>
              : (
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cultoChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={32}/>
                      <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-1)' }}/>
                      <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }}/>
                      <Line type="monotone" dataKey="adultos" name="Adultos" stroke="var(--brand)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}/>
                      <Line type="monotone" dataKey="criancas" name="Crianças" stroke="var(--ok)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
          </div>

          <div style={panelStyle}>
            <span style={panelTitle}>Batismos</span>
            {!batismoType ? <Notice>Nenhum tipo de evento chamado "Batismo" encontrado.</Notice> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!qtdBatizadosField
                  ? <Notice>Campo "quantidade_batizados" não configurado para o tipo Batismo. Cadastre em Tipos de Evento.</Notice>
                  : <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--brand-light)' }}>{batismoTotal} batizado{batismoTotal !== 1 ? 's' : ''} no período</div>}
                {!membrosBatizadosField
                  ? <Notice>Nenhum campo de relação com membros configurado para o tipo Batismo.</Notice>
                  : batizadosList.length === 0 ? <Notice>Nenhum membro vinculado a batismos no período.</Notice> : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {batizadosList.map((b, i) => <span key={i} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '99px', background: 'var(--brand-dim)', color: 'var(--brand-light)' }}>{b.name}</span>)}
                    </div>
                  )}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={panelTitle}>Atas de reunião</span>
              <input value={ataSearch} onChange={e => setAtaSearch(e.target.value)} placeholder="Buscar no texto da ata..." style={{ maxWidth: '240px' }} />
            </div>
            {ataFieldsAllTypes.length === 0 ? <Notice>Nenhum tipo de evento tem um campo "ata" (texto longo) configurado.</Notice>
              : atas.length === 0 ? <Notice>Nenhuma ata encontrada{ataSearch ? ' para essa busca' : ' no período'}.</Notice>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {atas.map(a => (
                    <div key={a.event.id} style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>{a.event.name} {a.event.event_date && `· ${new Date(a.event.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}</div>
                      {a.text && <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{a.text}</div>}
                      {a.attachments.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {a.attachments.map(att => <a key={att.id} href={att.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--brand-light)', textDecoration: 'none' }}>📎 {att.file_name}</a>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  )
}
