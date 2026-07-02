// Shared domain types for Instructorly.
// The whole lecture document (pages + blocks) is stored as JSON, so these
// types are the single source of truth for both the builder and the player.

export type Role = "instructor" | "student";

export type BlockType =
    | "heading"
    | "text"
    | "quote"
    | "callout"
    | "divider"
    | "table"
    | "chart"
    | "image"
    | "video"
    | "audio"
    | "llm"
    | "bookmark";

/** 블럭의 가로 폭 — 한 줄에 블럭을 나란히 놓기 위한 칸 너비.
 *  "full" = 한 줄 전체(기본), "half" = 1/2, "third" = 1/3.
 *  미설정(undefined)은 "full"과 같다.
 *
 *  ⚠️ 한 줄 묶기 규칙(연속한 좁은 블럭을 자동으로 한 줄에 채움)은
 *  lib/block-layout.ts의 groupBlocksIntoRows 한 곳에서만 결정한다. 나중에
 *  노션식 컬럼 컨테이너(방법 A)로 넘어갈 때도 그 함수만 바꾸면 된다. */
export type BlockWidth = "full" | "half" | "third";

export interface BlockBase {
    id: string;
    type: BlockType;
    /** 가로 폭(한 줄 나란히 배치용). 미설정이면 "full". 모든 블럭 타입 공통. */
    width?: BlockWidth;
}

export interface HeadingBlock extends BlockBase {
    type: "heading";
    level: 1 | 2 | 3;
    text: string;
}

export interface TextBlock extends BlockBase {
    type: "text";
    markdown: string;
}

export interface QuoteBlock extends BlockBase {
    type: "quote";
    text: string;
}

export interface CalloutBlock extends BlockBase {
    type: "callout";
    emoji: string;
    text: string;
}

export interface DividerBlock extends BlockBase {
    type: "divider";
}

export interface TableBlock extends BlockBase {
    type: "table";
    /** 표 머리글(첫 행). 칸 수는 이 길이가 기준이 된다. */
    headers: string[];
    /** 표 본문 — 행마다 칸 문자열 배열. 칸 수는 headers 길이에 맞춘다. */
    rows: string[][];
}

export interface ChartBlock extends BlockBase {
    type: "chart";
    /** 차트 종류 — 막대·꺾은선·원형. */
    chartKind: "bar" | "line" | "pie";
    /** 차트 제목(선택). */
    title: string;
    /** 데이터 항목 — 라벨과 숫자 값의 쌍. */
    data: { label: string; value: number }[];
}

export interface ImageBlock extends BlockBase {
    type: "image";
    /** "gen" = 프롬프트로 AI 생성, "upload" = 파일/URL 업로드. 미설정이면 "gen". */
    mode?: "gen" | "upload";
    prompt: string;
    imageUrl: string | null; // data URL or remote URL once generated
    seed: number;
    genMs: number | null; // generation time in milliseconds
    /** 강사가 이 블럭에 잠근 OpenRouter 이미지 모델 id. 미설정이면 기본 모델. */
    model?: string;
    /** 표시용 모델 이름(예: "Nano Banana 2"). */
    modelLabel?: string;
    /** 강사가 프롬프트를 고정했는지. true면 학생은 프롬프트 수정·실행 불가, 강사가 만든 결과만 본다. */
    locked?: boolean;
    /** 직전 생성 비용(런타임 전용·저장 안 함). 학생 작업 기록에 크레딧을 싣기 위한 임시 필드. */
    lastRun?: RunCost;
}

export interface VideoBlock extends BlockBase {
    type: "video";
    /** "gen" = 프롬프트로 AI 생성, "upload" = 파일/URL 업로드. 미설정이면 "gen". */
    mode?: "gen" | "upload";
    prompt?: string; // AI 생성 모드에서 사용
    url: string;
    caption: string;
    genMs?: number | null; // 생성 소요 시간(ms)
    /** 강사가 이 블럭에 잠근 OpenRouter 동영상 모델 id. 미설정이면 기본 모델. */
    model?: string;
    /** 표시용 모델 이름(예: "Veo 3.1 Fast"). */
    modelLabel?: string;
    /** 강사가 프롬프트를 고정했는지. true면 학생은 프롬프트 수정·실행 불가, 강사가 만든 결과만 본다. */
    locked?: boolean;
    /** 직전 생성 비용(런타임 전용·저장 안 함). 학생 작업 기록에 크레딧을 싣기 위한 임시 필드. */
    lastRun?: RunCost;
}

