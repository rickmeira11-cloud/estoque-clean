// Helpers compartilhados para a planilha de patrimônio.
// Usado tanto pela importação manual (client, page.tsx) quanto pelo
// sync via propostas (server, /api/patrimonio/sync-planilha).
// Reutilize daqui — não duplique parser nem mapeamento de colunas.

// Converter valor BR (R$ 6.890,00) para numero (6890.00)
export function parseValorBR(v: string): number | null {
  if (!v) return null
  const limpo = v.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(limpo)
  return isNaN(n) ? null : n
}

// Converter data BR (DD/MM/AAAA) para ISO (AAAA-MM-DD)
export function parseDataBR(d: string): string | null {
  if (!d) return null
  const parts = d.trim().split('/')
  if (parts.length !== 3) return null
  const [dia, mes, ano] = parts
  if (!dia || !mes || !ano) return null
  return ano + '-' + mes.padStart(2, '0') + '-' + dia.padStart(2, '0')
}

// Normalizar texto para casamento de ministério: lowercase + remover acentos.
// Nunca cria duplicata por diferença de acento/caixa.
export function normalizeMinisterio(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Resolve o ministry_id pelo nome: casa por nome normalizado (via cache) ou cria um novo
// ministério com o nome exato (sem duplicar por acento/caixa). O `cache` deve vir
// pré-carregado com os ministérios existentes (normalizeMinisterio(name) -> id).
// Reutilizado pelo sync da planilha e pela importação manual.
export async function resolveMinistryId(
  sb: any,
  churchId: string,
  nome: string,
  cache: Map<string, string>,
): Promise<string | null> {
  if (!nome) return null
  const key = normalizeMinisterio(nome)
  if (cache.has(key)) return cache.get(key)!
  const { data: novo, error } = await sb
    .from('ministries')
    .insert({ church_id: churchId, name: nome })
    .select('id')
    .single()
  if (error || !novo) return null
  cache.set(key, novo.id)
  return novo.id
}

// Ler uma coluna tentando variações de nome de cabeçalho.
export function getCol(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase())
    if (found && row[found]) return String(row[found]).trim()
  }
  return ''
}

export type LinhaPlanilha = {
  external_id: string
  ministerio: string
  name: string
  quantity: number
  description: string
  serial_number: string
  barcode: string
  acquisition_date: string | null
  acquisition_value: number | null
  useful_life_years: number
  depreciation_rate: number
  nfe_key: string
  supplier: string
}

// Mapear uma linha crua do CSV para os campos do patrimônio.
export function mapRowPlanilha(row: Record<string, any>): LinhaPlanilha {
  const g = (keys: string[]) => getCol(row, keys)
  return {
    external_id:       g(['ID']),
    ministerio:        g(['Ministério', 'Ministerio', 'Ministério responsável']),
    name:              g(['Nome / Item', 'Nome', 'Item']),
    quantity:          parseInt(g(['Quantidade'])) || 1,
    description:       g(['Descrição/Especificação/Modelo (categoria)', 'Descrição', 'Modelo']),
    serial_number:     g(['numero de série', 'número de série', 'serie']),
    barcode:           g(['Cod de Barras', 'Código de Barras', 'barcode']),
    acquisition_date:  parseDataBR(g(['Data aquisição/Doação', 'Data aquisição', 'Data'])),
    acquisition_value: parseValorBR(g(['Valor'])),
    useful_life_years: parseInt(g(['Vida útil'])) || 5,
    depreciation_rate: parseFloat(g(['% Depreciação Anual', 'Depreciação'])) || 20,
    nfe_key:           g(['Número da NF', 'NF', 'Nota']),
    supplier:          g(['Fornecedor']),
  }
}
