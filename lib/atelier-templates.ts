/**
 * 창작 실습 템플릿·테마·장르 메타의 단일 진실원.
 *
 * 장르(시·동화책·에세이)별로 "골격이 잡힌" 작품 문서(AtelierDoc)를 만들어 준다. 사용자는
 * (1) 템플릿을 골라 채워진 페이지를 편집하거나, (2) 빈 작품에서 블럭으로 직접 구성한다.
 * 본문은 기존 Page/Block 체계를 그대로 쓰므로 빌더의 편집·렌더 컴포넌트를 재사용한다.
 *
 * 서버(db.ts)와 클라이언트(에디터)가 함께 import하므로 부수효과 없이 순수해야 한다
 * (newId·createBlock만 사용 — 둘 다 서버/브라우저 양쪽에서 안전).
 */

import type {
    AtelierCover,
    AtelierDoc,
    AtelierFont,
    AtelierGenre,
    AtelierPageRatio,
    AtelierTheme,
    Block,
    Page,
} from "./types";
import { createBlock, type BlockMode } from "./blocks";
import { newId } from "./id";

/** PDF·책 한 쪽의 종횡비 키(types의 AtelierPageRatio 재노출). */
export type PageRatio = AtelierPageRatio;

/** 비율 선택 UI 옵션(표시 순서). */
export const RATIO_OPTIONS: { value: PageRatio; label: string }[] = [
    { value: "a4", label: "세로 (A4)" },
    { value: "r3_4", label: "세로 (3:4)" },
    { value: "square", label: "정사각 (1:1)" },
    { value: "r4_3", label: "가로 (4:3)" },
    { value: "a4l", label: "가로 (A4)" },
];

/** 작품에 실제 적용되는 비율 — 직접 고른 값이 없으면 장르 기본값. */
export function effectiveRatio(doc: AtelierDoc): PageRatio {
    return doc.ratio ?? genreMeta(doc.genre).pageRatio;
}

/** 폰트 선택 UI 옵션(표시 순서). */
export const FONT_OPTIONS: { value: AtelierFont; label: string }[] = [
    { value: "serif", label: "명조" },
    { value: "sans", label: "고딕" },
    { value: "round", label: "둥근" },
];

/** 작품에 실제 적용되는 글꼴 — 직접 고른 값이 없으면 장르 기본값. */
export function effectiveFont(doc: AtelierDoc): AtelierFont {
    return doc.font ?? genreMeta(doc.genre).defaultFont;
}

/** 장르 표시 메타 — 라벨·아이콘·종횡비·기본 테마. */
export interface GenreMeta {
    genre: AtelierGenre;
    /** 한국어 라벨. */
    label: string;
    /** lucide-react 아이콘 이름. */
    icon: string;
    /** 한 줄 설명. */
    blurb: string;
    /** 책/PDF 한 쪽 종횡비. */
    pageRatio: PageRatio;
    /** 기본 테마 키. */
    defaultTheme: string;
    /** 기본 글꼴. */
    defaultFont: AtelierFont;
}

/** 장르 목록(생성 다이얼로그·피커 표시 순서). */
export const GENRE_LIST: GenreMeta[] = [
    { genre: "poem", label: "시", icon: "Feather", blurb: "짧은 운문 한 편을 시집처럼", pageRatio: "a4", defaultTheme: "paper", defaultFont: "serif" },
    { genre: "storybook", label: "동화책", icon: "BookOpen", blurb: "그림과 글이 어우러진 그림책", pageRatio: "square", defaultTheme: "bloom", defaultFont: "round" },
    { genre: "essay", label: "에세이", icon: "PenLine", blurb: "생각을 담은 산문 한 편", pageRatio: "a4", defaultTheme: "sky", defaultFont: "sans" },
];

/** 장르 키로 메타를 찾는다(없으면 시로 폴백). */
export function genreMeta(genre: AtelierGenre): GenreMeta {
    return GENRE_LIST.find((g) => g.genre === genre) ?? GENRE_LIST[0];
}

/** 책 색·글꼴 테마 프리셋 — 모두 hex 값(캡처 안전). */
export const ATELIER_THEMES: AtelierTheme[] = [
    { key: "paper", accent: "#b45309", coverBg: "#fdf3e3", coverText: "#4a2f17", pageBg: "#fffdf8", pageText: "#3a2c1e" },
    { key: "night", accent: "#a5b4fc", coverBg: "#1e1b3a", coverText: "#f5f3ff", pageBg: "#f7f6ff", pageText: "#2a2540" },
    { key: "bloom", accent: "#db2777", coverBg: "#ffe4ef", coverText: "#831843", pageBg: "#fffafc", pageText: "#4a223a" },
    { key: "forest", accent: "#15803d", coverBg: "#e3f7e8", coverText: "#14532d", pageBg: "#fbfffc", pageText: "#1f3d2b" },
    { key: "sky", accent: "#0369a1", coverBg: "#e2f1fb", coverText: "#0c4a6e", pageBg: "#fbfdff", pageText: "#1e3a4f" },
    { key: "ink", accent: "#374151", coverBg: "#f3f4f6", coverText: "#111827", pageBg: "#ffffff", pageText: "#1f2937" },
];

