// Mapeamento mural_events (projeto do calendário) -> events (Gestoque).
// Regras definidas manualmente a partir da auditoria de 2026-11-25.

export type MuralEvent = {
  id: string
  year: number
  month: number
  day: number
  text: string | null
  category: string | null
  hour: string | null
  location: string | null
}

const CATEGORIES_TO_FETCH = ['culto', 'influa', 'zadok', 'lideranca', 'especial']

export function muralCategoriesToFetch(): string[] {
  return CATEGORIES_TO_FETCH
}

// Retorna o nome do event_type (pra buscar o id real em event_types) ou null se a linha deve ser ignorada.
export function mapMuralToEventTypeName(category: string | null, text: string | null): string | null {
  const cat = (category || '').trim().toLowerCase()
  const t = (text || '').toLowerCase()

  if (cat === 'culto') return 'Culto'
  if (cat === 'influa') return 'Influa'
  if (cat === 'lideranca') return 'Reunião de Liderança'
  if (cat === 'zadok') {
    if (t.includes('local')) return 'Zadok Local'
    if (t.includes('music')) return 'Zadok Music Bnu'
    return null
  }
  if (cat === 'especial') {
    if (t.includes('curso de noivos')) return 'Curso de Noivos'
    if (t.includes('welcome coffee')) return 'Welcome Coffee'
    if (t.includes('timothy')) return 'Timothy'
    return null
  }
  // feriado, ferias, vinte, estudo e qualquer outra categoria: ignorar
  return null
}

// "10h", "18h", "19:00", "10:30h" -> "HH:MM:SS"; vazio ou não reconhecido -> null
export function parseMuralHour(hourRaw: string | null): string | null {
  const h = (hourRaw || '').trim().toLowerCase()
  if (!h) return null
  let m = h.match(/^(\d{1,2})h$/)
  if (m) return `${m[1].padStart(2, '0')}:00:00`
  m = h.match(/^(\d{1,2}):(\d{2})$/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}:00`
  m = h.match(/^(\d{1,2}):(\d{2})h$/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}:00`
  return null
}

export function muralEventDate(ev: MuralEvent): string | null {
  if (!ev.year || ev.year === 0 || !ev.month || !ev.day) return null
  const mm = String(ev.month).padStart(2, '0')
  const dd = String(ev.day).padStart(2, '0')
  return `${ev.year}-${mm}-${dd}`
}
