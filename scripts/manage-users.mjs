/**
 * 账号管理 —— 这个 App 没有注册入口，账号一律由你在这里建。
 *
 *   npm run users:list                     看现在有谁
 *   npm run users:add   邮箱 [显示名]        建号，打印一个随机密码
 *   npm run users:reset 邮箱 [密码]          重设密码；不给就随机生成一个
 *   npm run users:avatar 邮箱 [套系名]        指派小人；不给套系名就是查看
 *   npm run users:remove 邮箱                删号（连同他的全部记录）
 *
 * 为什么是脚本而不是页面：dev-spec 第 0 节明确不做注册引导流程，而且这是
 * 20 个人的封闭圈 —— 陌生人根本不该有入口。密码你建完发给朋友，
 * 他第一次登录时 iOS 会问要不要存进钥匙串，之后就不用再输了。
 *
 * 忘密码也走这里（users:reset），不做邮件找回 —— 那等于把 Magic Link
 * 的邮件依赖又请回来。
 *
 * 需要 .env.local 里的 SUPABASE_SERVICE_ROLE_KEY。
 */
import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { discoverSets } from './lib/avatar-sets.mjs'

process.loadEnvFile('.env.local')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE) {
  console.error('缺环境变量：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** 去掉了容易看错的 0/O、1/l/I。12 位约 59 bit 熵，够用且能一眼抄对。 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

function newPassword() {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)]
  const group = () => Array.from({ length: 4 }, pick).join('')
  return `${group()}-${group()}-${group()}`
}

async function findUser(email) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
  }
}

async function list() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(error.message)
  const { data: profiles } = await admin.from('profiles').select('id, display_name, time_zone')
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  if (data.users.length === 0) {
    console.log('还没有任何账号。用 npm run users:add 邮箱 建一个。')
    return
  }
  console.log(`共 ${data.users.length} 个账号：\n`)
  for (const u of data.users) {
    const p = byId.get(u.id)
    const seen = u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString().slice(0, 10) : '从没登录过'
    console.log(`  ${(p?.display_name ?? '(无档案)').padEnd(16)} ${u.email.padEnd(32)} 最近登录 ${seen}`)
  }
}

async function add(email, displayName) {
  if (await findUser(email)) {
    console.error(`${email} 已经存在。要改密码用 npm run users:reset ${email}`)
    process.exit(1)
  }

  const password = newPassword()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 没有邮件流程，直接标记为已验证
  })
  if (error) throw new Error(`建号失败：${error.message}`)

  // 0004 的触发器已经按邮箱前缀建好了档案，这里只在指定了名字时覆盖
  if (displayName) {
    const { error: e } = await admin
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', data.user.id)
    if (e) console.error(`（名字没改上：${e.message}）`)
  }

  const { data: p } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', data.user.id)
    .maybeSingle()

  console.log(`\n建好了。把下面这段发给 ${p?.display_name ?? email}：\n`)
  console.log(`  练报 https://botion-troubleskillers-projects.vercel.app`)
  console.log(`  邮箱：${email}`)
  console.log(`  密码：${password}\n`)
  console.log('（密码只显示这一次，没记就用 users:reset 重来一个）')
}

async function reset(email, chosen) {
  const user = await findUser(email)
  if (!user) {
    console.error(`没有 ${email} 这个账号。用 npm run users:add 建一个。`)
    process.exit(1)
  }

  if (chosen !== undefined && chosen.length < 8) {
    console.error('密码至少 8 位。')
    process.exit(1)
  }

  const password = chosen ?? newPassword()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password })
  if (error) throw new Error(`重设失败：${error.message}`)

  if (chosen === undefined) {
    console.log(`\n${email} 的新密码：${password}\n`)
  } else {
    console.log(`\n${email} 的密码已设成你指定的那个。\n`)
  }
  console.log('（旧密码立刻失效。他在其它设备上已登录的会话不受影响）')
}

/**
 * 指派小人套系。素材放 public/avatars/{key}_1..4.png，
 * 跑一次 npm run avatars:thumbs 生成缩略图，然后指给谁就是谁。
 */
async function avatar(email, key) {
  const user = await findUser(email)
  if (!user) {
    console.error(`没有 ${email} 这个账号。`)
    process.exit(1)
  }

  const { complete } = discoverSets()

  if (!key) {
    const { data: p } = await admin
      .from('profiles')
      .select('display_name, avatar_key')
      .eq('id', user.id)
      .maybeSingle()
    console.log(`${p?.display_name ?? email} 现在用的是：${p?.avatar_key}`)
    console.log(`可选的套系：${complete.join('、')}`)
    console.log(`\n改：npm run users:avatar ${email} 套系名`)
    return
  }

  if (!complete.includes(key)) {
    console.error(`没有 ${key} 这套素材，或者它四档不齐。`)
    console.error(`现有的：${complete.join('、') || '(一套都没有)'}`)
    console.error(`\n加新的：把 ${key}_1.png ... ${key}_4.png 放进 public/avatars/，`)
    console.error('规格见 public/avatars/README.md，然后跑 npm run avatars:thumbs')
    process.exit(1)
  }

  const { error } = await admin.from('profiles').update({ avatar_key: key }).eq('id', user.id)
  if (error) throw new Error(`指派失败：${error.message}`)
  console.log(`${email} 的小人换成 ${key} 了。`)
}

async function remove(email) {
  const user = await findUser(email)
  if (!user) {
    console.error(`没有 ${email} 这个账号。`)
    process.exit(1)
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw new Error(`删除失败：${error.message}`)
  console.log(`${email} 已删除，他的档案和全部打卡记录一并删掉了。`)
}

const [command, email, displayName] = process.argv.slice(2)

try {
  switch (command) {
    case 'list':
      await list()
      break
    case 'add':
      if (!email) throw new Error('用法：npm run users:add 邮箱 [显示名]')
      await add(email, displayName)
      break
    case 'reset':
      if (!email) throw new Error('用法：npm run users:reset 邮箱 [密码]')
      // 不给密码就随机生成一个；给了就用你指定的
      await reset(email, displayName)
      break
    case 'avatar':
      if (!email) throw new Error('用法：npm run users:avatar 邮箱 [套系名]')
      await avatar(email, displayName)
      break
    case 'remove':
      if (!email) throw new Error('用法：npm run users:remove 邮箱')
      await remove(email)
      break
    default:
      console.log('用法：')
      console.log('  npm run users:list')
      console.log('  npm run users:add    邮箱 [显示名]')
      console.log('  npm run users:reset  邮箱 [密码]')
      console.log('  npm run users:avatar 邮箱 [套系名]   不给套系名就是查看当前的')
      console.log('  npm run users:remove 邮箱')
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
