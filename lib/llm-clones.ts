// 실제 LLM 사이트(ChatGPT·Claude·Gemini·Grok)를 똑같이 흉내 내는 시험/연습 화면이
// 공통으로 쓰는 화면용 메타데이터(서비스 이름·모델 라벨·강조색·인사말 등). 실제 응답은
// /api/drills/chat 라우트가 OpenRouter로 생성한다. 순수 모듈("use client" 아님).

import type { LlmProvider } from "./types";

export interface ProviderMeta {
    id: LlmProvider;
    /** 사람이 읽는 서비스 이름. */
    name: string;
    /** 헤더에 보이는 모델명. */
    model: string;
    /** 강조색(브랜드). */
    accent: string;
    /** 입력창 안내 문구(placeholder). */
    placeholder: string;
    /** 빈 화면 인사말 머리. */
    greetingPrefix: string;
    /** 추가 다이얼로그에서 보여줄 한 줄 설명. */
    blurb: string;
}

// 4개 서비스의 화면용 메타데이터.
export const PROVIDERS: Record<LlmProvider, ProviderMeta> = {
    chatgpt: {
        id: "chatgpt",
        name: "ChatGPT",
        model: "ChatGPT 5.5",
        accent: "#0d0d0d",
        placeholder: "무엇이든 물어보세요",
        greetingPrefix: "무엇을 도와드릴까요?",
        blurb: "오픈AI ChatGPT 화면을 똑같이 따라 합니다. 가장 널리 쓰이는 대화형 AI예요.",
    },
    claude: {
        id: "claude",
        name: "Claude",
        model: "Claude Opus 4.8",
        accent: "#cc785c",
        placeholder: "Claude에게 무엇이든 물어보세요",
        greetingPrefix: "안녕하세요",
        blurb: "앤트로픽 Claude 화면을 똑같이 따라 합니다. 따뜻한 종이색 디자인이 특징이에요.",
    },
    gemini: {
        id: "gemini",
        name: "Gemini",
        model: "3.5 Flash",
        accent: "#1a73e8",
        placeholder: "Gemini에게 물어보기",
        greetingPrefix: "안녕하세요",
        blurb: "구글 Gemini 화면을 똑같이 따라 합니다. 반짝이는 별 모양 애니메이션이 특징이에요.",
    },
    grok: {
        id: "grok",
        name: "Grok",
        model: "Grok 4",
        accent: "#1d9bf0",
        placeholder: "무엇이든 물어보세요",
        greetingPrefix: "무엇이 궁금하세요?",
        blurb: "xAI Grok 화면을 똑같이 따라 합니다. 검정 배경의 간결한 디자인이 특징이에요.",
    },
};

export const PROVIDER_LIST: ProviderMeta[] = [
    PROVIDERS.chatgpt,
    PROVIDERS.claude,
    PROVIDERS.gemini,
    PROVIDERS.grok,
];

// 빈 화면 인사말 — 이름이 있으면 "OOO님" 형태로 붙인다.
export function greetingFor(provider: LlmProvider, name?: string): string {
    const meta = PROVIDERS[provider];
    if ((provider === "claude" || provider === "gemini") && name) {
        return `${meta.greetingPrefix}, ${name}님`;
    }
    return meta.greetingPrefix;
}
