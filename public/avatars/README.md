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
