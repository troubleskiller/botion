/**
 * 隐私边界自测 —— dev-spec 第 11 节验收清单的第 1、4、5、6 条。
 *
 * 开发工具，不在 App 的代码路径里。用 service role 建两个探针账号，
 * 然后以普通登录用户的身份（anon key + 真实会话）去撞每一条边界。
 *
 *   node scripts/verify-rls.mjs
 *
 * 需要 .env.local 里的三个 Supabase 变量。跑完会删掉探针账号。
 */
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile('.env.local')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON || !SERVICE) {
  console.error('缺环境变量。需要 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const PROBE_A = 'rls-probe-a@example.com'
const PROBE_B = 'rls-probe-b@example.com'
const PASSWORD = 'rls-probe-only-' + 'Aa1!'

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

let failed = 0
let passed = 0

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

function appToday(offsetDays = 0, timeZone = 'Asia/Shanghai') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t).value
  const base = Date.parse(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`)
  return new Date(base + offsetDays * 86400000).toISOString().slice(0, 10)
}

async function removeProbes() {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers 失败：${error.message}`)
    for (const u of data.users) {
      if (u.email === PROBE_A || u.email === PROBE_B) {
        await admin.auth.admin.deleteUser(u.id)
      }
    }
    if (data.users.length < 200) break
    page += 1
  }
}

async function makeProbe(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`建 ${email} 失败：${error.message}`)
  return data.user
}

async function signIn(email) {
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`${email} 登录失败：${error.message}`)
  return client
}

