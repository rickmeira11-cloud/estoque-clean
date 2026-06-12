import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'
const WEEKDAYS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']

export async function GET() {
  return Response.json({ ok: true, message: 'Job de eventos recorrentes. Use POST para executar.' })
}

export async function POST() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar regras ativas
    const { data: rules } = await sb
      .from('recurring_events')
      .select('*')
      .eq('church_id', CHURCH_ID)
      .eq('is_active', true)

    if (!rules || rules.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nenhuma regra ativa', created: 0 })
    }

    // Data alvo = hoje + 2 dias
    const target = new Date()
    target.setDate(target.getDate() + 2)
    target.setHours(0, 0, 0, 0)
    const targetWeekday = target.getDay()
    const targetDate = target.toISOString().split('T')[0]

    const created: string[] = []

    for (const rule of rules) {
      // Verificar se a data alvo cai no dia da semana da regra
      if (rule.weekday !== targetWeekday) continue

      // Verificar se ja existe evento com mesmo nome e data
      const { data: existing } = await sb
        .from('events')
        .select('id')
        .eq('church_id', CHURCH_ID)
        .eq('name', rule.name)
        .eq('event_date', targetDate)
        .maybeSingle()

      if (existing) continue

      // Criar o evento
      const { error } = await sb.from('events').insert({
        church_id:   CHURCH_ID,
        name:        rule.name,
        event_date:  targetDate,
        description: rule.description || null,
        is_active:   true,
      })

      if (!error) created.push(rule.name + ' (' + targetDate + ')')
    }

    // Enviar WhatsApp se criou algum
    if (created.length > 0) {
      try {
        const phone  = process.env.CALLMEBOT_PHONE!
        const apikey = process.env.CALLMEBOT_APIKEY!
        const dataFmt = target.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
        let msg = '\u{1F4C5} *Eventos criados automaticamente*\n\n'
        created.forEach(c => { msg += '\u2705 ' + c + '\n' })
        msg += '\n_Data: ' + dataFmt + '_'
        const encoded = encodeURIComponent(msg)
        await fetch('https://api.callmebot.com/whatsapp.php?phone=' + phone + '&text=' + encoded + '&apikey=' + apikey)
      } catch (e) {
        console.error('WhatsApp error:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      target_date: targetDate,
      target_weekday: WEEKDAYS[targetWeekday],
      created: created.length,
      events: created,
    })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}