/**
 * 강의 "현재 페이지" 편집 AI 계약 — 시스템 프롬프트 + 응답 봉투 파서.
 *
 * 채팅은 강의 전체가 아니라 "사용자가 지금 보고 있는 페이지 한 장"만 만들고 고친다.
 * 그래서 모델에는 현재 페이지의 제목·블럭과 강의 제목(맥락)을 주고, { reply, page } 를
 * 받는다. 다른 페이지는 절대 건드리지 않는다. 서버 전용 순수 모듈(DOM 없음).
 *
 * 출력 스키마는 [[course-schema]], 페이지→런타임 변환은 [[course-format]]의 docToPage.
 */
import { PageGenResponseSchema, type PageGen } from "./course-schema";

/** 대화 한 턴(시스템 메시지는 빌더가 따로 앞에 붙인다). */
export interface ChatTurn {
    role: "user" | "assistant";
    content: string;
}

/** AI에게 맥락으로 주는 현재 페이지(제목 + 블럭들). 블럭 형태는 자유(JSON으로 직렬화만). */
export interface CurrentPageContext {
    title: string;
    blocks: unknown[];
}

/** 블럭 타입별로 무엇을 채워야 하는지 LLM에 알려주는 안내문. */
const BLOCK_FIELD_GUIDE = `사용 가능한 블럭(type)과 채울 필드:
- heading: { "type":"heading", "level":1~3, "text":"제목" }
- text: { "type":"text", "markdown":"마크다운 본문(**굵게**, # 제목, - 목록 가능)" }
- quote: { "type":"quote", "text":"인용문" }
- callout: { "type":"callout", "emoji":"💡", "text":"강조할 내용" }
- divider: { "type":"divider" }
- table: { "type":"table", "headers":["열1","열2"], "rows":[["A","1"],["B","2"]] }   // headers 길이=열 수, rows의 각 행은 그 길이에 맞춤
- chart: { "type":"chart", "chartKind":"bar|line|pie", "title":"차트 제목(선택)", "data":[{"label":"1월","value":30},{"label":"2월","value":50}] }
- image: { "type":"image", "mode":"gen", "prompt":"만들 그림 설명" }   // 실제 그림은 사용자가 나중에 생성
- video: { "type":"video", "mode":"gen", "prompt":"만들 영상 설명", "caption":"자막(선택)" }
- audio: { "type":"audio", "mode":"gen", "prompt":"만들 소리 설명", "caption":"설명(선택)" }
- llm: { "type":"llm", "prompt":"학생이 AI로 풀어볼 프롬프트" }
- bookmark: { "type":"bookmark", "url":"https://example.com", "title":"링크 제목(선택)", "description":"한 줄 설명(선택)", "siteName":"사이트 이름(선택)" }   // 제목/설명/이미지는 사용자가 "불러오기"로 자동 채울 수 있음

가로 폭(선택): 모든 블럭에 "width" 를 넣어 한 줄에 나란히 둘 수 있다.
- "width":"full"(기본, 생략 가능) = 한 줄 전체, "half" = 1/2, "third" = 1/3.
- 같은 폭의 좁은 블럭(half/third)을 연속으로 두면 자동으로 한 줄에 묶인다. 예: 카드 2장은 둘 다 "half", 카드 3장은 셋 다 "third".`;

