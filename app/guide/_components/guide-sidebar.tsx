/**
 * 왼쪽 목차(차례) 사이드바 — 지금 로그인한 역할(강사/학생)의 설명 항목만 보여 준다.
 * 학생에게는 강사용 항목이 보이지 않는다. 작은 화면에서는 '차례 펼치기'를 눌러 연다.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid } from "lucide-react";

import { useIdentity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { guideForRole, roleGuideLabel } from "./guide-data";

// 목록 항목 스타일을 만든다(선택된 항목은 또렷하게 강조).
function itemClass(active: boolean): string {
    return cn(
        "block rounded-xl px-4 py-3 text-base font-medium leading-snug transition-colors",
        active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-muted",
    );
}

// 왼쪽 목차 사이드바를 그린다.
export function GuideSidebar() {
    const role = useIdentity((s) => s.role);
    const hydrated = useIdentity((s) => s.hydrated);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // 하이드레이션 전에는 역할이 확정되지 않아 자리만 잡아 둔다(잘못된 역할 깜빡임 방지).
    if (!hydrated) {
        return (
            <aside className="w-full lg:w-72 lg:shrink-0">
                <div className="rounded-2xl border bg-card p-4">
                    <div className="h-6 w-24 animate-pulse rounded bg-muted" />
                    <div className="mt-4 space-y-2">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                        ))}
                    </div>
                </div>
            </aside>
        );
    }

    const guide = guideForRole(role);
    const isOverview = pathname === "/guide";

    return (
        <aside className="w-full lg:sticky lg:top-20 lg:w-72 lg:shrink-0">
            <div className="rounded-2xl border bg-card p-4">
                {/* 머리 — '차례' + 역할 배지 */}
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                    <span className="text-lg font-bold text-foreground">차례</span>
                    <Badge variant={role === "instructor" ? "default" : "secondary"}>
                        {roleGuideLabel(role)} 설명서
                    </Badge>
                </div>

                {/* 작은 화면용 펼치기 단추 */}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    className="mb-2 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-base font-semibold lg:hidden"
                >
                    {open ? "차례 접기" : "차례 펼치기"}
                    <ChevronDown
                        className={cn("size-5 transition-transform", open && "rotate-180")}
                    />
                </button>

                {/* 목록 — 큰 화면에서는 항상 보이고, 작은 화면에서는 펼칠 때만 보인다 */}
                <nav
                    aria-label="사용 설명서 차례"
                    className={cn("space-y-1", open ? "block" : "hidden", "lg:block")}
                >
                    <Link
                        href="/guide"
                        className={cn(itemClass(isOverview), "flex items-center gap-2")}
                    >
                        <LayoutGrid className="size-4 shrink-0" />
                        전체 흐름 보기
                    </Link>

                    <div className="my-2 h-px bg-border" />

                    {guide.sections.map((s) => (
                        <Link
                            key={s.id}
                            href={`/guide/${s.id}`}
                            className={itemClass(pathname === `/guide/${s.id}`)}
                        >
                            {s.title}
                        </Link>
                    ))}
                </nav>
            </div>
        </aside>
    );
}
