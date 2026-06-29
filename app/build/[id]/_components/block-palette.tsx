/**
 * 블럭 팔레트 — 빌더 오른쪽(또는 모바일 하단)에서 클릭/드래그로 블럭을 추가한다.
 * 미디어는 생성·업로드가 별도 항목이라 type 외에 mode까지 onAdd로 넘긴다.
 * 상단 탭(전체/AI/일반)으로 분류를 좁히고, 검색창으로 라벨·키워드를 필터링한다.
 */
"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_META, type BlockMeta, type BlockMode, type BlockGroup } from "@/lib/blocks";
import type { BlockType } from "@/lib/types";
import { MetaIcon } from "@/components/blocks/block-icon";
import { cn } from "@/lib/utils";

/** 팔레트 탭 필터 값. "all" = 전체 보기. */
type PaletteTab = "all" | BlockGroup;

/** 탭 정의(표시 순서 = 좌→우). */
const PALETTE_TABS: { key: PaletteTab; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "ai", label: "AI" },
    { key: "basic", label: "일반" },
];

// 팔레트 한 항목 — 클릭 또는 드래그로 해당 블럭을 추가한다.
function PaletteItem({
    meta,
    onAdd,
}: {
    meta: BlockMeta;
    onAdd: (t: BlockType, mode?: BlockMode) => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `palette-${meta.key}`,
        data: { source: "palette", type: meta.type, mode: meta.mode },
    });
    return (
        <button
            type="button"
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={() => onAdd(meta.type, meta.mode)}
            className={cn(
                "flex w-full touch-none items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted",
                isDragging && "opacity-50",
            )}
        >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
                <MetaIcon name={meta.icon} className="size-4" />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{meta.hint}</span>
            </span>
        </button>
    );
}

// 블럭 추가 팔레트 전체 — 탭/검색으로 BLOCK_META를 필터링해 보여준다.
export function BlockPalette({ onAdd }: { onAdd: (t: BlockType, mode?: BlockMode) => void }) {
    const [tab, setTab] = useState<PaletteTab>("all");
    const [query, setQuery] = useState("");

    // 활성 탭 + 검색어로 표시할 블럭 목록을 계산한다.
    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        return BLOCK_META.filter((m) => {
            if (tab !== "all" && m.group !== tab) return false;
            if (!q) return true;
            return (
                m.label.toLowerCase().includes(q) ||
                m.hint.toLowerCase().includes(q) ||
                m.keywords.some((k) => k.toLowerCase().includes(q))
            );
        });
    }, [tab, query]);

    return (
        <div className="space-y-2">
            <p className="eyebrow px-1">블럭 추가</p>

            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                {PALETTE_TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn(
                            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                            tab === t.key
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:border-ring">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="블럭 검색"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    aria-label="블럭 검색"
                />
            </div>

            <div className="space-y-2">
                {items.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                        일치하는 블럭이 없어요
                    </p>
                ) : (
                    items.map((m) => <PaletteItem key={m.key} meta={m} onAdd={onAdd} />)
                )}
            </div>
        </div>
    );
}
