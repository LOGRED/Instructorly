/**
 * 블럭 한 줄 배치(컬럼 레이아웃)의 단일 진실원.
 *
 * 강의 블럭은 평평한 1차원 배열(Block[])로 저장된다. 노션처럼 "한 줄에 2~3개"를
 * 보여주기 위해, 각 블럭의 width("full"/"half"/"third")를 보고 연속한 좁은 블럭을
 * 한 줄(row)로 묶는다. 빌더·미리보기·학습자 화면이 모두 이 함수를 거쳐 같은 방식으로
 * 줄을 나눈다 — 배치 규칙을 한 곳에 둬야 화면마다 어긋나지 않는다.
 *
 * 방법 A(노션식 컬럼 컨테이너 블럭)로 넘어갈 때도, 저장 구조만 바뀔 뿐 "줄로 묶어
 * 렌더한다"는 소비 측 계약은 이 모듈의 시그니처를 그대로 유지하면 된다.
 */

import type { Block, BlockWidth } from "./types";

/** 한 줄에 들어가는 블럭들의 묶음. */
export type BlockRow = Block[];

/** 폭을 0~1 분수로 바꾼다(full=1, half=1/2, third=1/3). 미설정은 full로 본다. */
export function widthFraction(width?: BlockWidth): number {
    switch (width) {
        case "half":
            return 1 / 2;
        case "third":
            return 1 / 3;
        case "full":
        default:
            return 1;
    }
}

// 부동소수 합산 오차를 흡수하기 위한 여유값(1/2 + 1/2, 1/3*3 = 1 보장).
const ROW_EPSILON = 0.001;

/**
 * 평평한 블럭 배열을 한 줄(row)들로 묶는다.
 *
 * 규칙: 앞에서부터 훑으며 현재 줄의 폭 합이 1을 넘지 않는 한 좁은 블럭을 같은 줄에
 * 채운다. 폭이 full(=1)인 블럭은 항상 단독 줄이다. 폭을 더해 1을 넘으면 새 줄을 연다.
 * 예) half+half → 한 줄, third+third+third → 한 줄, half+third → 한 줄(합 5/6),
 *     그 다음 third가 오면(합 7/6>1) 새 줄.
 */
export function groupBlocksIntoRows(blocks: Block[]): BlockRow[] {
    const rows: BlockRow[] = [];
    let current: BlockRow = [];
    let used = 0;

    for (const block of blocks) {
        const fr = widthFraction(block.width);
        // full 블럭은 단독 줄: 진행 중인 줄을 닫고 혼자 한 줄 차지한다.
        if (fr >= 1 - ROW_EPSILON) {
            if (current.length) {
                rows.push(current);
                current = [];
                used = 0;
            }
            rows.push([block]);
            continue;
        }
        // 좁은 블럭: 이번 블럭을 더해 1을 넘으면 새 줄부터 시작한다.
        if (current.length && used + fr > 1 + ROW_EPSILON) {
            rows.push(current);
            current = [];
            used = 0;
        }
        current.push(block);
        used += fr;
    }
    if (current.length) rows.push(current);
    return rows;
}

/**
 * row 안에서 각 블럭에 줄 인라인 스타일을 준다(flex 자식). flexGrow를 폭 분수에
 * 비례시켜 같은 줄 안에서 너비를 비율대로 나눈다. minWidth:0은 내용이 길어도
 * 칸이 줄어들 수 있게 한다. 단독 블럭(혼자인 줄)은 grow 1로 전체를 채운다.
 */
export function blockFlexStyle(width?: BlockWidth): { flexGrow: number; flexBasis: 0; minWidth: 0 } {
    return { flexGrow: widthFraction(width), flexBasis: 0, minWidth: 0 };
}

/** 블럭 래퍼 div에 부여하는 DOM id — 채팅 링크 클릭 시 이 id로 스크롤 타깃을 찾는다. */
export function blockDomId(blockId: string): string {
    return `block-${blockId}`;
}

/** 블럭 타입별 한국어 라벨(채팅 링크 칩 아이콘 옆 표기용). */
const BLOCK_TYPE_LABELS: Record<Block["type"], string> = {
    heading: "제목",
    text: "본문",
    quote: "인용",
    callout: "강조",
    divider: "구분선",
    table: "표",
    chart: "차트",
    image: "이미지",
    video: "영상",
    audio: "오디오",
    llm: "AI 글",
    bookmark: "북마크",
};

/** 채팅 링크 칩에 보여 줄 라벨을 만든다 — "타입 · 내용 일부" 형식(내용 없으면 타입만). */
export function blockLabel(block: Block): string {
    const type = BLOCK_TYPE_LABELS[block.type] ?? "블럭";
    let snippet = "";
    switch (block.type) {
        case "heading":
        case "quote":
            snippet = block.text;
            break;
        case "callout":
            snippet = block.text;
            break;
        case "text":
            snippet = block.markdown;
            break;
        case "table":
            snippet = block.headers.join(", ");
            break;
        case "chart":
            snippet = block.title;
            break;
        case "image":
        case "video":
        case "audio":
        case "llm":
            snippet = block.prompt ?? "";
            break;
        case "bookmark":
            snippet = block.title || block.url;
            break;
    }
    // 마크다운 기호·개행 제거 후 30자 컷.
    const clean = snippet.replace(/[#*`>_~\[\]]/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return type;
    const cut = clean.length > 30 ? clean.slice(0, 30) + "…" : clean;
    return `${type} · ${cut}`;
}

/** 폭 선택 UI에서 쓰는 옵션 목록(라벨 + 값). 빌더의 폭 토글이 이걸 쓴다. */
export const BLOCK_WIDTH_OPTIONS: { value: BlockWidth; label: string; title: string }[] = [
    { value: "full", label: "1/1", title: "한 줄 전체" },
    { value: "half", label: "1/2", title: "한 줄에 2개" },
    { value: "third", label: "1/3", title: "한 줄에 3개" },
];
