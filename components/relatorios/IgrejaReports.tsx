'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import dynamic from 'next/dynamic'
import { BlockExport } from './BlockExport'
import { exportBlocksToExcel, exportBlocksToPDF, todayStamp, type ReportBlock } from '@/lib/report-export'
const RelatoriosBarChart = dynamic(() => import('@/components/charts/RelatoriosBarChart'), { ssr: false })
const IgrejaTrendLineChart = dynamic(() => import('@/components/charts/IgrejaTrendLineChart'), { ssr: false })

type Tab = 'membros' | 'ministerios' | 'grupos' | 'eventos'
const TABS: { id: Tab; label: string }[] = [
  { id: 'membros',     label: 'Membros' },
  { id: 'ministerios', label: 'Ministérios' },
  { id: 'grupos',      label: '2ou+' },
  { id: 'eventos',     label: 'Eventos' },
]

type Member = { id: string; full_name: string; is_active: boolean; neighborhood: string | null; birth_date: string | null; phone: string | null; wants_to_serve_other_ministry: string | null; submitted_at: string | null }
type Ministry = { id: string; name: string; is_active: boolean }
type MinistryMember = { ministry_id: string; member_id: string; is_active: boolean; role: string }
type SmallGroup = { id: string; name: string; is_active: boolean }
type GroupMember = { small_group_id: string; member_id: string; role: string }
type EventType = { id: string; name: string }
type EventTypeField = { id: string; event_type_id: string; field_key: string; label: string; field_type: string }
type EventRow = { id: string; name: string; event_date: string | null; event_type_id: string | null }
type Attachment = { id: string; event_id: string; file_url: string; file_name: string }

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const panelStyle: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }
const panelTitle: React.CSSProperties = { fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '14px' }
const miniTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const nameFoneTable: React.CSSProperties = { ...miniTable, tableLayout: 'fixed' }
const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-3)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: '13px', color: 'var(--text-1)', borderBottom: '1px solid var(--border)' }

function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '13px' }}>{children}</div>
}

function NameListTable({ header, names }: { header: string; names: string[] }) {
  return (
    <table style={miniTable}>
      <thead><tr><th style={thStyle}>{header}</th></tr></thead>
      <tbody>
        {[...names].sort((a, b) => a.localeCompare(b)).map((name, i) => <tr key={i}><td style={tdStyle}>{name}</td></tr>)}
      </tbody>
    </table>
  )
}

function namesToBlock(title: string, header: string, names: string[]): ReportBlock {
  return {
    title,
    columns: [{ key: 'v', label: header }],
    rows: [...names].sort((a, b) => a.localeCompare(b)).map(v => ({ v })),
  }
}

function PanelHead({ title, count, getBlock, churchName, period, extra }: {
  title: string; count?: number
  getBlock: () => ReportBlock; churchName: string; period?: string
  extra?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ ...panelTitle, marginBottom: 0 }}>{title}{count !== undefined ? ` (${count})` : ''}</span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {extra}
        <BlockExport getBlock={getBlock} churchName={churchName} period={period}/>
      </div>
    </div>
  )
}

function ExportAllButton({ label, getBlocks, filename, churchName, period }: {
  label: string; getBlocks: () => ReportBlock[]; filename: string; churchName: string; period?: string
}) {
  async function onExcel() { await exportBlocksToExcel(getBlocks(), `${filename}-${todayStamp()}.xlsx`) }
  async function onPDF() { await exportBlocksToPDF(getBlocks(), { filename: `${filename}-${todayStamp()}.pdf`, reportTitle: label, churchName, period }) }
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={onExcel} style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>Exportar Excel</button>
      <button onClick={onPDF} style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>Exportar PDF</button>
    </div>
  )
}