export interface AudioBlock extends BlockBase {
    type: "audio";
    /** "gen" = 프롬프트로 AI 생성, "upload" = 파일/URL 업로드. 미설정이면 "gen". */
    mode?: "gen" | "upload";
    prompt?: string; // AI 생성 모드에서 사용
    url: string;
    caption: string;
    genMs?: number | null; // 생성 소요 시간(ms)
    /** 강사가 이 블럭에 잠근 OpenRouter 오디오 모델 id. 미설정이면 기본 모델. */
    model?: string;
    /** 표시용 모델 이름(예: "GPT Audio"). */
    modelLabel?: string;
    /** 강사가 프롬프트를 고정했는지. true면 학생은 프롬프트 수정·실행 불가, 강사가 만든 결과만 본다. */
    locked?: boolean;
    /** 직전 생성 비용(런타임 전용·저장 안 함). 학생 작업 기록에 크레딧을 싣기 위한 임시 필드. */
    lastRun?: RunCost;
}

export interface LlmBlock extends BlockBase {
    type: "llm";
    prompt: string;
    output: string | null;
    genMs: number | null;
    /** 강사가 이 블럭에 잠근 OpenRouter 텍스트 모델 id. 미설정이면 기본 모델. */
    model?: string;
    /** 표시용 모델 이름(예: "GPT-5.5"). */
    modelLabel?: string;
    /** 강사가 프롬프트를 고정했는지. true면 학생은 프롬프트 수정·실행 불가, 강사가 만든 결과만 본다. */
    locked?: boolean;
    /** 직전 생성 비용(런타임 전용·저장 안 함). 학생 작업 기록에 크레딧을 싣기 위한 임시 필드. */
    lastRun?: RunCost;
}

/** 링크 북마크 블럭 — 외부 URL을 노션 스타일 프리뷰 카드로 보여 준다. 제목·설명·
  *  대표 이미지·파비콘은 입력 시 서버가 Open Graph 메타를 긁어 채운다(없으면 폴백 UI). */
export interface BookmarkBlock extends BlockBase {
    type: "bookmark";
    /** 북마크 대상 URL(필수 입력). */
    url: string;
    /** 페이지 제목(og:title 또는 <title>). 메타 로드 전엔 빈 문자열. */
    title: string;
    /** 한 줄 설명(og:description). */
    description: string;
    /** 대표 이미지 URL(og:image). 없으면 null — 카드는 썸네일 없이 그린다. */
    image: string | null;
    /** 사이트 파비콘 URL. 없으면 null. */
    favicon: string | null;
    /** 사이트 이름(og:site_name 또는 호스트명). */
    siteName: string;
}

export type Block =
    | HeadingBlock
    | TextBlock
    | QuoteBlock
    | CalloutBlock
    | DividerBlock
    | TableBlock
    | ChartBlock
    | ImageBlock
    | VideoBlock
    | AudioBlock
    | LlmBlock
    | BookmarkBlock;

export interface Page {
    id: string;
    title: string;
    blocks: Block[];
}

/** 본문 가로 폭 — 강사가 강의 생성 시 고른다. 학생은 강사가 고른 폭 그대로 본다.
 *  값은 Tailwind max-w 단계와 1:1 대응(3xl=좁게 … 8xl=넓게). 미설정이면 "3xl"(기본). */
export type CourseMaxWidth = "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "8xl";

export interface Course {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    authorNickname: string;
    pages: Page[];
    /** 본문 가로 폭. 미설정이면 "3xl"(기존 강의 호환). 강사만 빌더에서 바꾼다. */
    maxWidth?: CourseMaxWidth;
    createdAt: number;
    updatedAt: number;
}

export interface CourseSummary {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    authorNickname: string;
    pageCount: number;
    updatedAt: number;
}

export type ChatAttachmentType = "image" | "video" | "audio" | "file" | "blockref";

export interface ChatAttachment {
    type: ChatAttachmentType;
    url: string;
    name: string;
    /** AI 글(LLM 결과)을 첨부할 때 본문 텍스트를 인라인으로 담는다(있으면 글 카드로 렌더). */
    text?: string;
    /** 학습 중 만든 AI 작품에서 가져온 첨부면 true(직접 업로드와 구분해 라벨 표시). */
    fromWork?: boolean;
    /** type="blockref"일 때 — 가리키는 강의 블럭의 페이지 인덱스(0-기준). */
    pageIdx?: number;
    /** type="blockref"일 때 — 가리키는 강의 블럭의 id(클릭 시 해당 블럭으로 스크롤). */
    blockId?: string;
}

