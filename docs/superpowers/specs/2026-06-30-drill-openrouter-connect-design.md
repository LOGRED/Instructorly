# 연습/시험 AI 화면 → 실제 OpenRouter 연결 (설계)

날짜: 2026-06-30
상태: 승인됨

## 배경

강좌의 연습(`practice`)·시험(`exam`) 화면은 4개 LLM 클론(ChatGPT·Claude·Gemini·Grok)
UI를 픽셀 단위로 흉내 낸다. 현재 응답은 `lib/llm-clones.ts`의 `cannedReply()`가 만드는
키워드 매칭 가짜 텍스트이며, 클라이언트(`useFakeChat`)에서 한 글자씩 흘려 보여 준다.
OpenRouter는 AI 스튜디오·강좌 블록 생성에만 연결돼 있고 연습/시험에는 호출되지 않는다.

이 설계는 연습/시험 클론을 **실제 OpenRouter**로 연결한다. 브랜드별 실제 모델로 라우팅하고,
응답 표시는 기존 "한 글자씩 흘리기" 애니메이션을 그대로 재사용한다(전체 응답 수신 후 reveal).

## 결정 사항

- **모델 라우팅(브랜드 플래그십)**
  - chatgpt → `openai/gpt-5.5`
  - claude → `anthropic/claude-opus-4.8`
  - gemini → `google/gemini-3.5-flash`
  - grok → `x-ai/grok-4` (스튜디오 카탈로그에는 없으나 OpenRouter에서 호출 가능한 id)
- **응답 표시**: 전체 응답을 받은 뒤 기존 `setInterval` reveal로 한 글자씩 표시(실시간 SSE 아님).
- **폴백 없음**: 키 미설정·API 실패 시 canned로 떨어지지 않고 한국어 에러 메시지를 버블에 표시.
- **사용량 로깅**: 생략(데모). 추후 필요 시 `usage_log`에 추가 가능.

## 아키텍처

### 신규 서버 모듈 `lib/drill-chat.ts` (순수, 서버에서 import)
- `PROVIDER_MODEL: Record<LlmProvider, string>` — 위 매핑.
- `buildDrillSystemPrompt(provider): string` — 노인 학습자 대상 따뜻하고 쉬운 한국어 도우미
  페르소나. 짧은 문장, 쉬운 단어, 단계별 안내. provider별 가벼운 말투 차이(grok 캐주얼 등).
- `buildDrillMessages(provider, history)` — `[{system}, ...history]` 메시지 배열 생성.

### 신규 API 라우트 `app/api/drills/chat/route.ts` (POST, `runtime = "nodejs"`)
- 입력: `{ provider: LlmProvider, messages: {role, content}[] }`.
- 검증: provider 화이트리스트, messages 배열·길이 제한(예: 최근 20턴).
- `hasKey()` 거짓 → 400 + 한국어 안내.
- `buildDrillMessages` → `chatCompleteMessages({ model, messages })` 호출.
- 성공 → `{ text }`. 실패 → 500 + `orError` 기반 한국어 메시지(`{ error }`).

### 클라이언트 `_shared.tsx`
- `useFakeChat` → `useLlmChat`로 개명(시그니처·반환 동일, 4개 클론 import만 변경).
- `send(text)`:
  1. 사용자 turn 추가 + `sentCount++` + status `"thinking"`.
  2. 현재까지의 메시지 히스토리를 `{role, content}[]`로 변환해 `POST /api/drills/chat`.
  3. 응답 `text` 수신 → 빈 어시스턴트 turn 추가 → status `"streaming"` →
     기존 `setInterval`로 `chunk`자씩 reveal → 끝나면 status `"idle"` + `onReplyComplete`.
  4. 실패 → 어시스턴트 turn에 한국어 에러 문구 표시 후 `"idle"` 복귀.
- 진행 중 재전송 방지(기존 가드 유지). 언마운트 시 진행 중 fetch는 무시(취소 플래그).

### UI 라벨 정합
- claude 클론 헤더/모델칩 라벨 `Claude Sonnet 4.6` → `Claude Opus 4.8`로 갱신(매핑과 일치).

## 데이터 흐름

```
클론 textarea
  → useLlmChat.send(text)
  → POST /api/drills/chat { provider, messages(history) }
  → buildDrillMessages → chatCompleteMessages → OpenRouter
  → { text }
  → reveal 애니메이션(한 글자씩)
  → 화면 + onReplyComplete(제출 버튼 활성)
```

## 에러 처리

- 키 없음: "AI 연결이 설정되지 않았습니다. 관리자에게 문의해 주세요." (서버 400 → 클라 버블).
- API/네트워크 실패: "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." (+ 서버 로그에 원본).
- 어느 경우든 앱 크래시 없음, status `idle` 복귀로 재시도 가능.

## 보존/비변경

- 4개 클론의 UI·생성 애니메이션·방금 수정한 포커스 수정은 그대로.
- `thinkingMs/chunk/tickMs` 타이밍 옵션은 reveal 속도로 계속 사용.
- `lib/llm-clones.ts`의 `PROVIDERS`(스킨 메타)·`greetingFor`는 유지.
  `TOPICS`·`cannedReply`·`fallbackBody`·`flavor`는 미사용 → 제거(정리).

## 영향 파일

- 신규: `lib/drill-chat.ts`, `app/api/drills/chat/route.ts`
- 수정: `app/drill/[id]/_components/_shared.tsx`(훅 재작성),
  4개 클론(import 변경), `claude-clone.tsx`(라벨), `lib/llm-clones.ts`(canned 제거)

## 검증

- `npx tsc --noEmit` 통과.
- 프리뷰: 연습 드릴에서 질문 전송 → 실제 OpenRouter 응답이 한 글자씩 표시되는지 확인.
- 에러 경로: 잘못된 모델/키 제거 상황에서 한국어 에러 버블 표시 확인.
