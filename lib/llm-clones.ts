// 실제 LLM 사이트(ChatGPT·Claude·Gemini·Grok)를 똑같이 흉내 내는 시험/연습 화면이
// 공통으로 쓰는 메타데이터와 "가짜 답변" 생성기. 외부 API에 의존하지 않고 즉시·확실하게
// 동작해야 하므로(노인 학습 데모), 답변은 프롬프트 키워드에 맞춘 한국어 canned 텍스트를
// 클라이언트에서 한 글자씩 흘려보낸다. 순수 모듈("use client" 아님).

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
        model: "Claude Sonnet 4.6",
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
        model: "Grok 4.3",
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

// ----------------------------------------------------------------------------
// 가짜 답변 생성기 — 프롬프트 키워드로 주제를 골라 한국어 답변(markdown)을 만든다.
// ----------------------------------------------------------------------------

interface Topic {
    test: (p: string) => boolean;
    body: string;
}

// 키워드별 모범 답변. 위에서부터 먼저 맞는 항목을 쓴다.
const TOPICS: Topic[] = [
    {
        test: (p) => /시\b|시를|시 써|poem|동시/.test(p),
        body: `네, 부탁하신 시를 써 봤어요.

**봄날의 마음**

창문 너머 햇살이
조용히 방으로 들어오면
나는 따뜻한 차 한 잔에
하루의 안부를 묻습니다

서두르지 않아도 괜찮아요
천천히, 천천히
봄은 늘 그렇게 오니까요

마음에 드셨길 바라요. 분위기를 바꾸거나 더 길게 써 드릴까요?`,
    },
    {
        test: (p) => /편지|감사|손주|손녀|손자|가족에게/.test(p),
        body: `따뜻한 편지를 함께 써 봤어요.

사랑하는 우리 손주에게,

할머니, 할아버지는 네가 건강하고 밝게 자라는 모습을 볼 때마다 참 행복하단다. 멀리 있어도 늘 너를 생각하고 있어. 밥 잘 챙겨 먹고, 힘든 일이 있으면 언제든 이야기하렴.

항상 응원할게. 사랑한다.

- 받는 분 이름이나 하고 싶은 말을 알려 주시면 더 어울리게 고쳐 드릴게요.`,
    },
    {
        test: (p) => /요리|레시피|만드는 법|김치|찌개|국|반찬|밥/.test(p),
        body: `간단하게 만들 수 있는 방법을 정리했어요.

**준비물**
- 주재료와 기본 양념(간장, 마늘, 파)
- 냄비 또는 프라이팬

**만드는 순서**
1. 재료를 먹기 좋은 크기로 썰어 주세요.
2. 냄비에 물을 붓고 끓기 시작하면 재료를 넣습니다.
3. 중간 불에서 10분 정도 끓이며 간을 맞춰요.
4. 마지막에 파를 넣고 한소끔 더 끓이면 완성!

천천히 따라 하시면 충분히 만드실 수 있어요. 더 자세한 양 조절도 도와드릴까요?`,
    },
    {
        test: (p) => /스마트폰|핸드폰|사진|카카오|문자|앱|설정/.test(p),
        body: `어렵지 않아요. 순서대로 천천히 해 보세요.

1. 먼저 화면 아래 또는 홈 화면에서 해당 앱을 찾아 한 번 누릅니다.
2. 처음 쓰실 때는 안내가 나오는데, **다음** 또는 **확인**을 눌러 진행하세요.
3. 글씨가 작으면 설정에서 글자 크기를 키울 수 있어요.

혹시 어떤 휴대폰(삼성/아이폰)을 쓰시는지 알려 주시면 화면에 맞춰 더 자세히 알려 드릴게요.`,
    },
    {
        test: (p) => /건강|운동|혈압|당뇨|스트레칭|걷기/.test(p),
        body: `건강을 위한 쉬운 방법을 알려 드릴게요.

- **매일 가볍게 걷기**: 하루 20~30분, 무리하지 않는 속도가 좋아요.
- **물 자주 마시기**: 조금씩 자주 드세요.
- **스트레칭**: 아침에 어깨와 목을 천천히 돌려 주세요.

무엇보다 꾸준함이 가장 중요해요. 다만 통증이 있으시면 꼭 의사 선생님과 상담하세요. 더 구체적인 운동도 알려 드릴까요?`,
    },
    {
        test: (p) => /번역|영어로|english|일본어|중국어/.test(p),
        body: `요청하신 내용을 자연스럽게 번역해 드릴게요.

원하시는 문장을 적어 주시면 영어·일본어·중국어 등으로 바꿔 드립니다. 격식 있는 표현과 편한 표현 중에서도 골라 드릴 수 있어요.

먼저 번역할 문장을 알려 주세요!`,
    },
    {
        test: (p) => /요약|정리|뭐야|설명|알려|무엇/.test(p),
        body: `질문하신 내용을 쉽게 정리해 드릴게요.

핵심만 말씀드리면, 중요한 점은 크게 세 가지예요.

1. **첫째**, 가장 기본이 되는 내용을 먼저 이해하면 쉬워요.
2. **둘째**, 어려운 용어는 익숙한 말로 바꿔서 생각해 보세요.
3. **셋째**, 천천히 한 단계씩 따라 하면 충분히 하실 수 있어요.

더 궁금한 부분을 콕 집어 물어보시면 그 부분만 깊이 설명해 드릴게요.`,
    },
];

// 주제를 못 찾았을 때 쓰는 기본 답변.
function fallbackBody(prompt: string): string {
    const short = prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;
    return `"${short}"에 대해 도와드릴게요.

좋은 질문이에요. 핵심을 정리하면 이렇게 생각해 볼 수 있어요.

1. 먼저 무엇을 하고 싶으신지 한 가지로 좁혀 보세요.
2. 그다음 가장 쉬운 첫걸음부터 시작하면 됩니다.
3. 막히는 부분이 있으면 그 부분만 다시 물어봐 주세요.

천천히 같이 해 봐요. 더 자세히 알려 드릴까요?`;
}

// 서비스별 말투를 살짝 입혀 마무리한다.
function flavor(provider: LlmProvider, body: string): string {
    switch (provider) {
        case "grok":
            return body + "\n\n😎 더 궁금한 거 있으면 편하게 물어봐요.";
        case "gemini":
            return body;
        case "claude":
            return body;
        default:
            return body;
    }
}

// 프롬프트에 대한 가짜 답변(markdown)을 만든다.
export function cannedReply(provider: LlmProvider, prompt: string): string {
    const p = prompt.trim();
    const topic = TOPICS.find((t) => t.test(p));
    const body = topic ? topic.body : fallbackBody(p);
    return flavor(provider, body);
}