export interface ChatMessage {
    id: string;
    courseId: string;
    userId?: string; // sender's account id (used to resolve the live avatar)
    nickname: string;
    role: Role;
    avatar?: string; // sender's current avatar key (see lib/avatars)
    text: string;
    attachments: ChatAttachment[];
    /** 말풍선 이모지 반응 — 이모지별로 누른 사용자 id 목록. 예: { "👍": ["u1","u2"] }.
      *  미설정(레거시)이면 반응 없음으로 본다. */
    reactions?: Record<string, string[]>;
    createdAt: number;
}

// ---------- Accounts (prototype auth: id + password, plaintext) ----------

export interface User {
    id: string; // login id, unique
    password: string; // plaintext — prototype only, never sent to the client
    name: string; // display name, e.g. 박성현
    role: Role;
    avatar: string; // chosen avatar key (see lib/avatars), "" = none
    createdAt: number;
}

/** User shape safe to expose to the client (no password). */
export interface UserPublic {
    id: string;
    name: string;
    role: Role;
    avatar: string;
}

// ---------- Programs (강좌) — group lessons (Course) into weeks ----------

/** What kind of content a week entry points at. 시험(exam)·연습(practice)은 실제
  *  LLM 사이트(ChatGPT/Claude/Gemini/Grok)를 똑같이 흉내 낸 화면에서 진행한다.
  *  실습(atelier)은 시·동화책·에세이를 만들어 PDF·책으로 출력하는 창작 실습이다. */
export type WeekItemType =
    | "lesson"
    | "post"
    | "announcement"
    | "exam"
    | "practice"
    | "atelier";

/** One ordered entry inside a week: 강의(Course), 게시물(Post), 공지사항(Announcement),
  *  또는 시험·연습(Drill). */
export interface WeekItem {
    type: WeekItemType;
    id: string;
}

/** A single week bucket inside a program. `items` is the ordered, mixed content
  *  list (instructor reorders freely); `lessonIds` is the legacy lesson-only list,
  *  migrated into `items` on read. */
export interface Week {
    id: string;
    weekNo: number;
    title: string;
    items: WeekItem[];
    /** @deprecated migrated into `items` on read — kept for backward compatibility. */
    lessonIds?: string[];
}

export interface Program {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    ownerId: string; // instructor user id
    ownerName: string;
    inviteCode: string; // students may self-join with this code
    /** 강좌 시작일 "YYYY-MM-DD". 미설정이면 null. */
    startDate: string | null;
    /** 강좌 종료일 "YYYY-MM-DD". 미설정이면 null. */
    endDate: string | null;
    /** 매주 수업하는 요일 목록 (0=일 … 6=토). 예: [1,3,5] = 월·수·금. */
    weekDays: number[];
    weeks: Week[];
    createdAt: number;
    updatedAt: number;
}

/** Lightweight program listing with rolled-up counts. */
export interface ProgramSummary {
    id: string;
    title: string;
    description: string;
    cover: string | null;
    ownerId: string;
    ownerName: string;
    startDate: string | null;
    endDate: string | null;
    weekDays: number[];
    weekCount: number;
    lessonCount: number;
    studentCount: number;
    updatedAt: number;
}

export interface Enrollment {
    programId: string;
    userId: string;
    name: string;
    avatar: string; // student's current avatar key (resolved live, see lib/avatars)
    enrolledAt: number;
}

// ---------- Progress ----------

/** Per-student progress on one lesson (Course). */
export interface LessonProgress {
    userId: string;
    lessonId: string;
    programId: string;
    maxPageReached: number; // furthest page index reached (0-based)
    totalPages: number;
    completed: boolean; // reached the last page
    updatedAt: number;
}

// ---------- Student work on AI blocks (prompts + generations persist) ----------

/** 한 번의 AI 생성에 든 비용·모델 묶음 — 생성 결과와 함께 학생 작업 기록에 실린다.
 *  studioGenerate 응답(크레딧·원화·USD·무료 여부·모델)을 그대로 담는 형태다. */
export interface RunCost {
    /** 이번 생성에 든 크레딧(1크레딧=0.1원). */
    credits: number;
    /** 이번 생성의 원화 환산 비용. */
    krw: number;
    /** 이번 생성의 USD 원가(공급가). */
    costUsd: number;
    /** 무료 생성이었는지(무료 모델/폴백). */
    free: boolean;
    /** 생성에 쓴 모델 id(있으면). */
    model?: string;
    /** 표시용 모델 이름(있으면). */
    modelLabel?: string;
}

