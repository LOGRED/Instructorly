<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:coding-conventions -->
# 코딩 컨벤션 (필수)

새로 생성하거나 수정하는 모든 `.ts` / `.tsx` 파일은 아래 규칙을 반드시 지킨다.

## 1. 들여쓰기 — 공백 4칸
- 들여쓰기는 **공백 4칸**으로 한다. 탭(tab) 금지.
- 문자열/템플릿 리터럴(백틱) 내부의 공백은 손대지 않는다(SQL·프롬프트 등 내용이 바뀜).

## 2. 함수 설명 주석 — 모든 함수에 필수
- 모든 함수 선언 바로 위에 그 함수가 **무엇을 하는지** 한국어 한 줄 주석을 단다.
- 대상: 함수 선언(`function`), 화살표 함수 상수, React 컴포넌트, 커스텀 훅, API 라우트 핸들러(`GET`/`POST`/...), 스토어 액션.
- 제외: 인라인 콜백(예: `onClick={() => ...}`)처럼 즉석에서 넘기는 익명 람다.

```ts
// 강의 목록을 DB에서 읽어 JSON으로 반환한다.
export async function GET() {
    return NextResponse.json({ courses: listCourses() });
}
```

## 3. tsx 파일 상단 설명 헤더 — 필수
- 모든 `.tsx` 파일은 **파일 최상단**에 이 파일이 무엇인지 설명하는 블록 주석을 둔다. (`.ts`도 동일하게 권장)
- `"use client"` / `"use server"` 지시문이 있으면 헤더 주석은 **그 위**에 둔다(주석은 지시문보다 앞에 와도 됨).

```tsx
/**
 * 강의 채팅 패널 — 학습자가 강의 내용에 대해 AI와 대화하는 클라이언트 컴포넌트.
 */
"use client";

import { ... } from "...";
```

## 4. 주석 언어
- 모든 설명 주석은 **한국어**로 작성한다.
<!-- END:coding-conventions -->
