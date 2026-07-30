'use client'

import { HomeIcon, MealsIcon, MineIcon, PublishIcon, TrainingIcon } from './icons'

/**
 * 底部导航。
 *
 * Phase 1 只有首页和出刊是通的。饮食 / 运动 / 我的属于 Phase 3 / 4，
 * 做成禁用占位 —— 用真的 disabled 属性（键盘不会聚焦到走不通的地方）
 * 加设计系统的 disabled 约定：45% 不透明度。
 * 不用 toast 提示「即将上线」：一个 disabled 控件本来就不该有交互反馈。
 */
export function BottomNav({ onPublish }: { onPublish: () => void }) {
  return (
    <nav className="border-divider bg-paper flex flex-none items-start justify-between border-t px-[16px] pt-[9px]">
      <NavItem label="首页" current icon={<HomeIcon />} />
      <NavItem label="饮食" upcoming icon={<MealsIcon />} />
      <NavItem label="出刊" icon={<PublishIcon />} onClick={onPublish} />
      <NavItem label="运动" upcoming icon={<TrainingIcon />} />
      <NavItem label="我的" upcoming icon={<MineIcon />} />
    </nav>
  )
}

function NavItem({
  label,
  icon,
  current = false,
  upcoming = false,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  current?: boolean
  upcoming?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={upcoming || current}
      aria-current={current ? 'page' : undefined}
      aria-label={upcoming ? `${label}（即将上线）` : label}
      onClick={onClick}
      className={[
        'flex min-h-[46px] flex-1 flex-col items-center justify-center gap-[5px] py-[7px]',
        current ? 'text-ink' : 'text-neutral-700',
        upcoming ? 'cursor-not-allowed opacity-45' : '',
        !upcoming && !current ? 'hover:text-accent active:text-accent-700' : '',
        current ? 'cursor-default' : '',
      ].join(' ')}
    >
      {icon}
      <span className="text-ds-9.5 tracking-ds-nav leading-none">{label}</span>
    </button>
  )
}
