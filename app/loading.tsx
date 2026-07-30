import { ThickThinRule } from '@/components/Rule'

/**
 * 加载态 —— dev-spec 第 10 节。
 * 报头先立住（它不依赖数据），下面留出版面的形状，不转圈。
 */
export default function Loading() {
  return (
    <main className="bg-paper min-h-dvh px-[22px] pt-safe">
      <header className="pt-[6px]">
        <div className="flex items-baseline gap-[9px]">
          <span className="font-heading text-ds-27 tracking-ds-display font-semibold">练报</span>
          <span className="text-ds-8.5 tracking-ds-kicker text-neutral-700 uppercase">
            Daily Rep
          </span>
        </div>
        <ThickThinRule />
        <div className="text-ds-11.5 pt-[6px] text-neutral-700">正在取今天这一期…</div>
      </header>

      <div className="flex gap-[6px] pt-[14px]" aria-hidden="true">
        <div className="w-[150px] flex-none pt-[12px]">
          <div className="bg-neutral-200 h-[9px] w-[56px]" />
          <div className="bg-neutral-200 mt-[9px] h-[40px] w-[104px]" />
          <div className="bg-neutral-200 mt-[26px] h-[9px] w-full" />
        </div>
        <div className="bg-neutral-200/60 h-[312px] flex-1" />
      </div>
    </main>
  )
}
