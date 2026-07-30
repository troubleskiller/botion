import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './lib/env'

/**
 * 每个请求刷新 Supabase 会话，并把未登录的人送去 /login。
 *
 * Next 16 把 middleware.ts 改名成了 proxy.ts，导出的函数要叫 proxy
 * 或者是 default export。
 *
 * 「在 iPhone 上添加到主屏后可以正常打开并保持登录」（第 11 节验收第 8 条）
 * 靠的就是这里：Cookie 会话每次请求都续期，独立窗口里也不会掉线。
 */
const PUBLIC_PATHS = ['/login', '/auth']

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() 而不是 getSession()：前者会向 Auth 服务核实 JWT，
  // 后者只解本地 Cookie，篡改过的 Cookie 也能过。
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (user === null && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (user !== null && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // 跳过静态资源和小人素材，别为一张 png 去核一次 JWT
    '/((?!_next/static|_next/image|favicon.ico|avatars/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
}