/** One generation attempt on an AI block (image or llm). */
export interface BlockRun {
    prompt: string;
    result: string | null; // image data URL or llm text output
    genMs: number | null;
    seed: number | null; // image only
    at: number;
    /** 이 생성에 든 크레딧. 옛 기록·미측정이면 undefined(=0으로 취급). */
    credits?: number;
    /** 이 생성의 원화 환산 비용. */
    krw?: number;
    /** 이 생성의 USD 원가. */
    costUsd?: number;
    /** 무료 생성이었는지. */
    free?: boolean;
    /** 생성에 쓴 모델 id(있으면). */
    model?: string;
    /** 표시용 모델 이름(있으면). */
    modelLabel?: string;
}

/** A student's saved state + full history for a single AI block in a lesson. */
export interface StudentBlockWork {
    userId: string;
    lessonId: string;
    blockId: string;
    blockType: "image" | "video" | "audio" | "llm";
    current: BlockRun; // latest prompt+result, restored on re-entry
    history: BlockRun[]; // newest-first list of past runs
    updatedAt: number;
}

// ---------- Posts (게시물) & Announcements (공지사항) ----------
// Both are block documents (title + blocks) that live inside a program week,
// just like a lesson. Authored by the instructor. Posts accept student comments
// (including secret comments); announcements are read-only broadcasts.

export interface Post {
    id: string;
    programId: string;
    title: string;
    authorId: string;
    authorName: string;
    blocks: Block[];
    createdAt: number;
    updatedAt: number;
}

export interface PostSummary {
    id: string;
    programId: string;
    title: string;
    authorName: string;
    blockCount: number;
    commentCount: number;
    updatedAt: number;
}

export interface Announcement {
    id: string;
    programId: string;
    title: string;
    authorId: string;
    authorName: string;
    blocks: Block[];
    createdAt: number;
    updatedAt: number;
}

export interface AnnouncementSummary {
    id: string;
    programId: string;
    title: string;
    authorName: string;
    blockCount: number;
    updatedAt: number;
}

/** A comment on a 게시물. Secret(비밀) comments are visible only to their author
  *  and to instructors (the post owner).
  *
  *  대댓글(reply): `parentId`가 최상위 댓글의 id면 그 댓글에 달린 답글이다(1단 중첩).
  *  답글은 부모(루트) 댓글의 비밀 여부를 그대로 상속한다 — 비밀 스레드의 답글은
  *  루트 작성자와 강사에게만 보이고, 다른 학생은 볼 수 없다. */
export interface PostComment {
    id: string;
    postId: string;
    /** 최상위 댓글이면 null, 대댓글이면 부모(루트) 댓글의 id. */
    parentId: string | null;
    userId: string;
    authorName: string;
    authorAvatar: string;
    role: Role;
    text: string;
    secret: boolean;
    /** 댓글에 첨부한 파일·작품(채팅과 동일한 규격). 없으면 빈 배열. */
    attachments: ChatAttachment[];
    createdAt: number;
}

// ---------- Drills (시험 · 연습) — 실제 LLM UI 따라 하기 ----------
// 시험(exam)과 연습(practice)은 실제 AI 서비스 화면을 똑같이 흉내 낸 환경에서
// 학습자가 직접 프롬프트를 입력해 보는 실습이다. provider 가 어떤 사이트의 모양을
// 복제할지(ChatGPT/Claude/Gemini/Grok) 정한다. 강의/게시물처럼 한 주차의 항목이 된다.

/** 복제할 실제 LLM 서비스. */
export type LlmProvider = "chatgpt" | "claude" | "gemini" | "grok";

/** 드릴 종류 — 시험(미션+제출) 또는 연습(자유 실습). */
export type DrillKind = "exam" | "practice";

export interface Drill {
    id: string;
    programId: string;
    kind: DrillKind;
    provider: LlmProvider;
    title: string;
    /** 시험 미션 안내 문구(연습은 비어 있을 수 있음). */
    mission: string;
    authorId: string;
    authorName: string;
    createdAt: number;
    updatedAt: number;
}

export interface DrillSummary {
    id: string;
    programId: string;
    kind: DrillKind;
    provider: LlmProvider;
    title: string;
    updatedAt: number;
}

