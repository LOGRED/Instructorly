/**
 * 연습·시험 LLM 클론의 실제 OpenRouter 연결용 서버 헬퍼.
 * provider(chatgpt·claude·gemini·grok)를 실제 모델 id로 매핑하고, 노인 학습자에게 맞춘
 * 한국어 시스템 프롬프트와 대화 메시지 배열을 만든다. 순수 모듈 — 라우트에서만 import.
 */
import type { LlmProvider } from "./types";

/** 클론별 화면에 보이는 모델 라벨(헤더·모델칩과 일치시키는 용도). */
export const PROVIDER_MODEL_LABEL: Record<LlmProvider, string> = {
    chatgpt: "ChatGPT 5.5",
    claude: "Claude Opus 4.8",
    gemini: "Gemini 3.5 Flash",
    grok: "Grok 4",
};

/** provider → 실제 OpenRouter 모델 id(브랜드 플래그십). */
export const PROVIDER_MODEL: Record<LlmProvider, string> = {
    chatgpt: "openai/gpt-5.5",
    claude: "anthropic/claude-opus-4.8",
    gemini: "google/gemini-3.5-flash",
    grok: "x-ai/grok-4",
};

/** 대화 한 턴 — 클라이언트가 보내는 형식(시스템 메시지는 서버에서 붙인다). */
export interface DrillChatTurn {
    role: "user" | "assistant";
    content: string;
}

/** 서버로 받는 메시지 배열에서 한 번에 허용하는 최근 턴 수(과금·컨텍스트 보호). */
export const MAX_HISTORY_TURNS = 20;

/** provider별 살짝 다른 말투 한 줄 — 실제 서비스 느낌을 살린다. */
function toneLine(provider: LlmProvider): string {
    switch (provider) {
        case "grok":
            return "가끔 가벼운 농담을 섞어도 좋지만, 핵심은 분명히 전달하세요.";
        case "claude":
            return "차분하고 정중한 말투로, 공감하며 답하세요.";
        case "gemini":
            return "밝고 친근한 말투로 간결하게 답하세요.";
        default:
            return "친절하고 명확한 말투로 답하세요.";
    }
}

/** 노인 학습자 대상 따뜻하고 쉬운 한국어 도우미 시스템 프롬프트를 만든다. */
export function buildDrillSystemPrompt(provider: LlmProvider): string {
    return [
        "당신은 인공지능(AI)을 처음 배우는 어르신 학습자를 돕는 한국어 도우미입니다.",
        "다음 원칙을 반드시 지키세요:",
        "- 항상 한국어로, 쉽고 또렷한 문장으로 답합니다.",
        "- 어려운 전문 용어는 피하고, 꼭 필요하면 쉬운 말로 풀어서 설명합니다.",
        "- 한 번에 너무 많은 정보를 주지 말고, 짧고 단계적으로 안내합니다.",
        "- 따뜻하고 존중하는 말투를 쓰고, 재촉하지 않습니다.",
        "- 목록이나 번호가 도움이 되면 간단한 markdown으로 정리합니다.",
        toneLine(provider),
    ].join("\n");
}

/** 시스템 프롬프트 + 대화 히스토리를 OpenRouter 메시지 배열로 합친다. */
export function buildDrillMessages(
    provider: LlmProvider,
    history: DrillChatTurn[],
): { role: string; content: string }[] {
    const trimmed = history
        .filter((t) => t.content.trim().length > 0)
        .slice(-MAX_HISTORY_TURNS);
    return [
        { role: "system", content: buildDrillSystemPrompt(provider) },
        ...trimmed.map((t) => ({ role: t.role, content: t.content })),
    ];
}
