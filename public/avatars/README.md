# 小人素材

需要 8 个文件，直接放在这个目录下：

```
you_1.png     you_2.png     you_3.png     you_4.png
friend_1.png  friend_2.png  friend_3.png  friend_4.png
```

规格（dev-spec 第 8 节）：

- 512 × 1024，PNG，透明背景
- 角色高度固定 921px
- 基线 y = 973
- 四档已对齐 —— 切换档位时角色的头顶和脚底不会移动

`you_*` 是首页主位（自己），全彩满幅。
`friend_*` 是朋友横排，前端会套 `.halftone` 网点半调处理。

档位对应累计训练次数：1 档 0–19 次，2 档 20–59，3 档 60–119，4 档 120+。

## 为什么只有两套

`profiles.avatar_key` 是按人存的（0004 迁移里默认建成 `friend`），
但目前只有 you / friend 两套图。所以：

- 首页自己的主位固定读 `you_{stage}.png`（`lib/avatars.ts` 的 `SELF_AVATAR_KEY`）
- 朋友横排读各自 profile 的 `avatar_key`

以后有了逐人素材，把每个 profile 的 `avatar_key` 改成对应的前缀就行，
代码不用动。

## 核对几何

```bash
npm run verify:avatars
```

会把每张图的 alpha 通道扫一遍量出不透明像素的外框，核对画布尺寸、
角色高度、基线位置，以及**四档之间头顶 y 和脚底 y 是否一致**
（dev-spec 第 11 节验收第 7 条）。1px 的错位肉眼看不出来，这个脚本看得出来。

## 真素材还没到位时

```bash
npm run avatars:placeholder
```

生成 8 张几何完全合规的占位图，好让界面能跑起来看版面。
**这批图不是能交付的东西** —— 真素材来了直接覆盖同名文件。
仓库里默认不带占位图，就是为了避免忘了替换。
