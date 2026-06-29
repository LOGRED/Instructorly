/**
 * 게시물 편집 페이지 — 강좌 내 게시물 제목과 블록 본문을 수정하는 클라이언트 컴포넌트.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { Post } from "@/lib/types";
import { getPost, savePost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { BlockDocEditor } from "@/components/blocks/block-doc-editor";

// PostEditPage — 게시물을 불러와 제목과 본문을 편집하고 저장한다.
export default function PostEditPage() {
    const params = useParams<{ id: string }>();
    const id = params.id;

    const [post, setPost] = useState<Post | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        getPost(id)
            .then((p) => active && setPost(p))
            .catch((e: unknown) =>
                active && setError(e instanceof Error ? e.message : "불러오기 실패"),
            );
        return () => {
            active = false;
        };
    }, [id]);

    // save — 현재 게시물 상태를 서버에 저장한다.
    const save = useCallback(async () => {
        if (!post) return;
        setSaving(true);
        try {
            const saved = await savePost(post);
            setPost(saved);
            setDirty(false);
            toast.success("게시물을 저장했어요.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }, [post]);

    // Cmd/Ctrl+S to save
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void save();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [save]);

    // beforeunload dirty guard
    useEffect(() => {
        function onBeforeUnload(e: BeforeUnloadEvent) {
            if (dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

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

    return (
        <div className="flex min-h-screen flex-col">
            {/* Sticky header */}
            <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    render={<Link href={`/programs/${post.programId}`} aria-label="강좌로 돌아가기" />}
                                />
                            }
                        >
                            <ArrowLeft className="size-5" />
                        </TooltipTrigger>
                        <TooltipContent>강좌로 돌아가기</TooltipContent>
                    </Tooltip>

                    <Input
                        value={post.title}
                        onChange={(e) => {
                            setPost((p) => (p ? { ...p, title: e.target.value } : p));
                            setDirty(true);
                        }}
                        className="h-9 max-w-xs border-transparent bg-transparent text-lg font-bold hover:border-input focus-visible:border-ring"
                        aria-label="게시물 제목"
                    />

                    {dirty && <span className="eyebrow text-warning">● 변경됨</span>}

                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            variant="outline"
                            render={
                                <Link
                                    href={`/posts/${post.id}?program=${post.programId}`}
                                    aria-label="게시물 미리보기"
                                />
                            }
                        >
                            <Eye className="size-4" /> 미리보기
                        </Button>
                        <Button onClick={save} disabled={saving}>
                            <Save className="size-4" /> {saving ? "저장 중..." : "저장"}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Editor body */}
            <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10">
                <BlockDocEditor
                    blocks={post.blocks}
                    onChange={(blocks) => {
                        setPost((p) => (p ? { ...p, blocks } : p));
                        setDirty(true);
                    }}
                />
            </main>
        </div>
    );
}
