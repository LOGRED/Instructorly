/**
 * 블럭 문서 에디터 — 게시물·공지사항 단일 문서를 Notion 스타일로 편집하는 클라이언트 컴포넌트.
 * 강의 빌더와 동일한 드래그·슬래시·팔레트 UX 를 공유하며, 문서 타입에 무관하게
 * 평면 Block[] 을 받아 변경분을 상위로 버블링한다. 제목 입력·저장·영속화는 부모 페이지가 담당한다.
 */
"use client";

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    closestCenter,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Block, BlockType } from "@/lib/types";
import { createBlock, blockMeta, type BlockMode } from "@/lib/blocks";
import { newId } from "@/lib/id";
import { cn } from "@/lib/utils";
import { MetaIcon } from "@/components/blocks/block-icon";
import { SortableBlock } from "@/app/build/[id]/_components/sortable-block";
import { BlockPalette } from "@/app/build/[id]/_components/block-palette";
import { SlashAdd } from "@/app/build/[id]/_components/slash-add";

// 블럭을 드롭할 수 있는 캔버스 영역을 렌더한다. 드래그 오버 시 윤곽선으로 피드백을 준다.
function DroppableCanvas({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: "doc-canvas" });
    return (
        <div
            ref={setNodeRef}
            className={cn(
                "rounded-xl transition-all",
                isOver && "outline-2 outline-dashed outline-ring/40",
            )}
        >
            {children}
        </div>
    );
}

// 블럭 문서 에디터를 렌더한다. 드래그·슬래시·팔레트로 블럭을 추가·정렬할 수 있다.
export function BlockDocEditor({
    blocks,
    onChange,
}: {
    blocks: Block[];
    onChange: (blocks: Block[]) => void;
}) {
    const [activePalette, setActivePalette] = useState<{
        type: BlockType;
        mode?: BlockMode;
    } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    // 특정 id 의 블럭을 새 블럭으로 교체한다.
    const updateBlock = (id: string, nb: Block) =>
        onChange(blocks.map((b) => (b.id === id ? nb : b)));

    // 특정 id 의 블럭을 목록에서 제거한다.
    const deleteBlock = (id: string) =>
        onChange(blocks.filter((b) => b.id !== id));

    // 지정한 타입·모드로 새 블럭을 목록 끝에 추가한다.
    const appendBlock = (type: BlockType, mode?: BlockMode) =>
        onChange([...blocks, createBlock(type, mode)]);

    // 텍스트를 포함한 텍스트 블럭을 목록 끝에 추가한다.
    const addTextBlock = (text: string) =>
        onChange([...blocks, { id: newId(), type: "text", markdown: text }]);

    // 지정한 블럭을 위(-1) 또는 아래(+1) 방향으로 한 칸 이동한다.
    const moveBlock = (id: string, dir: -1 | 1) => {
        const i = blocks.findIndex((b) => b.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= blocks.length) return;
        onChange(arrayMove(blocks, i, j));
    };

    // 드래그 시작 시 팔레트 출처 블럭 타입을 기록한다.
    function onDragStart(e: DragStartEvent) {
        const d = e.active.data.current as
            | { source?: string; type?: BlockType; mode?: BlockMode }
            | undefined;
        if (d?.source === "palette" && d.type) setActivePalette({ type: d.type, mode: d.mode });
    }

    // 드래그 종료 시 팔레트 드롭이면 새 블럭을 삽입하고, 정렬이면 순서를 바꾼다.
    function onDragEnd(e: DragEndEvent) {
        setActivePalette(null);
        const { active, over } = e;
        if (!over) return;
        const d = active.data.current as
            | { source?: string; type?: BlockType; mode?: BlockMode }
            | undefined;
        if (d?.source === "palette" && d.type) {
            const overId = String(over.id);
            const idx = blocks.findIndex((b) => b.id === overId);
            const nb = createBlock(d.type, d.mode);
            if (idx === -1) {
                onChange([...blocks, nb]);
            } else {
                const copy = [...blocks];
                copy.splice(idx + 1, 0, nb);
                onChange(copy);
            }
            return;
        }
        if (active.id !== over.id) {
            const from = blocks.findIndex((b) => b.id === active.id);
            const to = blocks.findIndex((b) => b.id === over.id);
            if (from < 0 || to < 0) return;
            onChange(arrayMove(blocks, from, to));
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <div className="flex w-full gap-6">
                <main className="min-w-0 flex-1">
                    <DroppableCanvas>
                        <div className="space-y-3">
                            {blocks.length === 0 && (
                                <div className="grid place-items-center rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                                    오른쪽 블럭을 끌어오거나 아래에서 <span className="mono mx-1">/</span> 를
                                    눌러 내용을 시작하세요
                                </div>
                            )}
                            <SortableContext
                                items={blocks.map((b) => b.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {blocks.map((b) => (
                                    <SortableBlock
                                        key={b.id}
                                        block={b}
                                        onChange={(nb) => updateBlock(b.id, nb)}
                                        onDelete={() => deleteBlock(b.id)}
                                        onMoveUp={() => moveBlock(b.id, -1)}
                                        onMoveDown={() => moveBlock(b.id, 1)}
                                    />
                                ))}
                            </SortableContext>
                            <SlashAdd onAdd={appendBlock} onAddText={addTextBlock} />
                        </div>
                    </DroppableCanvas>

                    <div className="mt-6 lg:hidden">
                        <BlockPalette onAdd={appendBlock} />
                    </div>
                </main>

                <aside className="hidden w-64 shrink-0 lg:block">
                    <div className="sticky top-20">
                        <BlockPalette onAdd={appendBlock} />
                    </div>
                </aside>
            </div>

            <DragOverlay>
                {activePalette ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
                        <MetaIcon name={blockMeta(activePalette.type, activePalette.mode).icon} className="size-4" />
                        <span className="text-sm font-medium">
                            {blockMeta(activePalette.type, activePalette.mode).label}
                        </span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
