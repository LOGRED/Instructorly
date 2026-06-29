/**
 * 강의 포터블 JSON 규격(course document) — 내보내기·불러오기·LLM 생성의 단일 표준.
 *
 * 왜 별도 포맷인가:
 *   런타임 `Course`(lib/types.ts)는 DB id·생성시각·생성 텍스트·시드 같은 "그 설치본에서만
 *   의미 있는" 휘발성 필드를 품는다. 이 포맷은 그걸 걷어내고 "강의가 무엇으로 이뤄지는가"만
 *   남긴 이식 가능한 표현이다. 그래서 (1) 다른 설치본으로 옮겨도 id 충돌이 없고,
 *   (2) LLM이 직접 작성하기 쉬우며(스키마가 작고 예측 가능), (3) 버전 태그로 호환을 지킨다.
 *
 * 규격(v1):
 *   - 최상위는 { format: "instructorly.course", version: 1, ...course }.
 *   - 강의·페이지·블럭의 id는 담지 않는다(불러올 때 새로 발급해 충돌을 막는다).
 *   - 휘발성 필드 seed·genMs·createdAt·updatedAt은 담지 않는다(불러올 때 기본값).
 *   - 생성 결과물(imageUrl·output·url 등)은 선택적으로 담는다 — 있으면 라운드트립으로 보존,
 *     없으면(LLM/수작업 작성) 불러올 때 null/빈값으로 채워진다.
 *
 * 불러오기는 "관대하게": 알 수 없는 필드는 버리고, 빠진 필드는 createBlock 기본값으로 채우며,
 * 잘못된 블럭은 건너뛴다. 내보내기는 "엄격하게": 항상 위 규격 그대로 직렬화한다.
 */

import type {
    Block,
    BlockWidth,
    Course,
    CourseMaxWidth,
    HeadingBlock,
    Page,
} from "./types";
import { BLOCK_META, createBlock, type BlockMode } from "./blocks";
import { asCourseMaxWidth } from "./course-width";
import { newId } from "./id";

/** 포맷 식별 문자열(매직). 불러올 때 이 값으로 우리 강의 파일임을 알아본다. */
export const COURSE_FORMAT = "instructorly.course" as const;
/** 현재 규격 버전. 호환을 깨는 구조 변경 때만 올린다. */
export const COURSE_FORMAT_VERSION = 1 as const;

/** 유니온 멤버별로 분배 적용되는 Omit(특정 멤버에만 있는 키도 안전하게 제거). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never;

/** 포터블 블럭 — 런타임 Block에서 id·seed·genMs·lastRun(휘발성)를 뺀 표현. */
export type BlockDoc = DistributiveOmit<Block, "id" | "seed" | "genMs" | "lastRun">;

/** 포터블 페이지 — id 없이 제목과 블럭 배열만. */
export interface PageDoc {
    title: string;
    blocks: BlockDoc[];
}

/** 포터블 강의 문서 — 내보내기 결과이자 불러오기/LLM 생성의 입력 규격. */
export interface CourseDoc {
    format: typeof COURSE_FORMAT;
    version: typeof COURSE_FORMAT_VERSION;
    title: string;
    description: string;
    cover: string | null;
    authorNickname: string;
    /** 본문 가로 폭. 없으면 불러올 때 기본(3xl)으로 둔다(undefined). */
    maxWidth?: CourseMaxWidth;
    pages: PageDoc[];
    /** 내보낸 시각(ms). 메타데이터일 뿐 불러오기에 영향 없음. */
    exportedAt: number;
}

/** 유효한 블럭 타입 집합(역직렬화 검증용). */
const BLOCK_TYPES = new Set<string>(BLOCK_META.map((m) => m.type));

// ---------- 직렬화(내보내기): Course → CourseDoc ----------

/** 런타임 블럭을 포터블 블럭으로 바꾼다(id·seed·genMs·lastRun 제거, 나머지 보존). */
function blockToDoc(block: Block): BlockDoc {
    const clone = { ...block } as Record<string, unknown>;
    delete clone.id;
    delete clone.seed;
    delete clone.genMs;
    // lastRun은 학생 작업 기록 전달용 런타임 임시 필드라 포터블 문서에서 제외한다.
    delete clone.lastRun;
    return clone as BlockDoc;
}

/** 런타임 강의를 포터블 강의 문서로 직렬화한다(내보내기의 핵심). */
export function courseToDoc(course: Course): CourseDoc {
    return {
        format: COURSE_FORMAT,
        version: COURSE_FORMAT_VERSION,
        title: course.title,
        description: course.description,
        cover: course.cover,
        authorNickname: course.authorNickname,
        maxWidth: course.maxWidth,
        pages: course.pages.map((p) => ({
            title: p.title,
            blocks: p.blocks.map(blockToDoc),
        })),
        exportedAt: Date.now(),
    };
}

