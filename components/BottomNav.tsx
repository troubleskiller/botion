'use client'

import Link from 'next/link'
import { HomeIcon, MealsIcon, MineIcon, PublishIcon, TrainingIcon } from './icons'

/**
 * 底部导航。
 *
 * 五项对应设计稿。哪一项通、哪一项还是占位，由下面的 READY 决定 ——
 * 加完一个页面就把它标成 true，不要留断链：一个点了 404 的入口比一个
 * 明确禁用的按钮更让人以为 App 坏了。
 *
 * 禁用态用真的 disabled 属性（键盘不会聚焦到走不通的地方）加设计系统的
 * 45% 不透明度。
 */
export type NavKey = 'home' | 'meals' | 'workouts' | 'progress'

const READY: Record<NavKey, boolean> = {
  home: true,
  meals: false,
  workouts: true,
  progress: false,
}

const HREF: Record<NavKey, string> = {
  home: '/',
  meals: '/meals',
  workouts: '/plan', // TODO 运动记录页做好后改回 /workouts，计划页从那里进
  progress: '/progress',
}

export function BottomNav({
  current,
  onPublish,
}: {
  current: NavKey
  /** 首页传进来就地开弹层；其它页面不传，点「出刊」回首页 */
  onPublish?: () => void
}) {
  return (
    <nav className="border-divider bg-paper flex flex-none items-start justify-between border-t px-[16px] pt-[9px]">
      <NavItem k="home" label="首页" current={current} icon={<HomeIcon />} />
      <NavItem k="meals" label="饮食" current={current} icon={<MealsIcon />} />

      {onPublish === undefined ? (
        <NavLink href="/" label="出刊" icon={<PublishIcon />} />
      ) : (
        <NavButton label="出刊" icon={<PublishIcon />} onClick={onPublish} />
      )}

      <NavItem k="workouts" label="运动" current={current} icon={<TrainingIcon />} />
      <NavItem k="progress" label="我的" current={current} icon={<MineIcon />} />
    </nav>
  )
}

const BASE =
  'flex min-h-[46px] flex-1 flex-col items-center justify-center gap-[5px] py-[7px]'

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-ds-9.5 tracking-ds-nav leading-none">{children}</span>
}

function NavItem({
  k,
  label,
  current,
  icon,
}: {
  k: NavKey
  label: string
  current: NavKey
  icon: React.ReactNode
}) {
  const isCurrent = k === current

  if (isCurrent) {
    return (
      <span className={`${BASE} text-ink`} aria-current="page">
        {icon}
        <Label>{label}</Label>
      </span>
    )
  }

  if (!READY[k]) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${label}（即将上线）`}
        className={`${BASE} cursor-not-allowed text-neutral-700 opacity-45`}
      >
        {icon}
        <Label>{label}</Label>
      </button>
    )
  }

  return <NavLink href={HREF[k]} label={label} icon={icon} />
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`${BASE} hover:text-accent active:text-accent-700 text-neutral-700`}
    >
      {icon}
      <Label>{label}</Label>
    </Link>
  )
}

function NavButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${BASE} hover:text-accent active:text-accent-700 text-neutral-700`}
    >
      {icon}
      <Label>{label}</Label>
    </button>
  )
}
