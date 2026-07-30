#!/usr/bin/env bash
#
# 在本地 Postgres 里把四个迁移跑一遍，然后撞每一条隐私边界。
# 不需要 Supabase —— 云端项目还没建就能先验一遍 SQL。
#
#   npm run verify:sql
#
# 需要本机有 Postgres 服务在跑（createdb / psql 可用）。
# 全程在一个临时库里，跑完就删，不碰任何已有的库。
set -euo pipefail

DB="lianbao_verify_$$"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v psql >/dev/null || ! command -v createdb >/dev/null; then
  echo "找不到 psql / createdb。这个脚本需要本机装了 Postgres。"
  echo "（云端项目建好之后，用 npm run verify:rls 直接打真库。）"
  exit 1
fi

if ! pg_isready -q; then
  echo "本机 Postgres 没在跑。先启动它，或者跳过这一步。"
  exit 1
fi

cleanup() { dropdb --if-exists "$DB" 2>/dev/null || true; }
trap cleanup EXIT

echo "临时库：$DB"
createdb "$DB"

echo "── 仿制 Supabase 环境"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/verify/00_shim.sql"

echo "── 跑迁移"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "── 撞边界"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/verify/01_assert.sql" >/dev/null

echo
psql -q -d "$DB" -t -A -F'  ' -c \
  "select case when ok then '  ✓' else '  ✗' end, label, coalesce(nullif(detail,''),'') from _checks order by n"

echo
echo "────────────────────────────────────────────────────"
psql -q -d "$DB" -t -A -c \
  "select '通过 ' || count(*) filter (where ok) || ' 项，失败 ' || count(*) filter (where not ok) || ' 项' from _checks"

FAILED=$(psql -q -d "$DB" -t -A -c "select count(*) from _checks where not ok")
if [ "$FAILED" != "0" ]; then
  echo "隐私边界有洞，先别往下做。"
  exit 1
fi
echo "迁移和隐私边界全部通过（本地验证，云端仍需 npm run verify:rls 复核）。"