/** 강의를 사람이 읽기 좋은 들여쓰기 JSON 문자열로 만든다(파일 저장용). */
export function serializeCourse(course: Course): string {
    return JSON.stringify(courseToDoc(course), null, 2);
}

// ---------- 역직렬화(불러오기): unknown JSON → Course ----------

/** 값이 문자열이면 그대로, 아니면 기본값을 돌려준다(기본값이 없으면 빈 문자열). */
function asString(v: unknown, fallback: string | undefined = ""): string {
    if (typeof v === "string") return v;
    return fallback ?? "";
}

/** 값이 문자열이면 그대로, 아니면 null(생성 전 미디어/LLM 결과 표현). */
function asStringOrNull(v: unknown): string | null {
    return typeof v === "string" ? v : null;
}

/** 값이 유효한 블럭 폭이면 그대로, 아니면 undefined(=full). 알 수 없는 값은 버린다. */
function asWidth(v: unknown): BlockWidth | undefined {
    return v === "full" || v === "half" || v === "third" ? v : undefined;
}

/** 임의의 객체 하나를 유효한 런타임 Block으로 정규화한다(불가하면 null로 건너뜀). */
function normalizeBlock(raw: unknown): Block | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const type = r.type;
    if (typeof type !== "string" || !BLOCK_TYPES.has(type)) return null;

    // 미디어 블럭의 입력 방식은 gen/upload만 허용. 그 외엔 gen으로.
    const mode: BlockMode = r.mode === "upload" ? "upload" : "gen";
    // 기본값 + 새 id가 박힌 블럭을 만든 뒤, 규격이 정한 필드만 덮어쓴다.
    const base = createBlock(type as Block["type"], mode);
    // 폭은 모든 블럭 공통 필드라 타입별 분기와 무관하게 한 번만 정규화해 부착한다.
    const width = asWidth(r.width);

    const built = ((): Block => {
    switch (base.type) {
        case "heading": {
            const lv = r.level;
            const level: HeadingBlock["level"] =
                lv === 1 || lv === 2 || lv === 3 ? lv : base.level;
            return { ...base, level, text: asString(r.text) };
        }
        case "text":
            return { ...base, markdown: asString(r.markdown) };
        case "quote":
            return { ...base, text: asString(r.text) };
        case "callout":
            return { ...base, emoji: asString(r.emoji, base.emoji), text: asString(r.text) };
        case "divider":
            return base;
        case "table": {
            // headers: 문자열 배열, rows: 문자열 2차원 배열. 칸 수는 headers 길이에 맞춰 정규화.
            const headers = Array.isArray(r.headers)
                ? r.headers.map((h) => asString(h))
                : base.headers;
            const cols = Math.max(1, headers.length);
            const rowsRaw = Array.isArray(r.rows) ? r.rows : base.rows;
            const rows = rowsRaw.map((row) => {
                const cells = Array.isArray(row) ? row.map((c) => asString(c)) : [];
                // 칸 수를 머리글 길이에 맞춘다(모자라면 빈칸, 넘치면 자른다).
                return Array.from({ length: cols }, (_, i) => cells[i] ?? "");
            });
            return { ...base, headers, rows: rows.length ? rows : base.rows };
        }
        case "chart": {
            const kind = r.chartKind;
            const chartKind =
                kind === "bar" || kind === "line" || kind === "pie" ? kind : base.chartKind;
            const dataRaw = Array.isArray(r.data) ? r.data : base.data;
            const data = dataRaw
                .map((d) => {
                    const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
                    const value = typeof o.value === "number" && !Number.isNaN(o.value) ? o.value : 0;
                    return { label: asString(o.label), value };
                });
            return { ...base, chartKind, title: asString(r.title), data: data.length ? data : base.data };
        }
        case "image":
            return {
                ...base,
                prompt: asString(r.prompt),
                imageUrl: asStringOrNull(r.imageUrl),
                model: asString(r.model, base.model),
                modelLabel: asString(r.modelLabel, base.modelLabel),
            };
        case "video":
            return {
                ...base,
                prompt: asString(r.prompt),
                url: asString(r.url),
                caption: asString(r.caption),
                model: asString(r.model, base.model),
                modelLabel: asString(r.modelLabel, base.modelLabel),
            };
        case "audio":
            return {
                ...base,
                prompt: asString(r.prompt),
                url: asString(r.url),
                caption: asString(r.caption),
                model: asString(r.model, base.model),
                modelLabel: asString(r.modelLabel, base.modelLabel),
            };
        case "llm":
            return {
                ...base,
                prompt: asString(r.prompt),
                output: asStringOrNull(r.output),
                model: asString(r.model, base.model),
                modelLabel: asString(r.modelLabel, base.modelLabel),
            };
        case "bookmark":
            return {
                ...base,
                url: asString(r.url),
                title: asString(r.title),
                description: asString(r.description),
                image: asStringOrNull(r.image),
                favicon: asStringOrNull(r.favicon),
                siteName: asString(r.siteName),
            };
    }
    // 모든 블럭 타입을 위에서 처리한다. 도달 불가지만 타입상 반환을 보장한다.
    return base;
    })();

    // AI 생성 블럭(llm·image·video·audio)만 프롬프트 고정 플래그를 보존한다.
    // (locked는 좁혀진 built에 먼저 붙여야 타입이 유지된다 — 그 뒤 공통 width를 얹는다.)
    const withLock =
        r.locked === true &&
        (built.type === "llm" || built.type === "image" || built.type === "video" || built.type === "audio")
            ? { ...built, locked: true }
            : built;
    return width ? { ...withLock, width } : withLock;
}

