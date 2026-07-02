/**
 * 사용 설명서 공통 껍데기 — 상단바와 '왼쪽 목차' 사이드바, 본문을 함께 배치한다.
 * (이 앱은 중첩 layout을 쓰지 않으므로, 라우트 layout 대신 각 페이지가 이 컴포넌트로 감싼다.)
 * 작은 화면에서는 사이드바와 본문이 위아래로 쌓이고, 큰 화면에서는 사이드바가 왼쪽에 고정된다.
 */
"use client";

import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { GuideSidebar } from "./guide-sidebar";

// 상단바 + 사이드바 + 본문을 한 화면으로 그린다.
export function GuideShell({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-full flex-col">
            <SiteHeader />
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:gap-10 lg:py-10">
                <GuideSidebar />
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
