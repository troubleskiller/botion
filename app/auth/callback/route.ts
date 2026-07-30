import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Magic Link 的落地点。
 *
 * 两种模板都接：
 *   · PKCE（Supabase 现在的默认）—— 回来时带 ?code=
 *   · TokenHash（旧模板 / 自定义模板用 {{ .TokenHash }}）—— 带 ?token_hash=&type=
 * 接两种是为了少一次「登录点了没反应」的排查。
 */
const OTP_TYPES: readonly EmailOtpType[] = ['magiclink', 'signup', 'invite', 'recovery', 'email_change', 'email']

function baseUrl(request: NextRequest): string {
  // Vercel 上 nextUrl.origin 是内部地址，要用转发头还原用户看到的域名
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost !== null && process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}

function backToLogin(request: NextRequest, message: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(request)}/login?error=${encodeURIComponent(message)}`)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const providerError = params.get('error_description') ?? params.get('error')
  if (providerError !== null) {
    return backToLogin(request, providerError)
  }

  const supabase = await createClient()
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const rawType = params.get('type')

  if (code !== null) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error !== null) return backToLogin(request, error.message)
    return NextResponse.redirect(baseUrl(request))
  }

  if (tokenHash !== null) {
    const type = OTP_TYPES.find((t) => t === rawType) ?? 'magiclink'
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error !== null) return backToLogin(request, error.message)
    return NextResponse.redirect(baseUrl(request))
  }

  return backToLogin(request, '这条链接里没有登录凭据，可能已经用过或者过期了。回来重新发一条')
}
