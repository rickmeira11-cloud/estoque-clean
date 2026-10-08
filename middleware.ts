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

  // /admin/* exige role admin ou super_admin
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? ''
    if (role !== 'admin' && role !== 'super_admin') {
      const accessUrl = request.nextUrl.clone()
      accessUrl.pathname = '/sem-acesso'
      return NextResponse.redirect(accessUrl)
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
