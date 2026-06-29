/**
 * 정렬 가능한 블럭 — dnd-kit 드래그 핸들이 달린 개별 블럭 컨테이너. 이동·삭제·폭 선택 버튼을 포함한다.
 */
"use client";

import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Block } from "@/lib/types";
import { BlockEdit } from "@/components/blocks/block-edit";
import { Button } from "@/components/ui/button";
import { blockMeta } from "@/lib/blocks";
import { BLOCK_WIDTH_OPTIONS } from "@/lib/block-layout";
import { cn } from "@/lib/utils";

// SortableBlock 컴포넌트를 내보낸다.
export function SortableBlock({
    block,
    autoFocus,
    onChange,
    onDelete,
    onMoveUp,
    onMoveDown,
}: {
    block: Block;
    autoFocus?: boolean;
    onChange: (b: Block) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: block.id });
    // Translate만 적용한다(Transform은 폭이 다른 블럭으로 옮길 때 scaleX/scaleY가 끼어
    // 블럭이 타겟 크기에 맞춰 찌그러지거나 커진다). 위치 이동만 필요하므로 scale은 버린다.
    // 드래그 중인 블럭은 DragOverlay(builder.tsx)가 커서를 따라다니는 카드로 그려준다.
    // 원본은 화면에서 완전히 접어(높이 0) 큰 빈 구멍을 없앤다. 큰 블럭을 옮길 때 원래
    // 자리가 그대로 비어 "자리를 못 찾는" 것처럼 보이던 문제를 막는다. 놓일 위치는
    // builder.tsx의 파란 삽입선이 따로 보여준다.
    const style: CSSProperties = isDragging
        ? { height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, borderWidth: 0, overflow: "hidden", opacity: 0 }
        : {
              transform: CSS.Translate.toString(transform),
              transition,
              opacity: 1,
          };
    const meta = blockMeta(block.type, "mode" in block ? block.mode : undefined);
    const currentWidth = block.width ?? "full";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group relative rounded-xl border bg-background p-3 pl-9 transition-shadow hover:shadow-sm"
        >
            <button
                type="button"
                className="absolute top-3 left-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                {...attributes}
                {...listeners}
                aria-label="드래그하여 순서 이동"
            >
                <GripVertical className="size-4" />
            </button>

            <div className="mb-2 flex items-center gap-2">
                <span className="eyebrow">{meta.label}</span>
                {/* 폭 선택 세그먼트 컨트롤 — 1/1·1/2·1/3 칩 3개 */}
                <div className="flex items-center gap-0.5">
                    {BLOCK_WIDTH_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            title={opt.title}
                            aria-label={opt.title}
                            aria-pressed={currentWidth === opt.value}
                            onClick={() => onChange({ ...block, width: opt.value })}
                            className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] leading-none transition-colors",
                                currentWidth === opt.value
                                    ? "bg-muted font-medium text-foreground"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-0.5">
                    <Button type="button" size="icon-sm" variant="ghost" onClick={onMoveUp} aria-label="위로 이동">
                        <ChevronUp className="size-4" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={onMoveDown} aria-label="아래로 이동">
                        <ChevronDown className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={onDelete}
                        aria-label="블럭 삭제"
                        className="text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            <BlockEdit block={block} onChange={onChange} autoFocus={autoFocus} />
        </div>
    );
}
