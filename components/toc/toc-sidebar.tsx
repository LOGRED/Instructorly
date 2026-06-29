/**
 * 목차 사이드바 — 본문은 그대로 두고(레이아웃을 나누지 않음) 본문 컨테이너의 "왼쪽 가장자리"에
 * CSS로 앵커되어 떠 있는 목차. `absolute right-full` 로 본문 바로 왼쪽 여백에 붙으므로 구조상
 * 본문과 절대 겹치지 않는다. shadcn 문서의 "On This Page" 처럼 카드 없이 텍스트 목록만 두며,
 * 스크롤 시 sticky 로 따라온다(글·공지=window, 강의=#lecture-scroll). 왼쪽 여백이 부족하면
 * 좌하단 버튼 → 시트로 대체한다.
 *
 * 사용 조건: 부모(본문 컨테이너)에 `relative` 가 있어야 하고, 이 컴포넌트를 그 안에 둔다.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { List } from "lucide-react";

import type { Block } from "@/lib/types";
import { cn } from "@/lib/utils";
import { extractToc } from "@/lib/toc";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { TocList } from "./toc-list";
import { TocProgress } from "./toc-progress";
import { useActiveHeading } from "./use-active-heading";

// 제목+블록으로 목차를 만들어 본문 왼쪽 여백에 앵커된 목록 + (여백 부족 시) 시트로 렌더한다.
export function TocSidebar({
    blocks,
    title,
    scrollRootId,
    className,
}: {
    blocks: Block[];
    /** 문서/페이지 제목(H1) — 목차 맨 앞에 포함한다. */
    title?: string;
    /** 내부 스크롤 컨테이너 id(강의 = "lecture-scroll"). 없으면 window 스크롤을 추적. */
    scrollRootId?: string;
    className?: string;
}) {
    const items = useMemo(() => extractToc(blocks, title), [blocks, title]);
    const ids = useMemo(() => items.map((i) => i.id), [items]);
    const { activeId, progress } = useActiveHeading(ids, scrollRootId);
    const [open, setOpen] = useState(false);
    // 본문 왼쪽 여백이 목차를 둘 만큼 넓은가. true=목록, false=버튼, undefined=측정 전.
    const [hasRoom, setHasRoom] = useState<boolean | undefined>(undefined);

    // 본문(첫 목차 대상)의 왼쪽 위치만 재서 "여백 충분 여부"를 판단한다(위치는 CSS가 잡으므로 정확).
    useEffect(() => {
        if (ids.length === 0) {
            setHasRoom(undefined);
            return;
        }
        function check() {
            const ref = document.getElementById(ids[0]);
            if (!ref) return;
            // 목차 폭(w-56 + pr-7 = 63 spacing 단위)은 Tailwind --spacing 토큰에 묶여 UI 크기 축을
            // 따른다(글자 크기와 분리). --spacing 실측치로 필요한 여백을 환산해 두 축 변경에 모두 대응한다.
            const probe = document.createElement("div");
            probe.style.cssText = "position:absolute;visibility:hidden;width:var(--spacing)";
            document.body.appendChild(probe);
            const spacingPx = probe.getBoundingClientRect().width || 4;
            probe.remove();
            const needed = 63 * spacingPx + 8; // 목차 폭(w-56 + pr-7) + 여유
            setHasRoom(ref.getBoundingClientRect().left >= needed);
        }
        check();
        window.addEventListener("resize", check, { passive: true });
        window.addEventListener("scroll", check, true);
        window.addEventListener("transitionend", check); // 채팅 패널 폭 전환 등
        let ro: ResizeObserver | undefined;
        const rootEl = scrollRootId ? document.getElementById(scrollRootId) : document.body;
        if (rootEl && typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(check);
            ro.observe(rootEl);
        }
        const settle = setTimeout(check, 350); // 마운트 직후 늦은 레이아웃 보정
        // 글자 크기·UI 크기(data-font-scale / data-ui-scale) 변경 시 카드/버튼을 다시 판단한다.
        const mo = new MutationObserver(check);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-font-scale", "data-ui-scale"] });
        return () => {
            window.removeEventListener("resize", check);
            window.removeEventListener("scroll", check, true);
            window.removeEventListener("transitionend", check);
            clearTimeout(settle);
            ro?.disconnect();
            mo.disconnect();
        };
    }, [ids.join("|"), scrollRootId]);

    // 항목이 2개 미만이면 목차가 의미 없으므로 렌더하지 않는다.
    if (items.length < 2) return null;

    // 해당 헤딩으로 부드럽게 스크롤하고, 시트는 닫는다.
    const jump = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        setOpen(false);
    };

    return (
        <>
            {/* 본문 왼쪽 가장자리에 앵커(absolute right-full) — 구조상 본문과 겹치지 않음. 카드 없이 텍스트만 */}
            {hasRoom && (
                <nav
                    aria-label="목차"
                    className={cn("absolute top-0 right-full z-20 hidden h-full pr-7 lg:block", className)}
                >
                    <div className="sticky top-24 max-h-[calc(100vh-7rem)] w-56 overflow-y-auto">
                        <TocProgress progress={progress} />
                        <TocList items={items} activeId={activeId} onJump={jump} />
                    </div>
                </nav>
            )}

            {/* 여백이 부족하면 좌하단 버튼 → 시트 */}
            {hasRoom === false && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger
                        render={
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="목차 열기"
                                className="fixed bottom-6 left-6 z-40 size-12 rounded-full bg-background/90 shadow-lg backdrop-blur"
                            >
                                <List className="size-5" />
                            </Button>
                        }
                    />
                    <SheetContent side="left" className="w-80 max-w-[85vw] sm:max-w-xs">
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-1.5">
                                <List className="size-4" /> 목차
                            </SheetTitle>
                        </SheetHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                            <TocProgress progress={progress} />
                            <TocList items={items} activeId={activeId} onJump={jump} />
                        </div>
                    </SheetContent>
                </Sheet>
            )}
        </>
    );
}
