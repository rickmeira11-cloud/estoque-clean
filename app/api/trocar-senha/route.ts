import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const { novaSenha } = await request.json()
    if (!novaSenha || novaSenha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }
    const auth = request.headers.get('Authorization')
    if (!auth) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await adminClient.auth.getUser(token)
    if (userErr || !user) return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })

    // Trocar senha via admin sem precisar da senha atual
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, { password: novaSenha })
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    // Marcar must_change_password = false
    await adminClient.from('profiles').update({ must_change_password: false }).eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
