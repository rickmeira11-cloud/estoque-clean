import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { mapMuralToEventTypeName, muralCategoriesToFetch, muralEventDate, parseMuralHour, type MuralEvent } from '@/lib/events-mural-sync'

const CHURCH_ID = '8db14705-9da8-4844-8b01-a73845297831'

const CALENDAR_URL = process.env.CALENDAR_SUPABASE_URL || ''
const CALENDAR_KEY  = process.env.CALENDAR_SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
  return Response.json({ ok: true, message: 'Sync de eventos do mural. Use POST para executar.' })
}

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET

  if (auth) {
    if (!secret || auth !== 'Bearer ' + secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else {
    const sb = await createServerClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  if (!CALENDAR_URL || !CALENDAR_KEY) {
    return NextResponse.json({ ok: false, error: 'CALENDAR_SUPABASE_URL / CALENDAR_SUPABASE_SERVICE_ROLE_KEY não configuradas' }, { status: 500 })
  }

  try {
    const calendarSb = createClient(CALENDAR_URL, CALENDAR_KEY)
    const gestoqueSb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const todayStr = new Date().toISOString().split('T')[0]

    const { data: muralRows, error: muralErr } = await calendarSb
      .from('mural_events')
      .select('id, year, month, day, text, category, hour, location')
      .in('category', muralCategoriesToFetch())
      .gt('year', 0)

    if (muralErr) {
      return NextResponse.json({ ok: false, error: 'Falha ao ler mural_events: ' + muralErr.message }, { status: 502 })
    }

    const { data: eventTypes } = await gestoqueSb
      .from('event_types')
      .select('id, name')
      .eq('church_id', CHURCH_ID)
    const typeIdByName = new Map((eventTypes || []).map((t: any) => [t.name, t.id]))

    const { data: existingEvents } = await gestoqueSb
      .from('events')
      .select('name, event_date')
      .eq('church_id', CHURCH_ID)
      .gte('event_date', todayStr)
    const existingKeys = new Set((existingEvents || []).map((e: any) => e.name + '|' + e.event_date))

    let created = 0
    let skippedCategory = 0
    let skippedNoType = 0
    let skippedPastOrInvalidDate = 0
    let skippedDuplicate = 0
    const createdByType: Record<string, number> = {}
    const nullHourEvents: { name: string; date: string }[] = []

    for (const row of (muralRows || []) as MuralEvent[]) {
      const eventDate = muralEventDate(row)
      if (!eventDate || eventDate < todayStr) { skippedPastOrInvalidDate++; continue }

      const typeName = mapMuralToEventTypeName(row.category, row.text)
      if (!typeName) { skippedCategory++; continue }

      const eventTypeId = typeIdByName.get(typeName)
      if (!eventTypeId) { skippedNoType++; continue }

      const title = row.text || typeName
      const key = title + '|' + eventDate
      if (existingKeys.has(key)) { skippedDuplicate++; continue }

      const eventTime = parseMuralHour(row.hour)
      if (!eventTime) nullHourEvents.push({ name: title, date: eventDate })

      const { error: insErr } = await gestoqueSb.from('events').insert({
        church_id: CHURCH_ID,
        name: title,
        event_date: eventDate,
        event_time: eventTime,
        event_type_id: eventTypeId,
        description: row.location ? 'Local: ' + row.location : null,
        is_active: true,
      })
      if (insErr) continue

      existingKeys.add(key)
      created++
      createdByType[typeName] = (createdByType[typeName] || 0) + 1
    }

    return NextResponse.json({
      ok: true,
      created,
      createdByType,
      skippedCategory,
      skippedNoType,
      skippedPastOrInvalidDate,
      skippedDuplicate,
      nullHourEvents,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