// ---------- AI 스튜디오 (OpenRouter 연동 · 크레딧 과금) ----------
// 실제 OpenRouter API(OpenAI 규격)로 텍스트/이미지/동영상/오디오를 생성하고,
// 응답에 포함된 usage.cost(USD)를 실시간 환율로 원화→크레딧(1크레딧=0.1원)으로
// 환산해 표시·기록한다. 모델 가격표는 OpenRouter 디스커버리 엔드포인트의 라이브
// 단가를 반영한다.

/** 스튜디오가 다루는 생성 카테고리. */
export type StudioCategory = "text" | "image" | "video" | "audio";

/** 한 모델의 단가(크레딧 환산, 실시간 환율 반영). 원본 USD 단가도 함께 보관한다. */
export interface ModelPricing {
    /** 입력 100만 토큰당 크레딧(텍스트 모델). */
    inputPerMTokCredits?: number;
    /** 출력 100만 토큰당 크레딧(텍스트 모델). */
    outputPerMTokCredits?: number;
    /** 생성 1건(요청)당 고정 크레딧(있을 때). */
    perRequestCredits?: number;
    /** 이미지 1장당 크레딧(이미지 모델). */
    perImageCredits?: number;
    /** 원본 USD 단가 — 툴팁/디버그용. */
    usd: {
        prompt?: number;
        completion?: number;
        request?: number;
        image?: number;
        audio?: number;
    };
}

/** 클라이언트에 내려보내는 모델 카탈로그 항목. */
export interface StudioModel {
    /** OpenRouter 모델 id (예: "openai/gpt-5.5"). */
    id: string;
    /** 한국어 표시 이름. */
    label: string;
    /** 한 줄 설명. */
    description: string;
    category: StudioCategory;
    /** 무료 모델(:free) 여부. */
    free: boolean;
    /** 라이브 디스커버리에서 확인된 모델인지. */
    available: boolean;
    pricing: ModelPricing;
    /** 표시용 태그(예: "추천", "멀티모달"). */
    badges?: string[];
}

/** GET /api/studio/models 응답 — 카탈로그 + 환율 + 키 보유 여부. */
export interface StudioCatalog {
    models: StudioModel[];
    fx: { krwPerUsd: number; updatedAt: number; source: string; stale: boolean };
    /** 1 크레딧의 원화 가치(0.1). */
    krwPerCredit: number;
    /** 서버에 OPENROUTER_API_KEY가 설정됐는지(없으면 실제 생성 불가). */
    hasKey: boolean;
    fetchedAt: number;
}

/** 생성 결과(클라이언트 표시용). */
export interface StudioGenResult {
    category: StudioCategory;
    model: string;
    modelLabel: string;
    /** 결과 종류 — 텍스트면 본문, 그 외엔 data URL 또는 미디어 URL. */
    kind: "text" | "image" | "video" | "audio";
    output: string;
    credits: number;
    krw: number;
    costUsd: number;
    genMs: number;
    /** 비용이 0(무료 모델 등)인지. */
    free: boolean;
}

/** 한 번의 생성 사용 기록(usage_log 한 행). */
export interface UsageRecord {
    id: string;
    userId: string;
    userName: string;
    category: StudioCategory;
    model: string;
    modelLabel: string;
    prompt: string;
    costUsd: number;
    krwPerUsd: number;
    credits: number;
    genMs: number;
    ok: boolean;
    createdAt: number;
    /** 저장된 결과물의 종류(미디어 종류). 결과물이 없는 레거시 기록은 "". */
    kind: StudioCategory | "";
    /** 저장된 결과물이 있는지 — 목록은 이 플래그만, 본문은 단건 상세 조회로 가져온다. */
    hasOutput: boolean;
    /** 결과물 본문/URL — 단건 상세 조회에서만 채워진다(목록 응답엔 없음). */
    output?: string | null;
}

/** 사용자별 사용량 집계(대시보드용). */
export interface UsageSummary {
    userId: string;
    userName: string;
    totalCredits: number;
    totalKrw: number;
    totalUsd: number;
    count: number;
    /** 카테고리별 크레딧·건수 분해. */
    byCategory: Record<StudioCategory, { credits: number; count: number }>;
    lastAt: number;
}

/** GET /api/studio/usage 응답 — 전체 집계 + 사용자별 + 최근 기록 + 전체 기록.
 *  records는 결과물 본문을 뺀 전체 기록(최신순)으로, 클라이언트가 날짜 필터·차트
 *  집계를 직접 계산하는 데 쓴다. */
