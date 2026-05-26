import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'

export async function GET() {
  return Response.json({ ok: true, message: 'Gestoque WhatsApp API ativa. Use POST para enviar alertas.' })
}

export async function POST() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: products } = await sb
      .from('products')
      .select('name, quantity, min_stock, category, expiration_date')
      .eq('church_id', CHURCH_ID)
      .eq('is_active', true)

    if (!products) return NextResponse.json({ ok: false, error: 'no products' })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7 = new Date(today)
    in7.setDate(today.getDate() + 7)

    const baixo    = products.filter(p => p.quantity <= p.min_stock)
    const vencendo = products.filter(p => {
      if (!p.expiration_date) return false
      return new Date(p.expiration_date) <= in7
    })

    if (baixo.length === 0 && vencendo.length === 0) {
      return NextResponse.json({ ok: true, message: 'sem alertas' })
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    })

    const lines: string[] = []
    lines.push('\uD83D\uDCE6 *Gestoque Poiema - Alertas de Estoque*')
    lines.push('_' + dataHoje + '_')
    lines.push('')

    if (baixo.length > 0) {
      lines.push('\u26A0\uFE0F *Estoque baixo ou zerado:*')
      baixo.forEach(p => {
        const icon = p.quantity === 0 ? '\uD83D\uDD34' : '\uD83D\uDFE1'
        lines.push(icon + ' ' + p.name + ' - *' + p.quantity + '* (min: ' + p.min_stock + ')')
      })
    }

    if (vencendo.length > 0) {
      lines.push('')
      lines.push('\u23F0 *Validade proxima (7 dias):*')
      vencendo.forEach(p => {
        const exp  = new Date(p.expiration_date + 'T12:00:00')
        const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const icon = diff < 0 ? '\uD83D\uDD34' : '\uD83D\uDFE0'
        const txt  = diff < 0 ? 'VENCIDO' : 'vence em ' + diff + ' dia(s)'
        lines.push(icon + ' ' + p.name + ' - ' + txt)
      })
    }

    lines.push('')
    lines.push('_Total: ' + baixo.length + ' item(s) baixo, ' + vencendo.length + ' vencendo_')
    lines.push('_Acesse: gestoquepoiemav1.vercel.app_')

    const msg = lines.join('\n')

    // Enviar via Callmebot
    const phone  = process.env.CALLMEBOT_PHONE!
    const apikey = process.env.CALLMEBOT_APIKEY!
    const encoded = encodeURIComponent(msg)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`

    const res = await fetch(url)
    const text = await res.text()

    return NextResponse.json({
      ok: true,
      callmebot: text,
      alertas: { baixo: baixo.length, vencendo: vencendo.length },
    })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}