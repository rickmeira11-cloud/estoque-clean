import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Sem sessão → login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Lê custom claims do JWT (zero queries ao banco)
  // Requer Auth Hook registrado: Authentication → Hooks → Customize Access Token
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  let claims: Record<string, unknown> = {}
  if (accessToken) {
    try {
      claims = JSON.parse(atob(accessToken.split('.')[1]))
    } catch {}
  }

  const isActive = (claims.is_active as boolean) ?? false
  const churchId = (claims.church_id as string | null) ?? null
  const userRole = (claims.user_role as string) ?? 'viewer'

  // Usuário autenticado mas ainda não aprovado pelo admin
  // /aguardando-aprovacao e /login estão fora do matcher — sem risco de loop
  if (!isActive || !churchId) {
    const url = request.nextUrl.clone()
    url.pathname = '/aguardando-aprovacao'
    return NextResponse.redirect(url)
  }

  // /admin/* exige role admin ou super_admin
  if (pathname.startsWith('/admin')) {
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/sem-acesso'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard',
    '/estoque',
    '/patrimonio',
    '/relatorios',
    '/movimentacoes',
    '/ministerios',
    '/historico',
    '/inventario',
    '/mural',
    '/nfe',
    '/trocar-senha',
    '/selecionar-igreja',
    '/admin/:path*',
  ],
}
