// Cálculo de valor patrimonial — depreciação LINEAR por vida útil.
// Fonte única compartilhada pela tela de patrimônio e pelo relatório
// (elimina a duplicação da fórmula). O motor é useful_life_years;
// depreciation_rate deixou de influenciar o valor.

export type BemDepreciavel = {
  acquisition_value: number | null
  acquisition_date: string | null
  useful_life_years?: number | null
  quantity?: number | null
}

// Valor atual (depreciado) de UMA unidade — linear por vida útil.
export function valorAtualUnitario(p: BemDepreciavel): number {
  const valorAquis = p.acquisition_value || 0
  if (valorAquis <= 0) return 0                        // sem valor cadastrado → 0
  if (!p.acquisition_date) return valorAquis           // sem data → não deprecia (valor cheio)
  const vida = (!p.useful_life_years || p.useful_life_years <= 0) ? 5 : p.useful_life_years // fallback, nunca ÷0
  const anosBrutos = (Date.now() - new Date(p.acquisition_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const anos = Math.max(0, anosBrutos)                 // clamp: data futura não valoriza acima da aquisição
  const valor = valorAquis * (1 - anos / vida)
  return Math.max(0, valor)                            // piso 0, sem residual
}

// Valor total atual = unitário depreciado × quantidade
export function valorAtual(p: BemDepreciavel): number {
  return valorAtualUnitario(p) * (p.quantity || 1)
}

// Valor total de aquisição = unitário × quantidade
export function valorAquisicaoTotal(p: BemDepreciavel): number {
  return (p.acquisition_value || 0) * (p.quantity || 1)
}
