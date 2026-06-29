/**
 * 공지사항 상세 페이지 — 강좌 내 공지사항 본문을 표시하는 클라이언트 컴포넌트.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, User } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { getAnnouncement } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { BlockDocView } from "@/components/blocks/block-doc-view";
import { TocSidebar } from "@/components/toc/toc-sidebar";
import { TITLE_DOM_ID } from "@/lib/toc";

// AnnouncementPageInner — 공지사항 데이터를 불러와 본문을 렌더링한다.
function AnnouncementPageInner() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const searchParams = useSearchParams();
    const programId = searchParams.get("program");

    const role = useIdentity((s) => s.role);

    const [item, setItem] = useState<Announcement | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        getAnnouncement(id)
            .then((a) => active && setItem(a))
            .catch((e: unknown) =>
                active && setError(e instanceof Error ? e.message : "불러오기 실패"),
            );
        return () => {
            active = false;
        };
    }, [id]);

    if (error) {
        return (
            <div className="grid min-h-[calc(100vh-4rem)] place-items-center p-6 text-center">
                <div className="space-y-4">
                    <p className="text-lg font-medium">공지사항을 불러오지 못했어요</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button render={<Link href={programId ? `/programs/${programId}` : "/programs"} />}>
                        강좌로 돌아가기
                    </Button>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="grid min-h-[calc(100vh-4rem)] place-items-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const backHref = `/programs/${item.programId}`;

    return (
        <main className="relative mx-auto max-w-3xl px-4 sm:px-6 py-10">
            {/* 목차 — 본문 왼쪽 가장자리에 앵커(레이아웃 차지 안 함) */}
            <TocSidebar blocks={item.blocks} title={item.title} />

            <Button
                variant="ghost"
                size="sm"
                className="-ml-2 mb-6"
                render={<Link href={backHref} aria-label="강좌로 돌아가기" />}
            >
                <ArrowLeft className="size-4" /> 강좌로
            </Button>

            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="eyebrow">공지사항</span>
                <span className="eyebrow text-muted-foreground inline-flex items-center gap-1">
                    <User className="size-3" />
                    {item.authorName}
                </span>
                <span className="eyebrow text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                </span>
            </div>

            <div className="mb-8 flex items-start justify-between gap-4">
                <h1 id={TITLE_DOM_ID} className="scroll-mt-24 text-3xl font-bold leading-tight">{item.title}</h1>
                {role === "instructor" && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        render={<Link href={`/announcements/${item.id}/edit`} aria-label="공지사항 편집" />}
                    >
                        <Pencil className="size-4" /> 편집
                    </Button>
                )}
            </div>

            <BlockDocView blocks={item.blocks} />
        </main>
    );
}

// AnnouncementPage — Suspense 경계와 SiteHeader를 최상위에서 한 번만 렌더링한다.
export default function AnnouncementPage() {
    return (
        <>
            <SiteHeader />
            <Suspense
                fallback={
                    <div className="grid min-h-[calc(100vh-4rem)] place-items-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                }
            >
                <AnnouncementPageInner />
            </Suspense>
        </>
    );
}