async function main() {
  console.log('清理旧探针账号…')
  await removeProbes()

  const a = await makeProbe(PROBE_A)
  const b = await makeProbe(PROBE_B)

  // 0004 的触发器应该已经建好档案
  const { data: profiles } = await admin.from('profiles').select('id').in('id', [a.id, b.id])
  section('建档触发器（0004）')
  check('两个账号登录后都自动有 profiles 行', (profiles ?? []).length === 2,
    `实际 ${(profiles ?? []).length} 行 —— 0004 迁移可能没跑`)

  const clientA = await signIn(PROBE_A)
  const clientB = await signIn(PROBE_B)

  const today = appToday(0)
  const yesterday = appToday(-1)

  // ── A 写一条自己的记录 ──────────────────────────────────────────────
  section('A 写入自己的记录')
  const insertA = await clientA
    .from('entries')
    .upsert({ user_id: a.id, date: today, sleep_band: 4, water_band: 3, trained: true, source: 'manual' },
      { onConflict: 'user_id,date' })
  check('A 能写自己今天的 entries', insertA.error === null, insertA.error?.message)

  await clientA.from('meals').insert({ user_id: a.id, date: today, slot: 'lunch', kcal: 680 })
  await clientA.from('workouts').insert({ user_id: a.id, date: today, kind: 'strength' })
  await clientA.from('body_photos').insert({ user_id: a.id, taken_on: today, photo_path: `body-photos/${a.id}/probe.jpg` })
  await clientA.from('meal_templates').insert({ user_id: a.id, name: '探针', items: [] })
  await clientA.from('push_subscriptions').insert({ user_id: a.id, subscription: {} })

  const ownRead = await clientA.from('entries').select('*')
  check('A 读得到自己的 entries', (ownRead.data ?? []).length === 1, ownRead.error?.message)

  // ── 验收第 1 条：第二个账号读不到第一个账号的任何一行 ─────────────────
  section('验收第 1 条 · B 读不到 A 的任何原始数据')
  for (const table of ['entries', 'meals', 'body_photos', 'workouts', 'meal_templates', 'push_subscriptions']) {
    const all = await clientB.from(table).select('*')
    check(`B 全表扫 ${table} 得到 0 行`, (all.data ?? []).length === 0,
      `拿到 ${(all.data ?? []).length} 行：${JSON.stringify(all.data)}`)

    const targeted = await clientB.from(table).select('*').eq('user_id', a.id)
    check(`B 指名读 A 的 ${table} 得到 0 行`, (targeted.data ?? []).length === 0,
      `拿到 ${(targeted.data ?? []).length} 行`)
  }

  const forge = await clientB
    .from('entries')
    .insert({ user_id: a.id, date: today, sleep_band: 1, water_band: 1, trained: false })
  check('B 不能以 A 的身份写 entries', forge.error !== null, '居然写进去了')

  const hijack = await clientB.from('profiles').update({ display_name: '被改了' }).eq('id', a.id).select()
  check('B 不能改 A 的 profiles', (hijack.data ?? []).length === 0)

  // ── 验收第 2 条：朋友视图只有派生状态 ────────────────────────────────
  section('验收第 2 条 · public_status 里没有原始数据')
  const view = await clientB.from('public_status').select('*').eq('user_id', a.id)
  const row = (view.data ?? [])[0]
  check('B 能从视图读到 A 的派生状态', row !== undefined, view.error?.message)

  if (row) {
    const allowed = ['user_id', 'display_name', 'avatar_key', 'stage', 'checked_in_today', 'state'].sort()
    const actual = Object.keys(row).sort()
    check('视图字段就是那 6 个，没多出来', JSON.stringify(actual) === JSON.stringify(allowed),
      `实际字段：${actual.join(', ')}`)
    for (const leak of ['sleep_band', 'water_band', 'trained', 'kcal', 'photo_path', 'source']) {
      check(`视图里没有 ${leak}`, !(leak in row))
    }
    check('A 的状态算成 energetic（睡 8h+ / 水充足）', row.state === 'energetic', `实际 ${row.state}`)
    check('A 今天已出刊', row.checked_in_today === true)
  }

  // ── 验收第 4 条：同一天重复出刊是更新 ────────────────────────────────
  section('验收第 4 条 · 同一天重复出刊是更新而非新增')
  const again = await clientA
    .from('entries')
    .upsert({ user_id: a.id, date: today, sleep_band: 1, water_band: 1, trained: true, source: 'manual' },
      { onConflict: 'user_id,date' })
  check('第二次 upsert 不报错', again.error === null, again.error?.message)
  const afterUpsert = await clientA.from('entries').select('*').eq('date', today)
  check('今天仍然只有 1 行', (afterUpsert.data ?? []).length === 1,
    `变成 ${(afterUpsert.data ?? []).length} 行了`)
  check('值被更新成了新的分档', (afterUpsert.data ?? [])[0]?.sleep_band === 1)

  const viewAfter = await clientB.from('public_status').select('state').eq('user_id', a.id)
  check('改成睡 <6h 后状态跟着变成 tired', (viewAfter.data ?? [])[0]?.state === 'tired',
    `实际 ${(viewAfter.data ?? [])[0]?.state}`)

  // ── 验收第 5 条：补卡只能补前一天 ────────────────────────────────────
  section('验收第 5 条 · 补卡只能补前一天')
  const makeupOk = await clientA
    .from('entries')
    .insert({ user_id: a.id, date: yesterday, sleep_band: 3, water_band: 2, trained: true })
  check('昨天可以补', makeupOk.error === null, makeupOk.error?.message)

  for (const [label, date] of [['前天', appToday(-2)], ['一周前', appToday(-7)], ['明天', appToday(1)]]) {
    const rejected = await clientA
      .from('entries')
      .insert({ user_id: a.id, date, sleep_band: 3, water_band: 2, trained: true })
    check(`${label}（${date}）被库拒绝`, rejected.error !== null, '居然写进去了')
  }

  // ── 验收第 6 条：跨过 20 次时档位从 1 跳到 2，且不回落 ─────────────────
  section('验收第 6 条 · 累计 20 次跨档，且只涨不跌')
  const stageOf = async () => {
    const r = await clientB.from('public_status').select('stage').eq('user_id', a.id)
    return (r.data ?? [])[0]?.stage
  }

  // 用 service role 补历史记录 —— RLS 的日期窗口挡的是普通用户，
  // 这里是为了造出「累计 N 次」的历史，不是绕过隐私边界
  const history = []
  for (let i = 2; i < 20; i += 1) {
    history.push({ user_id: a.id, date: appToday(-i), sleep_band: 3, water_band: 2, trained: true })
  }
  await admin.from('entries').upsert(history, { onConflict: 'user_id,date' })
  check('累计 19 次训练时还是 1 档', (await stageOf()) === 1, `实际 ${await stageOf()} 档`)

  await admin.from('entries').upsert(
    [{ user_id: a.id, date: appToday(-20), sleep_band: 3, water_band: 2, trained: true }],
    { onConflict: 'user_id,date' })
  check('第 20 次跨到 2 档', (await stageOf()) === 2, `实际 ${await stageOf()} 档`)

  // 之后全是没练的日子 —— 档位必须不动
  const idle = []
  for (let i = 21; i < 40; i += 1) {
    idle.push({ user_id: a.id, date: appToday(-i), sleep_band: 2, water_band: 2, trained: false })
  }
  await admin.from('entries').upsert(idle, { onConflict: 'user_id,date' })
  check('再加 19 天没练，档位仍是 2 档（只涨不跌）', (await stageOf()) === 2, `实际 ${await stageOf()} 档`)

  // ── 按人存的时区：库和前端必须算出同一个「今天」 ─────────────────────
  section('时区按人算 · 库里的 user_today() 与前端的 todayInZone() 一致')

  // 挑一个和东八区差得最远的时区，这样如果两边不一致一定会露馅
  const FAR = 'Pacific/Kiritimati' // UTC+14
  await admin.from('profiles').update({ time_zone: FAR }).eq('id', a.id)

  const farToday = appToday(0, FAR)
  const farTwoDaysAgo = appToday(-2, FAR)

  // 先把可能挡路的历史行清掉，免得 upsert 走成 UPDATE 混淆结论
  await admin.from('entries').delete().eq('user_id', a.id).in('date', [farToday, farTwoDaysAgo])

  const farOk = await clientA
    .from('entries')
    .insert({ user_id: a.id, date: farToday, sleep_band: 3, water_band: 2, trained: false })
  check(`改成 ${FAR} 后，该时区的今天（${farToday}）能写`, farOk.error === null,
    `${farOk.error?.message} —— 库里的 user_today() 和前端的 todayInZone() 算出来不一样`)

  const farReject = await clientA
    .from('entries')
    .insert({ user_id: a.id, date: farTwoDaysAgo, sleep_band: 3, water_band: 2, trained: false })
  check(`该时区的前天（${farTwoDaysAgo}）仍被拒绝`, farReject.error !== null, '居然写进去了')

  // 视图的 checked_in_today 也要按 A 自己的时区判
  const farView = await clientB.from('public_status').select('checked_in_today').eq('user_id', a.id)
  check(`视图按 A 自己的时区判定今日已出刊`, (farView.data ?? [])[0]?.checked_in_today === true,
    `实际 ${(farView.data ?? [])[0]?.checked_in_today}`)

  await admin.from('profiles').update({ time_zone: null }).eq('id', a.id)

  // ── anon 什么都读不到 ───────────────────────────────────────────────
  section('未登录（anon）读不到任何东西')
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  for (const table of ['entries', 'profiles', 'public_status', 'meals', 'body_photos']) {
    const r = await anon.from(table).select('*')
    check(`anon 读 ${table} 得到 0 行`, (r.data ?? []).length === 0,
      `拿到 ${(r.data ?? []).length} 行`)
  }

  console.log('\n清理探针账号…')
  await removeProbes()

  console.log(`\n${'─'.repeat(52)}`)
  console.log(`通过 ${passed} 项，失败 ${failed} 项`)
  if (failed > 0) {
    console.log('隐私边界有洞，先别往下做。')
    process.exit(1)
  }
  console.log('隐私边界全部通过。')
}

main().catch(async (err) => {
  console.error(`\n跑挂了：${err.message}`)
  try {
    await removeProbes()
  } catch {}
  process.exit(1)
})