/** 임의의 객체 하나를 유효한 런타임 Page로 정규화한다(새 id 발급). */
function normalizePage(raw: unknown): Page {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const blocksRaw = Array.isArray(r.blocks) ? r.blocks : [];
    const blocks = blocksRaw
        .map(normalizeBlock)
        .filter((b): b is Block => b !== null);
    return { id: newId(), title: asString(r.title), blocks };
}

/** 불러오기 시 강의 정체성(id·생성시각)을 호출 측이 고를 수 있게 하는 옵션. */
export interface DocToCourseOptions {
    /** 결과 강의에 쓸 id. 미지정이면 새로 발급(=새 강의로 가져오기). */
    id?: string;
    /** 결과 강의의 createdAt(ms). 미지정이면 현재 시각. */
    createdAt?: number;
}

/**
 * 임의의 JSON(우리 CourseDoc 또는 날것의 Course)을 유효한 런타임 Course로 역직렬화한다.
 * 페이지·블럭 id는 항상 새로 발급해 충돌을 막는다. 형식이 아니면 한국어 메시지로 throw.
 */
export function docToCourse(raw: unknown, opts: DocToCourseOptions = {}): Course {
    if (!raw || typeof raw !== "object") {
        throw new Error("JSON 객체가 아니에요.");
    }
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.pages)) {
        throw new Error("강의 형식이 아니에요(pages 배열이 없어요).");
    }

    const pages = r.pages.map(normalizePage);
    // 페이지가 하나도 없으면 빈 1페이지를 보장(빌더는 최소 1페이지 가정).
    if (pages.length === 0) {
        pages.push({ id: newId(), title: "1페이지", blocks: [] });
    }

    const now = Date.now();
    return {
        id: opts.id ?? newId(),
        title: asString(r.title, "가져온 강의"),
        description: asString(r.description),
        cover: asStringOrNull(r.cover),
        authorNickname: asString(r.authorNickname),
        maxWidth: asCourseMaxWidth(r.maxWidth),
        pages,
        createdAt: opts.createdAt ?? now,
        updatedAt: now,
    };
}

/**
 * 포터블 페이지(또는 부분/AI 작성 JSON) 하나를 유효한 런타임 Page로 변환한다.
 * 블럭은 createBlock 기본값으로 채워 항상 유효하게 만들고, opts.id를 주면 기존 페이지
 * id를 그대로 유지한다(현재 페이지를 제자리에서 교체할 때 사용). AI 페이지 편집에 쓴다.
 */
export function docToPage(raw: unknown, opts: { id?: string } = {}): Page {
    const p = normalizePage(raw);
    return opts.id ? { ...p, id: opts.id } : p;
}

// ---------- 브라우저 입출력 헬퍼(클릭 핸들러에서만 호출) ----------

/** 강의를 .json 파일로 내려받게 한다(브라우저). 파일명은 제목 기반. */
export function downloadCourseJson(course: Course): void {
    const json = serializeCourse(course);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseFileSlug(course.title)}.course.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** 업로드한 파일을 읽어 Course로 변환한다(파싱 실패 시 throw). */
export async function readCourseFile(
    file: File,
    opts: DocToCourseOptions = {},
): Promise<Course> {
    const text = await file.text();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("JSON을 읽을 수 없어요(파일이 손상됐을 수 있어요).");
    }
    return docToCourse(parsed, opts);
}

/** 파일명에 못 쓰는 문자를 걸러 안전한 슬러그를 만든다(한글은 유지). */
function courseFileSlug(title: string): string {
    const cleaned = title
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50);
    return cleaned || "course";
}