/** 테마 키로 테마를 찾는다(없으면 첫 테마). */
export function themeByKey(key: string): AtelierTheme {
    return ATELIER_THEMES.find((t) => t.key === key) ?? ATELIER_THEMES[0];
}

// ---------- 블럭/페이지 조립 헬퍼 ----------

/** 타입별 기본 블럭을 만든 뒤 일부 필드를 덮어써 한 블럭을 만든다(템플릿 작성용). */
function mk<T extends Block["type"]>(
    type: T,
    patch: Partial<Extract<Block, { type: T }>>,
    mode: BlockMode = "gen",
): Block {
    return { ...createBlock(type, mode), ...patch } as Block;
}

/** 새 id를 단 페이지 하나를 만든다. */
function page(title: string, blocks: Block[]): Page {
    return { id: newId(), title, blocks };
}

/** 표지 정보를 만든다(부분 덮어쓰기 허용). */
function cover(patch: Partial<AtelierCover> = {}): AtelierCover {
    return { title: "", subtitle: "", author: "", image: null, ...patch };
}

// ---------- 템플릿 정의 ----------

/** 한 템플릿 — 고른 즉시 채워진 작품 문서를 만들어 준다. */
export interface AtelierTemplate {
    id: string;
    genre: AtelierGenre;
    /** 한국어 라벨. */
    label: string;
    /** 한 줄 설명(미리보기). */
    blurb: string;
    /** lucide-react 아이콘 이름. */
    icon: string;
    /** 새 작품 문서를 만든다(매번 새 id). */
    build: () => AtelierDoc;
}

/** 장르 기본 테마를 적용한 표지+페이지로 작품 문서를 조립한다. */
function doc(genre: AtelierGenre, c: AtelierCover, pages: Page[]): AtelierDoc {
    return { genre, cover: c, theme: themeByKey(genreMeta(genre).defaultTheme), pages };
}

