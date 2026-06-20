import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']

const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  morador: ['/cadastro/moradores', '/encomendas', '/retirada'],
}

function isPathAllowed(path: string, allowedPaths: string[]) {
  return allowedPaths.some(p => path === p || path.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

  const { data: { user } } = await supabase.auth.getUser()

  if (isPublic) {
    if (user && (path.startsWith('/login') || path.startsWith('/signup'))) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo')
      const safeRedirect = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
      return NextResponse.redirect(new URL(safeRedirect, request.url))
    }
    return response
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', path + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  const role = user.app_metadata.role || 'morador'
  const restrictedPaths = ROLE_ALLOWED_PATHS[role]

  if (restrictedPaths && path !== '/' && !path.startsWith('/api/') && !isPathAllowed(path, restrictedPaths)) {
    return NextResponse.redirect(new URL(restrictedPaths[0], request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
