#!/usr/bin/env bash
# 把游戏 Web 构建上传到服务器的 games/<slug>/，先传到临时目录再原子替换。
# 用法：scripts/upload-game.sh <slug> <构建目录>
# 需要：rsync、ssh，以及环境变量（或项目根目录 .env 中的）DEPLOY_HOST、DEPLOY_USER，可选 DEPLOY_PATH
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "用法：$0 <slug> <构建目录>" >&2
  exit 1
fi

slug="$1"
build_dir="${2%/}"

if [[ ! "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "slug 只能包含小写字母、数字和连字符：$slug" >&2
  exit 1
fi
if [[ ! -f "$build_dir/index.html" ]]; then
  echo "构建目录里没有 index.html：$build_dir" >&2
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
: "${DEPLOY_HOST:?需要设置 DEPLOY_HOST}"
: "${DEPLOY_USER:?需要设置 DEPLOY_USER}"
deploy_path="${DEPLOY_PATH:-/opt/pzc-blog}"
remote="$DEPLOY_USER@$DEPLOY_HOST"
target="$deploy_path/games/$slug"

echo "上传 $build_dir → $remote:$target"
ssh "$remote" "mkdir -p '$target.tmp'"
rsync -az --delete --info=progress2 "$build_dir/" "$remote:$target.tmp/"
ssh "$remote" "rm -rf '$target.old' && { [ -d '$target' ] && mv '$target' '$target.old' || true; } && mv '$target.tmp' '$target' && rm -rf '$target.old'"
echo "完成：/play/$slug/"
