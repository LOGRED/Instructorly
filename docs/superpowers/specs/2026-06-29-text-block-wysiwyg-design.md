# 텍스트 블럭 WYSIWYG 편집 (Tiptap)

작성일: 2026-06-29

## 목표

텍스트 블럭의 강사 편집 화면을 노션처럼 만든다. 편집 중 raw 마크다운 기호(`**`, `## ` 등)가
보이지 않고, 굵게·제목·목록이 바로 서식으로 적용돼 보인다. 저장은 기존처럼 마크다운 문자열을
유지(라운드트립)하므로 학생 보기·AI 생성·PDF 등 하위 소비자는 변경하지 않는다.

## 범위

- 대상: `components/blocks/text-block-card.tsx`의 "직접 작성"(`view === "write"`) 화면만 교체.
- 무변경: "AI 생성" 화면, 학생 읽기 전용 `<Markdown>` 렌더, `block.markdown` 저장 구조,
  `TextBlock` 타입·직렬화.

## 아키텍처

```
TextBlockCard
├─ view "write" → <RichTextEditor value={markdown} onChange={...}/>  [신규]
│                   ├ Tiptap editor (StarterKit + tiptap-markdown)
│                   ├ 고정 툴바 (굵게·기울임·제목·목록·번호목록·인용)
│                   └ BubbleMenu (텍스트 선택 시 표시)
└─ view "ai"   → 기존 그대로 (프롬프트 → block.markdown 채우고 write 뷰로 전환)
```

신규 컴포넌트 `components/blocks/rich-text-editor.tsx`:

- props: `value: string`(마크다운), `onChange: (md: string) => void`, `autoFocus?`, `placeholder?`
- 내부에서 마크다운 ↔ Tiptap 문서 변환을 캡슐화. 외부는 마크다운 문자열만 주고받는다.

## 데이터 흐름 (마크다운 라운드트립)

- 로드: `value`(마크다운) → useEditor `content`로 전달 → tiptap-markdown이 파싱.
- 편집: `onUpdate` → `editor.storage.markdown.getMarkdown()` → `onChange(md)` (디바운스).
- 외부 동기화: write↔ai 토글 시 에디터가 언마운트/리마운트되어 새 `value`로 다시 마운트되므로
  별도 sync 이펙트 없이 안전. AI 생성은 ai 뷰(에디터 언마운트 상태)에서 일어난다.

## 기능셋 (기존 6개 유지, YAGNI)

굵게 · 기울임 · 제목(h2) · 목록 · 번호목록 · 인용.
StarterKit 입력 규칙 유지 → `**`, `## `, `- ` 등 타이핑 시 자동 서식(더 노션스러움).

## 스타일

- 에디터 콘텐츠에 `maketor-prose` 클래스 적용 → 학생 보기와 동일 타이포그래피로 WYSIWYG 일치.
- 컨테이너는 기존 Textarea처럼 `border + rounded-lg`, `focus-within` 시 ring 표시.
- 고정 툴바·버블 버튼 스타일은 기존 `markdown-toolbar.tsx` 버튼 클래스 재사용.

## 패키지

`@tiptap/react@^3` · `@tiptap/starter-kit@^3` · `@tiptap/pm@^3` · `tiptap-markdown@^0.9` ·
`markdown-it-cjk-friendly@^2` (전부 Tiptap v3 호환, React 19 / Next 16 OK)

## CJK 마크다운 파싱 (구현 핵심)

tiptap-markdown 내부 markdown-it은 **CJK에 인접한 강조**(예: `**굵게**한글`)를 살리지 못한다
(`**LLM(...)**은` → `<strong>` 변환 실패, raw `**` 노출). 프로젝트 렌더러가 `remark-cjk-friendly`를
쓰는 이유와 같은 문제다. 또 `immediatelyRender:false`에서는 tiptap-markdown의 초기 content 파싱
타이밍이 어긋난다. 그래서:

- `onCreate`에서 tiptap-markdown 내부 markdown-it 인스턴스(`editor.storage.markdown.parser.md`)에
  `markdown-it-cjk-friendly` 플러그인을 주입한 뒤, 그 파서로 초기 마크다운을 `setContent` 한다.
- 직렬화(`getMarkdown`)는 영향 없음 — `**…**`를 그대로 출력하고, 학생 뷰(cjk-friendly)·에디터 모두
  동일하게 다시 읽으므로 라운드트립이 안정적이다.

## Next 16 / React 19 주의

- 컴포넌트는 클라이언트(`"use client"`), `useEditor({ immediatelyRender: false })`로 SSR 경고 방지.
- 본문은 초기 `content` 대신 `onCreate`에서 채운다(위 CJK 파싱 절차).
- 툴바 active 상태 반응성은 `useEditorState` 셀렉터로 구독(트랜잭션마다 전체 리렌더 회피).

## 정리

`components/blocks/markdown-toolbar.tsx`는 텍스트블럭에서만 쓰였으므로 교체 후 제거(미커밋 파일).

## 리스크

- tiptap-markdown 직렬화 미세 차이(`*` vs `_`, CJK 공백). 6개 기능 한정이라 영향 작음. 검증으로 확인.
- v3 BubbleMenu / useEditor API(`@tiptap/react/menus`)는 설치 후 타입 검사로 확정.

## 검증

1. `npx tsc --noEmit` 통과.
2. dev 서버 → 강사 편집: 굵게/제목/목록 라이브 적용, 버블 메뉴 표시 확인.
3. 새로고침 후 마크다운 보존 확인.
4. 학생 보기 동일 렌더 확인. preview 스크린샷.
