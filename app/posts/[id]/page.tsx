/**
 * 게시물 상세 페이지 — 강좌 내 게시물 본문과 댓글을 표시하는 클라이언트 컴포넌트.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Pencil, User } from "lucide-react";
import { toast } from "sonner";

import type { Post } from "@/lib/types";
import { getPost } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BlockDocView } from "@/components/blocks/block-doc-view";
import { PostComments } from "@/components/post-comments";
import { TocSidebar } from "@/components/toc/toc-sidebar";
import { TITLE_DOM_ID } from "@/lib/toc";

function PostPageInner() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const searchParams = useSearchParams();
    const programIdParam = searchParams.get("program");

    const role = useIdentity((s) => s.role);

    const [post, setPost] = useState<Post | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        getPost(id)
            .then((p) => active && setPost(p))
            .catch((e: unknown) => {
                if (active) {
                    const msg = e instanceof Error ? e.message : "불러오기 실패";
                    setError(msg);
                    toast.error(msg);
                }
            });
        return () => {
            active = false;
        };
    }, [id]);

    if (error) {
        return (
            <div className="grid min-h-screen place-items-center p-6 text-center">
                <div className="space-y-4">
                    <p className="text-lg font-medium">게시물을 불러오지 못했어요</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button render={<Link href="/programs" />}>강좌로 돌아가기</Button>
                </div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="grid min-h-screen place-items-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const backHref = post.programId
        ? `/programs/${post.programId}`
        : (programIdParam ? `/programs/${programIdParam}` : "/programs");

    return (
        <main className="relative mx-auto max-w-3xl px-4 sm:px-6 py-10">
            {/* 목차 — 본문 왼쪽 가장자리에 앵커(레이아웃 차지 안 함) */}
            <TocSidebar blocks={post.blocks} title={post.title} />

            {/* Back link */}
            <Button
                variant="ghost"
                size="sm"
                render={<Link href={backHref} aria-label="강좌로 돌아가기" />}
                className="-ml-2 mb-6"
            >
                <ArrowLeft className="size-4" /> 강좌로
            </Button>

            {/* Eyebrow */}
            <div className="mb-2 flex items-center gap-2">
                <span className="eyebrow inline-flex items-center gap-1">
                    <User className="size-3" />
                    {post.authorName}
                </span>
                <span className="eyebrow text-muted-foreground">
                    ·{" "}
                    {new Date(post.updatedAt).toLocaleDateString("ko-KR")}
                </span>
            </div>

            {/* Title + optional edit button */}
            <div className="mb-8 flex items-start justify-between gap-4">
                <h1 id={TITLE_DOM_ID} className="scroll-mt-24 text-3xl font-bold leading-tight">{post.title}</h1>
                {role === "instructor" && (
                    <Button
                        variant="outline"
                        size="sm"
                        render={
                            <Link
                                href={`/posts/${post.id}/edit`}
                                aria-label="게시물 편집"
                            />
                        }
                        className="shrink-0 mt-1"
                    >
                        <Pencil className="size-4" /> 편집
                    </Button>
                )}
            </div>

            {/* Block document */}
            <BlockDocView blocks={post.blocks} />

            <Separator className="my-10" />

            {/* Comments */}
            <PostComments postId={post.id} />
        </main>
    );
}

export default function PostPage() {
    return (
        <>
            <SiteHeader />
            <Suspense
                fallback={
                    <div className="grid min-h-screen place-items-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                }
            >
                <PostPageInner />
            </Suspense>
        </>
    );
}
