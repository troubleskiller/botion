/**
 * 环境变量。缺了就在启动时炸掉，不要让页面带着 undefined 跑到一半才失败。
 *
 * NEXT_PUBLIC_* 会被 Next 在构建时按字面替换，所以这里必须写成完整的
 * process.env.NEXT_PUBLIC_XXX 表达式，不能用变量名拼出来。
 */
function required(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(`缺少环境变量 ${name}。复制 .env.local.example 成 .env.local 再填。`)
  }
  return value
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
)

export const SUPABASE_ANON_KEY = required(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
