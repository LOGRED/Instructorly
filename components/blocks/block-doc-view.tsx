/**
 * 블럭 문서 뷰어 — 게시물·공지사항 단일 문서를 읽기 전용으로 렌더하는 클라이언트 컴포넌트.
 * 각 블럭을 BlockView 로 표시하며, AI 블럭(이미지/LLM)은 작성된 결과만 보여주고
 * onChange 는 no-op 으로 처리해 독자에게는 비영속적으로 동작한다.
 */
"use client";

import type { Block } from "@/lib/types";
import { groupBlocksIntoRows, blockFlexStyle } from "@/lib/block-layout";
import { BlockView } from "@/components/blocks/block-view";

// 블럭 배열을 읽기 전용으로 렌더한다. 내용이 없으면 빈 상태 안내를 표시한다.
export function BlockDocView({ blocks }: { blocks: Block[] }) {
    if (blocks.length === 0) {
        return (
            <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
                아직 내용이 없어요.
            </p>
        );
    }
    return (
        <div className="space-y-6">
            {groupBlocksIntoRows(blocks).map((row) => (
                <div
                    key={row[0].id}
                    className="space-y-6 md:flex md:space-y-0 md:gap-4 md:items-start"
                >
                    {row.map((b) => (
                        <div key={b.id} style={blockFlexStyle(b.width)}>
                            <BlockView block={b} onChange={() => {}} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