export default function IgrejaReports() {
  const { profile } = useProfile()
  const churchName = (profile as any)?.church?.name || 'Igreja'
  const [tab, setTab] = useState<Tab>('membros')

  const [members, setMembers] = useState<Member[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [ministryMembers, setMinistryMembers] = useState<MinistryMember[]>([])
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)

  const [birthMonth, setBirthMonth] = useState(new Date().getMonth() + 1)
  const [growthPeriod, setGrowthPeriod] = useState<'6m' | '12m' | 'year'>('6m')

  useEffect(() => { if (profile?.church_id) loadBase() }, [profile?.church_id])

  async function loadBase() {
    setLoading(true)
    const sb = createClient()
    const [
      { data: mem }, { data: mins }, { data: minMem },
      { data: groups }, { data: grpMem }, { data: types },
    ] = await Promise.all([
      sb.from('members').select('id, full_name, is_active, neighborhood, birth_date, phone, wants_to_serve_other_ministry, submitted_at').eq('church_id', profile!.church_id),
      sb.from('ministries').select('id, name, is_active').eq('church_id', profile!.church_id),
      sb.from('ministry_members').select('ministry_id, member_id, is_active, role'),
      sb.from('small_groups').select('id, name, is_active').eq('church_id', profile!.church_id),
      sb.from('small_group_members').select('small_group_id, member_id, role'),
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

  const memberNameById = useMemo(() => {
    const map: Record<string, string> = {}
    members.forEach(m => { map[m.id] = m.full_name })
    return map
  }, [members])

  const memberById = useMemo(() => {
    const map: Record<string, Member> = {}
    members.forEach(m => { map[m.id] = m })
    return map
  }, [members])

  const ministryCounts = useMemo(() => {
    return ministries
      .filter(m => m.is_active)
      .map(m => {
        const memberIds = [...new Set(ministryMembers.filter(mm => mm.ministry_id === m.id).map(mm => mm.member_id))]
        const rows = memberIds
          .map(id => ({ id, name: memberNameById[id] || id, phone: memberById[id]?.phone || null }))
          .sort((a, b) => a.name.localeCompare(b.name))
        return { id: m.id, name: m.name, value: memberIds.length, rows }
      })
      .filter(m => m.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [ministries, ministryMembers, memberNameById, memberById])

  const ministriesEmpty = useMemo(() => {
    const withMembers = new Set(ministryMembers.map(m => m.ministry_id))
    return ministries.filter(m => m.is_active && !withMembers.has(m.id))
  }, [ministries, ministryMembers])

  const activeGroups = useMemo(() => smallGroups.filter(g => g.is_active), [smallGroups])
  const groupCounts = useMemo(() => {
    return activeGroups.map(g => {
      const memberIds = [...new Set(groupMembers.filter(gm => gm.small_group_id === g.id).map(gm => gm.member_id))]
      const rows = memberIds
        .map(id => ({ id, name: memberNameById[id] || id, phone: memberById[id]?.phone || null }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return { id: g.id, name: g.name, count: memberIds.length, rows }
    }).sort((a, b) => b.count - a.count)
  }, [activeGroups, groupMembers, memberNameById, memberById])

  // F: crescimento de membros por período
  const growthData = useMemo(() => {
    const months = growthPeriod === '6m' ? 6 : 12
    const now = new Date()
    const buckets: { key: string; label: string; value: number }[] = []
    if (growthPeriod === 'year') {
      const year = now.getFullYear()
      for (let m = 0; m < 12; m++) buckets.push({ key: `${year}-${String(m + 1).padStart(2, '0')}`, label: MONTHS[m].slice(0, 3), value: 0 })
    } else {
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`, value: 0 })
      }
    }
    const byKey: Record<string, number> = {}
    buckets.forEach(b => { byKey[b.key] = 0 })
    members.forEach(m => {
      if (!m.submitted_at) return
      const key = m.submitted_at.slice(0, 7)
      if (key in byKey) byKey[key]++
    })
    return buckets.map(b => ({ name: b.label, value: byKey[b.key] }))
  }, [members, growthPeriod])

  // F: dupla ausência (sem ministério E sem 2ou+)
  const duplaAusencia = useMemo(
    () => activeMembers.filter(m => !activeMinistryMemberIds.has(m.id) && !activeGroupMemberIds.has(m.id)),
    [activeMembers, activeMinistryMemberIds, activeGroupMemberIds]
  )

  // F: ministérios e grupos sem líder
  const ministriesSemLider = useMemo(() => {
    const comLider = new Set(ministryMembers.filter(mm => mm.role === 'lider').map(mm => mm.ministry_id))
    return ministries.filter(m => m.is_active && !comLider.has(m.id))
  }, [ministries, ministryMembers])

  const groupsSemLider = useMemo(() => {
    const comLider = new Set(groupMembers.filter(gm => gm.role === 'leader').map(gm => gm.small_group_id))
    return activeGroups.filter(g => !comLider.has(g.id))
  }, [activeGroups, groupMembers])

  // F: faixa etária
  const faixaEtaria = useMemo(() => {
    const ranges: { label: string; min: number; max: number }[] = [
      { label: '0-12', min: 0, max: 12 }, { label: '13-17', min: 13, max: 17 },
      { label: '18-25', min: 18, max: 25 }, { label: '26-40', min: 26, max: 40 },
      { label: '41-60', min: 41, max: 60 }, { label: '60+', min: 61, max: 999 },
    ]
    const counts = ranges.map(r => ({ name: r.label, value: 0, min: r.min, max: r.max }))
    let semData = 0
    const today = new Date()
    activeMembers.forEach(m => {
      if (!m.birth_date) { semData++; return }
      const bd = new Date(m.birth_date + 'T12:00:00')
      let age = today.getFullYear() - bd.getFullYear()
      const hasHadBirthday = (today.getMonth() > bd.getMonth()) || (today.getMonth() === bd.getMonth() && today.getDate() >= bd.getDate())
      if (!hasHadBirthday) age--
      const bucket = counts.find(c => age >= c.min && age <= c.max)
      if (bucket) bucket.value++
    })
    return { data: counts.map(({ name, value }) => ({ name, value })), semData }
  }, [activeMembers])

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
            <PanelHead
              title={`Aniversariantes de ${MONTHS[birthMonth - 1]}`}
              churchName={churchName}
              extra={
                <select value={birthMonth} onChange={e => setBirthMonth(parseInt(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              }
              getBlock={() => ({
                title: `Aniversariantes de ${MONTHS[birthMonth - 1]}`,
                columns: [{ key: 'day', label: 'Dia' }, { key: 'full_name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }],
                rows: birthdays.map(m => ({ day: m.day, full_name: m.full_name, phone: m.phone || '—' })),
              })}
            />
            {birthdays.length === 0 ? <Notice>Nenhum aniversariante em {MONTHS[birthMonth - 1]}.</Notice> : (
              <table style={miniTable}>
                <thead><tr><th style={thStyle}>Dia</th><th style={thStyle}>Nome</th><th style={thStyle}>Telefone</th></tr></thead>
                <tbody>{birthdays.map(m => <tr key={m.id}><td style={tdStyle}>{m.day}</td><td style={tdStyle}>{m.full_name}</td><td style={tdStyle}>{m.phone || '—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead
              title="Distribuição por bairro"
              count={bairroDist.length}
              churchName={churchName}
              getBlock={() => ({
                title: 'Distribuição por bairro',
                columns: [{ key: 'name', label: 'Bairro' }, { key: 'value', label: 'Membros' }, { key: 'pct', label: '%' }],
                rows: bairroDist.map(b => ({ name: b.name, value: b.value, pct: (activeMembers.length ? ((b.value / activeMembers.length) * 100).toFixed(0) : 0) + '%' })),
              })}
            />
            {bairroDist.length === 0 ? <Notice>Sem dados.</Notice> : (
              <table style={miniTable}>
                <thead><tr><th style={thStyle}>Bairro</th><th style={thStyle}>Membros</th><th style={thStyle}>%</th></tr></thead>
                <tbody>
                  {bairroDist.map(b => (
                    <tr key={b.name}>
                      <td style={tdStyle}>{b.name}</td>
                      <td style={tdStyle}>{b.value}</td>
                      <td style={tdStyle}>{activeMembers.length ? ((b.value / activeMembers.length) * 100).toFixed(0) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead title="Membros sem ministério" count={membersWithoutMinistry.length} churchName={churchName}
              getBlock={() => namesToBlock('Membros sem ministério', 'Nome', membersWithoutMinistry.map(m => m.full_name))} />
            {membersWithoutMinistry.length === 0 ? <Notice>Todos os membros ativos estão em algum ministério.</Notice> : (
              <NameListTable header="Nome" names={membersWithoutMinistry.map(m => m.full_name)} />
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead title="Membros sem 2ou+" count={membersWithoutGroup.length} churchName={churchName}
              getBlock={() => namesToBlock('Membros sem 2ou+', 'Nome', membersWithoutGroup.map(m => m.full_name))} />
            {membersWithoutGroup.length === 0 ? <Notice>Todos os membros ativos estão em algum grupo.</Notice> : (
              <NameListTable header="Nome" names={membersWithoutGroup.map(m => m.full_name)} />
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead title="Dupla ausência — sem ministério e sem 2ou+" count={duplaAusencia.length} churchName={churchName}
              getBlock={() => namesToBlock('Dupla ausência', 'Nome', duplaAusencia.map(m => m.full_name))} />
            {duplaAusencia.length === 0 ? <Notice>Nenhum membro ativo está ausente das duas frentes ao mesmo tempo.</Notice> : (
              <NameListTable header="Nome" names={duplaAusencia.map(m => m.full_name)} />
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead
              title="Crescimento — novos membros por período"
              churchName={churchName}
              period={growthPeriod === '6m' ? 'Últimos 6 meses' : growthPeriod === '12m' ? 'Últimos 12 meses' : 'Este ano'}
              extra={
                <select value={growthPeriod} onChange={e => setGrowthPeriod(e.target.value as any)}>
                  <option value="6m">Últimos 6 meses</option>
                  <option value="12m">Últimos 12 meses</option>
                  <option value="year">Este ano</option>
                </select>
              }
              getBlock={() => ({
                title: 'Crescimento — novos membros por período',
                columns: [{ key: 'name', label: 'Mês' }, { key: 'value', label: 'Novos membros' }],
                rows: growthData,
              })}
            />
            {growthData.every(g => g.value === 0) ? <Notice>Sem dados de cadastro (submitted_at) no período.</Notice> : (
              <div style={{ height: 240 }}>
                <RelatoriosBarChart data={growthData} layout="horizontal" barSize={24}/>
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead
              title={`Distribuição por faixa etária${faixaEtaria.semData > 0 ? ` (${faixaEtaria.semData} sem data de nascimento informada)` : ''}`}
              churchName={churchName}
              getBlock={() => ({
                title: 'Distribuição por faixa etária',
                columns: [{ key: 'name', label: 'Faixa' }, { key: 'value', label: 'Membros' }],
                rows: faixaEtaria.data,
                summary: [{ name: 'Sem data de nascimento', value: faixaEtaria.semData }],
              })}
            />
            <div style={{ height: 220 }}>
              <RelatoriosBarChart data={faixaEtaria.data} layout="horizontal" barSize={28}/>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ExportAllButton
              label="Relatório Igreja — Membros"
              churchName={churchName}
              filename="igreja-membros"
              getBlocks={() => [
                { title: 'Aniversariantes', columns: [{ key: 'day', label: 'Dia' }, { key: 'full_name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }], rows: birthdays.map(m => ({ day: m.day, full_name: m.full_name, phone: m.phone || '—' })) },
                { title: 'Distribuição por bairro', columns: [{ key: 'name', label: 'Bairro' }, { key: 'value', label: 'Membros' }], rows: bairroDist },
                namesToBlock('Membros sem ministério', 'Nome', membersWithoutMinistry.map(m => m.full_name)),
                namesToBlock('Membros sem 2ou+', 'Nome', membersWithoutGroup.map(m => m.full_name)),
                namesToBlock('Dupla ausência', 'Nome', duplaAusencia.map(m => m.full_name)),
                { title: 'Crescimento', columns: [{ key: 'name', label: 'Mês' }, { key: 'value', label: 'Novos membros' }], rows: growthData },
                { title: 'Faixa etária', columns: [{ key: 'name', label: 'Faixa' }, { key: 'value', label: 'Membros' }], rows: faixaEtaria.data },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'ministerios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ ...panelStyle, flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Ministérios ativos</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--brand-light)' }}>{ministries.filter(m => m.is_active).length}</div>
            </div>
            <div style={{ ...panelStyle, flex: 1, minWidth: '160px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Com membros vinculados</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--ok)' }}>{ministryCounts.length}</div>
            </div>
          </div>
          <div style={panelStyle}>
            <PanelHead
              title="Membros por ministério"
              churchName={churchName}
              getBlock={() => ({
                title: 'Membros por ministério',
                columns: [{ key: 'ministry', label: 'Ministério' }, { key: 'name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }],
                rows: ministryCounts.flatMap(m => m.rows.map(r => ({ ministry: m.name, name: r.name, phone: r.phone || '—' }))),
              })}
            />
            {ministryCounts.length === 0 ? <Notice>Nenhum ministério com membros vinculados.</Notice> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {ministryCounts.map(m => (
                  <div key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>{m.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{m.value} membro{m.value !== 1 ? 's' : ''}</span>
                    </div>
                    <table style={nameFoneTable}>
                      <colgroup><col style={{ width: '70%' }} /><col style={{ width: '30%' }} /></colgroup>
                      <thead><tr><th style={thStyle}>Nome</th><th style={thStyle}>Telefone</th></tr></thead>
                      <tbody>
                        {m.rows.map(r => <tr key={r.id}><td style={tdStyle}>{r.name}</td><td style={tdStyle}>{r.phone || '—'}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={panelStyle}>
            <PanelHead title="Ministérios ativos sem líder" count={ministriesSemLider.length} churchName={churchName}
              getBlock={() => namesToBlock('Ministérios ativos sem líder', 'Ministério', ministriesSemLider.map(m => m.name))} />
            {ministriesSemLider.length === 0 ? <Notice>Todos os ministérios ativos têm ao menos um líder.</Notice> : (
              <NameListTable header="Ministério" names={ministriesSemLider.map(m => m.name)} />
            )}
          </div>
          <div style={panelStyle}>
            <PanelHead title="Ministérios sem nenhum membro vinculado" count={ministriesEmpty.length} churchName={churchName}
              getBlock={() => namesToBlock('Ministérios sem membro vinculado', 'Ministério', ministriesEmpty.map(m => m.name))} />
            {ministriesEmpty.length === 0 ? <Notice>Todos os ministérios têm ao menos um membro.</Notice> : (
              <NameListTable header="Ministério" names={ministriesEmpty.map(m => m.name)} />
            )}
          </div>
          <div style={panelStyle}>
            <PanelHead
              title="Membros que não servem em nenhum ministério"
              count={membersWithoutMinistry.length}
              churchName={churchName}
              getBlock={() => ({
                title: 'Membros sem ministério — desejo de servir',
                columns: [{ key: 'full_name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }, { key: 'wants', label: 'Ministério que deseja participar' }],
                rows: membersWithoutMinistry.map(m => ({ full_name: m.full_name, phone: m.phone || '—', wants: m.wants_to_serve_other_ministry || '—' })),
              })}
            />
            {membersWithoutMinistry.length === 0 ? <Notice>Todos os membros ativos estão em algum ministério.</Notice> : (
              <table style={miniTable}>
                <thead><tr><th style={thStyle}>Nome</th><th style={thStyle}>Telefone</th><th style={thStyle}>Ministério que deseja participar</th></tr></thead>
                <tbody>
                  {membersWithoutMinistry.map(m => (
                    <tr key={m.id}>
                      <td style={tdStyle}>{m.full_name}</td>
                      <td style={tdStyle}>{m.phone || '—'}</td>
                      <td style={tdStyle}>{m.wants_to_serve_other_ministry || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ExportAllButton
              label="Relatório Igreja — Ministérios"
              churchName={churchName}
              filename="igreja-ministerios"
              getBlocks={() => [
                { title: 'Membros por ministério', columns: [{ key: 'ministry', label: 'Ministério' }, { key: 'name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }], rows: ministryCounts.flatMap(m => m.rows.map(r => ({ ministry: m.name, name: r.name, phone: r.phone || '—' }))) },
                namesToBlock('Ministérios ativos sem líder', 'Ministério', ministriesSemLider.map(m => m.name)),
                namesToBlock('Ministérios sem membro vinculado', 'Ministério', ministriesEmpty.map(m => m.name)),
                { title: 'Membros sem ministério', columns: [{ key: 'full_name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }, { key: 'wants', label: 'Deseja participar' }], rows: membersWithoutMinistry.map(m => ({ full_name: m.full_name, phone: m.phone || '—', wants: m.wants_to_serve_other_ministry || '—' })) },
              ]}
            />
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
            <PanelHead
              title="Membros por grupo"
              churchName={churchName}
              getBlock={() => ({
                title: 'Membros por grupo',
                columns: [{ key: 'group', label: 'Grupo' }, { key: 'name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }],
                rows: groupCounts.flatMap(g => g.rows.map(r => ({ group: g.name, name: r.name, phone: r.phone || '—' }))),
              })}
            />
            {groupCounts.length === 0 ? <Notice>Nenhum grupo cadastrado.</Notice> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {groupCounts.map(g => (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>{g.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{g.count} membro{g.count !== 1 ? 's' : ''}</span>
                    </div>
                    {g.rows.length === 0 ? <Notice>Nenhum membro vinculado.</Notice> : (
                      <table style={nameFoneTable}>
                        <colgroup><col style={{ width: '70%' }} /><col style={{ width: '30%' }} /></colgroup>
                        <thead><tr><th style={thStyle}>Nome</th><th style={thStyle}>Telefone</th></tr></thead>
                        <tbody>
                          {g.rows.map(r => <tr key={r.id}><td style={tdStyle}>{r.name}</td><td style={tdStyle}>{r.phone || '—'}</td></tr>)}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={panelStyle}>
            <PanelHead title="Grupos ativos sem líder" count={groupsSemLider.length} churchName={churchName}
              getBlock={() => namesToBlock('Grupos ativos sem líder', 'Grupo', groupsSemLider.map(g => g.name))} />
            {groupsSemLider.length === 0 ? <Notice>Todos os grupos ativos têm ao menos um líder.</Notice> : (
              <NameListTable header="Grupo" names={groupsSemLider.map(g => g.name)} />
            )}
          </div>
          <div style={panelStyle}>
            <PanelHead title="Membros sem 2ou+" count={membersWithoutGroup.length} churchName={churchName}
              getBlock={() => namesToBlock('Membros sem 2ou+', 'Nome', membersWithoutGroup.map(m => m.full_name))} />
            {membersWithoutGroup.length === 0 ? <Notice>Todos os membros ativos estão em algum grupo.</Notice> : (
              <NameListTable header="Nome" names={membersWithoutGroup.map(m => m.full_name)} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ExportAllButton
              label="Relatório Igreja — 2ou+"
              churchName={churchName}
              filename="igreja-2ou-mais"
              getBlocks={() => [
                { title: 'Membros por grupo', columns: [{ key: 'group', label: 'Grupo' }, { key: 'name', label: 'Nome' }, { key: 'phone', label: 'Telefone' }], rows: groupCounts.flatMap(g => g.rows.map(r => ({ group: g.name, name: r.name, phone: r.phone || '—' }))) },
                namesToBlock('Grupos ativos sem líder', 'Grupo', groupsSemLider.map(g => g.name)),
                namesToBlock('Membros sem 2ou+', 'Nome', membersWithoutGroup.map(m => m.full_name)),
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'eventos' && <EventosReport eventTypes={eventTypes} churchName={churchName} />}
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

const PERIOD_OPT_LABEL: Record<PeriodOpt, string> = { month: 'Este mês', quarter: 'Este trimestre', year: 'Este ano', custom: 'Personalizado' }

function EventosReport({ eventTypes, churchName }: { eventTypes: EventType[]; churchName: string }) {
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
  const cultoFields = useMemo(() => allFields.filter(f => f.event_type_id === cultoType?.id && f.field_type === 'number'), [allFields, cultoType])
  const adultosField = cultoFields.find(f => f.field_key.includes('adult'))
  const criancasField = cultoFields.find(f => f.field_key.includes('crian'))

  const cultoChartData = useMemo(() => {
    if (!cultoType || !adultosField || !criancasField) return []
    const cultoEvents = events.filter(e => e.event_type_id === cultoType.id).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    return cultoEvents.map(e => {
      const adultos = fieldValues.find(v => v.event_id === e.id && v.field_id === adultosField.id)?.value_number ?? 0
      const criancas = fieldValues.find(v => v.event_id === e.id && v.field_id === criancasField.id)?.value_number ?? 0
      return { name: e.name, label: e.event_date ? new Date(e.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—', adultos, criancas }
    })
  }, [cultoType, adultosField, criancasField, events, fieldValues])

  const batismoType = useMemo(() => eventTypes.find(t => t.name.toLowerCase().includes('batismo')), [eventTypes])
  const batismoFields = useMemo(() => allFields.filter(f => f.event_type_id === batismoType?.id), [allFields, batismoType])
  const numberFields = batismoFields.filter(f => f.field_type === 'number')
  const qtdBatizadosField = numberFields.find(f => f.field_key.includes('batism') || f.field_key.includes('quantidade')) || numberFields[0]
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

  const ataFieldsAllTypes = useMemo(() => {
    const textareas = allFields.filter(f => f.field_type === 'textarea')
    const byType: Record<string, EventTypeField> = {}
    for (const f of textareas) if (!byType[f.event_type_id]) byType[f.event_type_id] = f
    return Object.values(byType)
  }, [allFields])

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

  const periodLabel = periodOpt === 'custom' ? `${from} a ${to}` : PERIOD_OPT_LABEL[periodOpt]

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
          <div style={panelStyle}>
            <PanelHead
              title="Eventos por tipo"
              count={events.length}
              churchName={churchName}
              period={periodLabel}
              getBlock={() => ({
                title: 'Eventos por tipo',
                columns: [{ key: 'name', label: 'Tipo' }, { key: 'value', label: 'Qtde' }, { key: 'pct', label: '%' }],
                rows: byType.map(t => ({ name: t.name, value: t.value, pct: (events.length ? ((t.value / events.length) * 100).toFixed(0) : 0) + '%' })),
              })}
            />
            {byType.length === 0 ? <Notice>Nenhum evento no período.</Notice> : (
              <table style={miniTable}>
                <thead><tr><th style={thStyle}>Tipo</th><th style={thStyle}>Qtde</th><th style={thStyle}>%</th></tr></thead>
                <tbody>
                  {byType.map(t => (
                    <tr key={t.name}>
                      <td style={tdStyle}>{t.name}</td>
                      <td style={tdStyle}>{t.value}</td>
                      <td style={tdStyle}>{events.length ? ((t.value / events.length) * 100).toFixed(0) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead
              title="Cultos — Adultos x Crianças"
              churchName={churchName}
              period={periodLabel}
              getBlock={() => ({
                title: 'Cultos — Adultos x Crianças',
                columns: [{ key: 'name', label: 'Evento' }, { key: 'label', label: 'Data' }, { key: 'adultos', label: 'Adultos' }, { key: 'criancas', label: 'Crianças' }, { key: 'total', label: 'Total' }],
                rows: cultoChartData.map(c => ({ name: c.name, label: c.label, adultos: c.adultos, criancas: c.criancas, total: c.adultos + c.criancas })),
              })}
            />
            {!cultoType ? <Notice>Nenhum tipo de evento chamado "Culto" encontrado.</Notice>
              : (!adultosField || !criancasField) ? <Notice>Faltam campos numéricos para o tipo Culto: {!adultosField && 'um com "adulto" no nome'}{!adultosField && !criancasField && ' e '}{!criancasField && 'um com "criança" no nome'}. Cadastre em Tipos de Evento.</Notice>
              : cultoChartData.length === 0 ? <Notice>Nenhum culto no período.</Notice>
              : (
                <>
                  <div style={{ height: 240, marginBottom: '16px' }}>
                    <IgrejaTrendLineChart
                      data={cultoChartData.map(c => ({ label: c.label, adultos: c.adultos, criancas: c.criancas, total: c.adultos + c.criancas }))}
                      lines={[{ key: 'adultos', label: 'Adultos' }, { key: 'criancas', label: 'Crianças' }, { key: 'total', label: 'Total' }]}
                    />
                  </div>
                  <table style={miniTable}>
                    <thead><tr><th style={thStyle}>Evento</th><th style={thStyle}>Data</th><th style={thStyle}>Adultos</th><th style={thStyle}>Crianças</th><th style={thStyle}>Total</th></tr></thead>
                    <tbody>
                      {cultoChartData.map((c, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>{c.name}</td>
                          <td style={tdStyle}>{c.label}</td>
                          <td style={tdStyle}>{c.adultos}</td>
                          <td style={tdStyle}>{c.criancas}</td>
                          <td style={tdStyle}>{c.adultos + c.criancas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '14px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      Média adultos: <strong style={{ color: 'var(--text-1)' }}>{(cultoChartData.reduce((s, c) => s + c.adultos, 0) / cultoChartData.length).toFixed(1)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      Média crianças: <strong style={{ color: 'var(--text-1)' }}>{(cultoChartData.reduce((s, c) => s + c.criancas, 0) / cultoChartData.length).toFixed(1)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      Total no período: <strong style={{ color: 'var(--text-1)' }}>{cultoChartData.reduce((s, c) => s + c.adultos + c.criancas, 0)}</strong>
                    </div>
                  </div>
                </>
              )}
          </div>

          <div style={panelStyle}>
            <PanelHead
              title="Batismos"
              churchName={churchName}
              period={periodLabel}
              getBlock={() => ({
                title: 'Batismos',
                columns: [{ key: 'name', label: 'Nome' }],
                rows: batizadosList.map(b => ({ name: b.name })),
                summary: batismoTotal != null ? [{ name: `Total de batizados: ${batismoTotal}` }] : undefined,
              })}
            />
            {!batismoType ? <Notice>Nenhum tipo de evento chamado "Batismo" encontrado.</Notice> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!qtdBatizadosField
                  ? <Notice>Nenhum campo numérico configurado para o tipo Batismo. Cadastre em Tipos de Evento.</Notice>
                  : <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--brand-light)' }}>{batismoTotal} batizado{batismoTotal !== 1 ? 's' : ''} no período</div>}
                {!membrosBatizadosField
                  ? <Notice>Nenhum campo de relação com membros configurado para o tipo Batismo.</Notice>
                  : batizadosList.length === 0 ? <Notice>Nenhum membro vinculado a batismos no período.</Notice> : (
                    <NameListTable header="Nome" names={batizadosList.map(b => b.name)} />
                  )}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <PanelHead
              title="Atas de reunião"
              churchName={churchName}
              period={periodLabel}
              extra={<input value={ataSearch} onChange={e => setAtaSearch(e.target.value)} placeholder="Buscar no texto da ata..." style={{ maxWidth: '240px' }} />}
              getBlock={() => ({
                title: 'Atas de reunião',
                columns: [{ key: 'name', label: 'Evento' }, { key: 'date', label: 'Data' }, { key: 'text', label: 'Ata' }],
                rows: atas.map(a => ({ name: a.event.name, date: a.event.event_date ? new Date(a.event.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—', text: a.text || '—' })),
              })}
            />
            {ataFieldsAllTypes.length === 0 ? <Notice>Nenhum tipo de evento tem um campo de texto longo (ata) configurado.</Notice>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ExportAllButton
              label="Relatório Igreja — Eventos"
              churchName={churchName}
              period={periodLabel}
              filename="igreja-eventos"
              getBlocks={() => [
                { title: 'Eventos por tipo', columns: [{ key: 'name', label: 'Tipo' }, { key: 'value', label: 'Qtde' }], rows: byType },
                { title: 'Cultos', columns: [{ key: 'name', label: 'Evento' }, { key: 'label', label: 'Data' }, { key: 'adultos', label: 'Adultos' }, { key: 'criancas', label: 'Crianças' }, { key: 'total', label: 'Total' }], rows: cultoChartData.map(c => ({ name: c.name, label: c.label, adultos: c.adultos, criancas: c.criancas, total: c.adultos + c.criancas })) },
                { title: 'Batismos', columns: [{ key: 'name', label: 'Nome' }], rows: batizadosList.map(b => ({ name: b.name })) },
                { title: 'Atas de reunião', columns: [{ key: 'name', label: 'Evento' }, { key: 'date', label: 'Data' }, { key: 'text', label: 'Ata' }], rows: atas.map(a => ({ name: a.event.name, date: a.event.event_date ? new Date(a.event.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—', text: a.text || '—' })) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
