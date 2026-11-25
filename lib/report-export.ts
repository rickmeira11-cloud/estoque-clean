// Utilitário compartilhado de exportação de relatórios (PDF/Excel).
// Reaproveita as libs já usadas no projeto (xlsx, jspdf, jspdf-autotable) — nenhuma dependência nova.

export type ReportColumn = { key: string; label: string }
export type ReportBlock = {
  title: string
  columns: ReportColumn[]
  rows: Record<string, any>[]
  /** Linhas de rodapé opcionais (ex: totais/médias), no mesmo formato de `rows`. */
  summary?: Record<string, any>[]
  /** Elemento DOM (geralmente o container do gráfico) a capturar como imagem no PDF. Ignorado no Excel. */
  chartElement?: HTMLElement | null
}

// Serializa o <svg> do Recharts dentro de `container` como PNG (data URL), via canvas.
// Sem dependência nova — nenhuma lib de screenshot instalada no projeto.
export async function captureChartAsPng(container: HTMLElement | null | undefined, scale = 2): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!container) return null
  const svg = container.querySelector('svg')
  if (!svg) return null

  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width || Number(svg.getAttribute('width')) || 600))
  const height = Math.max(1, Math.round(rect.height || Number(svg.getAttribute('height')) || 300))

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Resolve variáveis CSS (var(--...)) pra cor concreta, já que o canvas não aplica o CSS da página.
  const computed = getComputedStyle(document.documentElement)
  function resolveVars(el: Element) {
    const style = (el as HTMLElement).getAttribute('style')
    if (style && style.includes('var(')) {
      const resolved = style.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_, v) => computed.getPropertyValue(v).trim() || '#999')
      ;(el as HTMLElement).setAttribute('style', resolved)
    }
    for (const attr of ['fill', 'stroke']) {
      const val = el.getAttribute(attr)
      if (val && val.includes('var(')) {
        const resolved = val.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_, v) => computed.getPropertyValue(v).trim() || '#999')
        el.setAttribute(attr, resolved)
      }
    }
    Array.from(el.children).forEach(resolveVars)
  }
  resolveVars(clone)
  clone.style.background = '#ffffff'

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    return { dataUrl: canvas.toDataURL('image/png'), width, height }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
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
    y += 6

    if (block.chartElement) {
      const captured = await captureChartAsPng(block.chartElement)
      if (captured) {
        const maxW = 269 // largura útil em A4 paisagem (297 - 2*14)
        const imgW = Math.min(maxW, captured.width / 2)
        const imgH = (captured.height / captured.width) * imgW
        if (y + imgH > 190) { doc.addPage(); y = 20 }
        doc.addImage(captured.dataUrl, 'PNG', 14, y, imgW, imgH)
        y += imgH + 8
      }
    }

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
