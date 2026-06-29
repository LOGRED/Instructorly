/**
 * 목차(TOC) 유틸 — 블록 배열에서 제목 블록(HeadingBlock)을 뽑고, 필요하면 문서/페이지
 * 제목(H1)까지 맨 앞에 포함해 목차 항목으로 변환한다. 헤딩 DOM 앵커 id 규칙도 한곳에서
 * 관리한다. block-view(앵커 부여)와 목차 컴포넌트(스크롤 이동 대상)가 같은 규칙을 공유한다.
 */
import type { Block } from "@/lib/types";

/** 문서/페이지 제목(H1) 목차 항목이 가리키는 DOM 앵커 id. 제목 <h1>에 이 id를 부여한다. */
export const TITLE_DOM_ID = "toc-doc-title";

export interface TocItem {
    /** 스크롤 이동 대상이 되는 헤딩 요소의 DOM id. */
    id: string;
    /** 제목 레벨(1=H1, 2=H2, 3=H3) — 목차 들여쓰기에 사용. */
    level: 1 | 2 | 3;
    /** 목차에 표시할 제목 텍스트. */
    text: string;
}

// 블록 id로부터 헤딩 요소의 DOM id를 만든다(앵커/스크롤 대상 식별용 단일 규칙).
export function headingDomId(blockId: string): string {
    return `h-${blockId}`;
}

// 문서/페이지 제목(있으면 맨 앞)과 제목 블록(H1·H2·H3)을 합쳐 목차 항목 목록으로 만든다.
export function extractToc(blocks: Block[], title?: string): TocItem[] {
    const items: TocItem[] = [];
    const t = title?.trim();
    if (t) items.push({ id: TITLE_DOM_ID, level: 1, text: t });
    for (const b of blocks) {
        if (b.type !== "heading") continue;
        items.push({
            id: headingDomId(b.id),
            level: b.level,
            text: b.text.trim() || "제목 없음",
        });
    }
    return items;
}
