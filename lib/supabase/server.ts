import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../env'

/**
 * 服务端的 Supabase 客户端（RSC / Server Action / Route Handler）。
 *
 * 用的是 anon key，所以 RLS 照常生效 —— 服务端渲染不等于绕过隐私边界。
 * 需要绕过 RLS 的地方（Phase 1 只有 scripts/verify-rls.mjs 的建号步骤）
 * 单独用 service role，且不在 App 的代码路径里。
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component 里不允许写 Cookie。会话刷新由 proxy.ts 负责，
          // 这里静默跳过是官方推荐做法。
        }
      },
    },
  })
}
