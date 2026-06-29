/**
 * 목차 진행률 헤더 — "목차" 라벨 + 읽은 비율(%)과 진행률 막대를 보여준다.
 * 레일·시트·팝오버 등 목차 컨테이너 공통으로 재사용한다.
 */
"use client";

import { List } from "lucide-react";

// 읽기 진행률(0~1)을 "목차" 라벨 + % + 막대로 렌더한다.
export function TocProgress({ progress }: { progress: number }) {
    const pct = Math.round(progress * 100);
    return (
        <div className="mb-3">
            <div className="mb-1 flex items-center justify-between gap-2">
                <p className="eyebrow flex items-center gap-1.5 text-muted-foreground">
                    <List className="size-3.5" /> 목차
                </p>
                <span className="mono text-[0.7rem] tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border">
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
