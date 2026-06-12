import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'
const WEEKDAYS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']

export async function GET() {
  return Response.json({ ok: true, message: 'Job de eventos recorrentes. Use POST para executar.' })
}

// Verifica se uma data alvo deve gerar evento para a regra
function shouldCreate(rule: any, target: Date): boolean {
  const targetWeekday = target.getDay()

  // Dia da semana precisa bater em todos os tipos
  if (rule.weekday !== targetWeekday) return false

  if (rule.frequency === 'semanal') {
    return true
  }

  if (rule.frequency === 'quinzenal') {
    if (!rule.anchor_date) return false
    const anchor = new Date(rule.anchor_date + 'T00:00:00')
    const diffDays = Math.round((target.getTime() - anchor.getTime()) / (1000*60*60*24))
    // Deve ser multiplo de 14 e nao negativo
    return diffDays >= 0 && diffDays % 14 === 0
  }

  if (rule.frequency === 'mensal') {
    // month_week: 1=primeira, 2=segunda, 3=terceira, 4=quarta, -1=ultima
    const week = rule.month_week || 1
    const day = target.getDate()
    if (week === -1) {
      // Ultima ocorrencia do weekday no mes: proxima semana ja eh outro mes
      const next = new Date(target); next.setDate(day + 7)
      return next.getMonth() !== target.getMonth()
    } else {
      // Nª ocorrencia: dia entre (week-1)*7+1 e week*7
      const nth = Math.ceil(day / 7)
      return nth === week
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
      // Diagnostico: buscar todas as regras sem filtro
      const { data: allRules, error: allErr } = await sb
        .from('recurring_events')
        .select('id,name,is_active,church_id')
      return NextResponse.json({
        ok: true,
        message: 'Nenhuma regra ativa',
        created: 0,
        debug: { church_id_usado: CHURCH_ID, total_regras_encontradas: allRules?.length || 0, regras: allRules, erro: allErr?.message }
      })
    }

    const created: string[] = []

    for (const rule of rules) {
      // Data alvo = hoje + lead_days da regra
      const lead = rule.lead_days || 2
      const target = new Date()
      target.setDate(target.getDate() + lead)
      target.setHours(0, 0, 0, 0)
      const targetDate = target.toISOString().split('T')[0]

      if (!shouldCreate(rule, target)) continue

      // Verificar duplicata
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