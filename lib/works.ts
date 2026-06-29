/**
 * 작품 → 채팅 첨부 변환 유틸 — 학습 중 만든 AI 작품(StudentBlockWork)을
 * 자랑방 채팅 첨부(ChatAttachment)로 바꾸는 순수 함수와, 작품 종류 한글 라벨을
 * 모아 둔 모듈. 서버·클라이언트 어디서나 쓸 수 있게 순수 함수로 유지한다.
 */
import type {
    ChatAttachment,
    ChatAttachmentType,
    StudentBlockWork,
} from "@/lib/types";

/** 작품을 만든 종류(블럭 타입). */
export type WorkKind = "image" | "video" | "audio" | "llm";

/** 작품 종류별 한글 라벨 — 노인 친화 표기(그림/영상/음악/글). */
export const WORK_KIND_LABEL: Record<WorkKind, string> = {
    image: "그림",
    video: "영상",
    audio: "음악",
    llm: "글",
};

/** 작품 종류별 큰 이모지 — 다이얼로그 필터·빈 썸네일에서 직관적으로 보여 준다. */
export const WORK_KIND_EMOJI: Record<WorkKind, string> = {
    image: "🎨",
    video: "🎬",
    audio: "🎵",
    llm: "✍️",
};

/** 한 작품(블럭의 최신 결과)을 사람이 알아볼 짧은 이름으로 만든다. */
export function workDisplayName(work: StudentBlockWork): string {
    const prompt = (work.current?.prompt ?? "").trim();
    if (prompt) return prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;
    return `내가 만든 ${WORK_KIND_LABEL[work.blockType]}`;
}

/** 작품 종류를 채팅 첨부 타입으로 매핑한다(글은 file로 담되 본문 text를 함께 싣는다). */
function attachmentType(blockType: WorkKind): ChatAttachmentType {
    if (blockType === "image") return "image";
    if (blockType === "video") return "video";
    if (blockType === "audio") return "audio";
    return "file"; // llm — 본문은 text 필드로 인라인 표시
}

/** 결과물이 있는 작품인지(빈 작업은 보관함·첨부에서 제외). */
export function workHasResult(work: StudentBlockWork): boolean {
    return !!work.current?.result;
}

/** 한 작품을 채팅 첨부로 변환한다. 결과물이 없으면 null. */
export function workToAttachment(work: StudentBlockWork): ChatAttachment | null {
    const result = work.current?.result;
    if (!result) return null;
    const name = workDisplayName(work);
    if (work.blockType === "llm") {
        return {
            type: "file",
            url: `data:text/plain;charset=utf-8,${encodeURIComponent(result)}`,
            name,
            text: result,
            fromWork: true,
        };
    }
    return {
        type: attachmentType(work.blockType),
        url: result,
        name,
        fromWork: true,
    };
}
