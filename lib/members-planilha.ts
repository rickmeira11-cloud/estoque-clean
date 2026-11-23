// Parser compartilhado para a planilha de Membros (Google Form → Google Sheets CSV).
// Reutiliza getCol e parseDataBR do patrimônio; mapeamento de colunas é deste módulo.

import { getCol, parseDataBR } from '@/lib/patrimonio-planilha'
import { createHash } from 'crypto'

export type LinhaMembro = {
  source_row_id:                string
  submitted_at:                 string | null
  email:                        string | null
  full_name:                    string
  birth_date:                   string | null
  birth_state:                  string | null
  spouse_name:                  string | null
  children_info:                string | null
  address_street:               string | null
  address_complement:           string | null
  neighborhood:                 string | null
  city:                         string | null
  phone:                        string | null
  small_group:                  string | null
  wants_to_host_group:          string | null
  serves_in_ministry:           string | null
  wants_to_serve_other_ministry: string | null
  accepts_communication:        boolean
}

function nullify(s: string): string | null {
  return s.trim() === '' ? null : s.trim()
}

// "Sim" / "sim" / "S" → true; qualquer outro valor → false
function parseSim(s: string): boolean {
  return /^s(im)?$/i.test(s.trim())
}

// Carimbo de data/hora do Google Forms: "DD/MM/AAAA HH:MM:SS"
function parseCarimbo(s: string): string | null {
  if (!s) return null
  // tenta "DD/MM/AAAA HH:MM:SS" → ISO
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}-03:00`
  return null
}

export function mapRowMembro(row: Record<string, any>): LinhaMembro | null {
  const g = (keys: string[]) => getCol(row, keys)

  const submittedRaw = g(['Carimbo de data/hora', 'Timestamp', 'Data e hora'])
  const email        = nullify(g(['Endereço de e-mail', 'E-mail', 'Email', 'email']))
  const full_name    = g(['Nome completo', 'Nome', 'name'])

  if (!full_name) return null // linha vazia ou cabeçalho duplicado

  const sourceInput = (submittedRaw || '') + '|' + (email || full_name)
  const source_row_id = createHash('sha256').update(sourceInput).digest('hex').slice(0, 32)

  return {
    source_row_id,
    submitted_at:   parseCarimbo(submittedRaw),
    email,
    full_name,
    birth_date:     parseDataBR(g(['Data de nascimento', 'Nascimento'])),
    birth_state:    nullify(g(['Naturalidade', 'Estado natal', 'Natural de'])),
    spouse_name:    nullify(g(['Nome do cônjuge', 'Conjuge', 'Cônjuge', 'Esposo(a)'])),
    children_info:  nullify(g(['Filhos', 'Informações sobre filhos', 'Filho(s)'])),
    address_street: nullify(g(['Rua', 'Endereço', 'Logradouro', 'Rua/Avenida'])),
    address_complement: nullify(g(['Complemento', 'Apto', 'Número'])),
    neighborhood:   nullify(g(['Bairro'])),
    city:           nullify(g(['Cidade', 'Município'])),
    phone:          nullify(g(['Seu Número de telefone/WhatsApp (com ddd)', 'Telefone', 'Celular', 'WhatsApp', 'Telefone/WhatsApp'])),
    small_group:    nullify(g(['Frequenta algum 2OU+?', 'Frequenta 2OU+', 'Grupo pequeno', 'Célula', 'Frequenta grupo'])),
    wants_to_host_group: nullify(g(['Deseja sediar grupo', 'Quer sediar', 'Hospedar grupo'])),
    serves_in_ministry: nullify(g(['Já serve em algum ministério?', 'Serve em ministério', 'Ministra em', 'Ministério que serve', 'Ministérios'])),
    wants_to_serve_other_ministry: nullify(g(['Já sentiu vontade de servir em outro ministério? (fora o seu atual)', 'Deseja servir em outro ministério', 'Outro ministério', 'Deseja servir'])),
    accepts_communication: parseSim(g(['Aceita comunicação', 'Comunicação', 'Autoriza contato'])),
  }
}
