/**
 * 주차 빠른 이동 내비게이션 — 강좌 상세의 주차 목록 위에 고정(sticky)되는 칩 줄.
 * "1주차 · 2주차 …" 칩을 누르면 해당 주차 섹션으로 부드럽게 스크롤하고,
 * 스크롤 위치에 따라 현재 화면에 보이는 주차 칩을 자동으로 강조(active)한다.
 * 주차가 2개 이상일 때만 노출된다(1개뿐이면 이동할 곳이 없어 숨김).
 */
"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";

import type { Week } from "@/lib/types";
import { cn } from "@/lib/utils";

// 주차 섹션을 가리키는 앵커 id를 만든다(주차 번호 기반, 페이지와 공유).
export function weekAnchorId(weekNo: number): string {
    return `week-${weekNo}`;
}

// 고정 헤더(64px) + 칩 줄 높이를 합한 스크롤 오프셋(px) — 점프 위치·활성 판정 기준선 공용.
const SCROLL_OFFSET = 128;

// 주어진 세로 위치까지 약 380ms 동안 부드럽게 스크롤한다(requestAnimationFrame 직접 구현).
function smoothScrollTo(targetY: number) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 2) return;
    const duration = 380;
    let startTs: number | null = null;
    function step(ts: number) {
        if (startTs === null) startTs = ts;
        const p = Math.min((ts - startTs) / duration, 1);
        // easeInOutQuad — 시작·끝은 천천히, 가운데는 빠르게.
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        window.scrollTo(0, startY + distance * eased);
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

interface WeekJumpNavProps {
    weeks: Week[];
}

// 주차 칩을 눌러 해당 주차 섹션으로 점프하는 고정 내비게이션을 렌더링한다.
export function WeekJumpNav({ weeks }: WeekJumpNavProps) {
    const [activeNo, setActiveNo] = useState<number | null>(weeks[0]?.weekNo ?? null);

    // 스크롤 위치에 따라 현재 보고 있는 주차 칩을 강조한다(스크롤 스파이).
    useEffect(() => {
        if (weeks.length === 0) return;

        // 활성 판정 기준선(px) — 점프 오프셋보다 살짝 아래에서 다음 주차로 전환.
        const OFFSET = SCROLL_OFFSET + 12;

        function syncActive() {
            // 기준선을 지나친(위로 올라간) 마지막 주차를 현재 주차로 본다.
            let current = weeks[0].weekNo;
            for (const w of weeks) {
                const el = document.getElementById(weekAnchorId(w.weekNo));
                if (el && el.getBoundingClientRect().top <= OFFSET) current = w.weekNo;
            }
            // 실제로 스크롤 가능한 페이지에서만, 바닥에 닿으면 마지막 주차를 활성화한다
            // (짧은 마지막 섹션 보정). 내용이 한 화면에 다 들어오면 보정하지 않는다.
            const doc = document.documentElement;
            const maxScroll = doc.scrollHeight - doc.clientHeight;
            if (maxScroll > 4 && window.scrollY >= maxScroll - 4) {
                current = weeks[weeks.length - 1].weekNo;
            }
            setActiveNo(current);
        }

        syncActive(); // 최초 진입 시 현재 위치를 즉시 반영.
        window.addEventListener("scroll", syncActive, { passive: true });
        window.addEventListener("resize", syncActive);
        return () => {
            window.removeEventListener("scroll", syncActive);
            window.removeEventListener("resize", syncActive);
        };
    }, [weeks]);

    // 칩을 누르면 해당 주차 섹션으로 부드럽게 스크롤하고 즉시 활성 표시한다.
    function jumpTo(weekNo: number) {
        const el = document.getElementById(weekAnchorId(weekNo));
        if (!el) return;
        setActiveNo(weekNo);
        // 고정 헤더+칩 줄을 피해 섹션 제목이 바로 아래에 오도록 목표 위치를 잡는다.
        const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET);
        smoothScrollTo(target);
    }

    // 이동할 주차가 2개 미만이면 내비게이션을 숨긴다.
    if (weeks.length < 2) return null;

    return (
        <nav
            aria-label="주차 바로가기"
            className="sticky top-16 z-30 -mx-4 mb-2 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6"
        >
            <div className="flex items-center gap-2">
                <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                    <ListChecks className="size-3.5" />
                    주차 이동
                </span>
                <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {weeks.map((week) => {
                        const active = week.weekNo === activeNo;
                        return (
                            <button
                                key={week.id}
                                type="button"
                                onClick={() => jumpTo(week.weekNo)}
                                aria-current={active ? "true" : undefined}
                                className={cn(
                                    "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                    active
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                                )}
                            >
                                {week.weekNo}주차
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
