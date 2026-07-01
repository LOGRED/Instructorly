# 랜딩 눈 마우스 추적 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 랜딩 페이지의 눈 일러스트가 마우스(모바일은 터치) 포인터를 따라 눈동자를 움직이게 한다.

**Architecture:** `public/landing-eyes.png`을 눈동자 없는 "흰자위만" 버전으로 이미지
편집하고, 신규 클라이언트 컴포넌트 `components/landing-eyes.tsx`가 그 위에 CSS로
그린 눈동자 2개를 올려 포인터 각도에 따라 `transform: translate()`로 움직인다.
`app/page.tsx`는 기존 `<Image>` 호출을 이 컴포넌트로 교체한다.

**Tech Stack:** Next.js 16(App Router, webpack)·React 19·Tailwind v4·`next/image`.
순수 `ref` + `requestAnimationFrame` 기반 커서 추적(외부 라이브러리 없음).

**참고**: 이 저장소는 자동화 테스트 러너(jest/vitest/playwright 등)가 없다
(`package.json`에 test 스크립트 없음, `Makefile`에 test 타깃 없음). 기존
설계 문서(`docs/superpowers/specs/2026-06-30-drill-openrouter-connect-design.md`)도
`npx tsc --noEmit` + 프리뷰 수동 확인으로만 검증한다. 이 플랜도 동일하게
**tsc + 프리뷰 확인**을 "테스트" 단계로 사용한다(TDD 표준 템플릿의 pytest/jest
스텝은 이 저장소에 적용 불가).

참고 설계 문서: `docs/superpowers/specs/2026-07-01-landing-eyes-cursor-tracking-design.md`

---

### Task 1: 이미지 편집 — 눈동자 제거한 흰자위 버전

**Files:**
- Modify: `public/landing-eyes.png` (같은 경로에 덮어쓰기)

- [ ] **Step 1: 원본 확인**

원본은 1254x1254 RGBA PNG, 두 개의 겹친 타원(흰자위, 굵은 검은 테두리) 안에
검은 원(눈동자)+작은 흰 하이라이트가 이미 합성돼 있고, 배경은 알파 0(완전 투명,
코너 픽셀 `(6,248,16,0)`).

- [ ] **Step 2: 이미지 생성/편집 도구로 눈동자 제거**

`chatgpt-image` 스킬로 `public/landing-eyes.png`를 편집 입력 이미지로 사용해 아래
프롬프트로 편집:

```
이 googly-eyes 일러스트에서 검은 눈동자(검은 원)와 흰 하이라이트만 제거하고,
흰자위(흰색 채움 + 굵은 검은 테두리)와 완전히 투명한 배경은 그대로 유지해줘.
구도·비율·테두리 굵기는 원본과 동일하게.
```

결과를 `public/landing-eyes.png`에 덮어쓴다.

- [ ] **Step 3: 결과 검증(코너 투명 + 중심 불투명 + 눈동자 없음)**

Run:
```bash
node -e "
const sharp = require('sharp');
sharp('public/landing-eyes.png').raw().ensureAlpha().toBuffer({resolveWithObject:true}).then(({data, info}) => {
  const {width, height, channels} = info;
  const idx = (x,y) => (y*width+x)*channels;
  const c = idx(5,5);
  console.log('corner alpha', data[c+3]);
  console.log('size', width, height);
});
"
```
Expected: `corner alpha 0`, `size 1254 1254`. 추가로 Read 툴로 이미지를 직접
열어 눈동자(검은 원)가 사라지고 흰자위+테두리만 남았는지 육안 확인.

- [ ] **Step 4: 커밋**

```bash
git add public/landing-eyes.png
git commit -m "asset: remove baked-in pupils from landing eyes illustration"
```

---

### Task 2: `LandingEyes` 컴포넌트 — 커서 추적 눈동자

**Files:**
- Create: `components/landing-eyes.tsx`
- Modify: `app/globals.css` (파일 끝에 `.eye-pupil` 트랜지션 규칙 추가)

- [ ] **Step 1: 컴포넌트 작성**

