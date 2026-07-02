#!/usr/bin/env bash
# 가이드 섹션 아이콘(라인아트) 일괄 생성 스크립트.
# chatgpt-image 스킬 경로(codex exec, gpt-image-2)로 "얇은 검정 선·내부 채움 없음·투명 배경" 아이콘을 만든다.
# 사용법:
#   scripts/gen-line-icons.sh            # 전체 17개 생성
#   scripts/gen-line-icons.sh start      # 'start' 하나만 (테스트)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_DIR="$ROOT/public/guide/icons"
mkdir -p "$ICON_DIR"

CODEX=/Applications/Codex.app/Contents/Resources/codex
[ -x "$CODEX" ] || CODEX=codex

FILTER="${1:-}"

# 모든 아이콘이 같은 화풍을 갖도록 공통 스타일 지시문(접두/접미)을 고정한다.
PREFIX="a minimalist, premium line-art icon of "
SUFFIX=". Drawn with smooth, uniform, clearly-visible MEDIUM-BOLD pure-black outline strokes ONLY (stroke weight roughly 2.5% of the icon width — confident and even, like a 24px stroke on a 1000px canvas). Hollow line art: absolutely NO fill, no solid black areas, no color, no orange, no grey, no shading, no gradient, no drop shadow. Rounded stroke caps and joins, one single consistent stroke weight throughout, clean geometric elegant high-end app-icon look that stays legible when shrunk small. Single icon centered in frame with generous even empty padding on all sides. The background MUST be fully transparent (RGBA PNG with a real alpha channel) — NOT white, NOT any solid color. Flat front view, no perspective."

# 파일이름 → 그릴 대상(subject) 매핑. 섹션 의미에 맞춘 한 가지 사물.
names=(start create-course invite weeks builder blocks ai posts announcements drills atelier roster progress studio settings chat player)
subjects=(
  "a graduation cap / mortarboard with a hanging tassel"
  "a file folder with a small plus (+) sign on it"
  "a paper airplane in flight"
  "a calendar grid with a few day cells"
  "a sheet of paper document with a pencil writing on it"
  "three stacked rounded blocks / layers"
  "a magic wand with a few sparkle stars around its tip"
  "a document page with horizontal text lines"
  "a megaphone / bullhorn"
  "a single dumbbell"
  "a feather quill pen"
  "a small group of three people (heads and shoulders)"
  "a bar chart of three rising bars with a small upward trend arrow"
  "a computer monitor screen with a single sparkle star (creative AI studio)"
  "a gear / cog wheel"
  "a rounded speech / chat bubble"
  "an open book"
)

DONE_DIR="$ICON_DIR/.done"
mkdir -p "$DONE_DIR"

# 단일 아이콘을 생성하고(흰 배경) 투명 라인아트 PNG로 변환·저장한다.
gen_one() {
  local name="$1" subject="$2"
  local out="$ICON_DIR/$name.png"
  # 이미 끝낸 아이콘은 건너뛴다(긴 배치가 중간에 죽어도 이어서 진행 가능).
  if [ -f "$DONE_DIR/$name" ]; then
    echo "↷ skip [$name] (already done)"
    return 0
  fi
  local prompt="Use your built-in image generation tool to generate exactly one image: ${PREFIX}${subject}${SUFFIX}. Do not write or run any code."
  echo "▶ [$name] generating…"
  "$CODEX" exec --skip-git-repo-check --enable image_generation "$prompt" < /dev/null > "/tmp/codex-$name.log" 2>&1
  # codex 로그의 session id로 정확한 출력 폴더를 찾는다(경합 없음·결정적).
  local sid img
  sid=$(awk -F': ' '/^session id:/{print $2}' "/tmp/codex-$name.log" | tr -d '[:space:]')
  img=$(ls -t "$HOME/.codex/generated_images/$sid"/ig_*.png 2>/dev/null | head -1)
  if [ -z "$img" ] || [ ! -f "$img" ]; then
    echo "✗ [$name] no image produced — see /tmp/codex-$name.log"
    return 1
  fi
  # 흰 배경 → 투명(명도→알파). 검정 선만 남긴다.
  if ! node "$ROOT/scripts/png-line-to-alpha.cjs" "$img" "$out" > /dev/null 2>&1; then
    echo "✗ [$name] alpha transform failed"
    return 1
  fi
  local alpha dims
  alpha=$(sips -g hasAlpha "$out" 2>/dev/null | awk '/hasAlpha/{print $2}')
  dims=$(sips -g pixelWidth -g pixelHeight "$out" 2>/dev/null | awk '/pixel/{printf "%s ", $2}')
  touch "$DONE_DIR/$name"
  echo "✓ [$name] saved → $out  (alpha=$alpha dims=${dims})"
}

count=0
for i in "${!names[@]}"; do
  n="${names[$i]}"
  [ -n "$FILTER" ] && [ "$n" != "$FILTER" ] && continue
  gen_one "$n" "${subjects[$i]}"
  count=$((count+1))
done
echo "── done: $count icon(s) ──"