export interface UsageReport {
    summaries: UsageSummary[];
    recent: UsageRecord[];
    records: UsageRecord[];
    totals: { credits: number; krw: number; usd: number; count: number };
}

// ---------- Atelier (창작 실습) — 시·동화책·에세이를 만들어 PDF/책으로 ----------
// 강좌 한 주차의 항목(WeekItem "atelier")으로, 학습자가 직접 시/동화책/에세이를 창작해
// 책 형태로 미리보고 PDF로 내려받는 실습이다. 강사는 시범본(sample)을 만들어 보여 주고,
// 학습자는 각자 자기 작품(AtelierWork)을 만든다. 본문은 기존 Page/Block 체계를 그대로 쓴다.

/** 창작 실습 장르 — 시·동화책·에세이. */
export type AtelierGenre = "poem" | "storybook" | "essay";

/** 책/PDF 한 쪽의 종횡비 — 세로 A4·가로 A4·정사각(1:1)·가로 4:3·세로 3:4. */
export type AtelierPageRatio = "a4" | "a4l" | "square" | "r4_3" | "r3_4" | "wide";

/** 본문 글꼴 — 명조(serif)·고딕(sans)·둥근(round). 색 테마와 독립적으로 고른다. */
export type AtelierFont = "serif" | "sans" | "round";

/** 책의 색 테마(표지·본문 공통). PDF 캡처(html2canvas) 안전을 위해 hex/rgb 값만 쓴다. 글꼴은 분리(AtelierFont). */
export interface AtelierTheme {
    /** 테마 프리셋 식별 키. */
    key: string;
    /** 강조 색(표지 제목·구분선 등) hex. */
    accent: string;
    /** 표지 배경 hex(또는 CSS 그라데이션 문자열). */
    coverBg: string;
    /** 표지 글자색 hex. */
    coverText: string;
    /** 본문 페이지 배경 hex. */
    pageBg: string;
    /** 본문 글자색 hex. */
    pageText: string;
}

/** 책 표지 정보. */
export interface AtelierCover {
    /** 책 제목. */
    title: string;
    /** 부제(장르 표기 등). */
    subtitle: string;
    /** 지은이(표지 하단 표기). */
    author: string;
    /** 표지 이미지(data URL 또는 원격 URL). 없으면 색·패턴만. */
    image: string | null;
    /** 표지 그림 생성에 쓸 모델 id. 비어 있으면 무료(Pollinations FLUX). 강사가 고른다. */
    model?: string;
    /** 표시용 모델 이름(예: "Nano Banana 2"). */
    modelLabel?: string;
}

/** 한 권의 창작 작품 문서 — 표지 + 본문 페이지. 강사 시범본과 학생 작품이 같은 규격이다. */
export interface AtelierDoc {
    genre: AtelierGenre;
    cover: AtelierCover;
    theme: AtelierTheme;
    /** 책 페이지 비율. 미설정이면 장르 기본값(genreMeta.pageRatio). */
    ratio?: AtelierPageRatio;
    /** 본문 글꼴. 미설정이면 장르 기본값(genreMeta.defaultFont). 색 테마와 분리. */
    font?: AtelierFont;
    /** 본문 페이지들(기존 Page/Block 재사용). 각 Page = 책의 한 쪽. */
    pages: Page[];
}

/** 강사가 개설하는 창작 실습 항목 — 장르·안내문 + 강사 시범본(sample). */
export interface Atelier {
    id: string;
    programId: string;
    genre: AtelierGenre;
    title: string;
    /** 학습자 안내문(과제 설명). */
    brief: string;
    authorId: string;
    authorName: string;
    /** 시작에 쓴 템플릿 id. 빈 작품에서 시작했으면 비어 있음(배지에 장르 표기 여부를 가른다). */
    templateId?: string;
    /** 강사 시범 작품 문서(학생이 참고용으로 열람). */
    sample: AtelierDoc;
    createdAt: number;
    updatedAt: number;
}

/** 주차 목록·요약용 가벼운 실습 정보. */
export interface AtelierSummary {
    id: string;
    programId: string;
    genre: AtelierGenre;
    title: string;
    updatedAt: number;
}

/** 한 학생이 한 창작 실습에서 만든 자기 작품. */
export interface AtelierWork {
    atelierId: string;
    userId: string;
    userName: string;
    doc: AtelierDoc;
    updatedAt: number;
}