```tsx
/**
 * 랜딩 페이지 눈 일러스트 — 눈동자가 마우스/터치 포인터를 따라 움직이는 클라이언트 컴포넌트.
 */
"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// 눈 소켓 중심(cx,cy)과 눈동자 최대 이동 반경(rx,ry) — 컨테이너 크기 대비 비율.
const EYES = [
    { cx: 0.34, cy: 0.5, rx: 0.09, ry: 0.08 },
    { cx: 0.68, cy: 0.5, rx: 0.09, ry: 0.08 },
] as const;

// 마우스/터치 포인터를 따라 두 눈동자가 움직이는 랜딩 눈 일러스트를 렌더한다.
export function LandingEyes({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pupilRefs = useRef<(HTMLDivElement | null)[]>([]);
    const rafRef = useRef<number | null>(null);
    const pointerRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // 포인터 위치를 기준으로 각 눈동자의 clamp된 이동량을 계산해 transform으로 적용한다.
        const applyPupilPositions = () => {
            rafRef.current = null;
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const { x: px, y: py } = pointerRef.current;

            EYES.forEach((eye, i) => {
                const pupil = pupilRefs.current[i];
                if (!pupil) return;
                const cx = rect.left + eye.cx * rect.width;
                const cy = rect.top + eye.cy * rect.height;
                const dx = px - cx;
                const dy = py - cy;
                const maxRx = eye.rx * rect.width;
                const maxRy = eye.ry * rect.height;
                const angle = Math.atan2(dy, dx);
                // 타원 정규화 거리(0~1)로 clamp해 눈동자가 흰자위 밖으로 나가지 않게 한다.
                const normalized = Math.min(1, Math.hypot(dx / maxRx, dy / maxRy));
                const offsetX = Math.cos(angle) * maxRx * normalized;
                const offsetY = Math.sin(angle) * maxRy * normalized;
                pupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            });
        };

        // 포인터 좌표만 기록하고 실제 DOM 반영은 rAF에서 한 번만 수행한다(리렌더 없음).
        const updatePointer = (x: number, y: number) => {
            pointerRef.current = { x, y };
            if (rafRef.current !== null) return;
            rafRef.current = requestAnimationFrame(applyPupilPositions);
        };

        const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) updatePointer(touch.clientX, touch.clientY);
        };

        window.addEventListener("mousemove", onMouseMove, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("touchmove", onTouchMove);
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div ref={containerRef} className={`relative aspect-square ${className ?? ""}`}>
            <Image
                src="/landing-eyes.png"
                alt=""
                fill
                priority
                sizes="176px"
                className="pointer-events-none select-none"
            />
            {EYES.map((eye, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        pupilRefs.current[i] = el;
                    }}
                    className="eye-pupil absolute rounded-full bg-black"
                    style={{
                        left: `${eye.cx * 100}%`,
                        top: `${eye.cy * 100}%`,
                        width: "16%",
                        height: "16%",
                        marginLeft: "-8%",
                        marginTop: "-8%",
                    }}
                >
                    <span
                        className="absolute rounded-full bg-white"
                        style={{ width: "30%", height: "30%", top: "16%", left: "54%" }}
                    />
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: `app/globals.css` 끝에 트랜지션/접근성 규칙 추가**

```css

/* 랜딩 눈동자 — 커서 추적 이동을 부드럽게, 감소된 모션 환경에서는 즉시 이동 */
.eye-pupil {
  transition: transform 80ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .eye-pupil {
    transition: none;
  }
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "landing-eyes"; echo "--- tsc done ---"`
Expected: `landing-eyes` 관련 에러 없이 `--- tsc done ---`만 출력.

- [ ] **Step 4: 커밋**

```bash
git add components/landing-eyes.tsx app/globals.css
git commit -m "feat: add cursor-tracking landing eyes component"
```

---

### Task 3: `app/page.tsx`에 적용

**Files:**
- Modify: `app/page.tsx:1-27`

- [ ] **Step 1: import 교체**

`import Image from "next/image";` 제거하고 아래로 교체:

```tsx
import { LandingEyes } from "@/components/landing-eyes";
```

- [ ] **Step 2: 렌더 블록 교체**

기존:
```tsx
            <Image
                src="/landing-eyes.png"
                alt=""
                width={220}
                height={220}
                priority
                className="mb-8 h-auto w-[140px] sm:w-[176px]"
            />
```

교체 후:
```tsx
            <LandingEyes className="mb-8 w-[140px] sm:w-[176px]" />
```

(파일 상단 헤더 주석의 "눈 일러스트" 설명 문구는 그대로 둔다 — 여전히 정확하다.)

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "page.tsx"; echo "--- tsc done ---"`
Expected: 에러 없이 `--- tsc done ---`.

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: use cursor-tracking eyes on landing page"
```

---

### Task 4: 프리뷰 검증

**Files:** 없음 (수동/브라우저 검증만)

- [ ] **Step 1: dev 서버 기동 및 홈 접속**

`preview_start`로 dev 서버 실행 후 `/`(홈) 접속.

- [ ] **Step 2: 정적 상태 확인**

`preview_screenshot`으로 초기 상태 확인 — 눈동자가 중앙 부근에 있고 레이아웃
깨짐(줄바꿈, 크기 이상) 없는지 확인.

- [ ] **Step 3: 커서 추적 확인**

`preview_eval`로 여러 지점에 `mousemove` 이벤트를 디스패치(예: 좌상단, 우하단,
중앙)한 뒤 각 시점 스크린샷 비교 — 두 눈동자가 해당 방향으로 회전하듯 이동하고
흰자위 밖으로 벗어나지 않는지 확인.

- [ ] **Step 4: 반응형 확인**

`preview_resize`(mobile, 375x812)로 전환 후 스크린샷 — 레이아웃 깨짐 없는지 확인.

- [ ] **Step 5: 콘솔 에러 확인**

`preview_console_logs`(level: error)로 런타임 에러 없는지 확인.
