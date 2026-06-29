/**
 * 목차 항목 리스트 — 제목들을 레벨별 들여쓰기와 함께 보여준다. 현재 위치보다 위(이미 지나온)
 * 항목은 "읽음"으로 좌측 스파인을 채워 진행 정도를 드러내고, 현재 항목은 강조, 이후 항목은
 * 흐리게 표시한다. 클릭 시 onJump(id)로 스크롤 이동을 위임한다. 레일/시트/팝오버에서 재사용된다.
 */
"use client";

import { cn } from "@/lib/utils";
import type { TocItem } from "@/lib/toc";

// 목차 항목들을 읽음/현재/이후 상태로 렌더하고 클릭 시 onJump(id)로 이동을 위임한다.
export function TocList({
    items,
    activeId,
    onJump,
    className,
}: {
    items: TocItem[];
    activeId: string;
    onJump: (id: string) => void;
    className?: string;
}) {
    const activeIndex = items.findIndex((it) => it.id === activeId);

    return (
        <ul className={cn("space-y-0.5 text-sm", className)}>
            {items.map((it, idx) => {
                const isActive = it.id === activeId;
                const isRead = activeIndex >= 0 && idx < activeIndex;
                return (
                    <li key={it.id}>
                        <button
                            type="button"
                            onClick={() => onJump(it.id)}
                            title={it.text}
                            aria-current={isActive ? "true" : undefined}
                            className={cn(
                                "block w-full truncate rounded-r-md border-l-2 py-1 pr-2 text-left leading-snug transition-colors",
                                it.level === 1 ? "pl-3 font-medium" : it.level === 2 ? "pl-6" : "pl-9",
                                isActive
                                    ? "border-primary bg-primary/5 text-primary"
                                    : isRead
                                        ? "border-primary/40 text-foreground/70 hover:border-primary hover:text-foreground"
                                        : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground",
                            )}
                        >
                            {it.text}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