/** 전체 템플릿 카탈로그(표시 순서). */
export const ATELIER_TEMPLATES: AtelierTemplate[] = [
    // ----- 시 -----
    {
        id: "poem-lyric",
        genre: "poem",
        label: "서정시 한 편",
        blurb: "표지 + 시 한 편(연 나눔)",
        icon: "Feather",
        build: () =>
            doc(
                "poem",
                cover({ title: "제목 없는 시", subtitle: "시 한 편", author: "" }),
                [
                    page("시", [
                        mk("heading", { level: 1, text: "제목을 입력하세요" }),
                        mk("text", {
                            markdown:
                                "첫 연을 여기에 적어 보세요.\n줄을 바꾸면 그대로 시의 행이 됩니다.\n\n둘째 연도 빈 줄로 나눠 적어요.\n마음에 떠오른 장면을 짧게.",
                        }),
                        mk("quote", { text: "마지막 한 줄로 여운을 남겨 보세요." }),
                    ]),
                ],
            ),
    },
    {
        id: "poem-photo",
        genre: "poem",
        label: "사진 시",
        blurb: "그림 한 장 + 시",
        icon: "Image",
        build: () =>
            doc(
                "poem",
                cover({ title: "사진 한 장의 시", subtitle: "포토 포엠", author: "" }),
                [
                    page("그림과 시", [
                        mk("image", { prompt: "잔잔한 호수 위로 번지는 노을, 부드러운 수채화풍" }),
                        mk("text", {
                            markdown: "그림을 보고 떠오른 마음을\n짧은 시로 적어 보세요.\n\n행을 바꾸며 천천히.",
                        }),
                    ]),
                ],
            ),
    },
    // ----- 동화책 -----
    {
        id: "story-four",
        genre: "storybook",
        label: "그림동화 (4장면)",
        blurb: "표지 + 그림·글 4쪽",
        icon: "BookOpen",
        build: () =>
            doc(
                "storybook",
                cover({ title: "작은 모험 이야기", subtitle: "그림동화", author: "" }),
                [
                    page("1쪽", [
                        mk("image", { prompt: "햇살 가득한 숲속 오솔길, 따뜻한 동화 일러스트" }),
                        mk("text", { markdown: "옛날 옛적, 작은 주인공이 길을 떠났어요." }),
                    ]),
                    page("2쪽", [
                        mk("image", { prompt: "숲에서 새 친구를 만나는 장면, 귀여운 동화 일러스트" }),
                        mk("text", { markdown: "가는 길에 다정한 친구를 만났답니다." }),
                    ]),
                    page("3쪽", [
                        mk("image", { prompt: "비바람을 함께 헤쳐 나가는 장면, 동화 일러스트" }),
                        mk("text", { markdown: "어려움이 닥쳤지만 둘은 힘을 모았어요." }),
                    ]),
                    page("4쪽", [
                        mk("image", { prompt: "노을 지는 집으로 돌아오는 장면, 포근한 동화 일러스트" }),
                        mk("text", { markdown: "그렇게 무사히 집으로 돌아왔답니다. 끝." }),
                    ]),
                ],
            ),
    },
    {
        id: "story-two",
        genre: "storybook",
        label: "짧은 그림책 (2장면)",
        blurb: "표지 + 그림·글 2쪽",
        icon: "BookOpen",
        build: () =>
            doc(
                "storybook",
                cover({ title: "두 장면 이야기", subtitle: "그림책", author: "" }),
                [
                    page("1쪽", [
                        mk("image", { prompt: "이야기의 시작 장면, 밝고 따뜻한 동화 일러스트" }),
                        mk("text", { markdown: "이야기의 시작을 적어 보세요." }),
                    ]),
                    page("2쪽", [
                        mk("image", { prompt: "이야기의 마지막 장면, 포근한 동화 일러스트" }),
                        mk("text", { markdown: "이야기의 끝을 적어 보세요." }),
                    ]),
                ],
            ),
    },
    // ----- 에세이 -----
    {
        id: "essay-basic",
        genre: "essay",
        label: "기본 에세이",
        blurb: "들어가며 · 본문 · 마치며",
        icon: "PenLine",
        build: () =>
            doc(
                "essay",
                cover({ title: "나의 이야기", subtitle: "에세이", author: "" }),
                [
                    page("들어가며", [
                        mk("heading", { level: 2, text: "들어가며" }),
                        mk("text", { markdown: "이 글을 쓰게 된 계기나 떠오른 생각을 적어 보세요." }),
                    ]),
                    page("본문", [
                        mk("heading", { level: 2, text: "본문" }),
                        mk("text", {
                            markdown: "겪은 일과 그때의 감정을 차분히 풀어 보세요.\n\n구체적인 장면 하나를 떠올리면 글이 살아납니다.",
                        }),
                    ]),
                    page("마치며", [
                        mk("heading", { level: 2, text: "마치며" }),
                        mk("text", { markdown: "글을 마무리하며 든 생각이나 다짐을 적어 보세요." }),
                        mk("quote", { text: "한 문장으로 마음을 정리해 보세요." }),
                    ]),
                ],
            ),
    },
    {
        id: "essay-photo",
        genre: "essay",
        label: "사진 에세이",
        blurb: "사진과 글을 번갈아",
        icon: "Image",
        build: () =>
            doc(
                "essay",
                cover({ title: "사진과 함께한 기록", subtitle: "포토 에세이", author: "" }),
                [
                    page("1부", [
                        mk("image", { prompt: "추억이 담긴 따뜻한 풍경, 감성적인 사진풍" }),
                        mk("text", { markdown: "이 사진에 담긴 이야기를 적어 보세요." }),
                    ]),
                    page("2부", [
                        mk("image", { prompt: "또 다른 순간을 담은 장면, 감성적인 사진풍" }),
                        mk("text", { markdown: "이어지는 이야기를 적어 보세요." }),
                    ]),
                ],
            ),
    },
];

/** 한 장르의 템플릿만 추린다. */
export function templatesForGenre(genre: AtelierGenre): AtelierTemplate[] {
    return ATELIER_TEMPLATES.filter((t) => t.genre === genre);
}

/** 장르 + 템플릿 id로 작품 문서를 만든다(템플릿이 없으면 빈 작품으로 폴백). */
export function buildAtelierDoc(genre: AtelierGenre, templateId?: string): AtelierDoc {
    const tpl = ATELIER_TEMPLATES.find((t) => t.id === templateId && t.genre === genre);
    return tpl ? tpl.build() : blankAtelierDoc(genre);
}

/** 블럭으로 직접 구성하기 위한 빈 작품(표지 + 빈 페이지 1쪽). */
export function blankAtelierDoc(genre: AtelierGenre): AtelierDoc {
    const meta = genreMeta(genre);
    return doc(
        genre,
        cover({ title: "", subtitle: meta.label, author: "" }),
        [page("1쪽", [mk("text", { markdown: "" })])],
    );
}

/** 작품 문서가 비어 있는지(아직 템플릿/블럭을 고르지 않음). */
export function isDocEmpty(d: AtelierDoc | null | undefined): boolean {
    return !d || !Array.isArray(d.pages) || d.pages.length === 0;
}
