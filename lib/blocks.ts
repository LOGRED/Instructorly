import type { Block, BlockType } from "./types";
import { newId } from "./id";

/** 미디어 블럭(이미지·동영상·오디오)의 입력 방식. "gen" = 프롬프트로 AI 생성, "upload" = 파일/URL 업로드. */
export type BlockMode = "gen" | "upload";

/** AI 생성 블럭의 기본 모델(강사가 바꾸기 전 초깃값). 블럭 타입별 1개씩. */
export const DEFAULT_BLOCK_MODEL: Record<
    "image" | "video" | "audio" | "llm",
    { id: string; label: string }
> = {
    llm: { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    image: { id: "google/gemini-3.1-flash-image", label: "Nano Banana 2" },
    video: { id: "google/veo-3.1-fast", label: "Veo 3.1 Fast" },
    audio: { id: "openai/gpt-audio", label: "GPT Audio" },
};

/** 팔레트 탭 분류. "ai" = 프롬프트로 AI가 생성하는 블럭, "basic" = 직접 입력·업로드하는 일반 블럭. */
export type BlockGroup = "ai" | "basic";

export interface BlockMeta {
    /** 팔레트/슬래시/드래그에서 쓰는 고유 키. 미디어는 type+mode가 달라 type만으로는 중복되므로 별도 키를 둔다. */
    key: string;
    type: BlockType;
    /** 미디어 블럭만 설정. 생성·업로드를 별도 블럭으로 분리하기 위한 고정 모드. */
    mode?: BlockMode;
    /** 팔레트 탭 분류(AI/일반). 프롬프트로 생성하는 블럭만 "ai". */
    group: BlockGroup;
    label: string;
    icon: string; // lucide-react icon name
    hint: string;
    keywords: string[];
}

/** Palette + slash-menu source of truth. Order = display order. */
export const BLOCK_META: BlockMeta[] = [
    { key: "text", type: "text", group: "basic", label: "텍스트", icon: "Type", hint: "마크다운 문단 · AI로도 작성", keywords: ["text", "글", "문단", "마크다운", "ai", "생성"] },
    { key: "heading", type: "heading", group: "basic", label: "제목", icon: "Heading", hint: "큰 제목", keywords: ["heading", "제목", "title", "h1", "h2"] },
    { key: "image-gen", type: "image", mode: "gen", group: "ai", label: "이미지 생성", icon: "Bot", hint: "프롬프트로 AI 그림을 만들어요", keywords: ["image", "이미지", "그림", "사진", "생성", "ai", "gen"] },
    { key: "image-upload", type: "image", mode: "upload", group: "basic", label: "이미지 업로드", icon: "Upload", hint: "이미지를 올리거나 AI로 생성", keywords: ["image", "이미지", "그림", "사진", "업로드", "파일", "upload", "ai", "생성"] },
    { key: "llm", type: "llm", group: "ai", label: "AI 글쓰기", icon: "PenLine", hint: "프롬프트로 글을 만들어요", keywords: ["llm", "글", "텍스트", "ai", "gpt", "질문", "작문"] },
    { key: "video-gen", type: "video", mode: "gen", group: "ai", label: "동영상 생성", icon: "Bot", hint: "프롬프트로 AI 영상을 만들어요", keywords: ["video", "동영상", "영상", "생성", "ai", "gen"] },
    { key: "video-upload", type: "video", mode: "upload", group: "basic", label: "동영상 업로드", icon: "Upload", hint: "파일·URL·유튜브 또는 AI 생성", keywords: ["video", "동영상", "영상", "업로드", "파일", "upload", "youtube", "유튜브", "url", "링크", "ai", "생성"] },
    { key: "audio-gen", type: "audio", mode: "gen", group: "ai", label: "오디오 생성", icon: "Bot", hint: "프롬프트로 AI 소리를 만들어요", keywords: ["audio", "오디오", "노래", "음악", "음성", "생성", "ai", "gen"] },
    { key: "audio-upload", type: "audio", mode: "upload", group: "basic", label: "오디오 업로드", icon: "Upload", hint: "오디오를 올리거나 AI로 생성", keywords: ["audio", "오디오", "노래", "음악", "음성", "업로드", "파일", "upload", "ai", "생성"] },
    { key: "quote", type: "quote", group: "basic", label: "인용", icon: "Quote", hint: "인용문", keywords: ["quote", "인용"] },
    { key: "callout", type: "callout", group: "basic", label: "강조 박스", icon: "Lightbulb", hint: "눈에 띄는 메모", keywords: ["callout", "강조", "박스", "팁"] },
    { key: "table", type: "table", group: "basic", label: "표", icon: "Table", hint: "행·열 표 데이터", keywords: ["table", "표", "테이블", "행", "열", "격자"] },
    { key: "chart", type: "chart", group: "basic", label: "차트", icon: "ChartColumn", hint: "막대·꺾은선·원형 그래프", keywords: ["chart", "차트", "그래프", "막대", "꺾은선", "원형", "통계"] },
    { key: "bookmark", type: "bookmark", group: "basic", label: "링크 북마크", icon: "Link", hint: "URL을 미리보기 카드로", keywords: ["bookmark", "북마크", "링크", "link", "url", "주소", "사이트", "embed", "임베드"] },
    { key: "divider", type: "divider", group: "basic", label: "구분선", icon: "Minus", hint: "가로 구분선", keywords: ["divider", "구분선", "선"] },
];

/** 블럭 칩/오버레이 라벨용 메타 조회. 미디어는 mode까지 맞춰 찾고, 없으면 type 우선 항목으로 폴백한다. */
export function blockMeta(type: BlockType, mode?: BlockMode): BlockMeta {
    if (mode) {
        const m = BLOCK_META.find((b) => b.type === type && b.mode === mode);
        if (m) return m;
    }
    return BLOCK_META.find((b) => b.type === type)!;
}

/** 팔레트 키로 메타를 찾는다(드래그 종료 시 키→메타 복원용). */
export function blockMetaByKey(key: string): BlockMeta | undefined {
    return BLOCK_META.find((b) => b.key === key);
}

/** 새 블럭을 만든다. 미디어 블럭은 생성 시 mode(gen/upload)가 고정되며 이후 토글되지 않는다. */
export function createBlock(type: BlockType, mode: BlockMode = "gen"): Block {
    const id = newId();
    switch (type) {
        case "heading":
            return { id, type, level: 2, text: "" };
        case "text":
            return { id, type, markdown: "" };
        case "quote":
            return { id, type, text: "" };
        case "callout":
            return { id, type, emoji: "💡", text: "" };
        case "divider":
            return { id, type };
        case "bookmark":
            return { id, type, url: "", title: "", description: "", image: null, favicon: null, siteName: "" };
        case "table":
            return { id, type, headers: ["항목", "값"], rows: [["", ""], ["", ""]] };
        case "chart":
            return {
                id,
                type,
                chartKind: "bar",
                title: "",
                data: [
                    { label: "1월", value: 30 },
                    { label: "2월", value: 50 },
                    { label: "3월", value: 20 },
                ],
            };
        case "image":
            return { id, type, mode, prompt: "", imageUrl: null, seed: Math.floor(Math.random() * 1_000_000), genMs: null, model: DEFAULT_BLOCK_MODEL.image.id, modelLabel: DEFAULT_BLOCK_MODEL.image.label };
        case "video":
            return { id, type, mode, prompt: "", url: "", caption: "", genMs: null, model: DEFAULT_BLOCK_MODEL.video.id, modelLabel: DEFAULT_BLOCK_MODEL.video.label };
        case "audio":
            return { id, type, mode, prompt: "", url: "", caption: "", genMs: null, model: DEFAULT_BLOCK_MODEL.audio.id, modelLabel: DEFAULT_BLOCK_MODEL.audio.label };
        case "llm":
            return { id, type, prompt: "", output: null, genMs: null, model: DEFAULT_BLOCK_MODEL.llm.id, modelLabel: DEFAULT_BLOCK_MODEL.llm.label };
    }
}
