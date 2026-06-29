# Instructorly

누구나 **AI 강사**가 되는 LMS 프로토타입. 강사는 노션·스크래치처럼 블럭으로 강의를 만들고, 학생은 페이지를 넘기며 배우고 결과물을 자랑합니다.

> 임시 명칭. Next.js 16 + shadcn/ui(Base UI) 기반 프론트엔드 프로토타입.

## 핵심 기능

1. **AI 강사 훈련 LMS** — 강의를 만들고(`/build`), 페이지를 넘기며 학습(`/learn`).
2. **노인 친화 접근성** — 글자 크기 3단계(보통·크게·아주 크게) + 고대비 토글 + 밝게/어둡게. 헤더에 상시 노출, 설정은 브라우저에 저장.
3. **Pretendard** 본문 + **Geist Mono**(라벨·타이머·시각 등 "콘솔" 보이스).
4. **단순한 UX** — 큰 버튼·큰 글씨·명확한 한글, midday.ai 풍의 절제된 모노크롬 디자인.
5. **블럭 에디터** — 오른쪽 팔레트에서 **드래그**하거나 본문에서 **`/` 명령**으로 블럭 삽입(노션식 마크다운).
   - **이미지 블럭**: 프롬프트 입력 → 실행 → 실제 이미지 생성. **소요 시간(초) 표시**. 저장 시 프롬프트+생성 이미지가 그대로 보존.
   - 학생은 학습 화면에서 프롬프트를 바꿔 **다시 생성** 가능(본인 세션 한정).
   - **LLM 블럭**: 프롬프트 → 실제 텍스트 생성 + 소요 시간.
   - **스크롤이 아닌 페이지 넘김** 방식의 LMS.
6. **학생 채팅(자랑방)** — 학습 화면 오른쪽. **몇 초마다 폴링**(4초)하는 비실시간 채팅. 이미지·동영상·오디오 첨부 업로드 지원.

## 기술 스택

- **Next.js 16.2.9** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (`base-nova` 스타일 = Base UI 프리미티브)
- **better-sqlite3** (Next API Routes에 파일 기반 SQLite)
- **@dnd-kit** (블럭 드래그&드롭) · **react-markdown** · **zustand** · **next-themes** · **sonner**
- **Pretendard**(CDN) · **Geist Mono**
- **AI 생성**: [Pollinations](https://pollinations.ai) 무료 API (키 불필요)
  - 이미지: `image.pollinations.ai` → 서버에서 받아 data URL로 인라인 저장
  - 텍스트: `text.pollinations.ai`

## 실행

```bash
npm install        # 의존성 (이미 설치되어 있다면 생략)
npm run dev        # 개발 서버 → http://localhost:3000
npm run build      # 프로덕션 빌드
npm start          # 프로덕션 실행
```

> **중요 — webpack 사용**: `dev`/`build` 스크립트는 `--webpack` 플래그를 씁니다.
> 프로젝트 경로에 한글(예: `진흥원_프론트엔드_프로토타입`)이 포함되어 있으면
> Next 16 기본 번들러인 **Turbopack이 청크 이름 생성 시 패닉**(멀티바이트
> char boundary 버그)합니다. webpack은 유니코드 경로를 정상 처리합니다.
> 영문 경로로 옮기면 Turbopack도 사용 가능합니다.

## 사용 흐름

1. `/login` — 닉네임 입력 + 역할(강사/학생) 선택 (비밀번호 없음).
2. **강사**: `/courses` → "새 강의 만들기" → `/build/[id]`에서 블럭으로 제작 → 저장.
3. **학생**: `/courses` → "학습하기" → `/learn/[id]`에서 페이지를 넘기며 학습, 이미지/AI 블럭 재실행, 오른쪽 채팅.

## 주요 경로

```
app/
  page.tsx                  랜딩
  login/page.tsx            로그인(닉네임+역할)
  courses/                  강의 목록 + 생성 다이얼로그
  build/[id]/               강사 빌더 (블럭 캔버스 + 팔레트 + 슬래시)
  learn/[id]/               학생 플레이어 (페이지 넘김 + 채팅)
  api/
    courses/[id]/(chat)     강의 CRUD + 채팅
    generate/(image|text)   Pollinations 생성 (소요 ms 측정)
    upload/                 첨부 업로드 → public/uploads
components/
  blocks/                   이미지·LLM·뷰·편집 블럭, 아이콘
  course-chat.tsx           폴링 채팅 패널
  accessibility-toolbar.tsx 글자 크기·고대비·테마
lib/
  db.ts types.ts pollinations.ts api.ts blocks.ts store.ts identity.ts
```

## 데이터

- SQLite 파일: `data/maketor.db` (첫 실행 시 자동 생성 + 데모 강의 시드).
- 업로드 파일: `public/uploads/`.
- 접근성/신원: 브라우저 `localStorage`.

## 로고

브랜드 마크는 **검은 원 안의 흰색 대문자 "I"**(Instructor + ly) 모노그램. 헤더/푸터/로그인에서는 벡터 컴포넌트 `components/brand-mark.tsx`로 렌더(라이트/다크 자동 반전) + `Instructorly` 워드마크로 사용. `public/logo.png`는 동일 콘셉트의 래스터 에셋(OG·소셜·앱 아이콘용).

---

프로토타입이므로 인증·권한·동시성은 단순화되어 있습니다.
