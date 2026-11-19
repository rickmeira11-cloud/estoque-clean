import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mapRowMembro } from '@/lib/members-planilha'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'

// URL do CSV publicado da planilha Google Sheets do Form de Membros.
// Manter no env para facilitar troca sem redeploy.
const CSV_URL = process.env.MEMBERS_SHEET_CSV_URL || ''

export async function GET() {
  return Response.json({ ok: true, message: 'Sync de membros. Use POST para executar.' })
}

export async function POST(request: Request) {
  // Autenticação: aceita CRON_SECRET (para o cron Vercel) ou chamada interna sem auth
  // em ambiente de desenvolvimento.
  const auth = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!CSV_URL) {
    return NextResponse.json({ ok: false, error: 'MEMBERS_SHEET_CSV_URL não configurada' }, { status: 500 })
  }

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Baixar CSV
    const res = await fetch(CSV_URL, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Falha ao baixar CSV: ' + res.status }, { status: 502 })
    }
    let text = await res.text()
    text = text.replace(/^﻿/, '') // remover BOM

    const Papa: any = (await import('papaparse')).default
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    const rawRows = (parsed.data as any[]) || []

    if (rawRows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: 0, total: 0 })
    }

    let inserted = 0
    let updated  = 0
    let skipped  = 0 // linhas sem email (não entram no upsert por email)
    const noEmailRows: string[] = []

    for (const raw of rawRows) {
      const m = mapRowMembro(raw)
      if (!m) continue

      if (!m.email) {
        // Sem e-mail: não dá pra fazer upsert determinístico.
        // Registra para log mas não insere para evitar duplicatas.
        skipped++
        noEmailRows.push(m.full_name)
        continue
      }

      // Upsert por (church_id, lower(email))
      const payload = {
        church_id:                    CHURCH_ID,
        source_row_id:                m.source_row_id,
        submitted_at:                 m.submitted_at,
        email:                        m.email.toLowerCase().trim(),
        full_name:                    m.full_name,
        birth_date:                   m.birth_date,
        birth_state:                  m.birth_state,
        spouse_name:                  m.spouse_name,
        children_info:                m.children_info,
        address_street:               m.address_street,
        address_complement:           m.address_complement,
        neighborhood:                 m.neighborhood,
        city:                         m.city,
        phone:                        m.phone,
        small_group:                  m.small_group,
        wants_to_host_group:          m.wants_to_host_group,
        serves_in_ministry:           m.serves_in_ministry,
        wants_to_serve_other_ministry: m.wants_to_serve_other_ministry,
        accepts_communication:        m.accepts_communication,
        updated_at:                   new Date().toISOString(),
      }

      // onConflict usa o índice members_email_church
      const { data: row, error } = await sb
        .from('members')
        .upsert(payload, {
          onConflict: 'church_id,email',
          ignoreDuplicates: false,
        })
        .select('id, created_at, updated_at')
        .single()

      if (error) {
        console.error('[members/sync] upsert error:', error.message, '| email:', m.email)
        skipped++
        continue
      }

      // Se created_at === updated_at (dentro do mesmo segundo) → inserção nova
      if (row && row.created_at === row.updated_at) {
        inserted++
      } else {
        updated++
      }
    }

    const { count } = await sb
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('church_id', CHURCH_ID)

    const total = count || 0

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      skipped,
      total,
      ...(noEmailRows.length > 0 ? { sem_email: noEmailRows } : {}),
    })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
