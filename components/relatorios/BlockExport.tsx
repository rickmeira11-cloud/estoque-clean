'use client'
import { exportBlocksToExcel, exportBlocksToPDF, todayStamp, type ReportBlock } from '@/lib/report-export'

export function BlockExport({ getBlock, churchName, period }: { getBlock: () => ReportBlock; churchName: string; period?: string }) {
  async function onExcel() {
    const block = getBlock()
    await exportBlocksToExcel([block], `${slug(block.title)}-${todayStamp()}.xlsx`)
  }
  async function onPDF() {
    const block = getBlock()
    await exportBlocksToPDF([block], { filename: `${slug(block.title)}-${todayStamp()}.pdf`, reportTitle: block.title, churchName, period })
  }
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={onExcel} title="Exportar Excel" style={btnStyle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </button>
      <button onClick={onPDF} title="Exportar PDF" style={btnStyle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="10" y1="13" x2="14" y2="13"/><line x1="10" y1="17" x2="14" y2="17"/></svg>
      </button>
    </div>
  )
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const btnStyle: React.CSSProperties = {
  width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0,
}
