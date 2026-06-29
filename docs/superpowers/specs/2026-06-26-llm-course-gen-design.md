# LLM 강의 생성 (대화형) — 설계 스펙

작성일: 2026-06-26
대상: Instructorly 강의 빌더(`app/build/[id]`)

## 목표
빌더 왼쪽 아래 버튼을 누르면 작은 채팅창이 열리고, AI와 대화하면서 강의를 생성/수정한다.
지난 작업에서 만든 포터블 JSON 규격(`lib/course-format.ts`, `CourseDoc` v1)을 LLM 출력 계약으로 재사용한다.

## 확정된 결정 (사용자 승인)
1. **적용 방식: 전체 교체** — 매 턴 AI가 강의 전체를 만들어 캔버스를 통째 교체.
2. **반영 시점: 자동 적용 + 되돌리기(undo)** — 응답이 강의를 담으면 즉시 반영하고, 직전 상태를 undo 스택에 쌓아 되돌릴 수 있게 한다.
3. **미디어 블럭: 프롬프트만** — AI는 image/video/audio/llm 블럭의 구조 + 프롬프트만 쓴다. 실제 생성물은 기존 [실행] 버튼으로 사용자가 만든다.
4. **구조화 라이브러리: 네이티브 + Zod** — 기존 `lib/openrouter.ts` 유지(크레딧 과금 보존). Zod로 스키마 1개를 두고 ① TS 타입 ② 모델에 보낼 JSON Schema ③ 런타임 검증을 모두 처리. LangChain/AI SDK 미사용.
5. 모델: 기본 `google/gemini-3.5-flash` 고정(선택기는 차후). 비스트리밍. 대화는 세션 메모리(미저장).

## AI 응답 봉투(envelope)
AI는 아래 JSON 객체 **하나만** 반환한다:
```jsonc
{
  "reply": "곱셈 기초를 5페이지로 구성했어요. 더 쉽게 풀어 드릴까요?",
  "course": {            // 또는 null (되묻기/잡담일 때)
    "title": "곱셈 기초",
    "description": "...",
    "authorNickname": "",
    "pages": [
      { "title": "1. 곱셈이란?", "blocks": [
        { "type": "heading", "level": 2, "text": "곱셈이란?" },
        { "type": "text", "markdown": "..." },
        { "type": "image", "mode": "gen", "prompt": "사과 3묶음 그림, 수채화풍" }
      ] }
    ]
  }
}
```
- `course` 있으면 → `docToCourse`로 런타임 Course 변환(새 id 발급·기본값 채움) → 캔버스 교체.
- `course: null` → AI가 정보를 되묻는 중. 대화만 이어진다.

## 블럭 스키마 (Zod, flat)
프로바이더 호환을 위해 블럭은 **flat 객체**로 정의한다(`type` 필수 + 타입별 필드는 optional). 이렇게 하면
`zod-to-json-schema`가 `anyOf`/`oneOf` 없이 단일 객체 스키마를 내보내 Gemini 등 구조화 출력에서 안전하다.
타입별로 어떤 필드를 채울지는 시스템 프롬프트가 안내하고, 최종 조립은 `docToCourse`가 타입별로 수행한다.

| type | AI가 채우는 필드 |
|------|------------------|
| heading | level(1~3), text |
| text | markdown |
| quote | text |
| callout | emoji, text |
| divider | (없음) |
| image | mode(gen/upload), prompt |
| video | mode, prompt, caption |
| audio | mode, prompt, caption |
| llm | prompt |

AI는 imageUrl/output/url/seed/genMs/model 등 **생성·휘발성 필드를 쓰지 않는다**(docToCourse 기본값).

## 구조 강제 3중 안전
1. **모델단**: OpenRouter `response_format: { type:"json_schema", json_schema:{ strict:true, schema } }` (schema = Zod→JSON Schema).
2. **서버 검증**: 응답을 Zod로 `safeParse`. 실패해도 다음 단계로.
3. **관대 변환**: `docToCourse`가 빠진 필드 기본값 채우고 잘못된 블럭은 건너뜀.
모델이 json_schema 미지원이면 `json_object`로 1회 폴백(스키마는 프롬프트에 동봉).

## 데이터 흐름
1. 빌더 좌하단 둥근 버튼(`fixed bottom-6 left-6 z-40`, toc-sidebar 패턴) 토글 → 작은 채팅 패널.
2. 입력 전송 → `POST /api/studio/course` `{ messages: {role,content}[], currentCourse: CourseDoc|null, model?, userId?, userName? }`.
3. 서버:
   - `lib/course-ai.ts`가 시스템 프롬프트 구성(규격 + 블럭 필드 안내 + 현재 강의 요약).
   - `lib/openrouter.ts`의 신규 `chatCompleteMessages({ model, messages, jsonSchema })` 호출(json_schema→json_object 폴백).
   - 응답을 Zod 검증 → `{reply, course}` 추출. `recordUsage`로 크레딧 과금(category "text").
   - 반환 `{ reply, course, credits, krw, genMs, free }`.
4. 클라:
   - `reply`를 채팅에 마크다운(`components/markdown.tsx`)으로 렌더, 크레딧/시간 메타 표시.
   - `course` 있으면 `docToCourse(course, { id, createdAt })`(현재 강의 정체성 유지) → builder가 직전 course를 undo 스택에 push 후 `setCourse` → 토스트 "반영했어요 · 되돌리기 ↩".
5. **되돌리기** 버튼 → undo 스택 pop → 이전 course 복원(여러 단계).

## 추가/수정 파일
**신규**
- `lib/course-schema.ts` — Zod 스키마(flat block / page / course-gen / response envelope) + JSON Schema export(`courseGenResponseJsonSchema`).
- `lib/course-ai.ts` — 시스템 프롬프트 빌더 + 봉투 파서(`parseCourseGenReply`).
- `app/api/studio/course/route.ts` — 대화형 생성 엔드포인트.
- `app/build/[id]/_components/ai-course-chat.tsx` — 플로팅 버튼 + 패널 + 대화/적용/되돌리기.

**수정**
- `lib/openrouter.ts` — `chatCompleteMessages` 추가(기존 `chatComplete` 불변).
- `lib/api.ts` — `generateCourse()` 클라 래퍼 + 응답 타입.
- `app/build/[id]/_components/builder.tsx` — undo 스택 state + `applyGeneratedCourse`/`undoGenerated` + `<AiCourseChat/>` 마운트.

## 에러/경계
- API 키 없음(`hasKey` false) → 전송 비활성 + 안내 문구.
- AI가 유효 JSON 미반환 → 전체 텍스트를 reply로, course=null, 토스트 안내.
- `docToCourse` throw → 적용 취소, 채팅 유지, 토스트.
- 빈 강의 처리·페이지 0개 보정은 `docToCourse` 기존 로직 재사용.

## 비목표 (YAGNI)
- 스트리밍 응답, 모델 선택기, 대화 영속화, 부분 편집(증분 diff), AI의 실제 미디어 생성.
- 위는 후속 단계에서 필요 시 Vercel AI SDK 등으로 확장.
