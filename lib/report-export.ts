// Utilitário compartilhado de exportação de relatórios (PDF/Excel).
// Reaproveita as libs já usadas no projeto (xlsx, jspdf, jspdf-autotable) — nenhuma dependência nova.

export type ReportColumn = { key: string; label: string }
export type ReportBlock = {
  title: string
  columns: ReportColumn[]
  rows: Record<string, any>[]
  /** Linhas de rodapé opcionais (ex: totais/médias), no mesmo formato de `rows`. */
  summary?: Record<string, any>[]
}

function sheetSafeName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let candidate = base
  let i = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = (base.slice(0, 28) + ' ' + i).slice(0, 31)
    i++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

export async function exportBlocksToExcel(blocks: ReportBlock[], filename: string) {
  const { utils, writeFile } = await import('xlsx')
  const wb = utils.book_new()
  const used = new Set<string>()
  for (const block of blocks) {
    const allRows = [...block.rows, ...(block.summary || [])]
    const data = allRows.map(row => {
      const out: Record<string, any> = {}
      for (const col of block.columns) out[col.label] = row[col.key] ?? ''
      return out
    })
    const ws = utils.json_to_sheet(data.length ? data : [{}])
    ws['!cols'] = block.columns.map(c => ({ wch: Math.max(c.label.length, 14) }))
    utils.book_append_sheet(wb, ws, sheetSafeName(block.title, used))
  }
  writeFile(wb, filename)
}

export async function exportBlocksToPDF(
  blocks: ReportBlock[],
  opts: { filename: string; reportTitle: string; churchName: string; period?: string }
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  doc.setFillColor(17, 17, 19); doc.rect(0, 0, 297, 30, 'F')
  doc.setTextColor(250, 250, 250); doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text(opts.reportTitle, 14, 12)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(161, 161, 170)
  doc.text(opts.churchName + (opts.period ? ' · ' + opts.period : '') + ' · Gerado em ' + today, 14, 20)

  let y = 36
  for (const block of blocks) {
    if (y > 180) { doc.addPage(); y = 20 }
    doc.setFontSize(11); doc.setTextColor(30, 30, 34); doc.setFont('helvetica', 'bold')
    doc.text(block.title, 14, y)
    const body = block.rows.map(row => block.columns.map(c => row[c.key] ?? '—'))
    const foot = block.summary?.map(row => block.columns.map(c => row[c.key] ?? ''))
    autoTable(doc, {
      head: [block.columns.map(c => c.label)],
      body: body.length ? body : [block.columns.map(() => '—')],
      foot,
      startY: y + 2,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 245], textColor: [30, 30, 34], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 250] },
    })
    y = (doc as any).lastAutoTable.finalY + 12
  }

  const pages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(161, 161, 170)
    doc.text(`Página ${i} de ${pages}`, 14, doc.internal.pageSize.height - 8)
    doc.text(opts.churchName, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' })
  }
  doc.save(opts.filename)
}

export function todayStamp(): string {
  return new Date().toISOString().split('T')[0]
}
