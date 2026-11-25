'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { exportBlocksToExcel, exportBlocksToPDF, todayStamp, type ReportBlock } from '@/lib/report-export'
import { BlockExport } from './BlockExport'

type AuditRow = { id: string; user_id: string | null; entity: string; action: string; created_at: string; user: { name: string; email: string } | null }

const panelStyle: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }
const panelTitle: React.CSSProperties = { fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '14px' }
const miniTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-3)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: '13px', color: 'var(--text-1)', borderBottom: '1px solid var(--border)' }

function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '13px' }}>{children}</div>
}

function PanelHead({ title, churchName, period, getBlock, extra }: { title: string; churchName: string; period?: string; getBlock: () => ReportBlock; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ ...panelTitle, marginBottom: 0 }}>{title}</span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {extra}
        <BlockExport getBlock={getBlock} churchName={churchName} period={period} />
      </div>
    </div>
  )
}

const PERIOD_OPTS = [{ v: '30', l: '30 dias' }, { v: '90', l: '90 dias' }, { v: '365', l: '12 meses' }]

export default function SistemaReports() {
  const { profile } = useProfile()
  const churchName = (profile as any)?.church?.name || 'Igreja'
  const [period, setPeriod] = useState('90')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id, period])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const since = new Date(); since.setDate(since.getDate() - parseInt(period))
    const { data } = await sb.from('audit_log')
      .select('id,user_id,entity,action,created_at,user:profiles(name,email)')
      .eq('church_id', profile!.church_id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    setRows((data as any) || [])
    setLoading(false)
  }

  const periodLabel = PERIOD_OPTS.find(o => o.v === period)?.l || period

  const byUser = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {}
    rows.forEach(r => {
      const name = r.user?.name || r.user?.email || 'Usuário desconhecido'
      if (!map[name]) map[name] = { name, count: 0 }
      map[name].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [rows])

  const byUserMonth = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    const months = new Set<string>()
    rows.forEach(r => {
      const name = r.user?.name || r.user?.email || 'Usuário desconhecido'
      const month = r.created_at.slice(0, 7)
      months.add(month)
      if (!map[name]) map[name] = {}
      map[name][month] = (map[name][month] || 0) + 1
    })
    const monthList = [...months].sort()
    return { monthList, rows: Object.entries(map).map(([name, byMonth]) => ({ name, byMonth, total: Object.values(byMonth).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total) }
  }, [rows])

  const byUserEntity = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    const entities = new Set<string>()
    rows.forEach(r => {
      const name = r.user?.name || r.user?.email || 'Usuário desconhecido'
      entities.add(r.entity)
      if (!map[name]) map[name] = {}
      map[name][r.entity] = (map[name][r.entity] || 0) + 1
    })
    return { entityList: [...entities].sort(), rows: Object.entries(map).map(([name, byEntity]) => ({ name, byEntity })) }
  }, [rows])

  if (loading) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px' }} />)}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...panelStyle, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Período</span>
        {PERIOD_OPTS.map(o => (
          <button key={o.v} onClick={() => setPeriod(o.v)} style={{ padding: '5px 12px', borderRadius: '99px', border: '1px solid', fontSize: '12px', cursor: 'pointer', background: period === o.v ? 'var(--brand)' : 'transparent', color: period === o.v ? '#fff' : 'var(--text-3)', borderColor: period === o.v ? 'var(--brand)' : 'var(--border)' }}>{o.l}</button>
        ))}
      </div>

      <div style={panelStyle}>
        <PanelHead
          title="Atividade por usuário"
          churchName={churchName}
          period={periodLabel}
          getBlock={() => ({
            title: 'Atividade por usuário',
            columns: [{ key: 'name', label: 'Usuário' }, { key: 'count', label: 'Ações' }],
            rows: byUser,
          })}
        />
        {byUser.length === 0 ? <Notice>Nenhuma ação registrada no período.</Notice> : (
          <table style={miniTable}>
            <thead><tr><th style={thStyle}>Usuário</th><th style={thStyle}>Ações</th></tr></thead>
            <tbody>{byUser.map(u => <tr key={u.name}><td style={tdStyle}>{u.name}</td><td style={tdStyle}>{u.count}</td></tr>)}</tbody>
          </table>
        )}
      </div>

      <div style={panelStyle}>
        <PanelHead
          title="Atividade por usuário e mês"
          churchName={churchName}
          period={periodLabel}
          getBlock={() => ({
            title: 'Atividade por usuário e mês',
            columns: [{ key: 'name', label: 'Usuário' }, ...byUserMonth.monthList.map(m => ({ key: m, label: m })), { key: 'total', label: 'Total' }],
            rows: byUserMonth.rows.map(r => ({ name: r.name, ...r.byMonth, total: r.total })),
          })}
        />
        {byUserMonth.rows.length === 0 ? <Notice>Nenhuma ação registrada no período.</Notice> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={miniTable}>
              <thead><tr><th style={thStyle}>Usuário</th>{byUserMonth.monthList.map(m => <th key={m} style={thStyle}>{m}</th>)}<th style={thStyle}>Total</th></tr></thead>
              <tbody>
                {byUserMonth.rows.map(r => (
                  <tr key={r.name}>
                    <td style={tdStyle}>{r.name}</td>
                    {byUserMonth.monthList.map(m => <td key={m} style={tdStyle}>{r.byMonth[m] || 0}</td>)}
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <PanelHead
          title="Atividade por usuário e entidade/tabela"
          churchName={churchName}
          period={periodLabel}
          getBlock={() => ({
            title: 'Atividade por usuário e entidade',
            columns: [{ key: 'name', label: 'Usuário' }, ...byUserEntity.entityList.map(e => ({ key: e, label: e }))],
            rows: byUserEntity.rows.map(r => ({ name: r.name, ...r.byEntity })),
          })}
        />
        {byUserEntity.rows.length === 0 ? <Notice>Nenhuma ação registrada no período.</Notice> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={miniTable}>
              <thead><tr><th style={thStyle}>Usuário</th>{byUserEntity.entityList.map(e => <th key={e} style={thStyle}>{e}</th>)}</tr></thead>
              <tbody>
                {byUserEntity.rows.map(r => (
                  <tr key={r.name}>
                    <td style={tdStyle}>{r.name}</td>
                    {byUserEntity.entityList.map(e => <td key={e} style={tdStyle}>{r.byEntity[e] || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={async () => { await exportBlocksToExcel([
          { title: 'Atividade por usuário', columns: [{ key: 'name', label: 'Usuário' }, { key: 'count', label: 'Ações' }], rows: byUser },
          { title: 'Atividade por usuário e mês', columns: [{ key: 'name', label: 'Usuário' }, ...byUserMonth.monthList.map(m => ({ key: m, label: m })), { key: 'total', label: 'Total' }], rows: byUserMonth.rows.map(r => ({ name: r.name, ...r.byMonth, total: r.total })) },
          { title: 'Atividade por usuário e entidade', columns: [{ key: 'name', label: 'Usuário' }, ...byUserEntity.entityList.map(e => ({ key: e, label: e }))], rows: byUserEntity.rows.map(r => ({ name: r.name, ...r.byEntity })) },
        ], `sistema-atividade-${todayStamp()}.xlsx`) }} style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer', marginRight: '8px' }}>Exportar Excel</button>
        <button onClick={async () => { await exportBlocksToPDF([
          { title: 'Atividade por usuário', columns: [{ key: 'name', label: 'Usuário' }, { key: 'count', label: 'Ações' }], rows: byUser },
          { title: 'Atividade por usuário e mês', columns: [{ key: 'name', label: 'Usuário' }, ...byUserMonth.monthList.map(m => ({ key: m, label: m })), { key: 'total', label: 'Total' }], rows: byUserMonth.rows.map(r => ({ name: r.name, ...r.byMonth, total: r.total })) },
          { title: 'Atividade por usuário e entidade', columns: [{ key: 'name', label: 'Usuário' }, ...byUserEntity.entityList.map(e => ({ key: e, label: e }))], rows: byUserEntity.rows.map(r => ({ name: r.name, ...r.byEntity })) },
        ], { filename: `sistema-atividade-${todayStamp()}.pdf`, reportTitle: 'Relatório Sistema — Atividade de uso', churchName, period: periodLabel }) }} style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>Exportar PDF</button>
      </div>
    </div>
  )
}
