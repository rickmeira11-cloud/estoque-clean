import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'

export async function GET() {
  return Response.json({ ok: true, message: 'Job de eventos recorrentes. Use POST para executar.' })
}

function shouldCreate(rule: any, target: Date): boolean {
  const targetWeekday = target.getDay()
  if (rule.weekday !== targetWeekday) return false

  if (rule.frequency === 'semanal') return true

  if (rule.frequency === 'quinzenal') {
    if (!rule.anchor_date) return false
    const anchor = new Date(rule.anchor_date + 'T00:00:00')
    const diffDays = Math.round((target.getTime() - anchor.getTime()) / (1000*60*60*24))
    return diffDays >= 0 && diffDays % 14 === 0
  }

  if (rule.frequency === 'mensal') {
    const week = rule.month_week || 1
    const day = target.getDate()
    if (week === -1) {
      const next = new Date(target); next.setDate(day + 7)
      return next.getMonth() !== target.getMonth()
    } else {
      return Math.ceil(day / 7) === week
    }
  }
  return false
}

export async function POST() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: rules } = await sb
      .from('recurring_events')
      .select('*')
      .eq('church_id', CHURCH_ID)
      .eq('is_active', true)

    if (!rules || rules.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nenhuma regra ativa', created: 0 })
    }

    const created: string[] = []

    for (const rule of rules) {
      const lead = rule.lead_days || 2
      const target = new Date()
      target.setDate(target.getDate() + lead)
      target.setHours(0, 0, 0, 0)
      const targetDate = target.toISOString().split('T')[0]

      if (!shouldCreate(rule, target)) continue

      const { data: existing } = await sb
        .from('events')
        .select('id')
        .eq('church_id', CHURCH_ID)
        .eq('name', rule.name)
        .eq('event_date', targetDate)
        .maybeSingle()

      if (existing) continue

      const { error } = await sb.from('events').insert({
        church_id:   CHURCH_ID,
        name:        rule.name,
        event_date:  targetDate,
        description: rule.description || null,
        is_active:   true,
      })

      if (!error) created.push(rule.name + ' (' + new Date(targetDate + 'T12:00:00').toLocaleDateString('pt-BR') + ')')
    }

    if (created.length > 0) {
      try {
        const phone  = process.env.CALLMEBOT_PHONE!
        const apikey = process.env.CALLMEBOT_APIKEY!
        let msg = '\u{1F4C5} *Eventos criados automaticamente*\n\n'
        created.forEach(c => { msg += '\u2705 ' + c + '\n' })
        const encoded = encodeURIComponent(msg)
        await fetch('https://api.callmebot.com/whatsapp.php?phone=' + phone + '&text=' + encoded + '&apikey=' + apikey)
      } catch (e) {
        console.error('WhatsApp error:', e)
      }
    }

    return NextResponse.json({ ok: true, created: created.length, events: created })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}