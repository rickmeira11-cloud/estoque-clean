import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'

export async function POST(req: NextRequest) {
  try {
    const { title, body, url, tag, userId } = await req.json()
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    let query = sb.from('push_subscriptions').select('subscription').eq('church_id', CHURCH_ID)
    if (userId) query = query.eq('user_id', userId)
    const { data: subs } = await query
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })
    const webpush = await import('web-push')
    webpush.default.setVapidDetails(process.env.VAPID_EMAIL!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    const payload = JSON.stringify({ title, body, url: url || '/dashboard', tag })
    let sent = 0; let failed = 0
    await Promise.all(subs.map(async (s: any) => {
      try { await webpush.default.sendNotification(s.subscription, payload); sent++ }
      catch (err: any) {
        failed++
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sb.from('push_subscriptions').delete().eq('subscription', s.subscription)
        }
      }
    }))
    return NextResponse.json({ ok: true, sent, failed })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json()
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await sb.from('push_subscriptions').upsert({ church_id: CHURCH_ID, user_id: userId, subscription, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}