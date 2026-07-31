import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mapRowPlanilha, normalizeMinisterio } from '@/lib/patrimonio-planilha'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSIVLMBw4H-EDIBNUqjLppbAIFZxrFfDoIbxfpULz2kKd46Z6JUx4ew-nxUjn---R21kR-l9k42OBIs/pub?gid=0&single=true&output=csv'

// Campos comparados entre planilha e Gestoque (NÃO inclui physical_location/location_id).
const COMPARE_FIELDS = [
  'name', 'quantity', 'description', 'serial_number', 'barcode',
  'acquisition_date', 'acquisition_value', 'useful_life_years',
  'depreciation_rate', 'nfe_key', 'supplier', 'ministry_id',
] as const

// Normaliza um valor para comparação: '' / undefined viram null.
function norm(v: any): any {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t }
  return v
}

function sameValue(a: any, b: any): boolean {
  const x = norm(a), y = norm(b)
  if (x === null && y === null) return true
  if (x === null || y === null) return false
  if (typeof x === 'number' || typeof y === 'number') return Number(x) === Number(y)
  return String(x) === String(y)
}

export async function GET() {
  return Response.json({ ok: true, message: 'Job de sync do patrimônio com a planilha. Use POST para executar.' })
}

export async function POST() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Baixar CSV publicado
    const res = await fetch(CSV_URL, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ ok: false, error: 'Falha ao baixar CSV: ' + res.status }, { status: 502 })
    let text = await res.text()
    text = text.replace(/^﻿/, '') // remover BOM se houver

    const Papa: any = (await import('papaparse')).default
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    const rawRows = (parsed.data as any[]) || []

    // 2. Carregar patrimônio atual e ministérios
    const [{ data: pats }, { data: mins }] = await Promise.all([
      sb.from('patrimonio').select('*').eq('church_id', CHURCH_ID).eq('is_active', true),
      sb.from('ministries').select('id,name').eq('church_id', CHURCH_ID),
    ])

    const byExternalId = new Map<string, any>(
      (pats || []).filter(p => p.external_id).map(p => [String(p.external_id), p])
    )
    const minByNorm = new Map<string, string>(
      (mins || []).map((m: any) => [normalizeMinisterio(m.name), m.id])
    )

    // Resolver ministério pela regra: casa por nome normalizado ou cria novo (nome exato da planilha).
    async function resolveMinistry(nome: string): Promise<string | null> {
      if (!nome) return null
      const key = normalizeMinisterio(nome)
      if (minByNorm.has(key)) return minByNorm.get(key)!
      const { data: novo, error } = await sb
        .from('ministries')
        .insert({ church_id: CHURCH_ID, name: nome })
        .select('id')
        .single()
      if (error || !novo) return null
      minByNorm.set(key, novo.id)
      return novo.id
    }

    // 3. Propostas pendentes existentes (dedupe por external_id + change_type)
    const { data: pendentes } = await sb
      .from('patrimonio_pending_changes')
      .select('*')
      .eq('church_id', CHURCH_ID)
      .eq('status', 'pendente')
    const pendByKey = new Map<string, any>(
      (pendentes || []).map((p: any) => [(p.external_id || '') + '|' + p.change_type, p])
    )

    let novas = 0
    let atualizadas = 0

    // Cria ou atualiza uma proposta pendente, evitando duplicatas.
    async function upsertProposal(
      change_type: string,
      external_id: string,
      patrimonio_id: string | null,
      proposed_data: any,
      current_data: any,
      diff_fields: string[],
    ) {
      const key = external_id + '|' + change_type
      const existing = pendByKey.get(key)
      if (existing) {
        const mudou =
          JSON.stringify(existing.proposed_data) !== JSON.stringify(proposed_data) ||
          JSON.stringify(existing.current_data) !== JSON.stringify(current_data) ||
          JSON.stringify(existing.diff_fields || []) !== JSON.stringify(diff_fields)
        if (mudou) {
          await sb.from('patrimonio_pending_changes')
            .update({ proposed_data, current_data, diff_fields, patrimonio_id, created_at: new Date().toISOString() })
            .eq('id', existing.id)
          atualizadas++
        }
      } else {
        const { data: inserted } = await sb.from('patrimonio_pending_changes')
          .insert({ church_id: CHURCH_ID, change_type, external_id, patrimonio_id, proposed_data, current_data, diff_fields, status: 'pendente' })
          .select('*')
          .single()
        novas++
        if (inserted) pendByKey.set(key, inserted)
      }
    }

    const seen = new Set<string>()

    for (const raw of rawRows) {
      const m = mapRowPlanilha(raw)
      if (!m.external_id || !m.name) continue
      seen.add(m.external_id)

      const ministry_id = await resolveMinistry(m.ministerio)
      const proposed = {
        external_id:       m.external_id,
        name:              m.name,
        quantity:          m.quantity,
        description:       m.description || null,
        serial_number:     m.serial_number || null,
        barcode:           m.barcode || null,
        acquisition_date:  m.acquisition_date,
        acquisition_value: m.acquisition_value,
        useful_life_years: m.useful_life_years,
        depreciation_rate: m.depreciation_rate,
        nfe_key:           m.nfe_key || null,
        supplier:          m.supplier || null,
        ministry_id,
      }

      const existing = byExternalId.get(m.external_id)
      if (!existing) {
        await upsertProposal('criar', m.external_id, null, proposed, null, [])
      } else {
        const diff: string[] = []
        for (const f of COMPARE_FIELDS) {
          if (!sameValue(existing[f], (proposed as any)[f])) diff.push(f)
        }
        if (diff.length > 0) {
          const current: any = { external_id: existing.external_id }
          for (const f of COMPARE_FIELDS) current[f] = existing[f] ?? null
          await upsertProposal('atualizar', m.external_id, existing.id, proposed, current, diff)
        }
      }
    }

    // 4. IDs que existem no Gestoque mas sumiram da planilha
    for (const [extId, p] of byExternalId) {
      if (seen.has(extId)) continue
      const current: any = { external_id: p.external_id }
      for (const f of COMPARE_FIELDS) current[f] = p[f] ?? null
      await upsertProposal('sumiu_planilha', extId, p.id, null, current, [])
    }

    // Total de pendentes após a rodada
    const { count } = await sb
      .from('patrimonio_pending_changes')
      .select('*', { count: 'exact', head: true })
      .eq('church_id', CHURCH_ID)
      .eq('status', 'pendente')
    const total_pendentes = count || 0

    // 5. WhatsApp se houve novas propostas
    if (novas > 0) {
      try {
        const phone = process.env.CALLMEBOT_PHONE!
        const apikey = process.env.CALLMEBOT_APIKEY!
        const msg = '\u{1F5C2}️ Patrimônio: ' + total_pendentes + ' mudança(s) pendente(s) na planilha para revisar'
        const encoded = encodeURIComponent(msg)
        await fetch('https://api.callmebot.com/whatsapp.php?phone=' + phone + '&text=' + encoded + '&apikey=' + apikey)
      } catch (e) {
        console.error('WhatsApp error:', e)
      }
    }

    return NextResponse.json({ ok: true, novas, atualizadas, total_pendentes })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