/** 현재 페이지 편집용 시스템 프롬프트를 만든다(강의 제목 + 현재 페이지 동봉). */
export function buildPageSystemPrompt(
    courseTitle: string,
    currentPage: CurrentPageContext | null,
): string {
    const base = `너는 강의의 "지금 보고 있는 페이지 한 장"을 만들고 고치는 도우미다.
사용자와 대화하며 "현재 페이지"의 제목과 블럭만 바꾼다. 다른 페이지는 절대 만들거나 건드리지 마라.

반드시 아래 JSON 객체 "하나만" 출력한다. 코드펜스(\`\`\`)나 설명 문장을 앞뒤에 붙이지 마라.
{
  "reply": "사용자에게 보여줄 짧고 친근한 한국어 답변",
  "page": { 현재 페이지 전체 또는 생략 }
}

규칙:
- 페이지를 만들거나 바꿨으면 "page"에 그 페이지 "전체"를 담는다(기존 블럭 + 바뀐 부분 모두 포함, 일부만 X).
- 더 물어볼 게 있거나 잡담이면 "page"를 생략하고 "reply"로만 대화한다.
- page 형태: { "title": "페이지 제목", "blocks": [ ...블럭... ] }
- 한 페이지는 보통 제목 1개 + 본문 블럭 몇 개로 구성한다. 너무 길게 만들지 마라.
- "강의 전체"나 "여러 페이지"를 만들어 달라고 해도, 너는 "이 페이지 한 장"만 채울 수 있다. 그럴 땐 이 페이지를 채우고, reply로 "다음 내용은 페이지를 추가해 이어가자"고 안내해라.
- 이미지/동영상/오디오/AI글(llm) 블럭은 "프롬프트만" 적는다. 실제 결과물(URL·이미지·생성된 글)은 절대 만들지 마라 — 사용자가 나중에 [실행] 버튼으로 생성한다.
- 모든 글은 학습자가 읽기 쉬운 한국어로 쓴다.

${BLOCK_FIELD_GUIDE}

지금 강의 제목: ${courseTitle || "(제목 없음)"}`;

    if (!currentPage) return base;

    // 현재 페이지를 동봉해 "더 쉽게", "이미지 추가" 같은 수정 요청을 맥락 있게 처리한다.
    const snapshot = JSON.stringify(
        { title: currentPage.title, blocks: currentPage.blocks },
        null,
        0,
    );
    return `${base}

지금 편집 중인 "현재 페이지"(이걸 기준으로 고쳐라):
${snapshot}`;
}

/** 시스템 메시지 + 대화 이력을 OpenRouter messages 배열로 만든다. */
export function buildPageMessages(
    history: ChatTurn[],
    courseTitle: string,
    currentPage: CurrentPageContext | null,
): { role: string; content: string }[] {
    return [
        { role: "system", content: buildPageSystemPrompt(courseTitle, currentPage) },
        ...history.map((t) => ({ role: t.role, content: t.content })),
    ];
}

/** 코드펜스(```json … ```)에 싸여 오면 안쪽 본문만 꺼낸다. */
function stripCodeFence(text: string): string {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return fence ? fence[1] : text;
}

/** 문자열에서 가장 바깥 중괄호 객체만 잘라낸다(앞뒤 잡소리 제거 폴백). */
function extractJsonObject(text: string): string {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    return first >= 0 && last > first ? text.slice(first, last + 1) : text;
}

/**
 * LLM 응답 텍스트를 { reply, page } 봉투로 파싱한다(매우 관대하게).
 * JSON 파싱·스키마 검증이 실패해도 가능한 한 reply를 건져내고 page는 null로 둔다.
 * page는 검증을 통과하면 PageGen, 아니면 원본 객체(있으면) — 클라이언트 docToPage가
 * 한 번 더 관대하게 받아낸다.
 */
export function parsePageGenReply(text: string): {
    reply: string;
    page: PageGen | null;
} {
    const raw = stripCodeFence(text).trim();

    let parsed: unknown = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        try {
            parsed = JSON.parse(extractJsonObject(raw));
        } catch {
            return { reply: text.trim() || "응답을 이해하지 못했어요. 다시 말씀해 주세요.", page: null };
        }
    }

    // 1순위: 스키마 검증 통과한 깔끔한 봉투.
    const ok = PageGenResponseSchema.safeParse(parsed);
    if (ok.success) {
        return { reply: ok.data.reply, page: ok.data.page ?? null };
    }

    // 2순위: 검증 실패 시 객체에서 reply/page를 최대한 건져낸다.
    const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    const reply =
        typeof obj.reply === "string" && obj.reply.trim() ? obj.reply : "페이지를 만들었어요.";
    const page =
        obj.page && typeof obj.page === "object" ? (obj.page as PageGen) : null;
    return { reply, page };
}
