import { Avatar } from './Avatar'
import { StateTag } from './StateBadge'
import type { PublicStatusRow } from '@/lib/types'

/**
 * 朋友横排 —— 数据只来自 public_status 视图。
 *
 * 隐私边界（dev-spec 第 11 节验收第 2 条）：横排里只有三样东西 ——
 * 小人、名字、今日状态。**没有一个数字。** 体重、体脂、卡路里、睡了几小时、
 * 喝了多少水、练了什么，一个都不出现，视图里根本查不到。
 *
 * 设计稿的标题行原本写「今日 13 人已出刊」，这里刻意改成不带数字的说法：
 * 硬验收条是「朋友横排不出现任何数字」，聚合数虽然是群体信息、也在横向
 * 滚动区之外，但同在一个分区里就够暧昧了 —— 索性一个数字都不放。
 * 社交压力靠「已有人出刊」这句话本身传达，不靠计数。
 *
 * 设计稿的判断：自己全彩满幅，朋友这一排走网点半调（.halftone），
 * 克制、成排、像版面。层级不靠尺寸硬撑。
 */
export function FriendRow({ friends }: { friends: readonly PublicStatusRow[] }) {
  const published = friends.filter((f) => f.checked_in_today).length

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-[16px]">
      <div className="flex items-baseline justify-between px-[22px]">
        <div className="flex items-baseline gap-[8px]">
          <h2 className="font-heading text-ds-17 font-semibold">朋友们</h2>
          <span className="text-ds-8.5 tracking-ds-wide text-neutral-700 uppercase">Friends</span>
        </div>
        {friends.length > 0 ? (
          <span className="text-ds-11 text-neutral-700">
            {published > 0 ? '今日已有人出刊' : '今日还没有人出刊'}
          </span>
        ) : null}
      </div>

      {friends.length === 0 ? (
        // 空状态是行动邀请，不是留白（dev-spec 第 10 节）
        <p className="text-ds-12.5 mt-[12px] px-[22px] text-neutral-800">
          这里还只有你一个人。把链接发给朋友，明天这一排就有人了。
        </p>
      ) : (
        <div className="scroll-x-clean flex min-h-0 flex-1 items-start gap-[14px] overflow-x-auto overflow-y-hidden px-[22px] pt-[12px]">
          {friends.map((friend) => (
            <FriendThumb key={friend.user_id} friend={friend} />
          ))}
        </div>
      )}
    </section>
  )
}

function FriendThumb({ friend }: { friend: PublicStatusRow }) {
  return (
    <div className="flex w-[72px] flex-none flex-col items-center">
      <div className="halftone relative h-[96px] w-full flex-none">
        <Avatar
          avatarKey={friend.avatar_key}
          stage={friend.stage}
          state={friend.state}
          /* 图像本身不承载信息 —— 名字和状态在下面的文本里，
             重复念一遍只会让读屏更啰嗦 */
          alt=""
        />
      </div>
      <div className="text-ds-12 mt-[7px] whitespace-nowrap leading-none">
        {friend.display_name}
      </div>
      <div className="mt-[6px]">
        <StateTag state={friend.state} />
      </div>
    </div>
  )
}
