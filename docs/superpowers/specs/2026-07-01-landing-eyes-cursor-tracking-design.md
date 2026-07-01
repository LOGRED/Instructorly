# 랜딩 페이지 눈동자 마우스 추적 (설계)

날짜: 2026-07-01
상태: 승인됨

## 배경

`app/page.tsx` 홈 랜딩 페이지는 `public/landing-eyes.png`(눈 일러스트, 1254x1254,
투명배경) 하나를 `next/image`로 정적 렌더한다. 이 PNG는 흰자위·검은 테두리·눈동자
(검은 원+흰 하이라이트)가 전부 한 장으로 합성돼 있어 눈동자만 따로 움직일 수 없다.

이 설계는 눈동자가 마우스 포인터(모바일은 터치 위치)를 따라 움직이는 인터랙션을
추가한다.

## 결정 사항

- **이미지**: `public/landing-eyes.png`를 이미지 생성 도구로 편집해 눈동자(검은 원+
  하이라이트)를 제거한 "흰자위+테두리만" 버전으로 교체한다. 투명 배경·기존 구도·
  스타일은 유지한다. 같은 파일 경로를 덮어써 `app/page.tsx`의 참조 경로는 바뀌지
  않는다.
- **눈동자**: 이미지가 아닌 CSS로 그린다(검은 원 + 작은 흰 하이라이트). 위치는 JS로
  계산한 `transform: translate()`를 직접 DOM에 적용한다.
- **추적 범위**: 페이지 어디에서든 `mousemove`/`touchmove`를 감지해 두 눈이 항상
  포인터 쪽을 본다(호버 등 특정 영역 제한 없음).
- **리렌더 없음**: React state 대신 `ref` DOM에 직접 스타일을 적용해 마우스 이동마다
  컴포넌트가 리렌더되지 않게 한다.

## 아키텍처

### 이미지 편집
- 대상: `public/landing-eyes.png` (원본 구도 유지, 눈동자만 제거).
- 도구: 이미지 생성/편집(gpt-image). 프롬프트 요지: "이 googly-eyes 일러스트에서
  검은 눈동자와 흰 하이라이트만 지우고, 흰자위(흰색 채움 + 굵은 검은 테두리)와
  투명 배경은 그대로 유지."
- 결과 검증: 코너 알파값 0(투명), 중심부는 흰색 불투명 유지 확인(`sharp`로 픽셀
  샘플링).

### 신규 클라이언트 컴포넌트 `components/landing-eyes.tsx`
- `"use client"`. props: `className?: string` — 기존 `<Image>`에 쓰던 사이즈 클래스
  (`mb-8 h-auto w-[140px] sm:w-[176px]`)를 그대로 wrapper에 전달.
- 구조: `relative aspect-square` wrapper
  - 배경: `<Image src="/landing-eyes.png" fill alt="" />` (편집된 흰자위 이미지)
  - 눈동자 2개: 절대위치 `div`(검은 원 + 흰 하이라이트), 각각 `ref`로 참조.
- 상수 `EYES: { cx, cy, rx, ry }[]` (컨테이너 대비 %, 좌/우 눈 소켓 중심과 눈동자
  최대 이동 반경) — 프리뷰로 시각 튜닝.
- `useEffect`로 `window`에 `mousemove`/`touchmove`(passive) 리스너 등록, 언마운트 시
  해제.
- 핸들러: `requestAnimationFrame`으로 스로틀. 컨테이너 `getBoundingClientRect()` +
  `EYES` 퍼센트로 각 눈 중심의 뷰포트 좌표를 구하고, 포인터와의 각도·거리를 계산해
  `rx/ry` 타원 안으로 clamp한 오프셋을 각 눈동자 `ref.style.transform`에 적용.
- CSS: 눈동자에 `transition: transform 80ms ease-out`,
  `@media (prefers-reduced-motion: reduce)`에서 `transition: none`.

### `app/page.tsx`
- 기존 `<Image src="/landing-eyes.png" ... />` 블록을
  `<LandingEyes className="mb-8 h-auto w-[140px] sm:w-[176px]" />`로 교체.
- 그 외 레이아웃(문구, `LoginDialog`)은 변경 없음.

## 데이터 흐름

```
mousemove/touchmove (window)
  → rAF 스로틀
  → 컨테이너 rect + EYES(%) → 눈 중심 뷰포트 좌표
  → 각도/거리 계산 → 타원(rx,ry) 범위로 clamp
  → 눈동자 ref.style.transform = translate(dx, dy)
  → 화면에 즉시 반영(리렌더 없음)
```

## 에러 처리 / 엣지케이스

- SSR: `useEffect`는 클라이언트에서만 실행되므로 첫 페인트는 눈동자 중앙 고정
  (레이아웃 시프트 없음, 자연스러운 기본 상태).
- 모바일: `touchmove`도 동일 로직 처리, 터치 없을 때는 중앙 유지.
- `prefers-reduced-motion`: transform 자체는 유지(추적 기능은 살아있음), 부드러운
  전환(transition)만 제거.
- 이미지 로드 실패: 기존과 동일하게 `alt=""` 빈 대체 텍스트, 레이아웃 깨짐 없음.

## 보존 / 비변경

- 페이지 텍스트, `LoginDialog`, 반응형 사이즈 클래스(`w-[140px] sm:w-[176px]`) 그대로.
- 이미지 파일 경로(`/landing-eyes.png`) 그대로 — 편집만 하고 교체하지 않음.

## 영향 파일

- 신규: `components/landing-eyes.tsx`
- 수정: `app/page.tsx` (컴포넌트 교체), `public/landing-eyes.png` (이미지 편집)

## 검증

- `npx tsc --noEmit` 통과.
- 프리뷰: 마우스를 화면 여러 지점으로 이동시키며 두 눈동자가 각도에 맞게 따라오는지
  확인, 흰자위 밖으로 눈동자가 벗어나지 않는지 확인.
- 반응형: 모바일 뷰포트(375px)에서도 레이아웃 깨짐 없는지 확인.
