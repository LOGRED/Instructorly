/**
 * 강의 생성 LLM 출력의 Zod 스키마(구조 강제의 단일 출처).
 *
 * 이 스키마 하나로 ① TS 타입(z.infer) ② 모델에 보낼 JSON Schema(z.toJSONSchema)
 * ③ 서버 런타임 검증을 모두 처리한다. 블럭은 프로바이더(특히 Gemini) 호환을 위해
 * "flat 객체"(type 필수 + 타입별 필드 optional)로 둔다 — discriminated union은
 * JSON Schema에서 anyOf로 풀려 일부 구조화 출력 모델이 거부하기 때문이다.
 * 타입별로 어떤 필드를 채울지는 시스템 프롬프트가 안내하고, 최종 조립은
 * lib/course-format.ts의 docToCourse가 타입별로 수행한다.
 *
 * 포터블 규격 자체는 [[course-format]](lib/course-format.ts)에 정의돼 있다.
 */
import { z } from "zod";

/** 허용 블럭 타입(course-format의 BlockType과 동일 집합). */
export const BLOCK_GEN_TYPES = [
    "heading",
    "text",
    "quote",
    "callout",
    "divider",
    "table",
    "chart",
    "image",
    "video",
    "audio",
    "llm",
    "bookmark",
] as const;

/** LLM이 작성하는 블럭 한 개 — flat 형태(type 필수, 나머지는 타입별 optional). */
export const BlockGenSchema = z.object({
    type: z.enum(BLOCK_GEN_TYPES),
    /** 가로 폭(한 줄 나란히 배치용). 미설정이면 "full". 좁은 블럭을 연속으로 두면 자동으로 한 줄에 묶인다. */
    width: z.enum(["full", "half", "third"]).optional(),
    /** heading: 1~3 */
    level: z.number().int().min(1).max(3).optional(),
    /** heading·quote·callout 본문 */
    text: z.string().optional(),
    /** text 블럭 마크다운 */
    markdown: z.string().optional(),
    /** callout 이모지 */
    emoji: z.string().optional(),
    /** image·video·audio 입력 방식 */
    mode: z.enum(["gen", "upload"]).optional(),
    /** image·video·audio·llm 프롬프트 */
    prompt: z.string().optional(),
    /** video·audio 설명 캡션 */
    caption: z.string().optional(),
    /** table 머리글(첫 행) */
    headers: z.array(z.string()).optional(),
    /** table 본문 행(행마다 칸 문자열 배열) */
    rows: z.array(z.array(z.string())).optional(),
    /** chart 종류 */
    chartKind: z.enum(["bar", "line", "pie"]).optional(),
    /** chart 제목 */
    title: z.string().optional(),
    /** chart 데이터 항목(라벨 + 숫자 값) */
    data: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
    /** bookmark 대상 URL */
    url: z.string().optional(),
    /** bookmark·heading·quote·callout 등 제목/본문 — bookmark 설명 */
    description: z.string().optional(),
    /** bookmark 사이트 이름 */
    siteName: z.string().optional(),
});

/** LLM이 작성하는 페이지 한 개. */
export const PageGenSchema = z.object({
    title: z.string(),
    blocks: z.array(BlockGenSchema),
});

/** LLM이 작성하는 강의 본문(우리 래퍼 필드 format/version은 제외 — 서버가 감싼다). */
export const CourseGenSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    authorNickname: z.string().optional(),
    pages: z.array(PageGenSchema),
});

/**
 * LLM 응답 봉투 — 채팅 답변 + 선택적 강의.
 * course가 없으면(omit) AI가 되묻는 중이라는 뜻. nullable 대신 optional을 써서
 * JSON Schema에 anyOf가 끼지 않게 한다(구조화 출력 호환).
 */
export const CourseGenResponseSchema = z.object({
    reply: z.string(),
    course: CourseGenSchema.optional(),
});

/**
 * 페이지 편집 응답 봉투 — 채팅 답변 + 선택적 "현재 페이지 한 장".
 * 채팅이 강의 전체가 아니라 "지금 보고 있는 페이지"만 만들고 고치는 단위라 page를 쓴다.
 * page가 없으면(omit) AI가 되묻는 중이라는 뜻.
 */
export const PageGenResponseSchema = z.object({
    reply: z.string(),
    page: PageGenSchema.optional(),
});

export type BlockGen = z.infer<typeof BlockGenSchema>;
export type PageGen = z.infer<typeof PageGenSchema>;
export type CourseGen = z.infer<typeof CourseGenSchema>;
export type CourseGenResponse = z.infer<typeof CourseGenResponseSchema>;
export type PageGenResponse = z.infer<typeof PageGenResponseSchema>;

/** Zod 스키마를 OpenRouter response_format(json_schema)용 JSON Schema 객체로 바꾼다. */
function toProviderJsonSchema(schema: z.ZodType): Record<string, unknown> {
    const js = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
    // $schema 키는 일부 프로바이더가 싫어해 제거한다(스키마 본문만 보낸다).
    delete js.$schema;
    return js;
}

/** 강의 전체 생성용 봉투 JSON Schema(현재는 페이지 단위로 전환 — 향후 재사용 대비 보존). */
export const COURSE_GEN_JSON_SCHEMA = toProviderJsonSchema(CourseGenResponseSchema);

/** 페이지 편집용 봉투 JSON Schema(한 번 만들어 재사용). */
export const PAGE_GEN_JSON_SCHEMA = toProviderJsonSchema(PageGenResponseSchema);
