import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: {
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
      }
    }
  }
)

async function getCallerProfile(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  const { data: { user } } = await adminClient.auth.getUser(token)
  if (!user) return null
  const { data, error } = await adminClient.from('profiles').select('role, church_id').eq('id', user.id).single()
  console.log('[api] profile:', data, 'error:', error?.message)
  return data
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const caller = await getCallerProfile(request)
    console.log('[api POST] caller:', caller)

    if (!caller) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!['super_admin', 'admin'].includes(caller.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { name, email, role, church_id } = body
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 })
    }
    // Gerar senha temporaria automatica
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!1'

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })
    console.log('[api POST] newUser:', newUser?.user?.id, 'error:', createError?.message)

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

    const { error: updateError } = await adminClient.from('profiles').update({
      name, role: role || 'operator', church_id: church_id || null, email,
    }).eq('id', newUser.user.id)
    console.log('[api POST] updateError:', updateError?.message)

    return NextResponse.json({ success: true, id: newUser.user.id })
  } catch (err: any) {
    console.log('[api POST] catch:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getCallerProfile(request)
    if (!caller) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!['super_admin', 'admin'].includes(caller.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    await adminClient.from('profiles').update({ is_active: false }).eq('id', userId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
